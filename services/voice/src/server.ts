import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { createCallStore } from "./call-store";
import { createConversationRelayHandler } from "./conversation-relay";
import { createElevenLabsPreview } from "./elevenlabs";
import { createGuestConfirmationService } from "./guest-confirmation-service";
import { getVoiceServiceReadiness, loadEnv, type VoiceServiceEnv } from "./env";
import { buildLiveCallConfig } from "./live-call";
import { createMenuIngestionService } from "./menu-ingestion-service";
import { createStaffNotificationService } from "./notification-service";
import { createPhoneNumberStore } from "./phone-number-store";
import { createRestaurantContextStore } from "./restaurant-context-store";
import { createTelephonyService } from "./telephony";
import { demoRestaurantContext } from "./restaurant-context";
import { generateRestaurantReply } from "./restaurant-agent";
import { validateTwilioSignature } from "./twilio-signature";
import { buildConversationRelayTwiML, buildUnavailableTwiML } from "./twiml";

const env = loadEnv();
const callStore = createCallStore(env);
const phoneNumberStore = createPhoneNumberStore(env);
const restaurantContextStore = createRestaurantContextStore(env);
const telephonyService = createTelephonyService(env);
const staffNotificationService = createStaffNotificationService(env);
const guestConfirmationService = createGuestConfirmationService(env);
const menuIngestionService = createMenuIngestionService(env);
const server = createServer((req, res) => {
  void handleRequest(req, res, env);
});

const wss = new WebSocketServer({ noServer: true });
const handleConversationRelayConnection = createConversationRelayHandler(
  env,
  callStore,
  restaurantContextStore,
  staffNotificationService,
  guestConfirmationService,
);

server.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path !== "/twilio/conversation-relay") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  if (!isValidTwilioUpgrade(req, env)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConversationRelayConnection(ws, req);
  });
});

server.listen(env.PORT, () => {
  console.info(`[voice-service] listening on http://localhost:${env.PORT}`);
});

