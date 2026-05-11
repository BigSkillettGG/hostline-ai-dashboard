import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import WebSocket, { type RawData } from "ws";
import type { VoiceServiceEnv } from "./env";
import { buildRestaurantInstructions } from "./restaurant-agent";
import type { RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";

const OPENAI_REALTIME_DEFAULT_MODEL = "gpt-realtime";
const OPENAI_REALTIME_DEFAULT_FEMALE_VOICE = "marin";
const OPENAI_REALTIME_DEFAULT_MALE_VOICE = "cedar";
const OPENAI_REALTIME_ACCEPT_URL = "https://api.openai.com/v1/realtime/calls";
const OPENAI_REALTIME_WEBSOCKET_URL = "wss://api.openai.com/v1/realtime";

type OpenAIRealtimeEnv = Pick<
  VoiceServiceEnv,
  | "OPENAI_API_KEY"
  | "OPENAI_PROJECT_ID"
  | "OPENAI_REALTIME_FEMALE_VOICE"
  | "OPENAI_REALTIME_MALE_VOICE"
  | "OPENAI_REALTIME_MODEL"
  | "OPENAI_REALTIME_VOICE"
  | "OPENAI_WEBHOOK_SECRET"
  | "PUBLIC_HTTP_BASE_URL"
  | "SUPABASE_DEMO_LOCATION_ID"
>;

interface OpenAIRealtimeSipServiceOptions {
  fetchImpl?: typeof fetch;
  websocketFactory?: (url: string, options: { headers: Record<string, string> }) => RealtimeSocket;
}

interface RealtimeSocket {
  close(code?: number, reason?: Buffer | string): void;
  on(event: "close", listener: (code: number, reason: Buffer) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "message", listener: (data: RawData) => void): this;
  on(event: "open", listener: () => void): this;
  send(data: string): void;
  terminate?: () => void;
}

export interface OpenAIRealtimeLiveCallConfig {
  model: string;
  projectIdConfigured: boolean;
  ready: boolean;
  sipUri?: string;
  voice: string;
  webhookSecretConfigured: boolean;
  webhookUrl?: string;
}

export interface OpenAIRealtimeWebhookResult {
  body: unknown;
  status: number;
}

interface OpenAIRealtimeIncomingEvent {
  data?: {
    call?: {
      id?: unknown;
    };
    call_id?: unknown;
    location_id?: unknown;
    metadata?: {
      locationId?: unknown;
      location_id?: unknown;
    };
    sip_headers?: Array<{ name?: unknown; value?: unknown }>;
  };
  id?: unknown;
  object?: unknown;
  type?: unknown;
}

interface OpenAIRealtimeToolCall {
  arguments: Record<string, unknown>;
  callId: string;
  name: string;
}

interface BuildOpenAIRealtimeAcceptPayloadInput {
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
}

interface OpenAIRealtimeAcceptPayload {
  audio: {
    input: {
      noise_reduction: { type: "near_field" };
      transcription: {
        language: "en";
        model: "gpt-4o-mini-transcribe";
        prompt: string;
      };
      turn_detection: {
        create_response: true;
        eagerness: "medium";
        interrupt_response: true;
        type: "semantic_vad";
      };
    };
    output: {
      speed: number;
      voice: string;
    };
  };
  instructions: string;
  max_output_tokens: number;
  model: string;
  output_modalities: ["audio"];
  tool_choice: "auto";
  tools: Array<{
    description: string;
    name: string;
    parameters: Record<string, unknown>;
    type: "function";
  }>;
  type: "realtime";
}

export function createOpenAIRealtimeSipService(
  env: OpenAIRealtimeEnv,
  restaurantContextStore: RestaurantContextStore,
  options: OpenAIRealtimeSipServiceOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const websocketFactory =
    options.websocketFactory ??
    ((url: string, socketOptions: { headers: Record<string, string> }) => new WebSocket(url, socketOptions));
  const activeSockets = new Map<string, RealtimeSocket>();

  return {
    get configured() {
      return Boolean(env.OPENAI_API_KEY && env.PUBLIC_HTTP_BASE_URL);
    },

    closeAll() {
      for (const [callId, socket] of activeSockets) {
        try {
          socket.close(1001, "HostLine voice service is restarting.");
        } catch (error) {
          console.warn("[openai-realtime] websocket close failed", { callId, error });
        }
      }
      activeSockets.clear();
    },

    getLiveCallConfig(locationId?: string): OpenAIRealtimeLiveCallConfig {
      return buildOpenAIRealtimeLiveCallConfig(env, locationId);
    },

    async handleIncomingWebhook({
      headers,
      locationId,
      rawBody,
    }: {
      headers: IncomingHttpHeaders;
      locationId?: string;
      rawBody: string;
    }): Promise<OpenAIRealtimeWebhookResult> {
      if (!env.OPENAI_API_KEY) {
        return { body: { error: "OPENAI_API_KEY is required before OpenAI Realtime calls can be accepted." }, status: 503 };
      }

      if (env.OPENAI_WEBHOOK_SECRET && !verifyOpenAIWebhookSignature({ headers, rawBody, secret: env.OPENAI_WEBHOOK_SECRET })) {
        return { body: { error: "Invalid OpenAI webhook signature" }, status: 401 };
      }

      const event = parseOpenAIRealtimeEvent(rawBody);
      if (event.type !== "realtime.call.incoming") {
        return { body: { ignored: true, type: event.type ?? "unknown" }, status: 200 };
      }

      const callId = extractOpenAIRealtimeCallId(event);
      if (!callId) {
        return { body: { error: "OpenAI realtime webhook did not include data.call_id." }, status: 400 };
      }

      const resolvedLocationId =
        locationId ??
        extractLocationId(event) ??
        env.SUPABASE_DEMO_LOCATION_ID ??
        "demo-location";
      const context = await restaurantContextStore.getContext(resolvedLocationId);
      const payload = buildOpenAIRealtimeAcceptPayload({ context, env });

      await acceptOpenAIRealtimeCall({
        callId,
        env,
        fetchImpl,
        payload,
      });

      startSidebandSocket({
        activeSockets,
        callId,
        context,
        env,
        locationId: resolvedLocationId,
        websocketFactory,
      });

      return {
        body: {
          accepted: true,
          callId,
          locationId: resolvedLocationId,
          model: payload.model,
          voice: payload.audio.output.voice,
        },
        status: 200,
      };
    },
  };
}

export function buildOpenAIRealtimeLiveCallConfig(env: OpenAIRealtimeEnv, locationId?: string): OpenAIRealtimeLiveCallConfig {
  const webhookUrl = env.PUBLIC_HTTP_BASE_URL
    ? withOptionalQueryParam(`${env.PUBLIC_HTTP_BASE_URL.replace(/\/$/, "")}/openai/realtime/webhook`, "locationId", locationId)
    : undefined;
  const model = resolveOpenAIRealtimeModel(env);
  const voice = env.OPENAI_REALTIME_VOICE?.trim() || env.OPENAI_REALTIME_FEMALE_VOICE?.trim() || OPENAI_REALTIME_DEFAULT_FEMALE_VOICE;

  return {
    model,
    projectIdConfigured: Boolean(env.OPENAI_PROJECT_ID),
    ready: Boolean(env.OPENAI_API_KEY && webhookUrl),
    sipUri: env.OPENAI_PROJECT_ID ? `sip:${env.OPENAI_PROJECT_ID}@sip.api.openai.com;transport=tls` : undefined,
    voice,
    webhookSecretConfigured: Boolean(env.OPENAI_WEBHOOK_SECRET),
    webhookUrl,
  };
}

export function buildOpenAIRealtimeAcceptPayload({
  context,
  env,
}: BuildOpenAIRealtimeAcceptPayloadInput): OpenAIRealtimeAcceptPayload {
  const voice = resolveOpenAIRealtimeVoice(env, context);

  return {
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          language: "en",
          model: "gpt-4o-mini-transcribe",
          prompt: [
            `This is a phone call with ${context.restaurantName}, a restaurant.`,
            "Expect restaurant words: reservations, pickup orders, specials, parking, allergies, delivery drivers, hours, waitlist.",
            `Menu terms include: ${context.menuHighlights.slice(0, 16).join(", ")}.`,
          ].join(" "),
        },
        turn_detection: {
          create_response: true,
          eagerness: "medium",
          interrupt_response: true,
          type: "semantic_vad",
        },
      },
      output: {
        speed: 1,
        voice,
      },
    },
    instructions: buildOpenAIRealtimeInstructions(context),
    max_output_tokens: 280,
    model: resolveOpenAIRealtimeModel(env),
    output_modalities: ["audio"],
    tool_choice: "auto",
    tools: buildOpenAIRealtimeTools(),
    type: "realtime",
  };
}

