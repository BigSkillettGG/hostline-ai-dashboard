import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import WebSocket, { type RawData } from "ws";
import type { CallStore } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import type { GuestConfirmationService } from "./guest-confirmation-service";
import type { StaffAlertKind, StaffNotificationService } from "./notification-service";
import type { CapturedOrderItem } from "./order-intake";
import { buildRestaurantInstructions, generateCallSummary } from "./restaurant-agent";
import { toSpokenRestaurantName, type RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import type { TranscriptRole, TranscriptTurn } from "./types";

const OPENAI_REALTIME_DEFAULT_MODEL = "gpt-realtime";
const OPENAI_REALTIME_DEFAULT_FEMALE_VOICE = "marin";
const OPENAI_REALTIME_DEFAULT_MALE_VOICE = "cedar";
const OPENAI_REALTIME_ACCEPT_URL = "https://api.openai.com/v1/realtime/calls";
const OPENAI_REALTIME_WEBSOCKET_URL = "wss://api.openai.com/v1/realtime";

type OpenAIRealtimeEnv = Pick<
  VoiceServiceEnv,
  | "OPENAI_API_KEY"
  | "OPENAI_MODEL"
  | "OPENAI_PROJECT_ID"
  | "OPENAI_REPLY_TIMEOUT_MS"
  | "OPENAI_REALTIME_FEMALE_VOICE"
  | "OPENAI_REALTIME_IDLE_TIMEOUT_MS"
  | "OPENAI_REALTIME_INTERRUPT_RESPONSE"
  | "OPENAI_REALTIME_MALE_VOICE"
  | "OPENAI_REALTIME_MODEL"
  | "OPENAI_REALTIME_NOISE_REDUCTION"
  | "OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS"
  | "OPENAI_REALTIME_SERVER_VAD_SILENCE_MS"
  | "OPENAI_REALTIME_SERVER_VAD_THRESHOLD"
  | "OPENAI_REALTIME_SPEED"
  | "OPENAI_REALTIME_TURN_DETECTION_MODE"
  | "OPENAI_REALTIME_TURN_EAGERNESS"
  | "OPENAI_REALTIME_VOICE"
  | "OPENAI_WEBHOOK_SECRET"
  | "PUBLIC_HTTP_BASE_URL"
  | "SUPABASE_DEMO_LOCATION_ID"
>;

interface OpenAIRealtimeSipServiceOptions {
  callStore?: CallStore;
  fetchImpl?: typeof fetch;
  guestConfirmationService?: GuestConfirmationService;
  staffNotificationService?: StaffNotificationService;
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

export interface OpenAIRealtimePreflightCheck {
  detail: string;
  id: string;
  label: string;
  ready: boolean;
  required: boolean;
}

export interface OpenAIRealtimePreflight {
  checks: OpenAIRealtimePreflightCheck[];
  config: OpenAIRealtimeLiveCallConfig;
  locationId: string;
  ready: boolean;
  restaurantName?: string;
}

interface OpenAIRealtimeIncomingEvent {
  created_at?: unknown;
  data?: {
    call?: {
      id?: unknown;
    };
    call_id?: unknown;
    caller_id?: unknown;
    from?: unknown;
    location_id?: unknown;
    metadata?: {
      callerPhone?: unknown;
      caller_phone?: unknown;
      locationId?: unknown;
      location_id?: unknown;
    };
    sip_headers?: Array<{ name?: unknown; value?: unknown }>;
    to?: unknown;
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

interface RealtimeTranscriptTurn {
  itemId?: string;
  role: TranscriptRole;
  text: string;
}

interface RealtimeQualityMetrics {
  activeResponseStartedAt?: number;
  agentTranscriptCount: number;
  callerTranscriptCount: number;
  firstGreetingResponseMs?: number;
  firstModelResponseMs?: number;
  lastResponseDurationMs?: number;
  lastSpeechStoppedAt?: number;
  responseCount: number;
  speechStartedDuringResponseCount: number;
  speechStartCount: number;
  speechStopCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  toolLatencyMs: number[];
}

interface OpenAIRealtimeSidebandSession {
  callRecordId?: string;
  callerPhone?: string;
  completed: boolean;
  context: RestaurantVoiceContext;
  externalCallId: string;
  finishCloseTimer?: ReturnType<typeof setTimeout>;
  finishRequested: boolean;
  locationId: string;
  quality: RealtimeQualityMetrics;
  staffCallbackRequested: boolean;
  startedAt: number;
  toolEvents: Array<{ kind?: string; latencyMs?: number; name: string; ok?: boolean }>;
  transcript: TranscriptTurn[];
  transcriptKeys: Set<string>;
}

interface BuildOpenAIRealtimeAcceptPayloadInput {
  callerPhone?: string;
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
  now?: Date;
}

interface OpenAIRealtimeAcceptPayload {
  audio: {
    input: {
      noise_reduction: { type: "near_field" | "far_field" };
      transcription: {
        language: "en";
        model: "gpt-4o-mini-transcribe";
        prompt: string;
      };
      turn_detection: {
        create_response: true;
        eagerness: "low" | "medium" | "high";
        interrupt_response: boolean;
        type: "semantic_vad";
      } | {
        create_response: true;
        idle_timeout_ms: number;
        interrupt_response: boolean;
        prefix_padding_ms: number;
        silence_duration_ms: number;
        threshold: number;
        type: "server_vad";
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
  const callStore = options.callStore;
  const guestConfirmationService = options.guestConfirmationService;
  const staffNotificationService = options.staffNotificationService;
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

    async getPreflight(locationId?: string): Promise<OpenAIRealtimePreflight> {
      return buildOpenAIRealtimePreflight({
        env,
        fetchImpl,
        locationId,
        restaurantContextStore,
      });
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
      const callerPhone = extractOpenAIRealtimeCallerPhone(event);
      const externalCallId = extractOpenAIRealtimeExternalCallId(event) ?? callId;
      const externalSessionId = extractOpenAIRealtimeSipCallId(event) ?? callId;
      let callRecordId: string | undefined;
      try {
        const result = await callStore?.startRealtimeCall({
          callerPhone,
          externalCallId,
          externalSessionId,
          locationId: resolvedLocationId,
          providerPayload: {
            openaiCallId: callId,
            sipHeaders: event.data?.sip_headers ?? [],
            webhookEventId: event.id,
          },
        });
        callRecordId = result?.callId;
      } catch (error) {
        console.error("[openai-realtime] call start persistence failed", { callId, error });
      }
      const payload = buildOpenAIRealtimeAcceptPayload({ callerPhone, context, env });

      await acceptOpenAIRealtimeCall({
        callId,
        env,
        fetchImpl,
        payload,
      });

      startSidebandSocket({
        activeSockets,
        callRecordId,
        callStore,
        callId,
        callerPhone,
        context,
        env,
        externalCallId,
        guestConfirmationService,
        locationId: resolvedLocationId,
        staffNotificationService,
        websocketFactory,
      });

      return {
        body: {
          accepted: true,
          callId,
          locationId: resolvedLocationId,
          model: payload.model,
          voice: payload.audio.output.voice,
          callerPhone,
        },
        status: 200,
      };
    },
  };
}

export async function buildOpenAIRealtimePreflight({
  env,
  fetchImpl = fetch,
  locationId,
  restaurantContextStore,
}: {
  env: OpenAIRealtimeEnv;
  fetchImpl?: typeof fetch;
  locationId?: string;
  restaurantContextStore: RestaurantContextStore;
}): Promise<OpenAIRealtimePreflight> {
  const resolvedLocationId = locationId?.trim() || env.SUPABASE_DEMO_LOCATION_ID || "demo-location";
  const config = buildOpenAIRealtimeLiveCallConfig(env, resolvedLocationId);
  const checks: OpenAIRealtimePreflightCheck[] = [
    {
      detail: "Needed so OpenAI can send incoming-call webhooks to the voice service.",
      id: "public_http_base_url",
      label: "Public voice URL",
      ready: Boolean(env.PUBLIC_HTTP_BASE_URL),
      required: true,
    },
    {
      detail: "Needed so the voice service can accept the SIP call and open the sideband WebSocket.",
      id: "openai_api_key",
      label: "OpenAI API key",
      ready: Boolean(env.OPENAI_API_KEY),
      required: true,
    },
    {
      detail: "Used when pointing a Twilio SIP trunk or other SIP carrier at OpenAI.",
      id: "openai_project_id",
      label: "OpenAI project ID",
      ready: Boolean(env.OPENAI_PROJECT_ID),
      required: false,
    },
    {
      detail: "Recommended after the first unsigned pilot call works. Leave unset until then.",
      id: "openai_webhook_secret",
      label: "OpenAI webhook secret",
      ready: Boolean(env.OPENAI_WEBHOOK_SECRET),
      required: false,
    },
  ];

  checks.push(await checkOpenAIRealtimeModel({ env, fetchImpl }));

  let restaurantName: string | undefined;
  try {
    const context = await restaurantContextStore.getContext(resolvedLocationId);
    restaurantName = context.restaurantName;
    checks.push({
      detail: `Loaded voice context for ${context.restaurantName}.`,
      id: "restaurant_context",
      label: "Restaurant context",
      ready: true,
      required: true,
    });
  } catch (error) {
    checks.push({
      detail: error instanceof Error ? error.message : "Could not load restaurant context.",
      id: "restaurant_context",
      label: "Restaurant context",
      ready: false,
      required: true,
    });
  }

  return {
    checks,
    config,
    locationId: resolvedLocationId,
    ready: checks.filter((check) => check.required).every((check) => check.ready),
    restaurantName,
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
  callerPhone,
  context,
  env,
  now,
}: BuildOpenAIRealtimeAcceptPayloadInput): OpenAIRealtimeAcceptPayload {
  const voice = resolveOpenAIRealtimeVoice(env, context);

  return {
    audio: {
      input: {
        noise_reduction: { type: resolveOpenAIRealtimeNoiseReduction(env) },
        transcription: {
          language: "en",
          model: "gpt-4o-mini-transcribe",
          prompt: [
            `This is a phone call with ${context.restaurantName}, a restaurant.`,
            "Expect restaurant words: reservations, pickup orders, specials, parking, allergies, delivery drivers, hours, waitlist.",
            `Menu terms include: ${context.menuHighlights.slice(0, 16).join(", ")}.`,
          ].join(" "),
        },
        turn_detection: resolveOpenAIRealtimeTurnDetection(env),
      },
      output: {
        speed: resolveOpenAIRealtimeSpeed(env),
        voice,
      },
    },
    instructions: buildOpenAIRealtimeInstructions(context, { callerPhone, now }),
    max_output_tokens: 280,
    model: resolveOpenAIRealtimeModel(env),
    output_modalities: ["audio"],
    tool_choice: "auto",
    tools: buildOpenAIRealtimeTools(),
    type: "realtime",
  };
}

export function buildOpenAIRealtimeInstructions(
  context: RestaurantVoiceContext,
  callContext: { callerPhone?: string; now?: Date } = {},
) {
  const localTimeContext = buildRestaurantLocalTimeContext(context, callContext.now);
  const callerPhoneContext = callContext.callerPhone
    ? `Caller phone number from SIP caller ID: ${callContext.callerPhone}. If the caller asks for a text or agrees to a confirmation, you may text this number. If offering a text, say the last four digits, not the full number.`
    : "Caller phone number is not available from SIP caller ID. Ask for the best mobile number before offering to text confirmations.";
  const openingGreeting = buildShortOpeningGreeting(context);

  return [
    buildRestaurantInstructions(context),
    `Current restaurant local time: ${localTimeContext}. Use this for today, tonight, tomorrow, open-now, specials-today, and reservation-date questions.`,
    callerPhoneContext,
    "Realtime phone behavior:",
    "This is one continuous live phone call. Never restart the opening greeting in the middle of the call.",
    `Opening greeting to use when the call begins: "${openingGreeting}"`,
    "Say the opening greeting once at the start of the call. Do not introduce yourself by name and do not say you are virtual or AI in the opening.",
    "If the caller says 'hello' before you have greeted them, immediately give the full opening greeting instead of only saying hello back.",
    "Voice style: warm, polished, friendly, and conversational. Avoid IVR cadence, monotone delivery, robotic precision, or over-enunciating the restaurant name.",
    "Greeting energy: the opening should be friendly and lightly upbeat, but short and not theatrical.",
    "Pacing: speak briskly enough for a phone call, with varied intonation and short sentence chunks. Do not drag out 'Olive and Ember'.",
    "Voice color: let a small smile come through in the greeting and positive answers; use gentle concern for allergies or complaints; keep the warmth subtle and professional.",
    "Make answers feel specific to what the caller just said. For example, if they ask about a table for 6 tonight, say 'For 6 tonight...' before asking only for the missing detail.",
    "Use 'we' when speaking for the restaurant, such as 'we're open until 10' or 'we have parking behind the building.'",
    "Use natural restaurant-host acknowledgements like 'Sure', 'Absolutely', 'Of course', 'One moment', and 'Let me check that' when they fit.",
    "If the caller pauses, wait naturally. If silence continues, ask a gentle continuation question such as 'Take your time. What else can I help you with?'",
    "Speakerphone and car audio behavior: ignore faint echoes, background noise, room noise, and your own voice coming back through the caller's speaker. Only treat clear human speech as caller intent.",
    "Handle clear interruptions gracefully. If the caller clearly cuts you off with speech, answer their latest request. Do not restart the call because of a noise, echo, or short silence.",
    "If the caller is in a very loud place or the audio is too unclear to understand, do not guess. Say briefly that it is too noisy to hear clearly and ask them to move somewhere quieter, call back, or let staff follow up by text/callback.",
    "Before any lookup or task that may take a moment, say one short natural bridge such as 'Sure, let me check that' or 'One moment, I am checking now,' then use the tool. Vary the wording and do not sound like an IVR.",
    "Use cached restaurant facts naturally. The facts are not a script; keep your wording warm, human, and specific to the caller's question.",
    "Use the lookup_restaurant_context tool for specials, hours, parking, directions, menu, reservation policy, pickup timing, payment, allergies, delivery drivers, lost items, complaints, or anything policy-like.",
    "After answering any normal question or completing any task, ask a short loop-closing question such as 'Can I help you with anything else?' unless the caller has already clearly said goodbye.",
    "Never end the call immediately after answering a question. The call should only close after the caller indicates they are done.",
    "If the caller says no, no thanks, that's all, that's it, I'm good, or similar after your anything-else question, call finish_call with a short closing line like 'Thanks for calling. Goodbye.' Do not ask another question.",
    "Do not call finish_call until the caller clearly indicates they are done or says goodbye.",
    "When finish_call returns ok, say only the closing line, then stop speaking. The call will end.",
    "If the caller says yes after your anything-else question, say 'Of course, what else can I help with?' and continue.",
    "There is no live staff transfer in this pilot. Never say you are connecting, transferring, or placing the caller on hold for staff.",
    "When a caller needs staff, use request_staff_callback, then say you are sending the message to staff and someone will call them back shortly.",
    "If you do not know an answer after checking context, do not guess. Offer a staff callback and collect the missing name, callback number, and question.",
    "For severe allergies, never guarantee safety. Use request_staff_callback and say staff needs to confirm because cross-contact is possible.",
    "For reservation requests, acknowledge any date, time, or party size already spoken, then ask only for missing details.",
    "When reservation date, time, party size, and guest name are known, use create_reservation_request to save the request. If the tool says staff confirmation is needed, tell the caller it is requested and staff will confirm.",
    "For pickup orders, collect items, quantities, name, and callback number. Payment is pay at pickup unless a POS integration says otherwise.",
    "For menu substitutions or off-menu requests, use the restaurant substitution policy. If allowed and obvious, note it as a request; if uncertain, say you can include the request but staff must confirm. Never guarantee off-menu items, allergy accommodations, prices, or availability unless the menu context explicitly confirms them.",
    "For reservations and pickup orders, once the request is captured, naturally offer to text a confirmation. Example: 'Would you like me to text that confirmation to the number ending 1234?'",
    "Only send a text after the caller agrees or asks for it. Use the send_guest_confirmation tool for reservation, order, or helpful follow-up texts.",
    "If the send_guest_confirmation tool succeeds, tell the caller the text is sent. Do not mention backend setup, SMS providers, or placeholder mode.",
    "Close naturally only after the caller is done. Use finish_call, say a short goodbye, and do not ask another question after goodbye.",
  ].join("\n");
}

export function extractOpenAIRealtimeCallId(event: OpenAIRealtimeIncomingEvent) {
  return stringValue(event.data?.call_id) ?? stringValue(event.data?.call?.id);
}

export function extractOpenAIRealtimeCallerPhone(event: OpenAIRealtimeIncomingEvent) {
  return normalizeCallerPhone(
    stringValue(event.data?.caller_id) ??
      stringValue(event.data?.from) ??
      stringValue(event.data?.metadata?.callerPhone) ??
      stringValue(event.data?.metadata?.caller_phone) ??
      extractCallerPhoneFromSipHeaders(event.data?.sip_headers),
  );
}

export function extractOpenAIRealtimeExternalCallId(event: OpenAIRealtimeIncomingEvent) {
  return extractSipHeader(event.data?.sip_headers, [
    "x-twilio-callsid",
    "x-twilio-call-sid",
    "twilio-callsid",
    "twilio-call-sid",
    "x-call-sid",
  ]);
}

export function extractOpenAIRealtimeSipCallId(event: OpenAIRealtimeIncomingEvent) {
  return extractSipHeader(event.data?.sip_headers, ["call-id", "callid"]);
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

export function extractOpenAIRealtimeTranscriptTurn(event: unknown): RealtimeTranscriptTurn | null {
  if (!event || typeof event !== "object") return null;
  const candidate = event as {
    content_index?: unknown;
    item?: unknown;
    item_id?: unknown;
    output_index?: unknown;
    transcript?: unknown;
    type?: unknown;
  };
  const type = stringValue(candidate.type);

  if (type === "conversation.item.input_audio_transcription.completed") {
    const text = stringValue(candidate.transcript);
    if (!text) return null;
    return {
      itemId: stringValue(candidate.item_id),
      role: "caller",
      text,
    };
  }

  if (type === "response.output_audio_transcript.done") {
    const text = stringValue(candidate.transcript);
    if (!text) return null;
    return {
      itemId: [
        stringValue(candidate.item_id),
        stringValue(candidate.output_index),
        stringValue(candidate.content_index),
      ].filter(Boolean).join(":") || undefined,
      role: "agent",
      text,
    };
  }

  return null;
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
        modifiers: item.modifiers,
        name: item.name,
        price: formatPrice(item.priceCents),
      })),
      policies: pickPolicies(context, ["menu", "substitutions", "specials", "pickup", "payment", "allergies"]),
      currentRestaurantTime: buildRestaurantLocalTimeContext(context),
      restaurantName: context.restaurantName,
      topic,
    };
  }

  return {
    currentRestaurantTime: buildRestaurantLocalTimeContext(context),
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
  callRecordId,
  callStore,
  callId,
  callerPhone,
  context,
  env,
  externalCallId,
  guestConfirmationService,
  locationId,
  staffNotificationService,
  websocketFactory,
}: {
  activeSockets: Map<string, RealtimeSocket>;
  callRecordId?: string;
  callStore?: CallStore;
  callId: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
  externalCallId: string;
  guestConfirmationService?: GuestConfirmationService;
  locationId: string;
  staffNotificationService?: StaffNotificationService;
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
  const session: OpenAIRealtimeSidebandSession = {
    callRecordId,
    callerPhone,
    completed: false,
    context,
    externalCallId,
    finishRequested: false,
    locationId,
    quality: createRealtimeQualityMetrics(),
    staffCallbackRequested: false,
    startedAt: Date.now(),
    toolEvents: [],
    transcript: [],
    transcriptKeys: new Set(),
  };

  socket.on("open", () => {
    console.info("[openai-realtime] sideband connected", { callId, locationId });
    sendRealtimeEvent(socket, {
      session: {
        instructions: buildOpenAIRealtimeInstructions(context, { callerPhone }),
        tool_choice: "auto",
        tools: buildOpenAIRealtimeTools(),
        type: "realtime",
      },
      type: "session.update",
    });
    sendRealtimeEvent(socket, {
      response: {
        instructions: buildOpeningGreetingInstructions(context),
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

    recordOpenAIRealtimeQualityEvent(session, eventType, callId);

    const transcriptTurn = extractOpenAIRealtimeTranscriptTurn(event);
    if (transcriptTurn) {
      void persistOpenAIRealtimeTranscriptTurn({
        callStore,
        session,
        turn: transcriptTurn,
      });
    }

    if (eventType === "response.done" && session.finishRequested) {
      scheduleOpenAIRealtimeFinishedClose({ callId, session, socket });
    }

    const toolCalls = extractOpenAIRealtimeToolCalls(event);
    if (!toolCalls.length) return;
    markRealtimeToolCalls(session, toolCalls);
    void handleOpenAIRealtimeToolCalls({
      callStore,
      callerPhone,
      callRecordId: session.callRecordId,
      context,
      guestConfirmationService,
      locationId,
      session,
      socket,
      staffNotificationService,
      toolCalls,
    });
  });

  socket.on("close", (code, reason) => {
    activeSockets.delete(callId);
    clearOpenAIRealtimeFinishedClose(session);
    void completeOpenAIRealtimeLoggedCall({
      callStore,
      closeCode: code,
      closeReason: reason.toString("utf8"),
      env,
      session,
    });
    console.info("[openai-realtime] sideband closed", {
      callId,
      code,
      reason: reason.toString("utf8"),
    });
  });

  socket.on("error", (error) => {
    activeSockets.delete(callId);
    clearOpenAIRealtimeFinishedClose(session);
    void completeOpenAIRealtimeLoggedCall({
      callStore,
      closeReason: error.message,
      env,
      session,
    });
    console.error("[openai-realtime] sideband failed", { callId, error });
  });
}

export function buildOpeningGreetingInstructions(context: RestaurantVoiceContext) {
  const greeting = buildShortOpeningGreeting(context);
  return [
    "Say this exact opening greeting once as soon as the call starts, then stop and listen:",
    greeting,
    "Deliver it warmly, like a friendly restaurant host with a smile in your voice.",
    "Do not add your name, do not say you are virtual or AI, and do not add menu, hours, or reservation information.",
  ].join(" ");
}

export function buildShortOpeningGreeting(context: RestaurantVoiceContext) {
  return `Hi, thank you for calling ${toSpokenRestaurantName(context.restaurantName)}. How can I help you?`;
}

function createRealtimeQualityMetrics(): RealtimeQualityMetrics {
  return {
    agentTranscriptCount: 0,
    callerTranscriptCount: 0,
    responseCount: 0,
    speechStartedDuringResponseCount: 0,
    speechStartCount: 0,
    speechStopCount: 0,
    toolCallCount: 0,
    toolErrorCount: 0,
    toolLatencyMs: [],
  };
}

function recordOpenAIRealtimeQualityEvent(session: OpenAIRealtimeSidebandSession, eventType: string, callId: string) {
  const now = Date.now();
  if (eventType === "input_audio_buffer.speech_started") {
    session.quality.speechStartCount += 1;
    if (session.quality.activeResponseStartedAt) {
      session.quality.speechStartedDuringResponseCount += 1;
      console.info("[openai-realtime] caller speech detected during response", {
        callId,
        count: session.quality.speechStartedDuringResponseCount,
      });
    }
    return;
  }

  if (eventType === "input_audio_buffer.speech_stopped") {
    session.quality.speechStopCount += 1;
    session.quality.lastSpeechStoppedAt = now;
    return;
  }

  if (eventType === "response.created") {
    session.quality.responseCount += 1;
    session.quality.activeResponseStartedAt = now;
    if (session.quality.responseCount === 1) {
      session.quality.firstGreetingResponseMs = now - session.startedAt;
    } else if (!session.quality.firstModelResponseMs && session.quality.lastSpeechStoppedAt) {
      session.quality.firstModelResponseMs = now - session.quality.lastSpeechStoppedAt;
    }
    console.info("[openai-realtime] response started", {
      callId,
      responseCount: session.quality.responseCount,
      sinceLastSpeechStopMs: session.quality.lastSpeechStoppedAt ? now - session.quality.lastSpeechStoppedAt : undefined,
    });
    return;
  }

  if (eventType === "response.done") {
    if (session.quality.activeResponseStartedAt) {
      session.quality.lastResponseDurationMs = now - session.quality.activeResponseStartedAt;
    }
    delete session.quality.activeResponseStartedAt;
  }
}

async function persistOpenAIRealtimeTranscriptTurn({
  callStore,
  session,
  turn,
}: {
  callStore?: CallStore;
  session: OpenAIRealtimeSidebandSession;
  turn: RealtimeTranscriptTurn;
}) {
  const text = turn.text.trim();
  if (!text) return;

  const key = `${turn.role}:${turn.itemId ?? text}`;
  if (session.transcriptKeys.has(key)) return;
  session.transcriptKeys.add(key);

  const transcriptTurn = {
    at: new Date().toISOString(),
    role: turn.role,
    text,
  } satisfies TranscriptTurn;
  session.transcript.push(transcriptTurn);
  if (turn.role === "caller") {
    session.quality.callerTranscriptCount += 1;
  } else if (turn.role === "agent") {
    session.quality.agentTranscriptCount += 1;
  }

  try {
    await callStore?.addTranscriptTurn({
      callId: session.callRecordId,
      offsetSeconds: getRealtimeSessionOffsetSeconds(session),
      speaker: turn.role,
      text,
    });
  } catch (error) {
    console.error("[openai-realtime] transcript persistence failed", {
      error,
      externalCallId: session.externalCallId,
      role: turn.role,
    });
  }
}

function markRealtimeToolCalls(session: OpenAIRealtimeSidebandSession, toolCalls: OpenAIRealtimeToolCall[]) {
  for (const toolCall of toolCalls) {
    session.toolEvents.push({
      kind: toolCall.name === "create_reservation_request" ? "reservation" : stringValue(toolCall.arguments.kind),
      name: toolCall.name,
    });
    if (toolCall.name === "request_staff_callback") {
      session.staffCallbackRequested = true;
    }
  }
}

function scheduleOpenAIRealtimeFinishedClose({
  callId,
  session,
  socket,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
}) {
  if (session.finishCloseTimer) return;
  session.finishCloseTimer = setTimeout(() => {
    console.info("[openai-realtime] closing completed call after goodbye", { callId });
    try {
      socket.close(1000, "HostLine call completed.");
    } catch (error) {
      console.warn("[openai-realtime] completed call close failed", { callId, error });
    }
  }, 250);
}

function clearOpenAIRealtimeFinishedClose(session: OpenAIRealtimeSidebandSession) {
  if (!session.finishCloseTimer) return;
  clearTimeout(session.finishCloseTimer);
  delete session.finishCloseTimer;
}

async function completeOpenAIRealtimeLoggedCall({
  callStore,
  closeCode,
  closeReason,
  env,
  session,
}: {
  callStore?: CallStore;
  closeCode?: number;
  closeReason?: string;
  env: OpenAIRealtimeEnv;
  session: OpenAIRealtimeSidebandSession;
}) {
  if (!callStore || !session.callRecordId) return;
  if (session.completed) return;
  session.completed = true;

  const durationSeconds = getRealtimeSessionOffsetSeconds(session);
  const classification = classifyOpenAIRealtimeCall(session);
  const structuredSummary = buildOpenAIRealtimeStructuredSummary(session, classification, closeCode, closeReason);
  const summary = await generateCallSummary({
    context: session.context,
    env,
    structuredSummary,
    transcript: session.transcript,
  }).catch((error) => {
    console.error("[openai-realtime] call summary generation failed", {
      error,
      externalCallId: session.externalCallId,
    });
    return structuredSummary;
  });

  try {
    await callStore.completeCall({
      callId: session.callRecordId,
      confidence: classification.confidence,
      durationSeconds,
      intent: classification.intent,
      outcome: classification.outcome,
      status: classification.status,
      summary,
    });
  } catch (error) {
    console.error("[openai-realtime] call completion persistence failed", {
      error,
      externalCallId: session.externalCallId,
    });
  }
}

function getRealtimeSessionOffsetSeconds(session: OpenAIRealtimeSidebandSession) {
  return Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
}

function classifyOpenAIRealtimeCall(session: OpenAIRealtimeSidebandSession): {
  confidence: number;
  intent: "order" | "reservation" | "faq" | "hours" | "other";
  outcome: string;
  status: "new" | "reviewed" | "needs_review" | "resolved";
} {
  const combinedText = session.transcript.map((turn) => turn.text).join(" ").toLowerCase();
  const toolNames = new Set(session.toolEvents.map((event) => event.name));
  const toolKinds = new Set(session.toolEvents.map((event) => event.kind).filter(Boolean));
  const intent = toolKinds.has("order") || /\b(order|pickup|takeout|to go|pizza|salad|pasta)\b/.test(combinedText)
    ? "order"
    : toolKinds.has("reservation") || /\b(reservation|reserve|book|table for|party of)\b/.test(combinedText)
      ? "reservation"
      : /\b(hour|open|close|closing|tonight)\b/.test(combinedText)
        ? "hours"
        : session.transcript.length
          ? "faq"
          : "other";

  const qualityNeedsReview =
    session.quality.toolErrorCount > 0 ||
    session.quality.speechStartedDuringResponseCount >= 3 ||
    (session.quality.speechStartCount >= 3 && session.quality.callerTranscriptCount === 0);
  const needsReview = session.staffCallbackRequested || toolNames.has("request_staff_callback") || qualityNeedsReview;
  const outcome = needsReview
    ? "escalated"
    : toolNames.has("create_reservation_request")
      ? "message_taken"
    : toolNames.has("send_guest_confirmation")
      ? "resolved"
      : intent === "order"
        ? "message_taken"
        : "resolved";

  return {
    confidence: session.transcript.length ? (needsReview ? 72 : 88) : 20,
    intent,
    outcome,
    status: needsReview || !session.transcript.length ? "needs_review" : "resolved",
  };
}

function buildOpenAIRealtimeStructuredSummary(
  session: OpenAIRealtimeSidebandSession,
  classification: ReturnType<typeof classifyOpenAIRealtimeCall>,
  closeCode?: number,
  closeReason?: string,
) {
  const callerTurns = session.transcript.filter((turn) => turn.role === "caller").map((turn) => turn.text);
  const agentTurns = session.transcript.filter((turn) => turn.role === "agent").map((turn) => turn.text);
  const actionSummary = session.toolEvents.length
    ? `Tools used: ${session.toolEvents.map(formatRealtimeToolEventSummary).join(", ")}.`
    : "No tools were used.";
  const closeSummary = closeCode || closeReason ? `Call close: ${[closeCode, closeReason].filter(Boolean).join(" ")}.` : "";
  const qualitySummary = buildRealtimeQualitySummary(session);

  return [
    `OpenAI Realtime call classified as ${classification.intent}; outcome ${classification.outcome}.`,
    callerTurns.length ? `Caller said: ${callerTurns.slice(-3).join(" / ")}.` : "No caller transcript was captured.",
    agentTurns.length ? `Vera replied: ${agentTurns.slice(-2).join(" / ")}.` : "",
    actionSummary,
    qualitySummary,
    closeSummary,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatRealtimeToolEventSummary(event: OpenAIRealtimeSidebandSession["toolEvents"][number]) {
  const parts = [event.kind ? `${event.name}:${event.kind}` : event.name];
  if (event.latencyMs !== undefined) parts.push(`${event.latencyMs}ms`);
  if (event.ok === false) parts.push("failed");
  return parts.join(" ");
}

function buildRealtimeQualitySummary(session: OpenAIRealtimeSidebandSession) {
  const avgToolLatency = session.quality.toolLatencyMs.length
    ? Math.round(session.quality.toolLatencyMs.reduce((sum, latency) => sum + latency, 0) / session.quality.toolLatencyMs.length)
    : undefined;
  const flags = [
    session.quality.speechStartedDuringResponseCount >= 3 && "possible speakerphone echo/false interruptions",
    session.quality.speechStartCount >= 3 && session.quality.callerTranscriptCount === 0 && "speech detected but no caller transcript",
    session.quality.toolErrorCount > 0 && "tool errors",
  ].filter((flag): flag is string => Boolean(flag));

  return [
    `Call quality: speech starts ${session.quality.speechStartCount}, speech stops ${session.quality.speechStopCount}, caller turns ${session.quality.callerTranscriptCount}, agent turns ${session.quality.agentTranscriptCount}.`,
    session.quality.firstGreetingResponseMs !== undefined ? `Greeting response started after ${session.quality.firstGreetingResponseMs}ms.` : "",
    session.quality.firstModelResponseMs !== undefined ? `First post-caller response started after ${session.quality.firstModelResponseMs}ms from speech stop.` : "",
    avgToolLatency !== undefined ? `Average tool latency ${avgToolLatency}ms.` : "",
    flags.length ? `Quality flags: ${flags.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function handleOpenAIRealtimeToolCalls({
  callStore,
  callerPhone,
  callRecordId,
  context,
  guestConfirmationService,
  locationId,
  session,
  socket,
  staffNotificationService,
  toolCalls,
}: {
  callStore?: CallStore;
  callerPhone?: string;
  callRecordId?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  staffNotificationService?: StaffNotificationService;
  toolCalls: OpenAIRealtimeToolCall[];
}) {
  for (const toolCall of toolCalls) {
    const startedAt = Date.now();
    let output: unknown;
    try {
      output = await handleOpenAIRealtimeToolCall({
        callStore,
        callerPhone,
        callRecordId,
        context,
        guestConfirmationService,
        locationId,
        staffNotificationService,
        toolCall,
      });
    } catch (error) {
      output = {
        error: error instanceof Error ? error.message : "Tool call failed.",
        ok: false,
      };
    }
    recordOpenAIRealtimeToolResult(session, toolCall, output, Date.now() - startedAt);
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
}

function recordOpenAIRealtimeToolResult(
  session: OpenAIRealtimeSidebandSession,
  toolCall: OpenAIRealtimeToolCall,
  output: unknown,
  latencyMs: number,
) {
  const ok = !isErrorToolOutput(output);
  session.quality.toolCallCount += 1;
  session.quality.toolLatencyMs.push(latencyMs);
  if (!ok) session.quality.toolErrorCount += 1;
  if (toolCall.name === "finish_call" && ok) {
    session.finishRequested = true;
  }

  const existing = [...session.toolEvents].reverse().find((event) => event.name === toolCall.name && event.latencyMs === undefined);
  if (existing) {
    existing.latencyMs = latencyMs;
    existing.ok = ok;
  }

  console.info("[openai-realtime] tool call completed", {
    latencyMs,
    name: toolCall.name,
    ok,
  });
}

function isErrorToolOutput(output: unknown) {
  if (!output || typeof output !== "object") return false;
  const record = output as Record<string, unknown>;
  return record.ok === false || typeof record.error === "string";
}

async function handleOpenAIRealtimeToolCall({
  callStore,
  callerPhone,
  callRecordId,
  context,
  guestConfirmationService,
  locationId,
  staffNotificationService,
  toolCall,
}: {
  callStore?: CallStore;
  callerPhone?: string;
  callRecordId?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  staffNotificationService?: StaffNotificationService;
  toolCall: OpenAIRealtimeToolCall;
}) {
  if (toolCall.name === "lookup_restaurant_context") {
    return lookupRestaurantContext(context, toolCall.arguments.topic);
  }

  if (toolCall.name === "send_guest_confirmation") {
    return sendOpenAIRealtimeGuestConfirmation({
      callerPhone,
      context,
      guestConfirmationService,
      rawArguments: toolCall.arguments,
    });
  }

  if (toolCall.name === "create_reservation_request") {
    return createOpenAIRealtimeReservationRequest({
      callRecordId,
      callStore,
      callerPhone,
      context,
      locationId,
      rawArguments: toolCall.arguments,
    });
  }

  if (toolCall.name === "request_staff_callback") {
    return requestOpenAIRealtimeStaffCallback({
      callRecordId,
      callerPhone,
      context,
      locationId,
      rawArguments: toolCall.arguments,
      staffNotificationService,
    });
  }

  if (toolCall.name === "finish_call") {
    return finishOpenAIRealtimeCall({
      rawArguments: toolCall.arguments,
    });
  }

  return {
    error: `Unknown tool: ${toolCall.name}`,
  };
}

export function finishOpenAIRealtimeCall({ rawArguments }: { rawArguments: Record<string, unknown> }) {
  const closingLine = sanitizeClosingLine(stringValue(rawArguments.closing_line) ?? "Thanks for calling. Goodbye.");
  return {
    ok: true,
    action: "finish_call",
    closingLine,
    message: `Say only this closing line, then stop speaking: "${closingLine}"`,
  };
}

export async function createOpenAIRealtimeReservationRequest({
  callRecordId,
  callStore,
  callerPhone,
  context,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callStore?: CallStore;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  locationId?: string;
  rawArguments: Record<string, unknown>;
}) {
  const date = stringValue(rawArguments.reservation_date);
  const time = normalizeRealtimeReservationTime(stringValue(rawArguments.reservation_time));
  const partySize = numberValue(rawArguments.party_size);
  const guestName = stringValue(rawArguments.guest_name);
  const callbackPhone = normalizeCallerPhone(stringValue(rawArguments.phone_number) ?? callerPhone);
  if (!date || !time || !partySize || !guestName) {
    const missing = [
      !date && "reservation_date",
      !time && "reservation_time",
      !partySize && "party_size",
      !guestName && "guest_name",
    ].filter((item): item is string => Boolean(item));

    return {
      ok: false,
      error: "missing_reservation_details",
      message: `Ask only for the missing reservation detail${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
      missing,
    };
  }

  try {
    const result = await callStore?.createStaffReviewReservation({
      callId: callRecordId,
      callerPhone: callbackPhone,
      confidence: 88,
      date,
      guestName,
      locationId,
      notes: stringValue(rawArguments.notes),
      partySize,
      provider: "manual_request",
      time,
    });

    return {
      ok: true,
      confirmationMode: "staff_confirmed",
      message:
        "Reservation request saved. Tell the caller staff will confirm it shortly; do not guarantee the table until staff confirms.",
      provider: "manual_request",
      reservationId: result?.reservationId,
      restaurantName: context.restaurantName,
      status: "pending_staff_confirmation",
    };
  } catch (error) {
    return {
      ok: false,
      error: "reservation_request_failed",
      message: error instanceof Error ? error.message : "Reservation request failed.",
    };
  }
}

export async function sendOpenAIRealtimeGuestConfirmation({
  callerPhone,
  context,
  guestConfirmationService,
  rawArguments,
}: {
  callerPhone?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  rawArguments: Record<string, unknown>;
}) {
  const phoneNumber = normalizeCallerPhone(stringValue(rawArguments.phone_number) ?? callerPhone);
  if (!phoneNumber) {
    return {
      ok: false,
      error: "missing_phone_number",
      message: "Ask the caller for the best mobile number before offering to text this.",
    };
  }

  const kind = stringValue(rawArguments.kind)?.toLowerCase();
  try {
    if (kind === "reservation") {
      const reservation = parseReservationConfirmationArguments(rawArguments);
      if (!reservation) {
        return {
          ok: false,
          error: "missing_reservation_details",
          message: "Reservation texts need date, time, and party size.",
          phoneNumber,
        };
      }
      if (guestConfirmationService) {
        await guestConfirmationService.sendReservationConfirmation({
          date: reservation.date,
          guestName: stringValue(rawArguments.guest_name),
          partySize: reservation.partySize,
          restaurantName: context.restaurantName,
          time: reservation.time,
          to: phoneNumber,
        });
      } else {
        console.info("[openai-realtime] placeholder reservation text recorded", {
          date: reservation.date,
          partySize: reservation.partySize,
          to: phoneNumber,
        });
      }
    } else if (kind === "order") {
      const items = parseOrderItems(rawArguments.order_items);
      if (guestConfirmationService) {
        await guestConfirmationService.sendOrderConfirmation({
          customerName: stringValue(rawArguments.guest_name),
          etaMinutes: context.defaultPickupEtaMinutes,
          items,
          restaurantName: context.restaurantName,
          to: phoneNumber,
        });
      } else {
        console.info("[openai-realtime] placeholder order text recorded", {
          itemCount: items.length,
          to: phoneNumber,
        });
      }
    } else {
      const message = stringValue(rawArguments.message) ?? "Your request was received.";
      if (guestConfirmationService) {
        await guestConfirmationService.sendTextMessage({
          message,
          restaurantName: context.restaurantName,
          to: phoneNumber,
        });
      } else {
        console.info("[openai-realtime] placeholder guest text recorded", {
          messageLength: message.length,
          to: phoneNumber,
        });
      }
    }

    return {
      ok: true,
      message: "Text confirmation sent.",
      phoneNumber,
      sentToLastFour: phoneNumber.slice(-4),
    };
  } catch (error) {
    return {
      ok: false,
      error: "send_failed",
      message: error instanceof Error ? error.message : "Text confirmation failed.",
      phoneNumber,
    };
  }
}

export async function requestOpenAIRealtimeStaffCallback({
  callRecordId,
  callerPhone,
  context,
  locationId,
  rawArguments,
  staffNotificationService,
}: {
  callRecordId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  locationId?: string;
  rawArguments: Record<string, unknown>;
  staffNotificationService?: StaffNotificationService;
}) {
  const callbackPhone = normalizeCallerPhone(stringValue(rawArguments.callback_phone) ?? callerPhone);
  if (!callbackPhone) {
    return {
      ok: false,
      error: "missing_callback_phone",
      message: "Ask the caller for the best callback number before promising staff follow-up.",
    };
  }

  const kind = normalizeStaffCallbackKind(rawArguments.kind);
  const severity = normalizeStaffCallbackSeverity(rawArguments.urgency, kind);
  const callerName = stringValue(rawArguments.caller_name);
  const reason = stringValue(rawArguments.reason) ?? "Caller needs staff follow-up.";
  const question = stringValue(rawArguments.question);
  const details = [
    callerName && `Caller name: ${callerName}`,
    `Callback: ${callbackPhone}`,
    question && `Question: ${question}`,
    `Reason: ${reason}`,
  ].filter((item): item is string => Boolean(item));

  try {
    if (staffNotificationService) {
      await staffNotificationService.sendStaffAlert({
        callId: callRecordId,
        callerPhone: callbackPhone,
        details,
        kind,
        locationId,
        restaurantName: context.restaurantName,
        severity,
        summary: buildStaffCallbackSummary(kind, callerName, reason),
      });
    } else {
      console.info("[openai-realtime] placeholder staff callback recorded", {
        callbackLastFour: callbackPhone.slice(-4),
        kind,
        reason,
        restaurantName: context.restaurantName,
      });
    }

    return {
      ok: true,
      callbackPhone,
      message: "Staff callback request recorded. Tell the caller staff will call them back shortly; do not say you are transferring or placing them on hold.",
      sentToStaff: Boolean(staffNotificationService?.configured),
      status: "callback_requested",
    };
  } catch (error) {
    return {
      ok: false,
      callbackPhone,
      error: "staff_callback_failed",
      message: error instanceof Error ? error.message : "Staff callback request failed.",
    };
  }
}

async function checkOpenAIRealtimeModel({
  env,
  fetchImpl,
}: {
  env: OpenAIRealtimeEnv;
  fetchImpl: typeof fetch;
}): Promise<OpenAIRealtimePreflightCheck> {
  const model = resolveOpenAIRealtimeModel(env);
  if (!env.OPENAI_API_KEY) {
    return {
      detail: `Cannot verify ${model} until OPENAI_API_KEY is configured.`,
      id: "openai_realtime_model",
      label: "OpenAI realtime model",
      ready: false,
      required: true,
    };
  }

  try {
    const response = await fetchImpl(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
    });

    return {
      detail: response.ok
        ? `${model} is reachable with the configured OpenAI key.`
        : `${model} check returned ${response.status}. Confirm the model name and API key project access.`,
      id: "openai_realtime_model",
      label: "OpenAI realtime model",
      ready: response.ok,
      required: true,
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : `Could not verify ${model}.`,
      id: "openai_realtime_model",
      label: "OpenAI realtime model",
      ready: false,
      required: true,
    };
  }
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
    {
      description:
        "Send a caller-approved SMS confirmation or helpful follow-up text. Use only after the caller agrees to receive a text or explicitly asks for one.",
      name: "send_guest_confirmation",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: {
            description: "Guest or order name, if known.",
            type: "string",
          },
          kind: {
            description: "The type of text to send.",
            enum: ["reservation", "order", "note"],
            type: "string",
          },
          message: {
            description: "Short helpful message for note texts. Do not include sensitive information.",
            type: "string",
          },
          order_items: {
            description: "Pickup order items when sending an order confirmation.",
            items: {
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                price_cents: { type: "number" },
                quantity: { type: "number" },
              },
              required: ["name", "quantity"],
              type: "object",
            },
            type: "array",
          },
          party_size: {
            description: "Party size for reservation texts.",
            type: "number",
          },
          phone_number: {
            description: "Caller mobile number. Omit this to use SIP caller ID when available.",
            type: "string",
          },
          reservation_date: {
            description: "Reservation date in the restaurant's local context, preferably YYYY-MM-DD.",
            type: "string",
          },
          reservation_time: {
            description: "Reservation time, such as 6 PM or 18:00.",
            type: "string",
          },
        },
        required: ["kind"],
        type: "object",
      },
      type: "function" as const,
    },
    {
      description:
        "Save a reservation request after collecting date, time, party size, and guest name. In the current pilot this creates a staff-confirmed request rather than guaranteeing a live table.",
      name: "create_reservation_request",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: {
            description: "Guest name for the reservation.",
            type: "string",
          },
          notes: {
            description: "Special occasion, seating preference, accessibility need, or other short notes.",
            type: "string",
          },
          party_size: {
            description: "Number of guests.",
            type: "number",
          },
          phone_number: {
            description: "Caller phone number. Omit this to use SIP caller ID when available.",
            type: "string",
          },
          reservation_date: {
            description: "Reservation date in the restaurant's local calendar, preferably YYYY-MM-DD.",
            type: "string",
          },
          reservation_time: {
            description: "Reservation time in 24-hour HH:mm format, such as 18:00.",
            type: "string",
          },
        },
        required: ["guest_name", "party_size", "reservation_date", "reservation_time"],
        type: "object",
      },
      type: "function" as const,
    },
    {
      description:
        "Create a staff callback request for severe allergies, unknown answers, complaints, human requests, unusual substitutions, unavailable items, or any situation staff must confirm. This does not transfer the live call.",
      name: "request_staff_callback",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: {
            description: "Best callback number. Omit to use SIP caller ID when available.",
            type: "string",
          },
          caller_name: {
            description: "Caller name, if known.",
            type: "string",
          },
          kind: {
            description: "Reason category for staff routing.",
            enum: ["allergy", "complaint", "delivery_failure", "handoff", "low_confidence", "order", "reservation", "sales"],
            type: "string",
          },
          question: {
            description: "The exact question staff needs to answer, if this is an unknown-answer callback.",
            type: "string",
          },
          reason: {
            description: "Short staff-facing reason for the callback.",
            type: "string",
          },
          urgency: {
            description: "How urgent this feels.",
            enum: ["low", "medium", "high"],
            type: "string",
          },
        },
        required: ["kind", "reason"],
        type: "object",
      },
      type: "function" as const,
    },
    {
      description:
        "Finish the live call only after the caller clearly says they are done, says no to the anything-else question, or says goodbye. This lets the service close the phone session after one final goodbye.",
      name: "finish_call",
      parameters: {
        additionalProperties: false,
        properties: {
          closing_line: {
            description: "Short final sentence to say to the caller before the call ends.",
            type: "string",
          },
          reason: {
            description: "Why the call is ready to end.",
            enum: ["caller_done", "caller_goodbye", "wrong_number_complete", "silent_or_abandoned"],
            type: "string",
          },
        },
        required: ["reason"],
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

export function buildRestaurantLocalTimeContext(context: RestaurantVoiceContext, now = new Date()) {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: context.timezone,
    timeZoneName: "short",
    weekday: "long",
    year: "numeric",
  };

  try {
    return new Intl.DateTimeFormat("en-US", options).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: undefined,
      timeZoneName: "short",
    }).format(now);
  }
}

