import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { createConversationRelayHandler } from "./conversation-relay";
import { createElevenLabsPreview } from "./elevenlabs";
import { loadEnv, type VoiceServiceEnv } from "./env";
import { demoRestaurantContext } from "./restaurant-context";
import { generateRestaurantReply } from "./restaurant-agent";
import { validateTwilioSignature } from "./twilio-signature";
import { buildConversationRelayTwiML, buildUnavailableTwiML } from "./twiml";

const env = loadEnv();
const server = createServer((req, res) => {
  void handleRequest(req, res, env);
});

const wss = new WebSocketServer({ noServer: true });
const handleConversationRelayConnection = createConversationRelayHandler(env);

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
    sendJson(res, 200, {
      ok: true,
      service: "hostline-voice",
      openaiConfigured: Boolean(currentEnv.OPENAI_API_KEY),
      elevenLabsConfigured: Boolean(currentEnv.ELEVENLABS_API_KEY),
      twilioSignatureRequired: currentEnv.REQUIRE_TWILIO_SIGNATURE,
    });
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

    const httpBaseUrl = currentEnv.PUBLIC_HTTP_BASE_URL;
    const twiml = buildConversationRelayTwiML({
      actionUrl: httpBaseUrl ? `${httpBaseUrl}/twilio/conversation-ended` : undefined,
      customParameters: {
        locationId: params.locationId ?? "demo-location",
      },
      language: currentEnv.TWILIO_LANGUAGE,
      transcriptionProvider: currentEnv.TWILIO_TRANSCRIPTION_PROVIDER,
      ttsProvider: currentEnv.TWILIO_TTS_PROVIDER,
      ttsVoice: currentEnv.TWILIO_TTS_VOICE,
      websocketUrl: `${currentEnv.PUBLIC_WS_BASE_URL}/twilio/conversation-relay`,
      welcomeGreeting: demoRestaurantContext.greeting,
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
    const body = JSON.parse(await readRequestBody(req)) as { prompt?: string };
    const reply = await generateRestaurantReply({
      callerUtterance: body.prompt ?? "",
      context: demoRestaurantContext,
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

async function readRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