export function buildOpenAIRealtimeInstructions(context: RestaurantVoiceContext) {
  return [
    buildRestaurantInstructions(context),
    "Realtime phone behavior:",
    "This is one continuous live phone call. Never restart the opening greeting in the middle of the call.",
    "Say the opening greeting only once, when the call begins.",
    "Use natural restaurant-host pacing. Short acknowledgements like 'Sure', 'Absolutely', 'One moment', and 'Let me check that' are okay when they fit.",
    "If the caller pauses, wait naturally. If silence continues, ask a gentle continuation question such as 'Take your time. What else can I help you with?'",
    "Handle interruptions gracefully. If the caller cuts you off, stop and answer their latest request.",
    "Use the lookup_restaurant_context tool for specials, hours, parking, directions, menu, reservation policy, pickup timing, payment, allergies, delivery drivers, lost items, complaints, or anything policy-like.",
    "When a tool returns information, answer in one warm sentence and then ask a natural next question only if the call is not clearly over.",
    "For reservation requests, acknowledge any date, time, or party size already spoken, then ask only for missing details.",
    "For pickup orders, collect items, quantities, name, and callback number. Payment is pay at pickup unless a POS integration says otherwise.",
    "Close naturally only after the caller is done. Say a short goodbye and do not ask another question after goodbye.",
  ].join("\n");
}