function resolveOpenAIRealtimeModel(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_MODEL?.trim() || OPENAI_REALTIME_DEFAULT_MODEL;
}

export function resolveOpenAIRealtimeSpeed(env: OpenAIRealtimeEnv) {
  const speed = Number.parseFloat(env.OPENAI_REALTIME_SPEED ?? "1.02");
  if (!Number.isFinite(speed)) return 1.02;
  return Math.min(1.12, Math.max(0.9, speed));
}

export function resolveOpenAIRealtimeNoiseReduction(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_NOISE_REDUCTION === "near_field" ? "near_field" : "far_field";
}

export function resolveOpenAIRealtimeTurnDetection(env: OpenAIRealtimeEnv): OpenAIRealtimeAcceptPayload["audio"]["input"]["turn_detection"] {
  if (env.OPENAI_REALTIME_TURN_DETECTION_MODE === "semantic_vad") {
    return {
      create_response: true,
      eagerness: resolveOpenAIRealtimeTurnEagerness(env),
      interrupt_response: resolveOpenAIRealtimeInterruptResponse(env),
      type: "semantic_vad",
    };
  }

  return {
    create_response: true,
    idle_timeout_ms: resolveOpenAIRealtimeIdleTimeoutMs(env),
    interrupt_response: resolveOpenAIRealtimeInterruptResponse(env),
    prefix_padding_ms: resolveOpenAIRealtimeServerVadPrefixPaddingMs(env),
    silence_duration_ms: resolveOpenAIRealtimeServerVadSilenceMs(env),
    threshold: resolveOpenAIRealtimeServerVadThreshold(env),
    type: "server_vad",
  };
}

