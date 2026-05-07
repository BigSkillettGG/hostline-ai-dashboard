import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { authorizeVoiceAdminRequest } from "./admin-auth";
import { createCallStore } from "./call-store";
import { createConversationRelayHandler } from "./conversation-relay";
import { createElevenLabsPreview } from "./elevenlabs";
import { createGuestConfirmationService } from "./guest-confirmation-service";
import { getVoiceServiceReadiness, loadEnv, type VoiceServiceEnv } from "./env";
import { buildLiveCallConfig } from "./live-call";
import {
  checkRateLimit,
  getRequestIp,
  HttpRequestError,
  parseJsonRequestBody,
  readLimitedRequestBody,
} from "./http-safety";
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
const ADMIN_BODY_LIMIT_BYTES = 16 * 1024;
const PREVIEW_BODY_LIMIT_BYTES = 4 * 1024;
const TWILIO_BODY_LIMIT_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const server = createServer((req, res) => {
  void handleRequest(req, res, env);
});

const wss = new WebSocketServer({ noServer: true });
const activeRelaySockets = new Set<WebSocket>();
const activeRelayCompletions = new Set<Promise<void>>();
const handleConversationRelayConnection = createConversationRelayHandler(
  env,
  callStore,
  restaurantContextStore,
  staffNotificationService,
  guestConfirmationService,
  {
    onSessionCompletion: trackRelayCompletion,
  },
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
    activeRelaySockets.add(ws);
    ws.once("close", () => activeRelaySockets.delete(ws));
    handleConversationRelayConnection(ws, req);
  });
});

server.listen(env.PORT, () => {
  console.info(`[voice-service] listening on http://localhost:${env.PORT}`);
});

process.once("SIGTERM", () => void shutdownGracefully("SIGTERM"));
process.once("SIGINT", () => void shutdownGracefully("SIGINT"));

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
    const authorization = await authorizeVoiceAdminRequest({
      currentEnv,
      locationId: url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      req,
    });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const liveCallConfig = buildLiveCallConfig(currentEnv, url.searchParams.get("locationId") ?? undefined);
    sendJson(res, liveCallConfig.ready ? 200 : 503, liveCallConfig);
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/twiml-preview") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID ?? "demo-location";
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendText(res, authorization.status, authorization.reason ?? "Unauthorized");
      return;
    }

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
    if (!allowRateLimitedRequest(req, res, "ingestion", 20)) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        jobId?: string;
        locationId?: string;
      };
      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const result = await menuIngestionService.runNext({
        jobId: body.jobId,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Menu ingestion failed");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/telephony/available-numbers") {
    if (!allowRateLimitedRequest(req, res, "number-search", 45)) return;

    const authorization = await authorizeVoiceAdminRequest({
      currentEnv,
      locationId: url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      req,
    });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
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
    if (!allowRateLimitedRequest(req, res, "number-provision", 10)) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        forwardingMode?: string;
        locationId?: string;
        phoneNumber?: string;
        restaurantMainLine?: string;
      };
      if (!body.phoneNumber?.trim()) {
        sendJson(res, 400, { error: "phoneNumber is required" });
        return;
      }

      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
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
      sendCaughtError(res, error, "Twilio number provisioning failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/voice") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
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
    } catch (error) {
      if (error instanceof HttpRequestError) {
        sendText(res, error.statusCode, error.message);
      } else {
        console.error("[voice-service] Twilio voice webhook failed", error);
        sendXml(res, 500, buildUnavailableTwiML("HostLine AI hit a setup issue. Please try again soon."));
      }
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/conversation-ended") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/voice/preview") {
    if (!allowRateLimitedRequest(req, res, "voice-preview", 20)) return;

    try {
      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId: currentEnv.SUPABASE_DEMO_LOCATION_ID,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const body = parseJsonRequestBody(await readLimitedRequestBody(req, PREVIEW_BODY_LIMIT_BYTES)) as { text?: string };
      const text = body.text?.trim() || demoRestaurantContext.greeting;
      const preview = await createElevenLabsPreview({ env: currentEnv, text });

      res.writeHead(200, {
        "Content-Type": preview.contentType,
        "Cache-Control": "no-store",
      });
      res.end(preview.audio);
    } catch (error) {
      sendCaughtError(res, error, "Voice preview failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/debug/reply" && currentEnv.NODE_ENV !== "production") {
    if (!allowRateLimitedRequest(req, res, "debug-reply", 30)) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        locationId?: string;
        prompt?: string;
      };
      const restaurantContext = await restaurantContextStore.getContext(body.locationId);
      const reply = await generateRestaurantReply({
        callerUtterance: body.prompt ?? "",
        context: restaurantContext,
        env: currentEnv,
        transcript: [],
      });
      sendJson(res, 200, { reply });
    } catch (error) {
      sendCaughtError(res, error, "Debug reply failed");
    }
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

function allowRateLimitedRequest(req: IncomingMessage, res: ServerResponse, action: string, limit: number) {
  const result = checkRateLimit({
    key: `${action}:${getRequestIp(req)}`,
    limit,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (result.allowed) return true;

  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  sendJson(res, 429, {
    error: "Too many requests. Please wait a moment and try again.",
    retryAfterSeconds: result.retryAfterSeconds,
  });
  return false;
}

function sendCaughtError(res: ServerResponse, error: unknown, fallbackMessage: string) {
  if (error instanceof HttpRequestError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }

  console.error("[voice-service] request failed", error);
  sendJson(res, 500, { error: fallbackMessage });
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
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, x-hostline-api-key");
}

async function shutdownGracefully(signal: "SIGINT" | "SIGTERM") {
  console.info("[voice-service] graceful shutdown requested", {
    activeRelayConnections: activeRelaySockets.size,
    signal,
  });

  server.close((error) => {
    if (error) {
      console.error("[voice-service] server close failed", error);
      process.exitCode = 1;
    }
  });

  for (const ws of activeRelaySockets) {
    try {
      ws.close(1001, "HostLine voice service is restarting.");
    } catch (error) {
      console.warn("[voice-service] websocket close failed", error);
    }
  }

  await waitForRelaySocketsToClose(4500);
  await waitForRelayCompletions(4500);
  wss.close();

  for (const ws of activeRelaySockets) {
    try {
      ws.terminate();
    } catch (error) {
      console.warn("[voice-service] websocket terminate failed", error);
    }
  }
}

function trackRelayCompletion(completion: Promise<void>) {
  const tracked = completion.finally(() => activeRelayCompletions.delete(tracked));
  activeRelayCompletions.add(tracked);
}

function waitForRelaySocketsToClose(timeoutMs: number) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (!activeRelaySockets.size || Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

async function waitForRelayCompletions(timeoutMs: number) {
  if (!activeRelayCompletions.size) return;

  await Promise.race([
    Promise.allSettled(Array.from(activeRelayCompletions)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