export function extractOpenAIRealtimeCallId(event: OpenAIRealtimeIncomingEvent) {
  return stringValue(event.data?.call_id) ?? stringValue(event.data?.call?.id);
}

export function extractOpenAIRealtimeToolCalls(event: unknown): OpenAIRealtimeToolCall[] {
  if (!event || typeof event !== "object") return [];
  const candidate = event as {
    response?: {
      output?: unknown[];
    };
    type?: unknown;
  };
  if (candidate.type !== "response.done" || !Array.isArray(candidate.response?.output)) return [];

  return candidate.response.output
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const output = item as { arguments?: unknown; call_id?: unknown; name?: unknown; type?: unknown };
      if (output.type !== "function_call") return null;
      const callId = stringValue(output.call_id);
      const name = stringValue(output.name);
      if (!callId || !name) return null;

      return {
        arguments: parseObjectArguments(output.arguments),
        callId,
        name,
      };
    })
    .filter((item): item is OpenAIRealtimeToolCall => Boolean(item));
}

export function lookupRestaurantContext(context: RestaurantVoiceContext, rawTopic: unknown) {
  const topic = String(rawTopic ?? "").toLowerCase();
  const policyMatches = Object.entries(context.policies)
    .filter(([key]) => !topic || key.toLowerCase().includes(topic) || topic.includes(key.toLowerCase()))
    .slice(0, 4);
  const faqMatches = context.faqs
    .filter((faq) => textMatchesTopic(`${faq.question} ${faq.answer}`, topic))
    .slice(0, 4);
  const knowledgeMatches = context.knowledgeSections
    .filter((section) => textMatchesTopic(`${section.title} ${section.body}`, topic))
    .slice(0, 4);

  if (topic.includes("menu") || topic.includes("order") || topic.includes("special") || topic.includes("food")) {
    return {
      menuHighlights: context.menuHighlights,
      menuItems: context.menuItems.slice(0, 30).map((item) => ({
        aliases: item.aliases,
        name: item.name,
        price: formatPrice(item.priceCents),
      })),
      policies: pickPolicies(context, ["menu", "specials", "pickup", "payment", "allergies"]),
      restaurantName: context.restaurantName,
      topic,
    };
  }

  return {
    faqs: faqMatches,
    knowledgeSections: knowledgeMatches,
    policies: policyMatches.length ? Object.fromEntries(policyMatches) : context.policies,
    restaurantName: context.restaurantName,
    topic,
  };
}