export function resolveOpenAIRealtimeTurnEagerness(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_TURN_EAGERNESS === "medium" || env.OPENAI_REALTIME_TURN_EAGERNESS === "high"
    ? env.OPENAI_REALTIME_TURN_EAGERNESS
    : "low";
}

export function resolveOpenAIRealtimeServerVadThreshold(env: OpenAIRealtimeEnv) {
  const threshold = env.OPENAI_REALTIME_SERVER_VAD_THRESHOLD;
  return Number.isFinite(threshold) ? Math.min(0.95, Math.max(0.05, threshold)) : 0.72;
}

export function resolveOpenAIRealtimeServerVadSilenceMs(env: OpenAIRealtimeEnv) {
  const silenceMs = env.OPENAI_REALTIME_SERVER_VAD_SILENCE_MS;
  return Number.isFinite(silenceMs) ? Math.min(2000, Math.max(200, Math.round(silenceMs))) : 550;
}

export function resolveOpenAIRealtimeServerVadPrefixPaddingMs(env: OpenAIRealtimeEnv) {
  const prefixPaddingMs = env.OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS;
  return Number.isFinite(prefixPaddingMs) ? Math.min(1000, Math.max(0, Math.round(prefixPaddingMs))) : 250;
}

export function resolveOpenAIRealtimeIdleTimeoutMs(env: OpenAIRealtimeEnv) {
  const idleTimeoutMs = env.OPENAI_REALTIME_IDLE_TIMEOUT_MS;
  return Number.isFinite(idleTimeoutMs) ? Math.min(30000, Math.max(5000, Math.round(idleTimeoutMs))) : 9000;
}