async function handleRequest(req: IncomingMessage, res: ServerResponse, currentEnv: VoiceServiceEnv) {
  const url = new URL(req.url ?? "/", "http://localhost");
  applyCors(req, res, currentEnv);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const readiness = getVoiceServiceReadiness(currentEnv);
    sendJson(res, 200, {
      ok: true,
      service: "hostline-voice",
      productionReady: readiness.productionReady,
      readinessChecks: readiness.checks,
      openaiConfigured: Boolean(currentEnv.OPENAI_API_KEY),
      elevenLabsConfigured: Boolean(currentEnv.ELEVENLABS_API_KEY),
      supabaseConfigured: Boolean(
        currentEnv.SUPABASE_URL &&
          currentEnv.SUPABASE_SECRET_KEY &&
          currentEnv.SUPABASE_DEMO_LOCATION_ID,
      ),
      onboardedContextConfigured: Boolean(
        currentEnv.SUPABASE_URL &&
          currentEnv.SUPABASE_SECRET_KEY &&
          currentEnv.SUPABASE_DEMO_LOCATION_ID,
      ),
      menuIngestionConfigured: menuIngestionService.configured,
      twilioProvisioningConfigured: telephonyService.configured,
      staffAlertsConfigured: staffNotificationService.configured,
      guestConfirmationsConfigured: guestConfirmationService.configured,
      twilioSignatureRequired: currentEnv.REQUIRE_TWILIO_SIGNATURE,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/ready") {
    const readiness = getVoiceServiceReadiness(currentEnv);
    sendJson(res, readiness.productionReady ? 200 : 503, {
      ok: readiness.productionReady,
      productionReady: readiness.productionReady,
      readinessChecks: readiness.checks,
      service: "hostline-voice",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/live-call-config") {
    if (!isAuthorizedInternalRequest(req, currentEnv)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const liveCallConfig = buildLiveCallConfig(currentEnv, url.searchParams.get("locationId") ?? undefined);
    sendJson(res, liveCallConfig.ready ? 200 : 503, liveCallConfig);
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/twiml-preview") {
    if (!isAuthorizedInternalRequest(req, currentEnv)) {
      sendText(res, 401, "Unauthorized");
      return;
    }

    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID ?? "demo-location";
    const liveCallConfig = buildLiveCallConfig(currentEnv, locationId);
    if (!liveCallConfig.conversationRelayUrl) {
      sendXml(res, 503, buildUnavailableTwiML("HostLine AI needs PUBLIC_WS_BASE_URL before live calls."));
      return;
    }

    const restaurantContext = await restaurantContextStore.getContext(locationId);
    const twiml = buildConversationRelayTwiML({
      actionUrl: liveCallConfig.actionUrl,
      customParameters: { locationId },
      language: currentEnv.TWILIO_LANGUAGE,
      transcriptionProvider: currentEnv.TWILIO_TRANSCRIPTION_PROVIDER,
      ttsProvider: currentEnv.TWILIO_TTS_PROVIDER,
      ttsVoice: currentEnv.TWILIO_TTS_VOICE,
      websocketUrl: liveCallConfig.conversationRelayUrl,
      welcomeGreeting: restaurantContext.greeting,
    });

    sendXml(res, 200, twiml);
    return;
  }

  if (req.method === "POST" && url.pathname === "/ingestion/run-next") {
    if (!isAuthorizedInternalRequest(req, currentEnv)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const body = parseJsonBody(await readRequestBody(req)) as { jobId?: string; locationId?: string };
      const result = await menuIngestionService.runNext({
        jobId: body.jobId,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Menu ingestion failed" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/telephony/available-numbers") {
    if (!isAuthorizedInternalRequest(req, currentEnv)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const numbers = await telephonyService.searchAvailableNumbers({
        areaCode: url.searchParams.get("areaCode") ?? undefined,
        contains: url.searchParams.get("contains") ?? undefined,
        country: url.searchParams.get("country") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? "5"),
      });
      sendJson(res, 200, { numbers });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Twilio number search failed" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/provision-number") {
    if (!isAuthorizedInternalRequest(req, currentEnv)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const body = JSON.parse(await readRequestBody(req)) as {
        forwardingMode?: string;
        locationId?: string;
        phoneNumber?: string;
        restaurantMainLine?: string;
      };
      if (!body.phoneNumber?.trim()) {
        sendJson(res, 400, { error: "phoneNumber is required" });
        return;
      }

      const input = {
        forwardingMode: body.forwardingMode,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
        phoneNumber: body.phoneNumber.trim(),
        restaurantMainLine: body.restaurantMainLine,
      };
      const provisioned = await telephonyService.provisionPhoneNumber(input);
      await phoneNumberStore.saveProvisionedNumber(input, provisioned);
      sendJson(res, 200, { phoneNumber: provisioned });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Twilio number provisioning failed" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/voice") {
    const rawBody = await readRequestBody(req);
    const params = Object.fromEntries(new URLSearchParams(rawBody));

    if (!isValidTwilioWebhook(req, currentEnv, params)) {
      sendText(res, 401, "Invalid Twilio signature");
      return;
    }

    if (!currentEnv.PUBLIC_WS_BASE_URL) {
      sendXml(res, 503, buildUnavailableTwiML());
      return;
    }

    const locationId =
      params.locationId ??
      url.searchParams.get("locationId") ??
      currentEnv.SUPABASE_DEMO_LOCATION_ID ??
      "demo-location";
    const restaurantContext = await restaurantContextStore.getContext(locationId);
    const liveCallConfig = buildLiveCallConfig(currentEnv, locationId);
    const twiml = buildConversationRelayTwiML({
      actionUrl: liveCallConfig.actionUrl,
      customParameters: {
        locationId,
      },
      language: currentEnv.TWILIO_LANGUAGE,
      transcriptionProvider: currentEnv.TWILIO_TRANSCRIPTION_PROVIDER,
      ttsProvider: currentEnv.TWILIO_TTS_PROVIDER,
      ttsVoice: currentEnv.TWILIO_TTS_VOICE,
      websocketUrl: liveCallConfig.conversationRelayUrl ?? `${currentEnv.PUBLIC_WS_BASE_URL}/twilio/conversation-relay`,
      welcomeGreeting: restaurantContext.greeting,
    });

    sendXml(res, 200, twiml);
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/conversation-ended") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/voice/preview") {
    try {
      const body = JSON.parse(await readRequestBody(req)) as { text?: string };
      const text = body.text?.trim() || demoRestaurantContext.greeting;
      const preview = await createElevenLabsPreview({ env: currentEnv, text });

      res.writeHead(200, {
        "Content-Type": preview.contentType,
        "Cache-Control": "no-store",
      });
      res.end(preview.audio);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Voice preview failed",
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/debug/reply" && currentEnv.NODE_ENV !== "production") {
    const body = JSON.parse(await readRequestBody(req)) as { locationId?: string; prompt?: string };
    const restaurantContext = await restaurantContextStore.getContext(body.locationId);
    const reply = await generateRestaurantReply({
      callerUtterance: body.prompt ?? "",
      context: restaurantContext,
      env: currentEnv,
      transcript: [],
    });
    sendJson(res, 200, { reply });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function isValidTwilioWebhook(req: IncomingMessage, currentEnv: VoiceServiceEnv, params: Record<string, string>) {
  if (!currentEnv.REQUIRE_TWILIO_SIGNATURE) return true;
  if (!currentEnv.TWILIO_AUTH_TOKEN || !currentEnv.PUBLIC_HTTP_BASE_URL) return false;

  return validateTwilioSignature({
    authToken: currentEnv.TWILIO_AUTH_TOKEN,
    expectedSignature: req.headers["x-twilio-signature"],
    params,
    url: `${currentEnv.PUBLIC_HTTP_BASE_URL}${req.url ?? ""}`,
  });
}

function isValidTwilioUpgrade(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  if (!currentEnv.REQUIRE_TWILIO_SIGNATURE) return true;
  if (!currentEnv.TWILIO_AUTH_TOKEN || !currentEnv.PUBLIC_WS_BASE_URL) return false;

  return validateTwilioSignature({
    authToken: currentEnv.TWILIO_AUTH_TOKEN,
    expectedSignature: req.headers["x-twilio-signature"],
    url: `${currentEnv.PUBLIC_WS_BASE_URL}${req.url ?? ""}`,
  });
}

function isAuthorizedInternalRequest(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  if (!currentEnv.HOSTLINE_INTERNAL_API_KEY) {
    return currentEnv.NODE_ENV !== "production";
  }

  return req.headers["x-hostline-api-key"] === currentEnv.HOSTLINE_INTERNAL_API_KEY;
}

async function readRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJsonBody(body: string) {
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendXml(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "application/xml" });
  res.end(body);
}

function sendText(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(body);
}

function applyCors(req: IncomingMessage, res: ServerResponse, currentEnv: VoiceServiceEnv) {
  const origin = req.headers.origin;
  const allowedOrigin = currentEnv.VOICE_SERVICE_ALLOWED_ORIGIN;

  if (allowedOrigin === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigin.split(",").map((item) => item.trim()).includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-hostline-api-key");
}
