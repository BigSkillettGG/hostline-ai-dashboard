import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import WebSocket, { type RawData } from "ws";
import type { CallStore } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import type { GuestConfirmationService } from "./guest-confirmation-service";
import type { StaffAlertKind, StaffNotificationService } from "./notification-service";
import type { OwnerCommandRuntime } from "./owner-command-runtime";
import type { CapturedOrderItem } from "./order-intake";
import {
  businessLinkKindLabels,
  findBusinessLink,
  normalizeCustomerRequestKind,
  type CustomerRequestKind,
} from "../../../src/domain/business-links";
import { buildRestaurantInstructions, generateCallSummary } from "./restaurant-agent";
import { buildBusinessTranscriptionPrompt, capitalize, getRuntimeBusinessProfile } from "./business-runtime";
import { demoRestaurantContext, toSpokenRestaurantName, type RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import type { ReservationPlatformService } from "./reservation-platform-service";
import type { TranscriptRole, TranscriptTurn } from "./types";
import { createTwilioCallRecordingService, isTwilioCallSid, type CallRecordingService } from "./twilio-recording-service";
import type { TrustedContact } from "../../../src/domain/trusted-contacts";
import { resolveSignalHostOpenAIVoice } from "../../../src/domain/voice-selection";

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
  | "OPENAI_REALTIME_AIDEN_VOICE"
  | "OPENAI_REALTIME_AVA_VOICE"
  | "OPENAI_REALTIME_FEMALE_VOICE"
  | "OPENAI_REALTIME_IDLE_TIMEOUT_MS"
  | "OPENAI_REALTIME_INTERRUPT_RESPONSE"
  | "OPENAI_REALTIME_MALE_VOICE"
  | "OPENAI_REALTIME_MANUAL_RESPONSE_GATING"
  | "OPENAI_REALTIME_MARCO_VOICE"
  | "OPENAI_REALTIME_MAYA_VOICE"
  | "OPENAI_REALTIME_MILES_VOICE"
  | "OPENAI_REALTIME_MODEL"
  | "OPENAI_REALTIME_NOISE_REDUCTION"
  | "OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS"
  | "OPENAI_REALTIME_SERVER_VAD_SILENCE_MS"
  | "OPENAI_REALTIME_SERVER_VAD_THRESHOLD"
  | "OPENAI_REALTIME_SPEED"
  | "OPENAI_REALTIME_THEO_VOICE"
  | "OPENAI_REALTIME_TURN_DETECTION_MODE"
  | "OPENAI_REALTIME_TURN_EAGERNESS"
  | "OPENAI_REALTIME_VERA_VOICE"
  | "OPENAI_REALTIME_VOICE"
  | "OPENAI_WEBHOOK_SECRET"
  | "PUBLIC_HTTP_BASE_URL"
  | "SUPABASE_DEMO_LOCATION_ID"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_API_BASE_URL"
  | "TWILIO_AUTH_TOKEN"
  | "TWILIO_CALL_RECORDING_CHANNELS"
  | "TWILIO_CALL_RECORDING_ENABLED"
  | "TWILIO_CALL_RECORDING_TRACK"
>;

interface OpenAIRealtimeSipServiceOptions {
  callStore?: CallStore;
  callRecordingService?: CallRecordingService;
  fetchImpl?: typeof fetch;
  guestConfirmationService?: GuestConfirmationService;
  ownerCommandRuntime?: OwnerCommandRuntime;
  reservationPlatformService?: ReservationPlatformService;
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
  noiseReduction: "near_field" | "far_field";
  projectIdConfigured: boolean;
  ready: boolean;
  sipUri?: string;
  speed: number;
  turnDetection: OpenAIRealtimeAcceptPayload["audio"]["input"]["turn_detection"];
  voice: string;
  webhookSecretConfigured: boolean;
  webhookUrl?: string;
  callRecordingConfigured: boolean;
  recordingStatusCallbackUrl?: string;
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
  ignoredNoiseTranscriptCount: number;
}

interface OpenAIRealtimeSidebandSession {
  callId: string;
  callRecordId?: string;
  callerPhone?: string;
  completed: boolean;
  context: RestaurantVoiceContext;
  externalCallId: string;
  finishCloseTimer?: ReturnType<typeof setTimeout>;
  finishRequested: boolean;
  ignoredTranscriptSamples: Array<{ reason?: string; text: string }>;
  locationId: string;
  manualResponseGating: boolean;
  manualIdlePromptCount: number;
  manualIdleTimer?: ReturnType<typeof setTimeout>;
  manualIdleTimeoutMs: number;
  ownerContact?: TrustedContact;
  openingGreetingCompleted: boolean;
  pendingManualResponse: boolean;
  quality: RealtimeQualityMetrics;
  recordingBackfilled?: boolean;
  reservationCreatedId?: string;
  reservationConfirmed?: boolean;
  staffCallbackRequested: boolean;
  staffFollowUpRequired: boolean;
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
  ownerContact?: TrustedContact;
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
        create_response: boolean;
        eagerness: "low" | "medium" | "high";
        interrupt_response: boolean;
        type: "semantic_vad";
      } | {
        create_response: boolean;
        idle_timeout_ms?: number;
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
  const callRecordingService = options.callRecordingService ?? createTwilioCallRecordingService(env, fetchImpl);
  const guestConfirmationService = options.guestConfirmationService;
  const ownerCommandRuntime = options.ownerCommandRuntime;
  const reservationPlatformService = options.reservationPlatformService;
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
          socket.close(1001, "SignalHost voice service is restarting.");
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
      const ownerContact = findTrustedOwnerCaller(context, callerPhone);
      const twilioCallSid = extractOpenAIRealtimeExternalCallId(event);
      const externalCallId = twilioCallSid ?? callId;
      const externalSessionId = extractOpenAIRealtimeSipCallId(event) ?? callId;
      let callRecordId: string | undefined;
      try {
        const result = await callStore?.startRealtimeCall({
          callerName: ownerContact?.name,
          callerPhone,
          externalCallId,
          externalSessionId,
          locationId: resolvedLocationId,
          providerPayload: {
            openaiCallId: callId,
            ownerContactId: ownerContact?.id,
            ownerContactType: ownerContact?.contactType,
            ownerMode: Boolean(ownerContact),
            sipHeaders: event.data?.sip_headers ?? [],
            webhookEventId: event.id,
          },
        });
        callRecordId = result?.callId;
      } catch (error) {
        console.error("[openai-realtime] call start persistence failed", { callId, error });
      }
      if (twilioCallSid) {
        void callRecordingService.startCallRecording({
          callRecordId,
          externalCallSid: twilioCallSid,
          locationId: resolvedLocationId,
          openaiCallId: callId,
        }).then((result) => {
          if (result.started) {
            if (result.recordingUrl) {
              void callStore?.attachCallRecording({
                callId: callRecordId,
                externalCallSid: twilioCallSid,
                recordingSid: result.recordingSid,
                recordingUrl: result.recordingUrl,
              });
            }
            console.info("[openai-realtime] Twilio call recording started", {
              callId,
              externalCallSid: twilioCallSid,
              recordingSid: result.recordingSid,
            });
          }
        }).catch((error) => {
          console.warn("[openai-realtime] Twilio call recording start failed", {
            callId,
            error,
            externalCallSid: twilioCallSid,
          });
        });
      }
      const payload = buildOpenAIRealtimeAcceptPayload({ callerPhone, context, env, ownerContact });

      await acceptOpenAIRealtimeCall({
        callId,
        env,
        fetchImpl,
        payload,
      });

      startSidebandSocket({
        activeSockets,
        callRecordId,
        callRecordingService,
        callStore,
        callId,
        callerPhone,
        context,
        env,
        externalCallId,
        guestConfirmationService,
        locationId: resolvedLocationId,
        ownerCommandRuntime,
        ownerContact,
        reservationPlatformService,
        staffNotificationService,
        websocketFactory,
      });

      return {
        body: {
          accepted: true,
          callId,
          locationId: resolvedLocationId,
          model: payload.model,
          ownerMode: Boolean(ownerContact),
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
    {
      detail: "Needed to auto-start Twilio recordings and attach completed MP3 URLs to call records.",
      id: "twilio_call_recording",
      label: "Twilio call recording",
      ready: env.TWILIO_CALL_RECORDING_ENABLED !== "false" && Boolean(
        env.TWILIO_ACCOUNT_SID &&
          env.TWILIO_AUTH_TOKEN &&
          env.PUBLIC_HTTP_BASE_URL,
      ),
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
    callRecordingConfigured: env.TWILIO_CALL_RECORDING_ENABLED !== "false" && Boolean(
      env.TWILIO_ACCOUNT_SID &&
        env.TWILIO_AUTH_TOKEN &&
        env.PUBLIC_HTTP_BASE_URL,
    ),
    model,
    noiseReduction: resolveOpenAIRealtimeNoiseReduction(env),
    projectIdConfigured: Boolean(env.OPENAI_PROJECT_ID),
    ready: Boolean(env.OPENAI_API_KEY && webhookUrl),
    recordingStatusCallbackUrl: env.PUBLIC_HTTP_BASE_URL
      ? `${env.PUBLIC_HTTP_BASE_URL.replace(/\/$/, "")}/twilio/recording-status`
      : undefined,
    sipUri: env.OPENAI_PROJECT_ID ? `sip:${env.OPENAI_PROJECT_ID}@sip.api.openai.com;transport=tls` : undefined,
    speed: resolveOpenAIRealtimeSpeed(env),
    turnDetection: resolveOpenAIRealtimeTurnDetection(env),
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
  ownerContact,
}: BuildOpenAIRealtimeAcceptPayloadInput): OpenAIRealtimeAcceptPayload {
  const voice = resolveOpenAIRealtimeVoice(env, context);

  return {
    audio: {
      input: {
        noise_reduction: { type: resolveOpenAIRealtimeNoiseReduction(env) },
        transcription: {
          language: "en",
          model: "gpt-4o-mini-transcribe",
          prompt: buildBusinessTranscriptionPrompt(context),
        },
        turn_detection: resolveOpenAIRealtimeTurnDetection(env),
      },
      output: {
        speed: resolveOpenAIRealtimeSpeed(env),
        voice,
      },
    },
    instructions: buildOpenAIRealtimeInstructions(context, { callerPhone, now, ownerContact }),
    max_output_tokens: 280,
    model: resolveOpenAIRealtimeModel(env),
    output_modalities: ["audio"],
    tool_choice: "auto",
    tools: buildOpenAIRealtimeTools(context, ownerContact),
    type: "realtime",
  };
}

export function buildOpenAIRealtimeInstructions(
  context: RestaurantVoiceContext,
  callContext: { callerPhone?: string; now?: Date; ownerContact?: TrustedContact } = {},
) {
  if (callContext.ownerContact) {
    return buildOwnerRealtimeInstructions(context, callContext.ownerContact, callContext);
  }

  const localTimeContext = buildRestaurantLocalTimeContext(context, callContext.now);
  const callerPhoneContext = callContext.callerPhone
    ? `Caller phone number from SIP caller ID: ${callContext.callerPhone}. If the caller asks for a text or agrees to a confirmation, you may text this number. If offering a text, say the last four digits, not the full number.`
    : "Caller phone number is not available from SIP caller ID. Ask for the best mobile number before offering to text confirmations.";
  const openingGreeting = buildShortOpeningGreeting(context);
  const businessLinksContext = buildRealtimeBusinessLinksInstruction(context);
  const orderModeContext = buildRealtimeOrderModeInstruction(context);
  const reservationModeContext = buildRealtimeReservationModeInstruction(context);
  const profile = getRuntimeBusinessProfile(context);
  const contextLookupTool = profile.isRestaurant ? "lookup_restaurant_context" : "lookup_business_context";

  return [
    buildRestaurantInstructions(context),
    `Current ${profile.businessNoun} local time: ${localTimeContext}. Use this for today, tonight, tomorrow, open-now, seasonal-priority, and booking-date questions.`,
    callerPhoneContext,
    "Realtime phone behavior:",
    "This is one continuous live phone call. Never restart the opening greeting in the middle of the call.",
    `Opening greeting to use when the call begins: "${openingGreeting}"`,
    "Say the opening greeting once at the start of the call, exactly as written. Do not add 'hi', 'hello', your name, or any extra words before or after it. Do not say you are virtual or AI in the opening.",
    "If the caller says 'hello' before you have greeted them, immediately give the full opening greeting instead of only saying hello back.",
    profile.isRestaurant
      ? "Voice style: bright, upbeat, polished, and genuinely delighted to help, like an excellent restaurant host. Avoid IVR cadence, monotone delivery, robotic precision, or over-enunciating the restaurant name."
      : "Voice style: bright, upbeat, polished, and genuinely delighted to help, like an excellent front desk employee. Avoid IVR cadence, monotone delivery, robotic precision, or over-enunciating the business name.",
    "Greeting energy: deliver the exact opening greeting with a big smile in your voice, confident warmth, and high hospitality energy. Do not add extra words like 'hi'.",
    "Pacing: speak briskly enough for a phone call, with varied intonation and short sentence chunks. Do not drag out 'Olive and Ember'.",
    "Voice color: keep a clear smile in the greeting and positive answers; use gentle concern for allergies or complaints; stay lively and human without becoming silly.",
    "Make answers feel specific to what the caller just said. For example, if they ask about a table for 6 tonight, say 'For 6 tonight...' before asking only for the missing detail.",
    profile.isRestaurant
      ? "Use 'we' when speaking for the restaurant, such as 'we're open until 10' or 'we have parking behind the building.'"
      : `Use 'we' when speaking for the ${profile.businessNoun}, such as 'we can help with that' or 'we serve your area.'`,
    profile.isRestaurant
      ? "Use natural restaurant-host acknowledgements like 'Sure', 'Absolutely', 'Of course', 'One moment', and 'Let me check that' when they fit."
      : `Use natural ${profile.staffNoun} acknowledgements like 'Sure', 'Absolutely', 'Of course', 'One moment', and 'Let me check that' when they fit.`,
    "If the caller pauses, wait naturally. If silence continues, ask a gentle continuation question such as 'Take your time. What else can I help you with?'",
    "Noisy-room behavior: ignore TV audio, background conversations, faint echoes, room noise, and your own voice coming back through the caller's phone. Only treat clear directed human speech as caller intent.",
    "Echo guardrail: if the caller audio appears to repeat your own greeting or phrases like 'thank you for calling' or 'how can I help you', treat it as echo or background audio. Do not repeat the greeting or respond as if it were a new customer request.",
    "If the caller only says 'hello', 'pardon', or 'are you there' after you have already greeted them, acknowledge once with 'I'm here' and wait for their actual request. Do not restart the opening greeting.",
    "Handle clear interruptions gracefully. If the caller clearly cuts you off with speech, answer their latest request. Do not restart the call because of a noise, echo, or short silence.",
    "If the caller is in a very loud place or the audio is too unclear to understand, do not guess. Say briefly that it is too noisy to hear clearly and ask them to move somewhere quieter, call back, or let staff follow up by text/callback.",
    "Before any lookup or task that may take a moment, say one short natural bridge such as 'Sure, let me check that' or 'One moment, I am checking now,' then use the tool. Vary the wording and do not sound like an IVR.",
    profile.isRestaurant
      ? "Use cached restaurant facts naturally. The facts are not a script; keep your wording warm, human, and specific to the caller's question."
      : `Use cached ${profile.businessNoun} facts naturally. The facts are not a script; keep your wording warm, human, and specific to the caller's question.`,
    profile.isRestaurant
      ? `Use the ${contextLookupTool} tool for specials, hours, parking, directions, menu, reservation policy, pickup timing, payment, allergies, delivery drivers, lost items, complaints, or anything policy-like.`
      : `Use the ${contextLookupTool} tool for hours, service area, directions, ${profile.offeringNoun}, ${profile.appointmentNoun} policy, quote policy, payment, safety, lost items, complaints, or anything policy-like.`,
    "After answering any normal question or completing any task, ask a short loop-closing question such as 'Can I help you with anything else?' unless the caller has already clearly said goodbye.",
    "Never end the call immediately after answering a question. The call should only close after the caller indicates they are done.",
    "If the caller says no, no thanks, that's all, that's it, I'm good, or similar after your anything-else question, call finish_call with a short closing line like 'Thanks for calling. Goodbye.' Do not ask another question.",
    "Do not call finish_call until the caller clearly indicates they are done or says goodbye.",
    "When finish_call returns ok, say only the closing line, then stop speaking. The call will end.",
    "If the caller says yes after your anything-else question, say 'Of course, what else can I help with?' and continue.",
    businessLinksContext,
    "There is no live staff transfer in this pilot. Never say you are connecting, transferring, or placing the caller on hold for staff.",
    "When a caller needs staff, use request_staff_callback, then say you are sending the message to staff and someone will call them back shortly.",
    "If you do not know an answer after checking context, do not guess. Offer a staff callback and collect the missing name, callback number, and question.",
    "For severe allergies, never guarantee safety. Use request_staff_callback and say staff needs to confirm because cross-contact is possible.",
    reservationModeContext,
    orderModeContext,
    profile.isRestaurant
      ? "For reservation requests, acknowledge any date, time, or party size already spoken, then ask only for missing details."
      : `For ${profile.appointmentNoun}, estimate, quote, or service requests, acknowledge any need, location, timing, or urgency already spoken, then ask only for missing details.`,
    profile.isRestaurant
      ? "When reservation date, time, party size, and guest name are known, use create_reservation_request to save the request. If the tool says provider_confirmed, tell the caller the reservation is confirmed. If the tool says staff confirmation is needed, tell the caller it is requested and staff will confirm."
      : `When customer name, callback number, request summary, urgency, and useful details are known, use create_customer_request with service_appointment, quote, lead, callback, or complaint. Tell the caller ${profile.staffNoun} will follow up; do not promise a confirmed ${profile.appointmentNoun} unless the context explicitly says it is confirmed.`,
    profile.isRestaurant
      ? "Reservation name guardrail: do not treat 'no', 'none', 'that's all', 'I'm good', goodbye phrases, or refusal phrases as a guest name. If the caller declines or skips the name, ask once for a real name or offer to have staff use caller ID for follow-up; do not save a fake name."
      : "Name guardrail: do not treat 'no', 'none', 'that's all', 'I'm good', goodbye phrases, or refusal phrases as a customer name.",
    profile.isRestaurant
      ? "For pickup orders, follow the configured order operating mode. If taking a manual request, collect items, quantities, name, and callback number. If link-first, offer to text the ordering link."
      : `For service requests, follow the configured request operating mode. If link-first, offer to text the booking, quote, or intake link. If staff-review, collect the details ${profile.staffNoun} need.`,
    profile.isRestaurant
      ? "For menu substitutions or off-menu requests, use the restaurant substitution policy. If allowed and obvious, note it as a request; if uncertain, say you can include the request but staff must confirm. Never guarantee off-menu items, allergy accommodations, prices, or availability unless the menu context explicitly confirms them."
      : "For unusual services, substitutions, and out-of-scope requests, use the business policy. If uncertain, collect the details for staff confirmation. Never guarantee availability, price, timing, or safety unless the context explicitly confirms it.",
    profile.isRestaurant
      ? "For reservations and pickup orders, once the request is captured, naturally offer to text a confirmation. Example: 'Would you like me to text that confirmation to the number ending 1234?'"
      : `For ${profile.appointmentNoun}, quote, intake, and callback requests, once the request or link is captured, naturally offer to text a confirmation or helpful link. Example: 'Would you like me to text that to the number ending 1234?'`,
    "Only send a text after the caller agrees or asks for it. Use the send_guest_confirmation tool for reservation, order, or helpful follow-up texts.",
    "When the caller asks for a configured link, use send_business_link after they ask for it or agree to receive it by text.",
    profile.isRestaurant
      ? "For generic leads, service appointments, quote requests, or requests outside the restaurant-specific tools, use create_customer_request after collecting the name, callback number, and request summary."
      : `For leads, ${profile.appointmentNoun}s, quote requests, and anything outside the specialized tools, use create_customer_request after collecting the name, callback number, request summary, urgency, and key details.`,
    "If the send_guest_confirmation tool succeeds, tell the caller the text is sent. Do not mention backend setup, SMS providers, or placeholder mode.",
    "Close naturally only after the caller is done. Use finish_call, say a short goodbye, and do not ask another question after goodbye.",
  ].join("\n");
}

export function buildOwnerRealtimeInstructions(
  context: RestaurantVoiceContext,
  ownerContact: TrustedContact,
  callContext: { callerPhone?: string; now?: Date } = {},
) {
  const profile = getRuntimeBusinessProfile(context);
  const firstName = firstNameOf(ownerContact.name);
  const localTimeContext = buildRestaurantLocalTimeContext(context, callContext.now);
  const phoneContext = callContext.callerPhone
    ? `Trusted caller ID: ${callContext.callerPhone}. Matched ${ownerContact.contactType} contact ${ownerContact.name}.`
    : `Trusted contact: ${ownerContact.contactType} ${ownerContact.name}. Caller ID was not available.`;

  return [
    `You are SignalHost speaking with ${firstName}, a trusted ${ownerContact.contactType.replace(/_/g, " ")} for ${context.restaurantName}.`,
    `This is an internal owner-assistant call, not a customer call. Never use the public customer greeting for ${context.restaurantName}.`,
    `Current ${profile.businessNoun} local time: ${localTimeContext}.`,
    phoneContext,
    `Opening greeting to use when the call begins: "${buildOwnerOpeningGreeting(ownerContact)}"`,
    "Say the owner greeting once, then stop and listen.",
    "The owner may ask for reports, urgent calls, open follow-ups, knowledge gaps, high-value opportunities, orders, reservations, or call volume.",
    "The owner may also teach permanent knowledge, such as 'remember that the bathroom is white', or give live updates, such as 'we are closed tomorrow' or 'tonight's special is lobster ravioli'.",
    "For any owner report question, live update, or permanent knowledge update, call run_owner_command with the owner's exact latest request. Do not claim something was saved until the tool says it was applied.",
    "After run_owner_command returns, summarize the spokenResponse naturally in one or two short sentences. If bullets are present, mention only the most important one or two.",
    "If the tool says approval is required, tell them it needs owner approval and that live caller behavior has not changed yet.",
    "If the tool says the command was unclear, ask one short clarifying question.",
    "Keep the tone friendly, useful, and staff-like. You are briefing the owner, not selling to a customer.",
    "After answering or saving an update, ask 'Anything else you want me to check or update?'",
    "Only finish the call after the owner clearly says they are done or says goodbye. Then call finish_call with a short closing line.",
  ].join("\n");
}

function buildRealtimeReservationModeInstruction(context: RestaurantVoiceContext) {
  const profile = getRuntimeBusinessProfile(context);
  const settings = context.reservationSettings;
  const label = profile.isRestaurant ? "Reservation" : `${capitalize(profile.appointmentNoun)} / booking`;
  const base = `${label} operating mode: ${settings.handlingMode}; provider: ${settings.provider}; current workflow: ${settings.sourceToday ?? "not specified"}.`;
  if (!profile.isRestaurant) {
    if (!settings.enabled || settings.handlingMode === "disabled") {
      return `${base} Do not book ${profile.appointmentNoun}s unless staff configuration changes; collect a callback request only if the customer wants follow-up.`;
    }
    if (settings.handlingMode === "booking_link") {
      return `${base} Offer to text the booking link${settings.bookingUrl ? ` (${settings.bookingUrl})` : ""}; do not collect the full request unless the customer wants staff follow-up.`;
    }
    return `${base} For ${profile.appointmentNoun}, estimate, inspection, or service booking requests, use create_customer_request after collecting customer name, callback number, service need, address or service area, urgency, and preferred window. Never guarantee a confirmed ${profile.appointmentNoun} until ${profile.staffNoun} confirm it.`;
  }
  if (!settings.enabled || settings.handlingMode === "disabled") {
    return `${base} Do not book or request reservations unless staff configuration changes; explain that this line is not taking booking requests right now.`;
  }
  if (settings.handlingMode === "booking_link") {
    return `${base} Offer to text the booking link${settings.bookingUrl ? ` (${settings.bookingUrl})` : ""}; do not collect full reservation details unless the caller wants staff follow-up.`;
  }
  if (settings.handlingMode === "integration") {
    return `${base} Try the connected provider through create_reservation_request; only call it after date, time, party size, and guest name are known.`;
  }
  if (settings.handlingMode === "hostline_lite_confirm") {
    return `${base} SignalHost may confirm only within configured rules${settings.autoConfirmPartyLimit ? `, including parties up to ${settings.autoConfirmPartyLimit}` : ""}; otherwise the request needs staff confirmation.`;
  }
  if (settings.handlingMode === "hostline_lite_request") {
    return `${base} Save a pending SignalHost reservation request and tell the caller staff will confirm shortly.`;
  }
  return `${base} Create a staff-confirmed reservation request; never guarantee the table until staff confirms.`;
}

function buildRealtimeOrderModeInstruction(context: RestaurantVoiceContext) {
  const profile = getRuntimeBusinessProfile(context);
  const settings = context.orderSettings;
  const base = profile.isRestaurant
    ? `Order operating mode: ${settings.handlingMode}.`
    : `Service-request operating mode: ${settings.handlingMode}.`;
  if (!profile.isRestaurant) {
    if (!settings.enabled || settings.handlingMode === "disabled") {
      return `${base} Do not capture service requests unless staff enables them; answer policy questions and offer staff follow-up if needed.`;
    }
    if (settings.handlingMode === "online_link") {
      return `${base} Offer to text the configured request, booking, quote, or intake link${settings.onlineOrderingUrl ? ` (${settings.onlineOrderingUrl})` : ""}; do not manually capture the full request unless the customer wants staff follow-up.`;
    }
    if (settings.handlingMode === "staff_review_and_link") {
      return `${base} Ask whether the customer wants a configured link or wants you to collect details for ${profile.staffNoun} review.`;
    }
    return `${base} Capture the request details for ${profile.staffNoun} review and never promise exact availability, price, or arrival time until staff confirms.`;
  }
  if (!settings.enabled || settings.handlingMode === "disabled") {
    return `${base} Do not take pickup orders; answer menu questions and offer staff follow-up if needed.`;
  }
  if (settings.handlingMode === "online_link") {
    return `${base} Offer to text the online ordering link${settings.onlineOrderingUrl ? ` (${settings.onlineOrderingUrl})` : ""}; do not manually capture the full order unless the caller needs staff follow-up.`;
  }
  if (settings.handlingMode === "staff_review_and_link") {
    return `${base} Ask whether the caller wants the online ordering link or wants you to take the order for staff review.`;
  }
  return `${base} Take the order details for staff review and never promise kitchen production until staff accepts it.`;
}

function buildRealtimeBusinessLinksInstruction(context: RestaurantVoiceContext) {
  if (!context.businessLinks.length) {
    return "No business links are configured yet.";
  }

  const links = context.businessLinks
    .map((link) => `${businessLinkKindLabels[link.kind]}: ${link.label} (${link.url})`)
    .join("; ");
  return `Configured business links for phone, website chat, and text follow-up: ${links}.`;
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

export function findTrustedOwnerCaller(context: RestaurantVoiceContext, callerPhone?: string) {
  const normalizedCallerPhone = normalizeCallerPhone(callerPhone);
  if (!normalizedCallerPhone) return undefined;

  return context.trustedContacts.find((contact) =>
    contact.canUseOwnerAssistant &&
    contact.phone &&
    normalizeCallerPhone(contact.phone) === normalizedCallerPhone
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

export function lookupBusinessContext(context: RestaurantVoiceContext, rawTopic: unknown) {
  const profile = getRuntimeBusinessProfile(context);
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

  if (
    topic.includes("menu") ||
    topic.includes("order") ||
    topic.includes("special") ||
    topic.includes("food") ||
    topic.includes("service") ||
    topic.includes("appointment") ||
    topic.includes("quote") ||
    topic.includes("estimate") ||
    topic.includes("repair") ||
    topic.includes("inspection")
  ) {
    return {
      businessName: context.restaurantName,
      businessType: profile.businessType,
      currentBusinessTime: buildRestaurantLocalTimeContext(context),
      offeringHighlights: context.menuHighlights,
      offeringItems: context.menuItems.slice(0, 30).map((item) => ({
        aliases: item.aliases,
        modifiers: item.modifiers,
        name: item.name,
        price: formatPrice(item.priceCents),
      })),
      policies: profile.isRestaurant
        ? pickPolicies(context, ["menu", "substitutions", "specials", "pickup", "payment", "allergies"])
        : pickPolicies(context, ["menu", "substitutions", "specials", "pickup", "payment", "allergies", "hours", "location", "reservations", "waitlist"]),
      profile: {
        appointmentNoun: profile.appointmentNoun,
        businessNoun: profile.businessNoun,
        customerNoun: profile.customerNoun,
        offeringNoun: profile.offeringNoun,
        staffNoun: profile.staffNoun,
      },
      topic,
    };
  }

  return {
    businessName: context.restaurantName,
    businessType: profile.businessType,
    currentBusinessTime: buildRestaurantLocalTimeContext(context),
    faqs: faqMatches,
    knowledgeSections: knowledgeMatches,
    policies: policyMatches.length ? Object.fromEntries(policyMatches) : context.policies,
    profile: {
      appointmentNoun: profile.appointmentNoun,
      businessNoun: profile.businessNoun,
      customerNoun: profile.customerNoun,
      offeringNoun: profile.offeringNoun,
      staffNoun: profile.staffNoun,
    },
    topic,
  };
}

export function lookupRestaurantContext(context: RestaurantVoiceContext, rawTopic: unknown) {
  const result = lookupBusinessContext(context, rawTopic);
  return {
    ...result,
    currentRestaurantTime: buildRestaurantLocalTimeContext(context),
    menuHighlights: context.menuHighlights,
    restaurantName: context.restaurantName,
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
  callRecordingService,
  context,
  env,
  externalCallId,
  guestConfirmationService,
  locationId,
  ownerCommandRuntime,
  ownerContact,
  reservationPlatformService,
  staffNotificationService,
  websocketFactory,
}: {
  activeSockets: Map<string, RealtimeSocket>;
  callRecordId?: string;
  callStore?: CallStore;
  callId: string;
  callerPhone?: string;
  callRecordingService?: CallRecordingService;
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
  externalCallId: string;
  guestConfirmationService?: GuestConfirmationService;
  locationId: string;
  ownerCommandRuntime?: OwnerCommandRuntime;
  ownerContact?: TrustedContact;
  reservationPlatformService?: ReservationPlatformService;
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
    callId,
    callRecordId,
    callerPhone,
    completed: false,
    context,
    externalCallId,
    finishRequested: false,
    ignoredTranscriptSamples: [],
    locationId,
    manualIdlePromptCount: 0,
    manualIdleTimeoutMs: resolveOpenAIRealtimeIdleTimeoutMs(env),
    manualResponseGating: resolveOpenAIRealtimeManualResponseGating(env),
    ownerContact,
    openingGreetingCompleted: false,
    pendingManualResponse: false,
    quality: createRealtimeQualityMetrics(),
    staffCallbackRequested: false,
    staffFollowUpRequired: false,
    startedAt: Date.now(),
    toolEvents: [],
    transcript: [],
    transcriptKeys: new Set(),
  };

  socket.on("open", () => {
    console.info("[openai-realtime] sideband connected", { callId, locationId });
    sendRealtimeEvent(socket, {
      session: {
        instructions: buildOpenAIRealtimeInstructions(context, { callerPhone, ownerContact }),
        tool_choice: "auto",
        tools: buildOpenAIRealtimeTools(context, ownerContact),
        type: "realtime",
      },
      type: "session.update",
    });
    sendRealtimeEvent(socket, {
      response: {
        instructions: buildOpeningGreetingInstructions(context, ownerContact),
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
      handleOpenAIRealtimeTranscriptTurn({
        callId,
        callStore,
        session,
        socket,
        turn: transcriptTurn,
      });
    }

    const toolCalls = extractOpenAIRealtimeToolCalls(event);
    if (toolCalls.length) {
      markRealtimeToolCalls(session, toolCalls);
      void handleOpenAIRealtimeToolCalls({
        callStore,
        callerPhone,
        callRecordId: session.callRecordId,
        context,
        guestConfirmationService,
        locationId,
        ownerCommandRuntime,
        ownerContact,
        reservationPlatformService,
        session,
        socket,
        staffNotificationService,
        toolCalls,
      });
      return;
    }

    if (eventType === "response.done") {
      handleOpenAIRealtimeResponseDone({ callId, session, socket });
      return;
    }

    if (eventType === "input_audio_buffer.speech_stopped") {
      scheduleOpenAIRealtimeManualIdlePrompt({ callId, session, socket });
    }
  });

  socket.on("close", (code, reason) => {
    activeSockets.delete(callId);
    clearOpenAIRealtimeFinishedClose(session);
    clearOpenAIRealtimeManualIdleTimer(session);
    void completeOpenAIRealtimeLoggedCall({
      callStore,
      callRecordingService,
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
    clearOpenAIRealtimeManualIdleTimer(session);
    void completeOpenAIRealtimeLoggedCall({
      callStore,
      callRecordingService,
      closeReason: error.message,
      env,
      session,
    });
    console.error("[openai-realtime] sideband failed", { callId, error });
  });
}

export function buildOpeningGreetingInstructions(context: RestaurantVoiceContext, ownerContact?: TrustedContact) {
  if (ownerContact) {
    return buildOwnerOpeningGreetingInstructions(ownerContact);
  }

  const greeting = buildShortOpeningGreeting(context);
  const profile = getRuntimeBusinessProfile(context);
  return [
    "Say this exact opening greeting once as soon as the call starts, then stop and listen:",
    greeting,
    profile.isRestaurant
      ? "Deliver it with bright, high-energy hospitality, like a friendly restaurant host with a big smile in your voice."
      : `Deliver it with bright, high-energy hospitality, like a friendly ${profile.staffNoun} with a big smile in your voice.`,
    profile.isRestaurant
      ? "Do not add 'hi' or 'hello', do not add your name, do not say you are virtual or AI, and do not add menu, hours, or reservation information."
      : `Do not add 'hi' or 'hello', do not add your name, do not say you are virtual or AI, and do not add ${profile.offeringNoun}, hours, or ${profile.appointmentNoun} information.`,
  ].join(" ");
}

export function buildOwnerOpeningGreetingInstructions(ownerContact: TrustedContact) {
  return [
    "Say this exact internal owner greeting once as soon as the call starts, then stop and listen:",
    buildOwnerOpeningGreeting(ownerContact),
    "Do not use the public business greeting, do not say you are virtual or AI, and do not mention customer-facing features unless asked.",
  ].join(" ");
}

export function buildOwnerOpeningGreeting(ownerContact: TrustedContact) {
  return `Hi ${firstNameOf(ownerContact.name)}, it's SignalHost. What would you like to check or update?`;
}

export function buildShortOpeningGreeting(context: RestaurantVoiceContext) {
  return `Thank you for calling ${toSpokenRestaurantName(context.restaurantName)}. How can I help you?`;
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
    ignoredNoiseTranscriptCount: 0,
  };
}

function recordOpenAIRealtimeQualityEvent(session: OpenAIRealtimeSidebandSession, eventType: string, callId: string) {
  const now = Date.now();
  if (eventType === "input_audio_buffer.speech_started") {
    clearOpenAIRealtimeManualIdleTimer(session);
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
    clearOpenAIRealtimeManualIdleTimer(session);
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

function handleOpenAIRealtimeTranscriptTurn({
  callId,
  callStore,
  session,
  socket,
  turn,
}: {
  callId: string;
  callStore?: CallStore;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  turn: RealtimeTranscriptTurn;
}) {
  if (hasOpenAIRealtimeTranscriptTurn(session, turn)) return;

  if (turn.role === "caller" && session.manualResponseGating) {
    const decision = shouldAcceptRealtimeCallerTranscript(session, turn.text);
    if (!decision.accept) {
      session.quality.ignoredNoiseTranscriptCount += 1;
      recordIgnoredRealtimeTranscriptSample(session, turn.text, decision.reason);
      discardIgnoredRealtimeConversationItem({ session, socket, turn });
      console.info("[openai-realtime] ignored likely background transcript", {
        callId,
        reason: decision.reason,
        sample: turn.text.slice(0, 100),
      });
      return;
    }
  }

  void persistOpenAIRealtimeTranscriptTurn({
    callStore,
    session,
    turn,
  });

  if (turn.role === "caller" && session.manualResponseGating) {
    clearOpenAIRealtimeManualIdleTimer(session);
    session.manualIdlePromptCount = 0;
    requestOpenAIRealtimeManualResponse({ callId, session, socket });
  }
}

function handleOpenAIRealtimeResponseDone({
  callId,
  session,
  socket,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
}) {
  if (!session.openingGreetingCompleted) {
    session.openingGreetingCompleted = true;
  }

  if (session.finishRequested) {
    scheduleOpenAIRealtimeFinishedClose({ callId, session, socket });
    return;
  }

  if (session.manualResponseGating && session.pendingManualResponse) {
    sendOpenAIRealtimeManualResponse({ callId, session, socket });
    return;
  }

  scheduleOpenAIRealtimeManualIdlePrompt({ callId, session, socket });
}

function requestOpenAIRealtimeManualResponse({
  callId,
  session,
  socket,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
}) {
  if (session.finishRequested) return;
  if (!session.openingGreetingCompleted || session.quality.activeResponseStartedAt) {
    session.pendingManualResponse = true;
    return;
  }
  sendOpenAIRealtimeManualResponse({ callId, session, socket });
}

function sendOpenAIRealtimeManualResponse({
  callId,
  session,
  socket,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
}) {
  clearOpenAIRealtimeManualIdleTimer(session);
  session.pendingManualResponse = false;
  console.info("[openai-realtime] creating gated response for accepted caller turn", { callId });
  sendRealtimeEvent(socket, { type: "response.create" });
}

function scheduleOpenAIRealtimeManualIdlePrompt({
  callId,
  session,
  socket,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
}) {
  if (!session.manualResponseGating || session.finishRequested || session.quality.activeResponseStartedAt) return;
  clearOpenAIRealtimeManualIdleTimer(session);
  session.manualIdleTimer = setTimeout(() => {
    if (session.finishRequested || session.quality.activeResponseStartedAt || session.pendingManualResponse) return;
    const isFinalPrompt = session.manualIdlePromptCount >= 3;
    session.manualIdlePromptCount += 1;
    if (isFinalPrompt) {
      session.finishRequested = true;
    }
    console.info("[openai-realtime] creating manual idle recovery response", {
      callId,
      final: isFinalPrompt,
      promptCount: session.manualIdlePromptCount,
    });
    delete session.manualIdleTimer;
    sendRealtimeEvent(socket, {
      response: {
        instructions: isFinalPrompt
          ? "The caller has not responded after several gentle check-ins. Do not answer or refer to any unclear background phrase. Do not restart the greeting. Say exactly and only: \"I still can't hear you, so I'll let you go for now. Please call back anytime. Thanks for calling. Goodbye.\""
          : "The caller may be silent, thinking, or checking the connection. Do not answer or refer to any unclear background phrase. Do not restart the greeting. Say exactly and only: \"I'm still here. Take your time. What else can I help with?\"",
      },
      type: "response.create",
    });
  }, session.manualIdleTimeoutMs);
}

function clearOpenAIRealtimeManualIdleTimer(session: OpenAIRealtimeSidebandSession) {
  if (!session.manualIdleTimer) return;
  clearTimeout(session.manualIdleTimer);
  delete session.manualIdleTimer;
}

function recordIgnoredRealtimeTranscriptSample(
  session: OpenAIRealtimeSidebandSession,
  text: string,
  reason?: string,
) {
  if (session.ignoredTranscriptSamples.length >= 5) return;
  session.ignoredTranscriptSamples.push({
    reason,
    text: text.trim().slice(0, 140),
  });
}

function hasOpenAIRealtimeTranscriptTurn(session: OpenAIRealtimeSidebandSession, turn: RealtimeTranscriptTurn) {
  return session.transcriptKeys.has(getOpenAIRealtimeTranscriptKey(turn));
}

function getOpenAIRealtimeTranscriptKey(turn: RealtimeTranscriptTurn) {
  return `${turn.role}:${turn.itemId ?? turn.text.trim()}`;
}

function shouldAcceptRealtimeCallerTranscript(
  session: OpenAIRealtimeSidebandSession,
  text: string,
): { accept: boolean; reason?: string } {
  const normalized = normalizeRealtimeCallerText(text);
  if (!normalized) return { accept: false, reason: "empty" };
  if (isOpenAIRealtimeTranscriptionPromptLeak(normalized)) return { accept: false, reason: "prompt_leak" };
  if (isLikelyOpenAIRealtimeAgentEcho(session, normalized)) return { accept: false, reason: "agent_echo" };

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const activeResponse = Boolean(session.quality.activeResponseStartedAt);
  const greetingPhase = !session.openingGreetingCompleted;
  const strongIntent = hasStrongCallerIntent(normalized);
  const clearIntent = hasLikelyCallerIntent(normalized);
  const directedSpeech = hasLikelyDirectedCallerSpeech(normalized);
  const shortConfirmation = isLikelyShortCallerConfirmation(normalized);
  const answerToAgentQuestion = isLikelyAnswerToRecentAgentQuestion(session, normalized);

  if (greetingPhase || activeResponse) {
    if (strongIntent || directedSpeech || shortConfirmation) return { accept: true };
    return { accept: false, reason: greetingPhase ? "greeting_noise" : "response_noise" };
  }

  if (clearIntent || directedSpeech || shortConfirmation || answerToAgentQuestion) return { accept: true };
  if (wordCount >= 4 && /\b(i|we|you|your|can|could|would|need|want|looking|calling|trying)\b/.test(normalized)) {
    return { accept: true };
  }
  return { accept: false, reason: "no_caller_intent" };
}

function discardIgnoredRealtimeConversationItem({
  session,
  socket,
  turn,
}: {
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  turn: RealtimeTranscriptTurn;
}) {
  if (!turn.itemId || session.finishRequested) return;
  sendRealtimeEvent(socket, {
    item_id: turn.itemId,
    type: "conversation.item.delete",
  });
}

function normalizeRealtimeCallerText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyOpenAIRealtimeAgentEcho(session: OpenAIRealtimeSidebandSession, normalized: string) {
  const businessName = normalizeRealtimeCallerText(toSpokenRestaurantName(session.context.restaurantName));
  return (
    normalized.includes("thank you for calling") ||
    normalized.includes("how can i help you") ||
    (Boolean(businessName) && normalized.includes(businessName) && normalized.includes("how can i help"))
  );
}

function hasLikelyCallerIntent(normalized: string) {
  return /\b(order|pickup|takeout|reservation|reserve|table|book|booking|appointment|quote|estimate|service|repair|emergency|leak|roof|hvac|plumb|electric|haircut|barber|color|hours|open|closed|close|menu|special|specials|parking|address|direction|directions|allergy|allergic|catering|private event|party|availability|available|tonight|today|tomorrow|callback|call back|manager|staff|text|email|price|cost|how much|delivery|lost|found|complaint|refund)\b/.test(
    normalized,
  );
}

function hasStrongCallerIntent(normalized: string) {
  return /\b(order|pickup|takeout|reservation|reserve|table|appointment|quote|estimate|emergency|leak|roof|hvac|plumb|electric|haircut|barber|color|hours|open|closed|close|menu|specials|parking|address|direction|directions|allergy|allergic|catering|private event|party|callback|call back|manager|text|email|price|cost|how much|delivery|lost|found|complaint|refund)\b/.test(
    normalized,
  );
}

function hasLikelyDirectedCallerSpeech(normalized: string) {
  return (
    /\b(what|when|where|why|how|who|do you|are you|can i|can you|could i|could you|would you|i need|i want|i'd like|i would like|i'm calling|i am calling|i was wondering|let me|get me|looking for|are you there|can you hear me|i'm here|i am here)\b/.test(
      normalized,
    ) || /\?$/.test(normalized)
  );
}

function isLikelyAnswerToRecentAgentQuestion(session: OpenAIRealtimeSidebandSession, normalized: string) {
  if (isLikelyBackgroundMediaFragment(normalized)) return false;
  const lastAgentTurn = session.transcript.filter((turn) => turn.role === "agent").at(-1)?.text ?? "";
  const lastAgent = normalizeRealtimeCallerText(lastAgentTurn);
  if (!lastAgent || !lastAgentTurn.includes("?")) return false;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 8) return true;

  return /\b(my|name|phone|number|address|order|party|people|tonight|tomorrow|today|please|sure|yes|no)\b/.test(normalized);
}

function isLikelyBackgroundMediaFragment(normalized: string) {
  return /\b(coming up next|after the break|sponsored by|watch now|streaming|subscribe|tonight on|commercial free|weather forecast)\b/.test(
    normalized,
  );
}

function isLikelyShortCallerConfirmation(normalized: string) {
  return /^(yes|yeah|yep|sure|please|no|nope|no thank you|no thanks|that's all|that is all|thanks|thank you|goodbye|bye|hello|hi|hello hello|hi hi|hello are you there|hi are you there)$/.test(
    normalized,
  );
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
  if (isOpenAIRealtimeTranscriptionPromptLeak(text)) {
    console.warn("[openai-realtime] ignored leaked transcription prompt", {
      externalCallId: session.externalCallId,
      role: turn.role,
    });
    return;
  }

  const key = getOpenAIRealtimeTranscriptKey({ ...turn, text });
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
      kind:
        toolCall.name === "create_reservation_request"
          ? "reservation"
          : toolCall.name === "create_customer_request"
            ? stringValue(toolCall.arguments.request_type)
            : toolCall.name === "send_business_link"
              ? stringValue(toolCall.arguments.link_kind)
              : toolCall.name === "run_owner_command"
                ? "owner_command"
                : stringValue(toolCall.arguments.kind),
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
      socket.close(1000, "SignalHost call completed.");
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
  callRecordingService,
  callStore,
  closeCode,
  closeReason,
  env,
  session,
}: {
  callRecordingService?: CallRecordingService;
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
      reservationId: session.reservationCreatedId,
      status: classification.status,
      summary,
    });
    scheduleOpenAIRealtimeRecordingBackfill({
      callRecordingService,
      callStore,
      session,
    });
  } catch (error) {
    console.error("[openai-realtime] call completion persistence failed", {
      error,
      externalCallId: session.externalCallId,
    });
  }
}

function scheduleOpenAIRealtimeRecordingBackfill({
  callRecordingService,
  callStore,
  session,
}: {
  callRecordingService?: CallRecordingService;
  callStore: CallStore;
  session: OpenAIRealtimeSidebandSession;
}) {
  if (!callRecordingService?.configured || !isTwilioCallSid(session.externalCallId)) return;

  for (const delayMs of [2500, 10000, 30000]) {
    const timer = setTimeout(() => {
      if (session.recordingBackfilled) return;
      void backfillOpenAIRealtimeRecording({
        callRecordingService,
        callStore,
        session,
      });
    }, delayMs);
    timer.unref?.();
  }
}

async function backfillOpenAIRealtimeRecording({
  callRecordingService,
  callStore,
  session,
}: {
  callRecordingService: CallRecordingService;
  callStore: CallStore;
  session: OpenAIRealtimeSidebandSession;
}) {
  try {
    if (session.recordingBackfilled) return;
    const result = await callRecordingService.findCompletedCallRecording({
      externalCallSid: session.externalCallId,
    });
    if (!result.recordingUrl) return;

    await callStore.attachCallRecording({
      callId: session.callRecordId,
      durationSeconds: result.durationSeconds,
      externalCallSid: session.externalCallId,
      recordingSid: result.recordingSid,
      recordingUrl: result.recordingUrl,
    });
    session.recordingBackfilled = true;
    console.info("[openai-realtime] Twilio call recording backfilled", {
      callId: session.callId,
      externalCallSid: session.externalCallId,
      recordingSid: result.recordingSid,
      recordingStatus: result.status,
    });
  } catch (error) {
    console.warn("[openai-realtime] Twilio call recording backfill failed", {
      callId: session.callId,
      error,
      externalCallSid: session.externalCallId,
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
  if (session.ownerContact) {
    return {
      confidence: session.transcript.length ? 90 : 30,
      intent: "other",
      outcome: "owner_assistant",
      status: session.transcript.length ? "resolved" : "needs_review",
    };
  }

  const callerText = session.transcript
    .filter((turn) => turn.role === "caller")
    .map((turn) => turn.text)
    .join(" ")
    .toLowerCase();
  const toolNames = new Set(session.toolEvents.map((event) => event.name));
  const toolKinds = new Set(session.toolEvents.map((event) => event.kind).filter(Boolean));
  const hasOrderIntent =
    toolKinds.has("order") ||
    /\b(place|make|put in|start|take)\s+(an?\s+)?(pickup\s+|takeout\s+|to\s+go\s+)?order\b/.test(callerText) ||
    /\b(can|could|may)\s+i\s+(order|get|have)\b/.test(callerText) ||
    /\b(i('|’)d like|i would like|let me get|can i get|i'll have|we'll have)\b/.test(callerText);
  const hasReservationIntent =
    toolKinds.has("reservation") || /\b(reservation|reserve|book|table for|party of)\b/.test(callerText);
  const hasHoursIntent = /\b(hour|hours|open|close|closing|tonight|today|tomorrow)\b/.test(callerText);
  const intent = hasOrderIntent
    ? "order"
    : hasReservationIntent
      ? "reservation"
      : hasHoursIntent
        ? "hours"
        : session.transcript.length
          ? "faq"
          : "other";

  const qualityNeedsReview =
    session.quality.toolErrorCount > 0 ||
    session.quality.speechStartedDuringResponseCount >= 3 ||
    (session.quality.speechStartCount >= 3 && session.quality.callerTranscriptCount === 0);
  const needsReview = session.staffCallbackRequested || toolNames.has("request_staff_callback") || qualityNeedsReview;
  const followUpToolUsed =
    session.staffFollowUpRequired ||
    toolNames.has("create_customer_request");
  const outcome = needsReview
    ? "escalated"
    : toolNames.has("create_customer_request")
      ? "message_taken"
    : session.reservationConfirmed
      ? "reservation_booked"
    : session.staffFollowUpRequired && toolNames.has("create_reservation_request")
      ? "message_taken"
    : toolNames.has("send_guest_confirmation") || toolNames.has("send_business_link")
      ? "resolved"
      : intent === "order"
        ? "message_taken"
        : "resolved";

  return {
    confidence: session.transcript.length ? (needsReview ? 72 : 88) : 20,
    intent,
    outcome,
    status: needsReview || !session.transcript.length ? "needs_review" : followUpToolUsed ? "new" : "resolved",
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
  const ignoredSummary = session.ignoredTranscriptSamples.length
    ? `Ignored likely background: ${session.ignoredTranscriptSamples.map((sample) => `${sample.reason ?? "noise"} "${sample.text}"`).join(" / ")}.`
    : "";

  return [
    session.ownerContact
      ? `Internal owner-assistant call with ${session.ownerContact.name} (${session.ownerContact.contactType}).`
      : "",
    `OpenAI Realtime call classified as ${classification.intent}; outcome ${classification.outcome}.`,
    callerTurns.length ? `Caller said: ${callerTurns.slice(-3).join(" / ")}.` : "No caller transcript was captured.",
    agentTurns.length ? `SignalHost replied: ${agentTurns.slice(-2).join(" / ")}.` : "",
    actionSummary,
    qualitySummary,
    ignoredSummary,
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
    session.quality.ignoredNoiseTranscriptCount > 0 && `${session.quality.ignoredNoiseTranscriptCount} likely background transcript(s) ignored`,
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

function isOpenAIRealtimeTranscriptionPromptLeak(text: string) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    /^hi,?\s+this is a phone call with\b/.test(normalized) ||
    /^this is a phone call with\b/.test(normalized) ||
    normalized.includes("expect restaurant words:") ||
    (normalized.includes("expect ") && normalized.includes(" words:") && normalized.includes("terms include:")) ||
    normalized.startsWith("transcription vocabulary hints for ") ||
    (normalized.includes("likely caller topics:") && normalized.includes("likely ") && normalized.includes(" terms:"))
  );
}

async function handleOpenAIRealtimeToolCalls({
  callStore,
  callerPhone,
  callRecordId,
  context,
  guestConfirmationService,
  locationId,
  ownerCommandRuntime,
  ownerContact,
  reservationPlatformService,
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
  ownerCommandRuntime?: OwnerCommandRuntime;
  ownerContact?: TrustedContact;
  reservationPlatformService?: ReservationPlatformService;
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
        ownerCommandRuntime,
        ownerContact,
        reservationPlatformService,
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
  if (ok && output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const reservationId = stringValue(record.reservationId);
    const outputStatus = stringValue(record.status);
    if (toolCall.name === "create_reservation_request") {
      if (reservationId) session.reservationCreatedId = reservationId;
      if (outputStatus === "confirmed") {
        session.reservationConfirmed = true;
      } else if (outputStatus !== "booking_link_required") {
        session.staffFollowUpRequired = true;
      }
    }
    if (toolCall.name === "create_customer_request") {
      session.staffFollowUpRequired = true;
    }
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
  ownerCommandRuntime,
  ownerContact,
  reservationPlatformService,
  staffNotificationService,
  toolCall,
}: {
  callStore?: CallStore;
  callerPhone?: string;
  callRecordId?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  ownerCommandRuntime?: OwnerCommandRuntime;
  ownerContact?: TrustedContact;
  reservationPlatformService?: ReservationPlatformService;
  staffNotificationService?: StaffNotificationService;
  toolCall: OpenAIRealtimeToolCall;
}) {
  if (toolCall.name === "lookup_restaurant_context") {
    return lookupRestaurantContext(context, toolCall.arguments.topic);
  }

  if (toolCall.name === "run_owner_command") {
    return runOpenAIRealtimeOwnerCommand({
      locationId,
      ownerCommandRuntime,
      ownerContact,
      rawArguments: toolCall.arguments,
    });
  }

  if (toolCall.name === "lookup_business_context") {
    return lookupBusinessContext(context, toolCall.arguments.topic);
  }

  if (toolCall.name === "send_guest_confirmation") {
    return sendOpenAIRealtimeGuestConfirmation({
      callRecordId,
      callerPhone,
      context,
      guestConfirmationService,
      locationId,
      rawArguments: toolCall.arguments,
    });
  }

  if (toolCall.name === "send_business_link") {
    return sendOpenAIRealtimeBusinessLink({
      callRecordId,
      callerPhone,
      context,
      guestConfirmationService,
      locationId,
      rawArguments: toolCall.arguments,
    });
  }

  if (toolCall.name === "create_customer_request") {
    return createOpenAIRealtimeCustomerRequest({
      callRecordId,
      callStore,
      callerPhone,
      context,
      locationId,
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
      reservationPlatformService,
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

export async function runOpenAIRealtimeOwnerCommand({
  locationId,
  ownerCommandRuntime,
  ownerContact,
  rawArguments,
}: {
  locationId?: string;
  ownerCommandRuntime?: OwnerCommandRuntime;
  ownerContact?: TrustedContact;
  rawArguments: Record<string, unknown>;
}) {
  const message = stringValue(rawArguments.message);
  if (!ownerContact) {
    return {
      ok: false,
      error: "trusted_owner_not_found",
      message: "This caller is not recognized as a trusted owner or manager.",
    };
  }
  if (!ownerCommandRuntime) {
    return {
      ok: false,
      error: "owner_command_runtime_missing",
      message: "Owner command runtime is not configured.",
    };
  }
  if (!message) {
    return {
      ok: false,
      error: "missing_owner_command_message",
      message: "Ask the owner what they want to check or update.",
    };
  }

  return ownerCommandRuntime.runCommand({
    actor: ownerContact,
    channel: "phone",
    locationId: locationId ?? "",
    message,
  });
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
  reservationPlatformService,
}: {
  callRecordId?: string;
  callStore?: CallStore;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  locationId?: string;
  rawArguments: Record<string, unknown>;
  reservationPlatformService?: ReservationPlatformService;
}) {
  const date = stringValue(rawArguments.reservation_date);
  const time = normalizeRealtimeReservationTime(stringValue(rawArguments.reservation_time));
  const partySize = numberValue(rawArguments.party_size);
  const guestName = normalizeRealtimeGuestName(stringValue(rawArguments.guest_name));
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
      message: [
        `Ask only for the missing reservation detail${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
        missing.includes("guest_name")
          ? "Do not treat words like no, none, that's all, I'm good, or goodbye as a reservation name."
          : "",
        missing.includes("guest_name") && callbackPhone
          ? `If the caller does not want to give a name, ask whether staff may use the phone number ending ${callbackPhone.slice(-4)} for follow-up instead.`
          : "",
      ].filter(Boolean).join(" "),
      missing,
    };
  }

  const reservationSettings = context.reservationSettings;
  if (!reservationSettings.enabled || reservationSettings.handlingMode === "disabled") {
    return {
      ok: false,
      error: "reservations_disabled",
      message:
        "Tell the caller the restaurant is not taking reservations through this line. Offer to answer other questions or take a staff callback message if needed.",
      status: "disabled",
    };
  }

  if (reservationSettings.handlingMode === "booking_link" && reservationSettings.bookingUrl) {
    return {
      ok: true,
      bookingUrl: reservationSettings.bookingUrl,
      confirmationMode: "booking_link",
      message:
        "Offer to text the booking link to the caller. Do not say the reservation is confirmed because the guest still needs to book through the link.",
      provider: reservationSettings.provider,
      restaurantName: context.restaurantName,
      status: "booking_link_required",
    };
  }

  try {
    if (
      reservationSettings.handlingMode === "hostline_lite_confirm" &&
      reservationSettings.autoConfirmPartyLimit &&
      partySize <= reservationSettings.autoConfirmPartyLimit
    ) {
      const result = await callStore?.createStaffReviewReservation({
        callId: callRecordId,
        callerPhone: callbackPhone,
        confidence: 90,
        date,
        guestName,
        locationId,
        manualRequest: false,
        notes: stringValue(rawArguments.notes),
        partySize,
        provider: "hostline_lite",
        status: "confirmed",
        time,
      });

      return {
        ok: true,
        confirmationMode: "hostline_lite_confirmed",
        message:
          "Reservation confirmed in SignalHost. Tell the caller it is confirmed and offer to text the confirmation.",
        provider: "hostline_lite",
        reservationId: result?.reservationId,
        restaurantName: context.restaurantName,
        status: "confirmed",
      };
    }

    const shouldTryProvider = reservationSettings.handlingMode === "integration";
    const platformResult = shouldTryProvider
      ? await reservationPlatformService?.createReservation({
          callId: callRecordId,
          callerPhone: callbackPhone,
          context,
          date,
          guestName,
          locationId,
          notes: stringValue(rawArguments.notes),
          partySize,
          time,
        })
      : undefined;
    if (platformResult?.ok && platformResult.provider === "opentable" && platformResult.status === "confirmed") {
      const result = await callStore?.createStaffReviewReservation({
        callId: callRecordId,
        callerPhone: callbackPhone,
        confidence: 94,
        date,
        guestName,
        locationId,
        manualRequest: false,
        notes: stringValue(rawArguments.notes),
        partySize,
        provider: "opentable",
        providerReservationId: platformResult.providerReservationId ?? platformResult.confirmationCode,
        status: "confirmed",
        time,
      });

      return {
        ok: true,
        confirmationCode: platformResult.confirmationCode,
        confirmationMode: "provider_confirmed",
        message:
          "Reservation confirmed in OpenTable. Tell the caller it is confirmed and offer to text the confirmation.",
        provider: "opentable",
        providerReservationId: platformResult.providerReservationId,
        reservationId: result?.reservationId,
        restaurantName: context.restaurantName,
        status: "confirmed",
      };
    }

    const fallbackProvider = fallbackReservationProvider(reservationSettings.handlingMode, platformResult?.provider);
    const result = await callStore?.createStaffReviewReservation({
      callId: callRecordId,
      callerPhone: callbackPhone,
      confidence: 88,
      date,
      guestName,
      locationId,
      manualRequest: true,
      notes: buildReservationFallbackNotes({
        notes: stringValue(rawArguments.notes),
        platformResult,
      }),
      partySize,
      provider: fallbackProvider,
      time,
    });

    return {
      ok: true,
      confirmationMode: reservationSettings.handlingMode === "hostline_lite_request" ? "hostline_lite_pending" : "staff_confirmed",
      message:
        platformResult?.status === "unavailable"
          ? "Requested time was unavailable in OpenTable. Tell the caller staff will review and confirm options shortly; do not guarantee the table."
          : "Reservation request saved. Tell the caller staff will confirm it shortly; do not guarantee the table until staff confirms.",
      provider: fallbackProvider,
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

function fallbackReservationProvider(mode: string, platformProvider?: string) {
  if (platformProvider === "opentable") return "opentable";
  if (mode === "hostline_lite_request" || mode === "hostline_lite_confirm") return "hostline_lite";
  return "manual_request";
}

function buildReservationFallbackNotes({
  notes,
  platformResult,
}: {
  notes?: string;
  platformResult?: { message?: string; provider?: string; status?: string };
}) {
  return [
    notes,
    platformResult?.provider === "opentable"
      ? `OpenTable did not confirm automatically. Status: ${platformResult.status}. ${platformResult.message ?? ""}`.trim()
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function sendOpenAIRealtimeGuestConfirmation({
  callRecordId,
  callerPhone,
  context,
  guestConfirmationService,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
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
          callId: callRecordId,
          date: reservation.date,
          guestName: stringValue(rawArguments.guest_name),
          locationId,
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
          callId: callRecordId,
          customerName: stringValue(rawArguments.guest_name),
          etaMinutes: context.defaultPickupEtaMinutes,
          items,
          locationId,
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
          callId: callRecordId,
          locationId,
          message,
          restaurantName: context.restaurantName,
          threadType: "general",
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

export async function sendOpenAIRealtimeBusinessLink({
  callRecordId,
  callerPhone,
  context,
  guestConfirmationService,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  rawArguments: Record<string, unknown>;
}) {
  const phoneNumber = normalizeCallerPhone(stringValue(rawArguments.phone_number) ?? callerPhone);
  if (!phoneNumber) {
    return {
      ok: false,
      error: "missing_phone_number",
      message: "Ask the caller for the best mobile number before offering to text this link.",
    };
  }

  const link = findBusinessLink(context.businessLinks, rawArguments.link_kind);
  if (!link) {
    return {
      ok: false,
      error: "missing_business_link",
      message: "No configured link matches that request. Offer staff follow-up instead of inventing a URL.",
    };
  }

  const message = `${link.label}: ${link.url}`;
  try {
    if (guestConfirmationService) {
      await guestConfirmationService.sendTextMessage({
        callId: callRecordId,
        locationId,
        message,
        restaurantName: context.restaurantName,
        threadType: "business_link",
        to: phoneNumber,
      });
    } else {
      console.info("[openai-realtime] placeholder business link text recorded", {
        kind: link.kind,
        to: phoneNumber,
        url: link.url,
      });
    }

    return {
      ok: true,
      link,
      message: `Texted ${link.label}. Tell the caller it is sent.`,
      phoneNumber,
      sentToLastFour: phoneNumber.slice(-4),
    };
  } catch (error) {
    return {
      ok: false,
      error: "send_link_failed",
      message: error instanceof Error ? error.message : "Business link text failed.",
      phoneNumber,
    };
  }
}

export async function createOpenAIRealtimeCustomerRequest({
  callRecordId,
  callerPhone,
  callStore,
  context,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callerPhone?: string;
  callStore?: CallStore;
  context: RestaurantVoiceContext;
  locationId?: string;
  rawArguments: Record<string, unknown>;
}) {
  const customerPhone = normalizeCallerPhone(stringValue(rawArguments.callback_phone) ?? callerPhone);
  if (!customerPhone) {
    return {
      ok: false,
      error: "missing_callback_phone",
      message: "Ask the caller for the best callback number before saving this request.",
    };
  }

  const requestType = normalizeCustomerRequestKind(rawArguments.request_type);
  const summary = stringValue(rawArguments.summary);
  if (!summary) {
    return {
      ok: false,
      error: "missing_summary",
      message: "Summarize what the customer needs in one staff-facing sentence before saving.",
    };
  }

  try {
    const result = await callStore?.createCustomerRequest({
      callId: callRecordId,
      customerName: stringValue(rawArguments.caller_name),
      customerPhone,
      details: normalizeCustomerRequestDetails(rawArguments.details),
      locationId,
      priority: normalizeCustomerRequestPriority(rawArguments.urgency, requestType),
      requestType,
      summary,
    });

    return {
      ok: true,
      message: "Customer request saved. Tell the caller staff will follow up shortly.",
      requestId: result?.requestId,
      requestType,
      status: "customer_request_saved",
      taskId: result?.taskId,
    };
  } catch (error) {
    return {
      ok: false,
      error: "customer_request_failed",
      message: error instanceof Error ? error.message : "Customer request could not be saved.",
      requestType,
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

function buildOpenAIRealtimeTools(context: RestaurantVoiceContext = demoRestaurantContext, ownerContact?: TrustedContact) {
  if (ownerContact) return buildOwnerRealtimeTools();

  const profile = getRuntimeBusinessProfile(context);
  const lookupName = profile.isRestaurant ? "lookup_restaurant_context" : "lookup_business_context";
  const tools = [
    {
      description: profile.isRestaurant
        ? "Look up restaurant facts, policies, FAQs, menu highlights, specials, hours, parking, reservations, pickup, payment, allergy, delivery, lost item, complaint, vendor, or human handoff details before answering."
        : `Look up ${profile.businessNoun} facts, policies, FAQs, ${profile.offeringNoun} highlights, service area, hours, ${profile.appointmentNoun}s, quote policy, payment, safety, complaint, vendor, or human handoff details before answering.`,
      name: lookupName,
      parameters: {
        additionalProperties: false,
        properties: {
          topic: {
            description: profile.isRestaurant
              ? "The restaurant topic the caller asked about, such as specials, hours, parking, reservations, pickup, payment, allergies, delivery drivers, lost item, complaint, vendor, or menu."
              : `The ${profile.businessNoun} topic the caller asked about, such as hours, service area, ${profile.offeringNoun}, ${profile.appointmentNoun}s, quotes, payment, safety, complaints, vendors, or staff callback.`,
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
            description: `${capitalize(profile.customerNoun)}, guest, order, or request name, if known.`,
            type: "string",
          },
          kind: {
            description: "The type of text to send.",
            enum: ["appointment", "order", "quote", "request", "reservation", "note"],
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
            description: profile.isRestaurant
              ? "Reservation date in the restaurant's local context, preferably YYYY-MM-DD."
              : `${capitalize(profile.appointmentNoun)} or request date in the business's local context, preferably YYYY-MM-DD.`,
            type: "string",
          },
          reservation_time: {
            description: profile.isRestaurant ? "Reservation time, such as 6 PM or 18:00." : `${capitalize(profile.appointmentNoun)} or request time, such as 6 PM or 18:00.`,
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
        "Send a configured business link, such as online ordering, reservations, booking, menu, quote, or intake. Use after the caller asks for the link or agrees to receive it by text.",
      name: "send_business_link",
      parameters: {
        additionalProperties: false,
        properties: {
          link_kind: {
            description: "Which configured link to send.",
            enum: ["booking", "custom", "intake", "menu", "ordering", "quote", "reservation"],
            type: "string",
          },
          phone_number: {
            description: "Caller mobile number. Omit this to use SIP caller ID when available.",
            type: "string",
          },
        },
        required: ["link_kind"],
        type: "object",
      },
      type: "function" as const,
    },
    {
      description:
        "Create a generic staff-facing customer request for leads, service appointments, quotes, order requests, reservation requests, callbacks, or other business workflows not handled by a specialized tool.",
      name: "create_customer_request",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: {
            description: "Best callback number. Omit to use SIP caller ID when available.",
            type: "string",
          },
          caller_name: {
            description: "Customer name, if known.",
            type: "string",
          },
          details: {
            additionalProperties: true,
            description: "Short structured details such as requested date, service area, issue, budget, or notes.",
            type: "object",
          },
          request_type: {
            description: "The category of request.",
            enum: ["callback", "complaint", "general", "lead", "order", "quote", "reservation", "service_appointment"],
            type: "string",
          },
          summary: {
            description: "One concise staff-facing sentence summarizing what the customer needs.",
            type: "string",
          },
          urgency: {
            description: "How urgent this request is.",
            enum: ["low", "normal", "high", "urgent"],
            type: "string",
          },
        },
        required: ["request_type", "summary"],
        type: "object",
      },
      type: "function" as const,
    },
    {
      description:
        "Save a restaurant reservation request after collecting date, time, party size, and guest name. In the current pilot this creates a staff-confirmed request rather than guaranteeing a live table.",
      name: "create_reservation_request",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: {
            description: "Real guest name for the reservation. Never use no, none, that's all, I'm good, goodbye, or refusal phrases as the name.",
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
  return profile.isRestaurant ? tools : tools.filter((tool) => tool.name !== "create_reservation_request");
}

function buildOwnerRealtimeTools() {
  return [
    {
      description:
        "Run a trusted owner or manager command. Use for reports, urgent calls, follow-ups, live business updates, business modes, and permanent knowledge updates. Pass the owner's exact latest request.",
      name: "run_owner_command",
      parameters: {
        additionalProperties: false,
        properties: {
          message: {
            description: "The owner or manager's exact latest request, such as 'what happened today' or 'remember that the bathroom is white'.",
            type: "string",
          },
        },
        required: ["message"],
        type: "object",
      },
      type: "function" as const,
    },
    {
      description:
        "Finish the internal owner call only after the owner clearly says they are done, says no to the anything-else question, or says goodbye.",
      name: "finish_call",
      parameters: {
        additionalProperties: false,
        properties: {
          closing_line: {
            description: "Short final sentence to say to the owner before the call ends.",
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

export function resolveOpenAIRealtimeManualResponseGating(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_MANUAL_RESPONSE_GATING !== false;
}

export function resolveOpenAIRealtimeTurnDetection(env: OpenAIRealtimeEnv): OpenAIRealtimeAcceptPayload["audio"]["input"]["turn_detection"] {
  const createResponse = !resolveOpenAIRealtimeManualResponseGating(env);
  if (env.OPENAI_REALTIME_TURN_DETECTION_MODE === "semantic_vad") {
    return {
      create_response: createResponse,
      eagerness: resolveOpenAIRealtimeTurnEagerness(env),
      interrupt_response: resolveOpenAIRealtimeInterruptResponse(env),
      type: "semantic_vad",
    };
  }

  const turnDetection: OpenAIRealtimeAcceptPayload["audio"]["input"]["turn_detection"] = {
    create_response: createResponse,
    interrupt_response: resolveOpenAIRealtimeInterruptResponse(env),
    prefix_padding_ms: resolveOpenAIRealtimeServerVadPrefixPaddingMs(env),
    silence_duration_ms: resolveOpenAIRealtimeServerVadSilenceMs(env),
    threshold: resolveOpenAIRealtimeServerVadThreshold(env),
    type: "server_vad",
  };
  if (createResponse) {
    turnDetection.idle_timeout_ms = resolveOpenAIRealtimeIdleTimeoutMs(env);
  }
  return turnDetection;
}

export function resolveOpenAIRealtimeTurnEagerness(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_TURN_EAGERNESS === "medium" || env.OPENAI_REALTIME_TURN_EAGERNESS === "high"
    ? env.OPENAI_REALTIME_TURN_EAGERNESS
    : "low";
}

export function resolveOpenAIRealtimeServerVadThreshold(env: OpenAIRealtimeEnv) {
  const threshold = env.OPENAI_REALTIME_SERVER_VAD_THRESHOLD;
  return Number.isFinite(threshold) ? Math.min(0.95, Math.max(0.05, threshold)) : 0.88;
}

export function resolveOpenAIRealtimeServerVadSilenceMs(env: OpenAIRealtimeEnv) {
  const silenceMs = env.OPENAI_REALTIME_SERVER_VAD_SILENCE_MS;
  return Number.isFinite(silenceMs) ? Math.min(2000, Math.max(200, Math.round(silenceMs))) : 900;
}

export function resolveOpenAIRealtimeServerVadPrefixPaddingMs(env: OpenAIRealtimeEnv) {
  const prefixPaddingMs = env.OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS;
  return Number.isFinite(prefixPaddingMs) ? Math.min(1000, Math.max(0, Math.round(prefixPaddingMs))) : 150;
}

export function resolveOpenAIRealtimeIdleTimeoutMs(env: OpenAIRealtimeEnv) {
  const idleTimeoutMs = env.OPENAI_REALTIME_IDLE_TIMEOUT_MS;
  return Number.isFinite(idleTimeoutMs) ? Math.min(45000, Math.max(15000, Math.round(idleTimeoutMs))) : 18000;
}

export function resolveOpenAIRealtimeInterruptResponse(env: OpenAIRealtimeEnv) {
  return env.OPENAI_REALTIME_INTERRUPT_RESPONSE === true;
}

function resolveOpenAIRealtimeVoice(env: OpenAIRealtimeEnv, context: RestaurantVoiceContext) {
  if (env.OPENAI_REALTIME_VOICE?.trim()) return env.OPENAI_REALTIME_VOICE.trim();
  return resolveSignalHostOpenAIVoice(context.voiceProfileId ?? context.hostName ?? context.voiceGender, {
    aiden: env.OPENAI_REALTIME_AIDEN_VOICE || env.OPENAI_REALTIME_THEO_VOICE || env.OPENAI_REALTIME_MALE_VOICE,
    ava: env.OPENAI_REALTIME_AVA_VOICE || env.OPENAI_REALTIME_VERA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE || OPENAI_REALTIME_DEFAULT_FEMALE_VOICE,
    female: env.OPENAI_REALTIME_FEMALE_VOICE,
    male: env.OPENAI_REALTIME_MALE_VOICE,
    maya: env.OPENAI_REALTIME_MAYA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE,
    miles: env.OPENAI_REALTIME_MILES_VOICE || env.OPENAI_REALTIME_MARCO_VOICE || env.OPENAI_REALTIME_MALE_VOICE || OPENAI_REALTIME_DEFAULT_MALE_VOICE,
  });
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

function normalizeCustomerRequestPriority(value: unknown, requestType: CustomerRequestKind) {
  if (value === "urgent" || value === "high" || value === "normal" || value === "low") return value;
  if (requestType === "complaint") return "high";
  if (requestType === "service_appointment") return "normal";
  return "normal";
}

function normalizeCustomerRequestDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const details: Record<string, string | number | boolean> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      details[key] = rawValue;
    }
  }
  return Object.keys(details).length ? details : undefined;
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

function firstNameOf(value: string) {
  return value.trim().split(/\s+/)[0] || "there";
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

function normalizeRealtimeGuestName(value?: string) {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return undefined;
  if (
    /^(n\/?a|na|no|nope|none|nothing|no thanks|no thank you|not needed)$/.test(normalized) ||
    /^(thats all|that is all|thats it|that is it|im good|i am good|all set|goodbye|bye)$/.test(normalized) ||
    /^no\s+(thats|that is|thanks|thank you|im|i am|all)/.test(normalized)
  ) {
    return undefined;
  }
  return value.trim();
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