export function resolveOpenAIRealtimeInterruptResponse(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_INTERRUPT_RESPONSE === true;
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

function normalizeStaffCallbackKind(value: unknown): StaffAlertKind {
  const kind = stringValue(value)?.toLowerCase();
  if (kind === "complaint") return "complaint";
  if (kind === "delivery_failure") return "delivery_failure";
  if (kind === "order") return "order";
  if (kind === "reservation") return "reservation";
  if (kind === "sales") return "sales";
  if (kind === "allergy" || kind === "low_confidence") return "low_confidence";
  return "handoff";
}

function normalizeStaffCallbackSeverity(value: unknown, kind: StaffAlertKind) {
  const severity = stringValue(value)?.toLowerCase();
  if (severity === "high" || kind === "complaint" || kind === "delivery_failure") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function buildStaffCallbackSummary(kind: StaffAlertKind, callerName: string | undefined, reason: string) {
  const label = kind === "low_confidence" ? "Staff confirmation" : "Staff callback";
  return `${label} requested${callerName ? ` for ${callerName}` : ""}: ${reason}`;
}

function extractCallerPhoneFromSipHeaders(headers: Array<{ name?: unknown; value?: unknown }> | undefined) {
  const priority = ["p-asserted-identity", "remote-party-id", "from", "x-twilio-from", "contact"];
  for (const name of priority) {
    const value = extractSipHeader(headers, [name]);
    if (value) return value;
  }
  return undefined;
}

function extractSipHeader(headers: Array<{ name?: unknown; value?: unknown }> | undefined, names: string[]) {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  const match = headers?.find((header) => normalizedNames.has(String(header.name ?? "").toLowerCase()));
  return stringValue(match?.value);
}

function normalizeCallerPhone(value?: string) {
  if (!value) return undefined;
  const match = value.match(/\+?[1-9][\d\s().-]{6,}\d/);
  if (!match) return undefined;

  const raw = match[0].trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function parseReservationConfirmationArguments(args: Record<string, unknown>) {
  const date = stringValue(args.reservation_date);
  const time = stringValue(args.reservation_time);
  const partySize = numberValue(args.party_size);
  if (!date || !time || !partySize) return null;
  return { date, partySize, time };
}

function normalizeRealtimeReservationTime(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const twentyFourHour = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) {
    return `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  const meridiem = normalized.match(/^(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)$/);
  if (!meridiem) return undefined;

  let hour = Number(meridiem[1]);
  const minutes = meridiem[2] ?? "00";
  const isPm = meridiem[3].startsWith("p");
  if (hour < 1 || hour > 12) return undefined;
  if (isPm && hour < 12) hour += 12;
  if (!isPm && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function parseOrderItems(value: unknown): CapturedOrderItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const name = stringValue(candidate.name);
      const quantity = numberValue(candidate.quantity);
      if (!name || !quantity) return null;
      return {
        name,
        priceCents: numberValue(candidate.price_cents) ?? 0,
        quantity,
      };
    })
    .filter((item): item is CapturedOrderItem => Boolean(item));
}

function numberValue(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : undefined;
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

function sanitizeClosingLine(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Thanks for calling. Goodbye.";
  const withoutQuestion = normalized.replace(/\?+$/g, ".");
  const words = withoutQuestion.split(/\s+/).slice(0, 12).join(" ");
  return /[.!]$/.test(words) ? words : `${words}.`;
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
