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
import { capitalize, getRuntimeBusinessProfile } from "./business-runtime";
import { toSpokenRestaurantName, type RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import type { ReservationPlatformService } from "./reservation-platform-service";
import type { TranscriptRole, TranscriptTurn } from "./types";
import { createTwilioCallRecordingService, isTwilioCallSid, type CallRecordingService } from "./twilio-recording-service";
import { recordToolCallMetric } from "./metrics";
import { classifyRealtimeToolError } from "./openai-realtime-tool-errors";
import { buildOpenAIRealtimeTools, buildOpenAIRealtimeTranscriptionPrompt } from "./openai-realtime-tools";
import type { TrustedContact } from "../../../src/domain/trusted-contacts";
import { resolveSignalHostOpenAIVoice } from "../../../src/domain/voice-selection";
import { normalizeCustomerAddress } from "./address-normalization-service";

const OPENAI_REALTIME_DEFAULT_MODEL = "gpt-realtime";
const OPENAI_REALTIME_DEFAULT_FEMALE_VOICE = "marin";
const OPENAI_REALTIME_DEFAULT_MALE_VOICE = "cedar";
const OPENAI_REALTIME_ACCEPT_URL = "https://api.openai.com/v1/realtime/calls";
const OPENAI_REALTIME_WEBSOCKET_URL = "wss://api.openai.com/v1/realtime";
const HARBOR_PLUMBING_DEMO_LOCATION_ID = "22222222-2222-4222-8222-222222222222";

export type OpenAIRealtimeAcceptProvider = "custom" | "agents_sdk";

type OpenAIRealtimeEnv = Pick<
  VoiceServiceEnv,
  | "GOOGLE_MAPS_API_KEY"
  | "OPENAI_API_KEY"
  | "OPENAI_MODEL"
  | "OPENAI_PROJECT_ID"
  | "OPENAI_REPLY_TIMEOUT_MS"
  | "OPENAI_REALTIME_AIDEN_VOICE"
  | "OPENAI_REALTIME_AVA_VOICE"
  | "OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS"
  | "OPENAI_REALTIME_FEMALE_VOICE"
  | "OPENAI_REALTIME_GREETING_DELAY_MS"
  | "OPENAI_REALTIME_IDLE_TIMEOUT_MS"
  | "OPENAI_REALTIME_INTERRUPT_RESPONSE"
  | "OPENAI_REALTIME_MALE_VOICE"
  | "OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS"
  | "OPENAI_REALTIME_MANUAL_RESPONSE_GATING"
  | "OPENAI_REALTIME_MARCO_VOICE"
  | "OPENAI_REALTIME_MAYA_VOICE"
  | "OPENAI_REALTIME_MILES_VOICE"
  | "OPENAI_REALTIME_MODEL"
  | "OPENAI_REALTIME_NOISE_REDUCTION"
  | "OPENAI_REALTIME_AGENTS_SDK_LOCATION_IDS"
  | "OPENAI_REALTIME_PROVIDER"
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
  acceptProvider: OpenAIRealtimeAcceptProvider;
  greetingDelayMs: number;
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
  manualDetailResponseDelayMs: number;
  manualResponseGating: boolean;
  manualIdlePromptCount: number;
  manualIdleTimer?: ReturnType<typeof setTimeout>;
  manualIdleTimeoutMs: number;
  manualResponseDelayMs: number;
  manualResponseStartPending?: boolean;
  manualResponseTimer?: ReturnType<typeof setTimeout>;
  ownerContact?: TrustedContact;
  openingGreetingCompleted: boolean;
  activeResponseCancelRequested?: boolean;
  pendingManualResponseDelayMs?: number;
  pendingManualResponse: boolean;
  quality: RealtimeQualityMetrics;
  recordingBackfilled?: boolean;
  reservationCreatedId?: string;
  reservationConfirmed?: boolean;
  responseAudioCompleteFallbackTimer?: ReturnType<typeof setTimeout>;
  staffCallbackRequested: boolean;
  staffFollowUpRequired: boolean;
  startedAt: number;
  toolEvents: Array<{ callId?: string; kind?: string; latencyMs?: number; name: string; ok?: boolean }>;
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

    get activeSocketCount() {
      return activeSockets.size;
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

      const destinationPhone = extractOpenAIRealtimeDestinationPhone(event);
      const phoneResolvedLocationId = await restaurantContextStore.resolveLocationIdByPhoneNumber?.(destinationPhone);
      const resolvedLocationId =
        phoneResolvedLocationId ??
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
      const acceptProvider = resolveOpenAIRealtimeAcceptProvider(env, resolvedLocationId);
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
            realtimeAcceptProvider: acceptProvider,
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
      const payload = await buildOpenAIRealtimeWebhookAcceptPayload({
        acceptProvider,
        callerPhone,
        context,
        env,
        locationId: resolvedLocationId,
        ownerContact,
      });

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
          realtimeAcceptProvider: acceptProvider,
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
    acceptProvider: resolveOpenAIRealtimeAcceptProvider(env, locationId),
    callRecordingConfigured: env.TWILIO_CALL_RECORDING_ENABLED !== "false" && Boolean(
      env.TWILIO_ACCOUNT_SID &&
        env.TWILIO_AUTH_TOKEN &&
        env.PUBLIC_HTTP_BASE_URL,
    ),
    greetingDelayMs: resolveOpenAIRealtimeGreetingDelayMs(env),
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
          prompt: buildOpenAIRealtimeTranscriptionPrompt(context),
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

async function buildOpenAIRealtimeWebhookAcceptPayload({
  acceptProvider,
  callerPhone,
  context,
  env,
  locationId,
  ownerContact,
}: BuildOpenAIRealtimeAcceptPayloadInput & {
  acceptProvider: OpenAIRealtimeAcceptProvider;
  locationId?: string;
}): Promise<OpenAIRealtimeAcceptPayload | Record<string, any>> {
  if (acceptProvider === "agents_sdk") {
    const { buildOpenAIAgentsRealtimeAcceptPayload } = await import("./openai-agents-realtime-spike");
    const sdkPayload = await buildOpenAIAgentsRealtimeAcceptPayload({ callerPhone, context, env, ownerContact });
    console.info("[openai-realtime] using OpenAI Agents SDK SIP accept payload", {
      locationId,
      restaurantName: context.restaurantName,
    });
    return sdkPayload;
  }

  return buildOpenAIRealtimeAcceptPayload({ callerPhone, context, env, ownerContact });
}

export function resolveOpenAIRealtimeAcceptProvider(
  env: {
    OPENAI_REALTIME_AGENTS_SDK_LOCATION_IDS?: string;
    OPENAI_REALTIME_PROVIDER?: OpenAIRealtimeAcceptProvider;
    [key: string]: unknown;
  },
  locationId?: string,
): OpenAIRealtimeAcceptProvider {
  if (env.OPENAI_REALTIME_PROVIDER === "agents_sdk") return "agents_sdk";
  if (env.OPENAI_REALTIME_PROVIDER === "custom") return "custom";

  const normalizedLocationId = locationId?.trim().toLowerCase();
  const pilotIds = parseAgentsSdkPilotLocationIds(env.OPENAI_REALTIME_AGENTS_SDK_LOCATION_IDS);
  if (pilotIds.has("*") || pilotIds.has("all")) return "agents_sdk";
  if (normalizedLocationId && pilotIds.has(normalizedLocationId)) return "agents_sdk";
  return "custom";
}

export function parseAgentsSdkPilotLocationIds(rawValue?: string) {
  const value = rawValue?.trim() || HARBOR_PLUMBING_DEMO_LOCATION_ID;
  return new Set(
    value
      .split(/[,\s]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
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
  const universalIntakeContext = buildRealtimeUniversalIntakeInstruction(context);
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
    `Identity check: if the caller asks whether they reached ${context.restaurantName}, asks "is this ${context.restaurantName}", or asks if this is the ${profile.businessNoun}, answer yes. Say something like "Yes, you've reached ${context.restaurantName}. I'm ${context.hostName}, the SignalHost helping with their calls. How can I help?" Never answer no, never say this is only a generic assistant, and never send them to a directory for the business they already reached.`,
    "If the caller says 'hello' before you have greeted them, immediately give the full opening greeting instead of only saying hello back.",
    "If the caller says 'hello', 'are you there', or 'can you hear me' after you have already started or completed the opening greeting, do not repeat the full greeting. Say briefly, 'I'm here. How can I help?'",
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
    "Incomplete speech guardrail: if the caller's latest sentence is cut off, trails off, ends mid-detail, or the transcript looks incomplete, do not infer the missing words. Briefly ask for the missing piece, such as 'Sorry, where is the leak?' or 'I missed the last part. Can you finish that?'",
    "Never invent a room, service, menu item, address, urgency, date, time, party size, symptom, or request detail that the caller did not clearly say. If a detail matters and was not clearly spoken, ask for it.",
    "Do not convert a partial statement into a complete request. For example, if the caller says 'I have a leak in my...' ask where the leak is instead of assuming kitchen, bathroom, basement, or active leak.",
    "If the caller pauses, wait naturally. If silence continues, ask a gentle continuation question such as 'Take your time. What else can I help you with?'",
    "Noisy-room behavior: ignore TV audio, background conversations, faint echoes, room noise, and your own voice coming back through the caller's phone. Only treat clear directed human speech as caller intent.",
    "Echo guardrail: if the caller audio appears to repeat your own greeting or phrases like 'thank you for calling' or 'how can I help you', treat it as echo or background audio. Do not repeat the greeting or respond as if it were a new customer request.",
    "If the caller only says 'hello', 'pardon', or 'are you there' after you have already greeted them, acknowledge once with 'I'm here' and wait for their actual request. Do not restart the opening greeting.",
    "Handle clear interruptions gracefully. If the caller clearly cuts you off with speech, answer their latest request. Do not restart the call because of a noise, echo, or short silence.",
    "Repair behavior: if the caller says 'wait', 'hold on', 'I didn't answer', 'I wasn't done', 'that's not what I said', 'no, I said', or sounds frustrated because you talked over them, stop the current flow. Say a brief apology like 'Sorry about that, go ahead, I'm listening.' Do not say 'No problem' in this situation.",
    "If the caller is in a very loud place or the audio is too unclear to understand, do not guess. Say briefly that it is too noisy to hear clearly and ask them to move somewhere quieter, call back, or let staff follow up by text/callback.",
    "Before any lookup or task that may take a moment, say one short natural bridge such as 'Sure, let me check that' or 'One moment, I am checking now,' then use the tool. Vary the wording and do not sound like an IVR.",
    profile.isRestaurant
      ? "Use cached restaurant facts naturally. The facts are not a script; keep your wording warm, human, and specific to the caller's question."
      : `Use cached ${profile.businessNoun} facts naturally. The facts are not a script; keep your wording warm, human, and specific to the caller's question.`,
    profile.isRestaurant
      ? `Use the ${contextLookupTool} tool for specials, hours, parking, directions, menu, reservation policy, pickup timing, payment, allergies, delivery drivers, lost items, complaints, or anything policy-like.`
      : `Use the ${contextLookupTool} tool for hours, service area, directions, ${profile.offeringNoun}, ${profile.appointmentNoun} policy, quote policy, payment, safety, lost items, complaints, or anything policy-like.`,
    profile.isRestaurant
      ? `For direct menu availability or orderability questions like "do you have pizza" or "can I get meatballs," first check the configured menu items in your instructions. If uncertain, call ${contextLookupTool} with the item or category before saying no. Specials are not the full menu.`
      : `For direct service availability questions, first check the configured services in your instructions. If uncertain, call ${contextLookupTool} with the service or category before saying no.`,
    profile.isRestaurant
      ? "If the caller asks a direct price, rate, fee, minimum, or cost question, answer the policy first from context. If exact pricing is not available, say pricing depends on details and staff can confirm. Only then ask whether they want staff follow-up; do not skip straight to collecting contact info."
      : "If the caller asks a direct price, hourly-rate, fee, trip-charge, estimate, or cost question, answer the policy first from context. If exact pricing is not available, say pricing depends on the job and staff can confirm. Only then ask whether they want staff follow-up; do not skip straight to collecting contact info.",
    "After answering any normal question or completing any task, ask a short loop-closing question such as 'Can I help you with anything else?' unless the caller has already clearly said goodbye.",
    "Never end the call immediately after answering a question. The call should only close after the caller indicates they are done.",
    "After saving a reservation, sending a text, sending a link, or taking an order request, do not call finish_call right away. Give the result, then ask a brief anything-else question unless the caller already said they are done.",
    "If the caller says no, no thanks, that's all, that's it, I'm good, or similar after your anything-else question, call finish_call with a short closing line like 'Thanks for calling. Goodbye.' Do not ask another question.",
    "Do not call finish_call until the caller clearly indicates they are done or says goodbye.",
    "When finish_call returns ok, say only the closing line, then stop speaking. The call will end. Keep the closing short and do not repeat the business name in the goodbye.",
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
    universalIntakeContext,
    "Address capture: whenever the caller gives a service, job, delivery, or customer address, use normalize_customer_address before saving the request or sending a confirmation. If it returns needs_more_detail, ask only for the missing part, not the whole address again. If it returns a readBack, say that read-back and ask if it is right before saving. Do not invent apartment, suite, unit, gate code, or access details; ask for those only if the caller mentions them or the address clearly needs them.",
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
      : `For ${profile.appointmentNoun}, quote, intake, and callback requests, once the request or link is captured, naturally offer to text a copy of the request details or a helpful link. Do not call it a confirmation unless a real ${profile.appointmentNoun} is confirmed. Example: 'Would you like me to text a copy of that request to the number ending 1234?'`,
    "Only send a text after the caller agrees or asks for it. Use the send_guest_confirmation tool for reservation, order, or helpful follow-up texts.",
    "When the caller asks for a configured link, use send_business_link after they ask for it or agree to receive it by text.",
    profile.isRestaurant
      ? "For generic leads, service appointments, quote requests, or requests outside the restaurant-specific tools, use create_customer_request after collecting the name, callback number, and request summary."
      : `For leads, ${profile.appointmentNoun}s, quote requests, and anything outside the specialized tools, use create_customer_request after collecting the name, callback number, request summary, urgency, and key details.`,
    "When collecting a name, address, phone number, email, spelling, or other detail, let the caller finish the full detail before responding. If they spell a name, capture the spelled last name and do not treat it as background noise.",
    profile.isRestaurant
      ? "If the send_guest_confirmation tool succeeds, tell the caller the text is sent. Do not mention backend setup, SMS providers, or placeholder mode."
      : "If the send_guest_confirmation tool succeeds, tell the caller the text is sent. For service requests, say it is a copy of the request or useful link, not a confirmed appointment. If the caller asks what is being confirmed, explain that staff still needs to confirm timing.",
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

function buildRealtimeUniversalIntakeInstruction(context: RestaurantVoiceContext) {
  const profile = getRuntimeBusinessProfile(context);
  const requestTypes = profile.isRestaurant
    ? "orders, reservations, messages, event inquiries, and customer requests"
    : `${profile.appointmentNoun}s, quotes, messages, and customer requests`;

  return [
    `Universal intake style for ${profile.businessNoun} ${requestTypes}: ask one short question at a time.`,
    "First understand what the caller wants, then ask only for the next missing detail.",
    "If the caller gives several needs at once, briefly reflect what you heard and ask one focused follow-up.",
    "Do not ask for the issue, address, name, phone, timing, urgency, and preferred follow-up all in one breath.",
    "Do not infer urgency, availability, confirmation, or priority from an ambiguous or partial answer.",
    "If the caller's answer could mean several things, ask a simple clarifying question instead of deciding for them.",
    "Only label something urgent when the caller clearly describes immediate safety risk, active property damage, severe customer impact, time-critical business impact, or explicitly asks for emergency help.",
    "If urgency is unclear, keep the tone calm, say what you understood, and ask one direct question to clarify.",
    "When the caller seems confused, restate what you understood in one sentence, then ask the next easiest question.",
    "If the caller becomes frustrated, slow down, acknowledge it briefly, and ask one simple next-step question.",
  ].join(" ");
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

export function extractOpenAIRealtimeDestinationPhone(event: OpenAIRealtimeIncomingEvent) {
  return normalizeCallerPhone(stringValue(event.data?.to)) ??
    normalizeCallerPhone(extractDestinationPhoneFromSipHeaders(event.data?.sip_headers));
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
  const offeringMatches = findOfferingMatches(context, topic);
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
    topic.includes("inspection") ||
    offeringMatches.length > 0
  ) {
    return {
      businessName: context.restaurantName,
      businessType: profile.businessType,
      currentBusinessTime: buildRestaurantLocalTimeContext(context),
      matchedOfferingItems: offeringMatches.slice(0, 10).map(formatOfferingLookupItem),
      offeringHighlights: context.menuHighlights,
      offeringItems: context.menuItems.slice(0, 30).map(formatOfferingLookupItem),
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
  payload: OpenAIRealtimeAcceptPayload | Record<string, any>;
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
    manualDetailResponseDelayMs: resolveOpenAIRealtimeDetailCaptureResponseDelayMs(env),
    manualIdlePromptCount: 0,
    manualIdleTimeoutMs: resolveOpenAIRealtimeIdleTimeoutMs(env),
    manualResponseDelayMs: resolveOpenAIRealtimeManualResponseDelayMs(env),
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
    const sendOpeningGreeting = () => {
      if (session.completed || activeSockets.get(callId) !== socket) return;
      sendRealtimeEvent(socket, {
        response: {
          instructions: buildOpeningGreetingInstructions(context, ownerContact),
        },
        type: "response.create",
      });
    };
    const greetingDelayMs = resolveOpenAIRealtimeGreetingDelayMs(env);
    if (greetingDelayMs > 0) {
      const greetingTimer = setTimeout(sendOpeningGreeting, greetingDelayMs);
      greetingTimer.unref?.();
    } else {
      sendOpeningGreeting();
    }
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
      if (transcriptTurn.role === "agent" && eventType === "response.output_audio_transcript.done") {
        scheduleOpenAIRealtimeResponseCompletionFallback({
          callId,
          session,
          socket,
          transcript: transcriptTurn.text,
        });
      }
    }

    const toolCalls = extractOpenAIRealtimeToolCalls(event);
    if (toolCalls.length) {
      markRealtimeToolCalls(session, toolCalls);
      void handleOpenAIRealtimeToolCalls({
        callStore,
        callerPhone,
        callRecordId: session.callRecordId,
        context,
        env,
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

    if (eventType === "response.done" || eventType === "response.audio.done" || eventType === "output_audio_buffer.stopped") {
      handleOpenAIRealtimeResponseDone({ callId, session, socket, source: eventType });
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
    clearOpenAIRealtimeManualResponseTimer(session);
    clearOpenAIRealtimeResponseCompletionFallbackTimer(session);
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
    clearOpenAIRealtimeManualResponseTimer(session);
    clearOpenAIRealtimeResponseCompletionFallbackTimer(session);
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
    "Say this exact opening greeting once after the phone audio path is connected, then stop and listen:",
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
    delete session.manualResponseStartPending;
    delete session.activeResponseCancelRequested;
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
    delete session.manualResponseStartPending;
    delete session.activeResponseCancelRequested;
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
    maybeCancelOpenAIRealtimeActiveResponseForCallerTurn({
      callId,
      reason: decision.reason,
      session,
      socket,
      text: turn.text,
    });
  }

  void persistOpenAIRealtimeTranscriptTurn({
    callStore,
    session,
    turn,
  });

  if (turn.role === "caller" && session.manualResponseGating) {
    clearOpenAIRealtimeManualIdleTimer(session);
    session.manualIdlePromptCount = 0;
    requestOpenAIRealtimeManualResponse({ callId, session, socket, turnText: turn.text });
  }
}

function handleOpenAIRealtimeResponseDone({
  callId,
  session,
  socket,
  source,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  source?: string;
}) {
  clearOpenAIRealtimeResponseCompletionFallbackTimer(session);
  if (session.quality.activeResponseStartedAt) {
    session.quality.lastResponseDurationMs = Date.now() - session.quality.activeResponseStartedAt;
  }
  delete session.quality.activeResponseStartedAt;
  delete session.manualResponseStartPending;
  delete session.activeResponseCancelRequested;

  if (!session.openingGreetingCompleted) {
    session.openingGreetingCompleted = true;
  }

  console.info("[openai-realtime] response completed", {
    callId,
    pendingManualResponse: session.pendingManualResponse,
    source: source ?? "response.done",
  });

  if (session.finishRequested) {
    scheduleOpenAIRealtimeFinishedClose({ callId, session, socket });
    return;
  }

  if (session.manualResponseGating && session.pendingManualResponse) {
    scheduleOpenAIRealtimeManualResponse({
      callId,
      delayMs: session.pendingManualResponseDelayMs ?? session.manualResponseDelayMs,
      session,
      socket,
    });
    return;
  }

  scheduleOpenAIRealtimeManualIdlePrompt({ callId, session, socket });
}

function scheduleOpenAIRealtimeResponseCompletionFallback({
  callId,
  session,
  socket,
  transcript,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  transcript: string;
}) {
  clearOpenAIRealtimeResponseCompletionFallbackTimer(session);
  if (!session.quality.activeResponseStartedAt || session.finishRequested) return;
  // Text transcript completion can arrive before PSTN audio finishes playing.
  // Never use it to complete the opening greeting, because that re-enables
  // caller handling while speakerphone/handset echo may still be coming back.
  if (!session.openingGreetingCompleted) return;

  const delayMs = estimateOpenAIRealtimeResponseCompletionFallbackMs(transcript);
  session.responseAudioCompleteFallbackTimer = setTimeout(() => {
    delete session.responseAudioCompleteFallbackTimer;
    if (!session.quality.activeResponseStartedAt || session.finishRequested) return;
    handleOpenAIRealtimeResponseDone({
      callId,
      session,
      socket,
      source: "response.output_audio_transcript.done_fallback",
    });
  }, delayMs);
  session.responseAudioCompleteFallbackTimer.unref?.();
}

function clearOpenAIRealtimeResponseCompletionFallbackTimer(session: OpenAIRealtimeSidebandSession) {
  if (!session.responseAudioCompleteFallbackTimer) return;
  clearTimeout(session.responseAudioCompleteFallbackTimer);
  delete session.responseAudioCompleteFallbackTimer;
}

function estimateOpenAIRealtimeResponseCompletionFallbackMs(transcript: string) {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  if (!wordCount) return 900;
  return Math.min(3000, Math.max(900, wordCount * 170 + 350));
}

function requestOpenAIRealtimeManualResponse({
  callId,
  session,
  socket,
  turnText,
}: {
  callId: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  turnText?: string;
}) {
  if (session.finishRequested) return;
  if (session.manualResponseStartPending) return;
  const delayMs = resolveOpenAIRealtimeManualResponseDelayForTurn(session, turnText);
  if (!session.openingGreetingCompleted || session.quality.activeResponseStartedAt) {
    session.pendingManualResponse = true;
    session.pendingManualResponseDelayMs = Math.max(session.pendingManualResponseDelayMs ?? 0, delayMs);
    return;
  }
  scheduleOpenAIRealtimeManualResponse({ callId, delayMs, session, socket });
}

function scheduleOpenAIRealtimeManualResponse({
  callId,
  delayMs,
  session,
  socket,
}: {
  callId: string;
  delayMs: number;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
}) {
  clearOpenAIRealtimeManualIdleTimer(session);
  clearOpenAIRealtimeManualResponseTimer(session);
  session.pendingManualResponse = true;
  session.pendingManualResponseDelayMs = delayMs;
  if (delayMs <= 0) {
    sendOpenAIRealtimeManualResponse({ callId, session, socket });
    return;
  }
  session.manualResponseTimer = setTimeout(() => {
    delete session.manualResponseTimer;
    if (session.finishRequested || session.quality.activeResponseStartedAt || session.manualResponseStartPending) return;
    sendOpenAIRealtimeManualResponse({ callId, session, socket });
  }, delayMs);
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
  clearOpenAIRealtimeManualResponseTimer(session);
  session.pendingManualResponse = false;
  delete session.pendingManualResponseDelayMs;
  session.manualResponseStartPending = true;
  const latestCallerText = getLastRealtimeCallerText(session);
  console.info("[openai-realtime] creating gated response for accepted caller turn", {
    callId,
    latestCallerText: latestCallerText?.slice(0, 100),
  });
  sendRealtimeEvent(socket, {
    response: {
      instructions: buildManualRealtimeResponseInstructions(session, latestCallerText),
    },
    type: "response.create",
  });
}

function buildManualRealtimeResponseInstructions(
  session: OpenAIRealtimeSidebandSession,
  latestCallerText?: string,
) {
  const profile = getRuntimeBusinessProfile(session.context);
  const latest = latestCallerText?.trim();
  const deterministicRepair = buildDeterministicRealtimeRepairInstructions(session, latest);
  if (deterministicRepair) return deterministicRepair;

  const base = [
    latest
      ? `Reply to this latest completed caller message only: "${latest}"`
      : "Reply only if there is a completed caller message in the conversation.",
    "Do not infer hidden words, omitted details, background speech, or answers that the caller did not clearly give.",
    "Do not continue a form, reservation, order, estimate, or service-intake flow as if the caller answered your prior question unless the latest caller message actually contains the answer.",
    "If the latest caller message is only 'hello', 'are you there', 'what?', 'pardon?', or another connection check, briefly acknowledge and ask how you can help; do not invent or advance any details.",
    "Never invent date, time, party size, guest name, menu items, quantities, address, service type, fixture, urgency, or pricing.",
    "Never say you have marked, saved, placed, submitted, or sent a request unless a tool call has returned ok for that action.",
  ];

  if (profile.isRestaurant) {
    base.push(
      "For reservations, if the caller has not clearly provided date, time, party size, and guest name, ask only for the missing detail. Do not supply your own party size or time.",
      "For pickup orders, if the caller has not clearly provided items, quantities, name, and callback details, ask only for the missing detail. Do not supply your own items or quantities.",
    );
  } else {
    base.push(
      `For ${profile.appointmentNoun}, quote, or service requests, ask only for the missing details. Do not supply your own service type, address, fixture, timing, or urgency.`,
    );
  }

  return base.join(" ");
}

function buildDeterministicRealtimeRepairInstructions(
  session: OpenAIRealtimeSidebandSession,
  latest?: string,
) {
  if (!latest) return null;
  const normalized = normalizeRealtimeCallerText(latest);
  if (!normalized) return null;

  const incompletePhone = getIncompleteCallbackPhoneRepair(session, latest, normalized);
  if (incompletePhone) {
    return [
      `The caller gave an incomplete callback phone number. Say exactly and only: "I only got ${incompletePhone}. Could you repeat the rest of the phone number?"`,
      "Do not save, submit, text, finish, or move to another question until the caller gives the missing digits.",
    ].join(" ");
  }

  if (isOpeningConnectionCheck(session, normalized)) {
    return [
      'The caller is checking the connection right after the opening greeting. Say exactly and only: "I\'m here. How can I help you?"',
      "Do not restart the greeting, do not say hi or hello, and do not add any other words.",
    ].join(" ");
  }

  if (isCallerIdentityQuestion(normalized)) {
    const businessName = toSpokenRestaurantName(session.context.restaurantName);
    return [
      `The caller is asking who they reached. Say exactly and only: "You've reached ${businessName}. I can help with questions or service requests. How can I help you?"`,
      "Do not say you are not the business. Do not over-explain that you are automated unless the caller specifically asks if you are AI.",
    ].join(" ");
  }

  return null;
}

function isOpeningConnectionCheck(session: OpenAIRealtimeSidebandSession, normalized: string) {
  const callerTurnCount = session.transcript.filter((turn) => turn.role === "caller").length;
  if (callerTurnCount > 1) return false;
  return /^(hello|hello there|hi|hey|are you there|you there|can you hear me|is anyone there|anyone there|are you still there)$/.test(
    normalized,
  );
}

function isCallerIdentityQuestion(normalized: string) {
  return (
    /^(who is this|who am i speaking with|who am i talking to|what company is this|what business is this)$/.test(
      normalized,
    ) ||
    /\b(is this|did i reach|did i call|am i calling)\b/.test(normalized)
  );
}

function getIncompleteCallbackPhoneRepair(
  session: OpenAIRealtimeSidebandSession,
  originalText: string,
  normalized: string,
) {
  const lastAgentText = session.transcript.filter((turn) => turn.role === "agent").at(-1)?.text ?? "";
  const lastAgent = normalizeRealtimeCallerText(lastAgentText);
  const lastAgentAskedForPhone = /\b(callback|phone|number|best number|mobile|cell)\b/.test(lastAgent);
  const callerIsGivingPhone = /\b(callback|phone|number|mobile|cell)\b/.test(normalized) || /\b\d[\d\s().-]{3,}\d\b/.test(originalText);
  if (!lastAgentAskedForPhone || !callerIsGivingPhone) return null;

  const digitCount = originalText.replace(/\D/g, "").length;
  if (digitCount < 4 || digitCount >= 10) return null;

  return extractIncompletePhoneFragment(originalText) ?? "part of the number";
}

function extractIncompletePhoneFragment(text: string) {
  const match = text.match(/\+?\d[\d\s().-]{2,}\d/);
  if (!match) return null;
  return match[0].replace(/\s+/g, " ").trim();
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
  if (
    !session.manualResponseGating ||
    session.finishRequested ||
    session.quality.activeResponseStartedAt ||
    session.manualResponseStartPending ||
    session.manualResponseTimer
  ) return;
  clearOpenAIRealtimeManualIdleTimer(session);
  session.manualIdleTimer = setTimeout(() => {
    if (
      session.finishRequested ||
      session.quality.activeResponseStartedAt ||
      session.pendingManualResponse ||
      session.manualResponseStartPending ||
      session.manualResponseTimer
    ) return;
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

function clearOpenAIRealtimeManualResponseTimer(session: OpenAIRealtimeSidebandSession) {
  if (!session.manualResponseTimer) return;
  clearTimeout(session.manualResponseTimer);
  delete session.manualResponseTimer;
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
  if (isLikelyOpeningGreetingEcho(session, normalized)) return { accept: false, reason: "opening_greeting_echo" };
  if (isLikelyOpenAIRealtimeAgentEcho(session, normalized)) return { accept: false, reason: "agent_echo" };
  if (isLikelyBackgroundMediaFragment(normalized)) return { accept: false, reason: "background_media" };
  if (isLikelyOpeningBackchannelEcho(session, normalized)) return { accept: false, reason: "opening_backchannel_echo" };

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const activeResponse = Boolean(session.quality.activeResponseStartedAt);
  const greetingPhase = !session.openingGreetingCompleted;
  const strongIntent = hasStrongCallerIntent(normalized);
  const clearIntent = hasLikelyCallerIntent(normalized);
  const configuredOfferingIntent = hasConfiguredOfferingIntent(session.context, normalized);
  const directedSpeech = hasLikelyDirectedCallerSpeech(normalized);
  const shortConfirmation = isLikelyShortCallerConfirmation(normalized);
  const answerToAgentQuestion = isLikelyAnswerToRecentAgentQuestion(session, normalized);
  const correctionOrRepair = isLikelyCallerCorrectionOrRepair(normalized);
  const detailAnswer = isAnsweringDetailCaptureQuestion(session, normalized);

  if (greetingPhase || activeResponse) {
    if (correctionOrRepair) return { accept: true, reason: "caller_repair" };
    if (answerToAgentQuestion) return { accept: true, reason: "answer_to_agent_question" };
    if (detailAnswer) return { accept: true, reason: "detail_capture" };
    if (strongIntent) return { accept: true, reason: "strong_intent" };
    if (configuredOfferingIntent) return { accept: true, reason: "configured_offering" };
    if (directedSpeech) return { accept: true, reason: "directed_speech" };
    if (shortConfirmation) return { accept: true, reason: "short_confirmation" };
    return { accept: false, reason: greetingPhase ? "greeting_noise" : "response_noise" };
  }

  // Once the greeting is complete and SignalHost is listening, prefer letting the
  // realtime model interpret natural speech over forcing caller intent through
  // a brittle keyword list. The hard rejects above still catch prompt leakage,
  // obvious agent echo, and common TV/radio fragments.
  if (wordCount >= 2) return { accept: true };
  if (clearIntent || configuredOfferingIntent || directedSpeech || shortConfirmation || answerToAgentQuestion) {
    return { accept: true };
  }
  if (wordCount >= 4 && /\b(i|we|you|your|can|could|would|need|want|looking|calling|trying)\b/.test(normalized)) {
    return { accept: true };
  }
  return { accept: false, reason: "no_caller_intent" };
}

function maybeCancelOpenAIRealtimeActiveResponseForCallerTurn({
  callId,
  reason,
  session,
  socket,
  text,
}: {
  callId: string;
  reason?: string;
  session: OpenAIRealtimeSidebandSession;
  socket: RealtimeSocket;
  text: string;
}) {
  if (!session.quality.activeResponseStartedAt || session.activeResponseCancelRequested || session.finishRequested) return;
  const normalized = normalizeRealtimeCallerText(text);
  if (!shouldCancelActiveResponseForCallerTurn(session, normalized, reason)) return;

  session.activeResponseCancelRequested = true;
  console.info("[openai-realtime] cancelling active response for caller repair/answer", {
    callId,
    reason,
    sample: text.slice(0, 100),
  });
  sendRealtimeEvent(socket, { type: "response.cancel" });
  sendRealtimeEvent(socket, { type: "output_audio_buffer.clear" });
}

function shouldCancelActiveResponseForCallerTurn(
  session: OpenAIRealtimeSidebandSession,
  normalized: string,
  reason?: string,
) {
  if (!normalized || !session.openingGreetingCompleted) {
    return isLikelyCallerCorrectionOrRepair(normalized) || hasStrongCallerIntent(normalized);
  }

  if (
    reason === "caller_repair" ||
    reason === "answer_to_agent_question" ||
    reason === "detail_capture" ||
    reason === "strong_intent" ||
    reason === "configured_offering" ||
    reason === "directed_speech"
  ) {
    return true;
  }

  return false;
}

function resolveOpenAIRealtimeManualResponseDelayForTurn(session: OpenAIRealtimeSidebandSession, text?: string) {
  if (!text) return session.manualResponseDelayMs;
  const normalized = normalizeRealtimeCallerText(text);
  if (isLikelyShortCallerConfirmation(normalized)) {
    return Math.min(350, session.manualResponseDelayMs);
  }
  const schedulingDelayMs = getMinimumSchedulingCaptureDelayMs(session, normalized);
  if (schedulingDelayMs) {
    return Math.max(session.manualResponseDelayMs, session.manualDetailResponseDelayMs, schedulingDelayMs);
  }
  if (isAnsweringDetailCaptureQuestion(session, normalized)) {
    return Math.max(
      session.manualResponseDelayMs,
      session.manualDetailResponseDelayMs,
      getMinimumDetailCaptureDelayMs(session, normalized),
    );
  }
  return session.manualResponseDelayMs;
}

function getMinimumSchedulingCaptureDelayMs(session: OpenAIRealtimeSidebandSession, normalized: string) {
  if (!normalized) return 0;
  const lastAgentTurn = session.transcript.filter((turn) => turn.role === "agent").at(-1)?.text ?? "";
  const lastAgent = normalizeRealtimeCallerText(lastAgentTurn);
  if (
    isLikelySchedulingDateFragment(normalized) &&
    !hasSpecificSchedulingTime(normalized) &&
    (isSchedulingCapturePrompt(lastAgent) || hasSchedulingRequestCue(normalized))
  ) {
    return 1800;
  }
  if (isSchedulingCapturePrompt(lastAgent) && isLikelyShortSchedulingFragment(normalized)) return 1400;
  return 0;
}

function getMinimumDetailCaptureDelayMs(session: OpenAIRealtimeSidebandSession, normalized: string) {
  const lastAgentTurn = session.transcript.filter((turn) => turn.role === "agent").at(-1)?.text ?? "";
  const lastAgent = normalizeRealtimeCallerText(lastAgentTurn);
  if (isAddressCapturePrompt(lastAgent) || isLikelyAddressFragment(normalized)) return 1800;
  if (isSpelledFragment(normalized)) return 1800;
  return 0;
}

function isAnsweringDetailCaptureQuestion(session: OpenAIRealtimeSidebandSession, normalized: string) {
  if (!normalized) return false;
  const lastAgentTurn = session.transcript.filter((turn) => turn.role === "agent").at(-1)?.text ?? "";
  const lastAgent = normalizeRealtimeCallerText(lastAgentTurn);
  if (!lastAgent) return false;

  return (
    isAddressCapturePrompt(lastAgent) ||
    /\b(name|full name|first name|last name|who should|who is this|who am i speaking|spell|spelling|callback|phone|number|email|address|where do you need|where you need|service address|come out|send someone|best number|email address)\b/.test(
      lastAgent,
    ) ||
    isSchedulingCapturePrompt(lastAgent) ||
    isLikelyAddressFragment(normalized) ||
    /\b(at|dot|com|net|org|gmail|yahoo|outlook|icloud|hotmail|dash|underscore)\b/.test(
      normalized,
    ) ||
    isSpelledFragment(normalized)
  );
}

function isSchedulingCapturePrompt(lastAgent: string) {
  return /\b(when|what day|which day|what date|preferred date|preferred time|what time|date and time|day and time|schedule|book|appointment|reservation|come out|send someone|available|availability|how soon)\b/.test(
    lastAgent,
  );
}

function isLikelySchedulingDateFragment(normalized: string) {
  return /\b(today|tonight|tomorrow|this week|next week|this weekend|next weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|this monday|this tuesday|this wednesday|this thursday|this friday|this saturday|this sunday)\b/.test(
    normalized,
  );
}

function hasSchedulingRequestCue(normalized: string) {
  return /\b(come|come out|send someone|schedule|book|booking|reservation|appointment|available|availability|can you do|could you do|any chance|service call|quote|estimate)\b/.test(
    normalized,
  );
}

function isLikelyShortSchedulingFragment(normalized: string) {
  return (
    normalized.split(/\s+/).filter(Boolean).length <= 6 &&
    (isLikelySchedulingDateFragment(normalized) ||
      hasSpecificSchedulingTime(normalized) ||
      /\b(asap|as soon as possible|morning|afternoon|evening|lunchtime|lunch|dinner|breakfast)\b/.test(normalized))
  );
}

function hasSpecificSchedulingTime(normalized: string) {
  return /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\s*m|p\s*m|am|pm)?\b/.test(normalized) ||
    /\b(noon|midnight|morning|afternoon|evening|lunchtime|lunch|dinner|breakfast)\b/.test(normalized);
}

function isAddressCapturePrompt(lastAgent: string) {
  return /\b(address|where do you need|where you need|service address|come out|send someone|where should|job location|service location)\b/.test(
    lastAgent,
  );
}

function isLikelyAddressFragment(normalized: string) {
  return (
    /\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|way|place|pl|terrace|ter|trail|trl|parkway|pkwy|highway|hwy|route|unit|apt|apartment|suite|floor)\b/.test(
      normalized,
    ) ||
    /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|hampshire|jersey|mexico|york|carolina|dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|tennessee|texas|utah|vermont|virginia|washington|wisconsin|wyoming)\b/.test(
      normalized,
    ) ||
    /\b(?:in|near|by|around)\s+[a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,}){0,2}\b/.test(normalized) ||
    /\b\d{5}(?:\s*-\s*\d{4})?\b/.test(normalized)
  );
}

function isSpelledFragment(normalized: string) {
  return /(?:\b[a-z]\b[\s-]*){3,}/i.test(normalized);
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
    isLikelyGreetingEchoText(normalized) ||
    normalized.includes("how can i help you") ||
    (Boolean(businessName) && normalized.includes(businessName) && normalized.includes("how can i help")) ||
    isLikelyRecentAgentTranscriptEcho(session, normalized)
  );
}

function isLikelyGreetingEchoText(normalized: string) {
  return (
    /\b(thank you|thanks)\s+for\s+calling\b/.test(normalized) ||
    /\bthanks?\s+calling\b/.test(normalized)
  );
}

function isLikelyOpeningGreetingEcho(session: OpenAIRealtimeSidebandSession, normalized: string) {
  if (!isLikelyGreetingEchoText(normalized)) return false;
  if (session.transcript.some((turn) => turn.role === "caller")) return false;
  if (Date.now() - session.startedAt > 20000) return false;

  const recentAgentGreeting = session.transcript
    .filter((turn) => turn.role === "agent")
    .slice(-2)
    .map((turn) => normalizeRealtimeCallerText(turn.text))
    .some((turn) => isLikelyGreetingEchoText(turn) || turn.includes("how can i help"));

  return !session.openingGreetingCompleted || Boolean(session.quality.activeResponseStartedAt) || recentAgentGreeting;
}

function isLikelyRecentAgentTranscriptEcho(session: OpenAIRealtimeSidebandSession, normalized: string) {
  const candidateWords = significantEchoWords(normalized);
  if (candidateWords.length < 5) return false;

  const recentAgentTurns = session.transcript
    .filter((turn) => turn.role === "agent")
    .slice(-3)
    .map((turn) => normalizeRealtimeCallerText(turn.text))
    .filter(Boolean);

  return recentAgentTurns.some((agentTurn) => {
    if (agentTurn.includes(normalized)) return true;
    const agentWords = new Set(significantEchoWords(agentTurn));
    if (agentWords.size < 5) return false;
    const overlap = candidateWords.filter((word) => agentWords.has(word)).length / candidateWords.length;
    return overlap >= 0.78;
  });
}

function significantEchoWords(normalized: string) {
  const stopWords = new Set(["a", "an", "and", "are", "can", "for", "i", "is", "it", "me", "of", "or", "that", "the", "to", "we", "you", "your"]);
  return normalized
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function hasLikelyCallerIntent(normalized: string) {
  return /\b(orders?|pickup|takeout|reservations?|reserve|table|book|booking|appointments?|quotes?|estimates?|services?|repairs?|emergency|leaks?|roof|roofing|hvac|plumb|plumbing|electric|electrical|haircuts?|barber|color|hours|open|closed|close|menus?|specials?|parking|address|directions?|allerg(?:y|ies|ic)|catering|private event|part(?:y|ies)|availability|available|tonight|today|tomorrow|callback|call back|manager|staff|text|email|prices?|cost|how much|deliver(?:y|ies)|lost|found|complaints?|refund)\b/.test(
    normalized,
  );
}

function hasStrongCallerIntent(normalized: string) {
  return /\b(orders?|pickup|takeout|reservations?|reserve|table|appointments?|quotes?|estimates?|emergency|leaks?|roof|roofing|hvac|plumb|plumbing|electric|electrical|haircuts?|barber|color|hours|open|closed|close|menus?|specials?|parking|address|directions?|allerg(?:y|ies|ic)|catering|private event|part(?:y|ies)|callback|call back|manager|text|email|prices?|cost|how much|deliver(?:y|ies)|lost|found|complaints?|refund)\b/.test(
    normalized,
  );
}

function hasConfiguredOfferingIntent(context: RestaurantVoiceContext, normalized: string) {
  if (isLikelyBackgroundMediaFragment(normalized)) return false;
  const normalizedTopic = normalizeLookupText(normalized);
  if (!normalizedTopic) return false;

  return context.menuItems.some((item) => {
    const terms = [item.name, ...(item.aliases ?? [])];
    return terms.some((term) => {
      const normalizedTerm = normalizeLookupText(term);
      if (!normalizedTerm || normalizedTerm.length < 4) return false;
      return normalizedTopic.includes(normalizedTerm) || normalizedTerm.includes(normalizedTopic);
    });
  });
}

function hasLikelyDirectedCallerSpeech(normalized: string) {
  return (
    /\b(what|when|where|why|how|who|do you|are you|can i|can you|could i|could you|would you|i need|i want|i'd like|i would like|i'm calling|i am calling|i was wondering|let me|get me|looking for|are you there|can you hear me|i'm here|i am here)\b/.test(
      normalized,
    ) || /\?$/.test(normalized)
  );
}

function isLikelyCallerCorrectionOrRepair(normalized: string) {
  return /\b(wait|hold on|hang on|one second|just a second|let me finish|i'?m not done|i was not done|i wasn'?t done|i didn'?t answer|i did not answer|i didn'?t say|i did not say|that'?s not what i said|that is not what i said|no i said|no that'?s|actually|you cut me off|you interrupted|stop talking|listen|go back|start over|what are you talking about)\b/.test(
    normalized,
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

function isLikelyOpeningBackchannelEcho(session: OpenAIRealtimeSidebandSession, normalized: string) {
  if (
    !(
      isLikelyGreetingEchoText(normalized) ||
      /^(thanks?|thank you|okay|ok|yeah|yep|sure|uh huh|mhm|mm hmm)$/.test(normalized)
    )
  ) {
    return false;
  }
  if (session.transcript.some((turn) => turn.role === "caller")) return false;
  if (Date.now() - session.startedAt > 15000) return false;

  const lastAgent = normalizeRealtimeCallerText(session.transcript.filter((turn) => turn.role === "agent").at(-1)?.text ?? "");
  return (
    !session.openingGreetingCompleted ||
    Boolean(session.quality.activeResponseStartedAt) ||
    isLikelyGreetingEchoText(lastAgent) ||
    lastAgent.includes("how can i help")
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
      callId: toolCall.callId,
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
  const hasCallerTranscript = Boolean(callerText.trim()) || session.quality.callerTranscriptCount > 0;
  const shortGreetingOnlyCall =
    !hasCallerTranscript &&
    session.quality.agentTranscriptCount > 0 &&
    getRealtimeSessionOffsetSeconds(session) <= 12;
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
  const intent = hasReservationIntent
    ? "reservation"
    : hasOrderIntent
      ? "order"
      : hasHoursIntent
        ? "hours"
        : hasCallerTranscript
          ? "faq"
          : "other";

  const hasUnresolvedToolError = hasUnresolvedRealtimeToolError(session);
  const qualityNeedsReview =
    hasUnresolvedToolError ||
    session.quality.speechStartedDuringResponseCount >= 3 ||
    (session.quality.speechStartCount >= 3 && session.quality.callerTranscriptCount === 0) ||
    shortGreetingOnlyCall;
  const needsReview = session.staffCallbackRequested || toolNames.has("request_staff_callback") || qualityNeedsReview;
  const followUpToolUsed =
    session.staffFollowUpRequired ||
    toolNames.has("create_customer_request");
  const outcome = shortGreetingOnlyCall
    ? "audio_unavailable"
    : needsReview
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
    confidence: hasCallerTranscript ? (needsReview ? 72 : 88) : 20,
    intent,
    outcome,
    status: needsReview || !hasCallerTranscript ? "needs_review" : followUpToolUsed ? "new" : "resolved",
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
    session.quality.agentTranscriptCount > 0 &&
      session.quality.callerTranscriptCount === 0 &&
      getRealtimeSessionOffsetSeconds(session) <= 12 &&
      "short greeting-only call with no caller audio captured",
    session.quality.speechStartedDuringResponseCount >= 3 && "possible speakerphone echo/false interruptions",
    session.quality.speechStartCount >= 3 && session.quality.callerTranscriptCount === 0 && "speech detected but no caller transcript",
    session.quality.ignoredNoiseTranscriptCount > 0 && `${session.quality.ignoredNoiseTranscriptCount} likely background transcript(s) ignored`,
    hasUnresolvedRealtimeToolError(session) && "tool errors",
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

function hasUnresolvedRealtimeToolError(session: OpenAIRealtimeSidebandSession) {
  const latestByToolAndKind = new Map<string, boolean>();
  for (const event of session.toolEvents) {
    if (event.ok === undefined) continue;
    latestByToolAndKind.set(`${event.name}:${event.kind ?? ""}`, event.ok !== false);
  }
  return [...latestByToolAndKind.values()].some((ok) => !ok);
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
  env,
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
  env: OpenAIRealtimeEnv;
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
        env,
        guestConfirmationService,
        locationId,
        ownerCommandRuntime,
        ownerContact,
        reservationPlatformService,
        session,
        staffNotificationService,
        toolCall,
      });
    } catch (error) {
      output = {
        error: error instanceof Error ? error.message : "Tool call failed.",
        errorType: classifyRealtimeToolError(error),
        callerGuidance: "Tell the caller the request was captured for staff review if possible; do not promise the action completed.",
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

  const existing = [...session.toolEvents]
    .reverse()
    .find((event) => event.callId === toolCall.callId && event.name === toolCall.name && event.latencyMs === undefined) ??
    [...session.toolEvents].reverse().find((event) => event.name === toolCall.name && event.latencyMs === undefined);
  if (existing) {
    existing.latencyMs = latencyMs;
    existing.ok = ok;
  }

  console.info("[openai-realtime] tool call completed", {
    latencyMs,
    name: toolCall.name,
    ok,
  });
  recordToolCallMetric({ latencyMs, name: toolCall.name, ok });
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
  env,
  guestConfirmationService,
  locationId,
  ownerCommandRuntime,
  ownerContact,
  reservationPlatformService,
  session,
  staffNotificationService,
  toolCall,
}: {
  callStore?: CallStore;
  callerPhone?: string;
  callRecordId?: string;
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  ownerCommandRuntime?: OwnerCommandRuntime;
  ownerContact?: TrustedContact;
  reservationPlatformService?: ReservationPlatformService;
  session: OpenAIRealtimeSidebandSession;
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

  if (toolCall.name === "normalize_customer_address") {
    return normalizeOpenAIRealtimeCustomerAddress({
      context,
      env,
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
      lastCallerText: getLastRealtimeCallerText(session),
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

export function finishOpenAIRealtimeCall({
  lastCallerText,
  rawArguments,
}: {
  lastCallerText?: string;
  rawArguments: Record<string, unknown>;
}) {
  const closingLine = sanitizeClosingLine(stringValue(rawArguments.closing_line) ?? "Thanks for calling. Goodbye.");
  const reason = stringValue(rawArguments.reason) ?? "caller_done";
  if (lastCallerText && !canFinishAfterCallerTurn(lastCallerText, reason)) {
    return {
      ok: false,
      action: "finish_call",
      error: "caller_not_done",
      callerGuidance:
        "The caller has not clearly said they are done. Do not end the call yet. Confirm the completed task, then ask: 'Can I help you with anything else?'",
      lastCallerText,
    };
  }

  return {
    ok: true,
    action: "finish_call",
    closingLine,
    reason,
    message: `Say only this closing line, then stop speaking: "${closingLine}"`,
  };
}

function getLastRealtimeCallerText(session: OpenAIRealtimeSidebandSession) {
  return session.transcript.filter((turn) => turn.role === "caller").at(-1)?.text;
}

function canFinishAfterCallerTurn(lastCallerText: string, reason: string) {
  if (reason === "silent_or_abandoned" || reason === "wrong_number_complete") return true;
  return isCallerDoneUtterance(normalizeRealtimeCallerText(lastCallerText));
}

function isCallerDoneUtterance(normalized: string) {
  if (!normalized) return false;
  if (
    /^(no|nope|no thanks|no thank you|nothing else|that's all|that is all|that's it|that is it|i'm good|im good|i am good|all set|i'm all set|im all set)$/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/^(goodbye|bye|thanks|thank you|awesome thanks|awesome thank you|perfect thanks|perfect thank you)$/.test(normalized)) {
    return true;
  }
  return /\b(no thanks|no thank you|nothing else|that's all|that is all|that's it|that is it|i'm good|im good|all set|goodbye|bye)\b/.test(
    normalized,
  );
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
      const address = stringValue(rawArguments.formatted_address) ?? stringValue(rawArguments.service_address);
      const baseMessage = stringValue(rawArguments.message) ?? "Your request was received.";
      const message = address && !baseMessage.toLowerCase().includes(address.toLowerCase())
        ? `${baseMessage} Address: ${address}.`
        : baseMessage;
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

    const successMessage =
      kind === "reservation" || kind === "order"
        ? "Text confirmation sent."
        : kind === "appointment" || kind === "service_appointment" || kind === "quote" || kind === "lead" || kind === "callback"
          ? "Text request summary sent."
          : "Text sent.";

    return {
      ok: true,
      message: successMessage,
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

export async function normalizeOpenAIRealtimeCustomerAddress({
  context,
  env,
  rawArguments,
}: {
  context: RestaurantVoiceContext;
  env: OpenAIRealtimeEnv;
  rawArguments: Record<string, unknown>;
}) {
  return normalizeCustomerAddress({
    context,
    env,
    rawAddress: stringValue(rawArguments.raw_address),
    unitOrAccess: stringValue(rawArguments.unit_or_access),
  });
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
    const details = mergeCustomerRequestDetails(
      normalizeCustomerRequestDetails(rawArguments.details),
      buildCustomerRequestAddressDetails(rawArguments),
    );
    const result = await callStore?.createCustomerRequest({
      callId: callRecordId,
      customerName: stringValue(rawArguments.caller_name),
      customerPhone,
      details,
      locationId,
      priority: normalizeCustomerRequestPriority(rawArguments.urgency, requestType),
      requestType,
      summary,
    });

    return {
      ok: true,
      message:
        requestType === "service_appointment"
          ? "Customer request saved for staff follow-up. Do not call this a confirmed appointment; tell the caller staff will confirm timing shortly."
          : "Customer request saved. Tell the caller staff will follow up shortly.",
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

export function resolveOpenAIRealtimeManualResponseDelayMs(env: OpenAIRealtimeEnv) {
  const delayMs = env.OPENAI_REALTIME_MANUAL_RESPONSE_DELAY_MS ?? 650;
  return Number.isFinite(delayMs) ? Math.min(2000, Math.max(0, Math.round(delayMs))) : 650;
}

export function resolveOpenAIRealtimeDetailCaptureResponseDelayMs(env: OpenAIRealtimeEnv) {
  const delayMs = env.OPENAI_REALTIME_DETAIL_CAPTURE_RESPONSE_DELAY_MS ?? 1300;
  return Number.isFinite(delayMs) ? Math.min(2000, Math.max(0, Math.round(delayMs))) : 1300;
}

export function resolveOpenAIRealtimeGreetingDelayMs(env: OpenAIRealtimeEnv) {
  const delayMs = env.OPENAI_REALTIME_GREETING_DELAY_MS ?? 900;
  return Number.isFinite(delayMs) ? Math.min(2500, Math.max(0, Math.round(delayMs))) : 900;
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

export function resolveOpenAIRealtimeInterruptResponse(_env: OpenAIRealtimeEnv) {
  return false;
}

function resolveOpenAIRealtimeVoice(env: OpenAIRealtimeEnv, context: RestaurantVoiceContext) {
  const configuredVoice = context.voiceProfileId ?? context.hostName ?? context.voiceGender;
  if (configuredVoice) {
    return resolveSignalHostOpenAIVoice(configuredVoice, {
      aiden: env.OPENAI_REALTIME_AIDEN_VOICE || env.OPENAI_REALTIME_THEO_VOICE || env.OPENAI_REALTIME_MALE_VOICE,
      ava: env.OPENAI_REALTIME_AVA_VOICE || env.OPENAI_REALTIME_VERA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE || OPENAI_REALTIME_DEFAULT_FEMALE_VOICE,
      female: env.OPENAI_REALTIME_FEMALE_VOICE,
      male: env.OPENAI_REALTIME_MALE_VOICE,
      maya: env.OPENAI_REALTIME_MAYA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE,
      miles: env.OPENAI_REALTIME_MILES_VOICE || env.OPENAI_REALTIME_MARCO_VOICE || env.OPENAI_REALTIME_MALE_VOICE || OPENAI_REALTIME_DEFAULT_MALE_VOICE,
    });
  }
  if (env.OPENAI_REALTIME_VOICE?.trim()) return env.OPENAI_REALTIME_VOICE.trim();
  return resolveSignalHostOpenAIVoice(undefined, {
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

function buildCustomerRequestAddressDetails(rawArguments: Record<string, unknown>) {
  const details: Record<string, string | number> = {};
  const serviceAddress = stringValue(rawArguments.formatted_address) ?? stringValue(rawArguments.service_address);
  if (serviceAddress) {
    details.serviceAddress = serviceAddress;
    details.formattedAddress = serviceAddress;
  }
  const latitude = coordinateValue(rawArguments.address_latitude);
  const longitude = coordinateValue(rawArguments.address_longitude);
  if (latitude !== undefined) details.addressLatitude = latitude;
  if (longitude !== undefined) details.addressLongitude = longitude;
  const status = stringValue(rawArguments.address_status);
  if (status) details.addressStatus = status;
  const googleMapsUri = stringValue(rawArguments.google_maps_uri);
  if (googleMapsUri) details.googleMapsUri = googleMapsUri;
  const googlePlaceId = stringValue(rawArguments.google_place_id);
  if (googlePlaceId) details.googlePlaceId = googlePlaceId;
  return Object.keys(details).length ? details : undefined;
}

function mergeCustomerRequestDetails(
  base?: Record<string, string | number | boolean>,
  address?: Record<string, string | number>,
) {
  if (!base && !address) return undefined;
  return {
    ...(base ?? {}),
    ...(address ?? {}),
  };
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

function extractDestinationPhoneFromSipHeaders(headers: Array<{ name?: unknown; value?: unknown }> | undefined) {
  const priority = [
    "diversion",
    "x-twilio-to",
    "x-original-to",
    "p-called-party-id",
    "called-party-id",
    "to",
  ];
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

function coordinateValue(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
}

function textMatchesTopic(text: string, topic: string) {
  if (!topic) return false;
  const normalizedText = text.toLowerCase();
  return topic
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .some((word) => normalizedText.includes(word));
}

function findOfferingMatches(context: RestaurantVoiceContext, topic: string) {
  const normalizedTopic = normalizeLookupText(topic);
  if (!normalizedTopic) return [];

  return context.menuItems.filter((item) => {
    const terms = [item.name, ...(item.aliases ?? []), ...(item.modifiers ?? [])];
    return terms.some((term) => offeringTermMatchesTopic(term, normalizedTopic));
  });
}

function offeringTermMatchesTopic(term: string, normalizedTopic: string) {
  const normalizedTerm = normalizeLookupText(term);
  if (!normalizedTerm) return false;
  if (normalizedTopic.includes(normalizedTerm) || normalizedTerm.includes(normalizedTopic)) return true;

  const topicWords = new Set(normalizedTopic.split(/\s+/).filter((word) => word.length > 2));
  return normalizedTerm
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .some((word) => topicWords.has(word));
}

function normalizeLookupText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatOfferingLookupItem(item: RestaurantVoiceContext["menuItems"][number]) {
  return {
    aliases: item.aliases ?? [],
    modifiers: item.modifiers ?? [],
    name: item.name,
    price: formatPrice(item.priceCents),
  };
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
  if (withoutQuestion.split(/\s+/).length > 12 || /\b(and|or|but|with|at|for|to|of)$/i.test(words)) {
    return "Thanks for calling. Goodbye.";
  }
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