export function verifyOpenAIWebhookSignature({
  headers,
  nowSeconds = Math.floor(Date.now() / 1000),
  rawBody,
  secret,
}: {
  headers: IncomingHttpHeaders;
  nowSeconds?: number;
  rawBody: string;
  secret: string;
}) {
  const webhookId = firstHeader(headers["webhook-id"]);
  const webhookTimestamp = firstHeader(headers["webhook-timestamp"]);
  const webhookSignature = firstHeader(headers["webhook-signature"]);
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const timestamp = Number.parseInt(webhookTimestamp, 10);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 5 * 60) return false;

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", decodeWebhookSecret(secret)).update(signedPayload).digest("base64");
  const expectedBuffer = Buffer.from(expected);

  return webhookSignature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const [, encodedSignature] = part.split(",");
      if (!encodedSignature) return false;
      const signatureBuffer = Buffer.from(encodedSignature);
      return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
    });
}

async function acceptOpenAIRealtimeCall({
  callId,
  env,
  fetchImpl,
  payload,
}: {
  callId: string;
  env: OpenAIRealtimeEnv;
  fetchImpl: typeof fetch;
  payload: OpenAIRealtimeAcceptPayload;
}) {
  const response = await fetchImpl(`${OPENAI_REALTIME_ACCEPT_URL}/${encodeURIComponent(callId)}/accept`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Realtime accept failed: ${response.status} ${body}`);
  }
}

function startSidebandSocket({
  activeSockets,
  callId,
  context,
  env,
  locationId,
  websocketFactory,
}: {
  activeSockets: Map<string, RealtimeSocket>;
  callId: string;
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
  locationId: string;
  websocketFactory: (url: string, options: { headers: Record<string, string> }) => RealtimeSocket;
}) {
  if (!env.OPENAI_API_KEY || activeSockets.has(callId)) return;

  const url = `${OPENAI_REALTIME_WEBSOCKET_URL}?call_id=${encodeURIComponent(callId)}`;
  const socket = websocketFactory(url, {
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
  });
  activeSockets.set(callId, socket);

  socket.on("open", () => {
    console.info("[openai-realtime] sideband connected", { callId, locationId });
    sendRealtimeEvent(socket, {
      session: {
        instructions: buildOpenAIRealtimeInstructions(context),
        tool_choice: "auto",
        tools: buildOpenAIRealtimeTools(),
      },
      type: "session.update",
    });
    sendRealtimeEvent(socket, {
      response: {
        instructions: `Say exactly this once, then wait for the caller: ${context.greeting}`,
      },
      type: "response.create",
    });
  });

  socket.on("message", (data) => {
    const event = parseRealtimeSocketMessage(data);
    if (!event) return;
    const eventType = typeof event.type === "string" ? event.type : "unknown";

    if (eventType === "error") {
      console.warn("[openai-realtime] realtime error event", { callId, event });
      return;
    }

    const toolCalls = extractOpenAIRealtimeToolCalls(event);
    if (!toolCalls.length) return;

    for (const toolCall of toolCalls) {
      const output = handleOpenAIRealtimeToolCall(context, toolCall);
      sendRealtimeEvent(socket, {
        item: {
          call_id: toolCall.callId,
          output: JSON.stringify(output),
          type: "function_call_output",
        },
        type: "conversation.item.create",
      });
    }
    sendRealtimeEvent(socket, { type: "response.create" });
  });

  socket.on("close", (code, reason) => {
    activeSockets.delete(callId);
    console.info("[openai-realtime] sideband closed", {
      callId,
      code,
      reason: reason.toString("utf8"),
    });
  });

  socket.on("error", (error) => {
    activeSockets.delete(callId);
    console.error("[openai-realtime] sideband failed", { callId, error });
  });
}

function handleOpenAIRealtimeToolCall(context: RestaurantVoiceContext, toolCall: OpenAIRealtimeToolCall) {
  if (toolCall.name === "lookup_restaurant_context") {
    return lookupRestaurantContext(context, toolCall.arguments.topic);
  }

  return {
    error: `Unknown tool: ${toolCall.name}`,
  };
}

function buildOpenAIRealtimeTools() {
  return [
    {
      description:
        "Look up restaurant facts, policies, FAQs, menu highlights, specials, hours, parking, reservations, pickup, payment, allergy, delivery, lost item, complaint, vendor, or human handoff details before answering.",
      name: "lookup_restaurant_context",
      parameters: {
        additionalProperties: false,
        properties: {
          topic: {
            description:
              "The restaurant topic the caller asked about, such as specials, hours, parking, reservations, pickup, payment, allergies, delivery drivers, lost item, complaint, vendor, or menu.",
            type: "string",
          },
        },
        required: ["topic"],
        type: "object",
      },
      type: "function" as const,
    },
  ];
}

function parseOpenAIRealtimeEvent(rawBody: string): OpenAIRealtimeIncomingEvent {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OpenAIRealtimeIncomingEvent;
    }
  } catch {
    // Fall through to the empty event below.
  }
  return {};
}

function parseRealtimeSocketMessage(data: RawData) {
  try {
    const text = Array.isArray(data)
      ? Buffer.concat(data).toString("utf8")
      : Buffer.isBuffer(data)
        ? data.toString("utf8")
        : Buffer.from(data).toString("utf8");
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { type?: unknown }
      : null;
  } catch {
    return null;
  }
}

function sendRealtimeEvent(socket: RealtimeSocket, event: unknown) {
  socket.send(JSON.stringify(event));
}

function extractLocationId(event: OpenAIRealtimeIncomingEvent) {
  return stringValue(event.data?.location_id) ??
    stringValue(event.data?.metadata?.locationId) ??
    stringValue(event.data?.metadata?.location_id);
}

function resolveOpenAIRealtimeModel(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_MODEL?.trim() || OPENAI_REALTIME_DEFAULT_MODEL;
}

function resolveOpenAIRealtimeVoice(env: OpenAIRealtimeEnv, context: RestaurantVoiceContext) {
  if (env.OPENAI_REALTIME_VOICE?.trim()) return env.OPENAI_REALTIME_VOICE.trim();
  if (context.voiceGender === "male") {
    return env.OPENAI_REALTIME_MALE_VOICE?.trim() || OPENAI_REALTIME_DEFAULT_MALE_VOICE;
  }
  return env.OPENAI_REALTIME_FEMALE_VOICE?.trim() || OPENAI_REALTIME_DEFAULT_FEMALE_VOICE;
}

function withOptionalQueryParam(url: string, key: string, value?: string) {
  if (!value) return url;
  const nextUrl = new URL(url);
  nextUrl.searchParams.set(key, value);
  return nextUrl.toString();
}

function parseObjectArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function pickPolicies(context: RestaurantVoiceContext, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, context.policies[key]]).filter(([, value]) => Boolean(value)));
}

function textMatchesTopic(text: string, topic: string) {
  if (!topic) return false;
  const normalizedText = text.toLowerCase();
  return topic
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .some((word) => normalizedText.includes(word));
}

function formatPrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function decodeWebhookSecret(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed.startsWith("whsec_")) return Buffer.from(trimmed);
  const decoded = Buffer.from(trimmed.slice("whsec_".length), "base64");
  return decoded.length ? decoded : Buffer.from(trimmed);
}
