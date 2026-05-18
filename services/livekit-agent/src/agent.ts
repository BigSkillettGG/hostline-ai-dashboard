import { AutoSubscribe, cli, defineAgent, llm, ServerOptions, voice, type JobContext } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import { TelephonyBackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { fileURLToPath } from "node:url";
import { createGuestConfirmationService } from "../../voice/src/guest-confirmation-service";
import { HARBOR_PLUMBING_DEMO_LOCATION_ID } from "../../voice/src/livekit-handoff";
import {
  buildOpenAIRealtimeInstructions,
  createOpenAIRealtimeCustomerRequest,
  createOpenAIRealtimeReservationRequest,
  finishOpenAIRealtimeCall,
  lookupBusinessContext,
  lookupRestaurantContext,
  requestOpenAIRealtimeStaffCallback,
  resolveOpenAIRealtimeNoiseReduction,
  resolveOpenAIRealtimeSpeed,
  resolveOpenAIRealtimeTurnDetection,
  sendOpenAIRealtimeBusinessLink,
  sendOpenAIRealtimeGuestConfirmation,
} from "../../voice/src/openai-realtime-sip";
import { buildOpenAIRealtimeTools } from "../../voice/src/openai-realtime-tools";
import { createRestaurantContextStore } from "../../voice/src/restaurant-context-store";
import { toSpokenRestaurantName, type RestaurantVoiceContext } from "../../voice/src/restaurant-context";
import { createCallStore, type CallStore } from "../../voice/src/call-store";
import { loadEnv, type VoiceServiceEnv } from "../../voice/src/env";
import { createStaffNotificationService } from "../../voice/src/notification-service";
import { createReservationPlatformService } from "../../voice/src/reservation-platform-service";
import { resolveSignalHostOpenAIVoice } from "../../../src/domain/voice-selection";

interface LiveKitAgentUserData {
  callRecordId?: string;
  callerPhone?: string;
  callStore: CallStore;
  context: RestaurantVoiceContext;
  env: VoiceServiceEnv;
  jobContext: JobContext;
  lastCallerText?: string;
  locationId: string;
  startedAt: number;
}

const DEFAULT_LIVEKIT_AGENT_NAME = "signalhost-harbor";

export default defineAgent({
  entry: async (ctx) => {
    const env = loadEnv();
    const metadata = parseMetadata(ctx.job?.metadata ?? ctx.info?.acceptArguments?.metadata);
    const locationId = metadata.locationId ?? env.SUPABASE_DEMO_LOCATION_ID ?? HARBOR_PLUMBING_DEMO_LOCATION_ID;
    console.info("[livekit-agent] job starting", {
      jobId: ctx.job?.id,
      locationId,
      metadata,
      room: ctx.room.name,
    });
    const context = await createRestaurantContextStore(env).getContext(locationId);
    const callStore = createCallStore(env);
    const externalCallId = metadata.callSid ?? ctx.room.name ?? `livekit-${Date.now()}`;
    const callerPhone = metadata.callerPhone;
    const startedAt = Date.now();
    const callStart = await callStore.startRealtimeCall({
      callerPhone,
      externalCallId,
      externalSessionId: ctx.room.name,
      locationId,
      provider: "livekit_openai_realtime",
      providerPayload: {
        livekitRoom: ctx.room.name,
        metadata,
      },
    });

    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);

    const userData: LiveKitAgentUserData = {
      callRecordId: callStart.callId,
      callerPhone,
      callStore,
      context,
      env,
      jobContext: ctx,
      locationId,
      startedAt,
    };
    const session = new voice.AgentSession<LiveKitAgentUserData>({
      llm: new openai.realtime.RealtimeModel({
        apiKey: env.OPENAI_API_KEY,
        inputAudioNoiseReduction: { type: resolveOpenAIRealtimeNoiseReduction(env) },
        inputAudioTranscription: {
          language: "en",
          model: "gpt-4o-mini-transcribe",
        },
        model: env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
        speed: resolveOpenAIRealtimeSpeed(env),
        turnDetection: resolveLiveKitRealtimeTurnDetection(env),
        voice: resolveLiveKitOpenAIVoice(env, context),
      }),
      maxToolSteps: 4,
      turnHandling: {
        endpointing: {
          maxDelay: 2200,
          minDelay: 650,
          mode: "dynamic",
        },
        interruption: {
          enabled: true,
          falseInterruptionTimeout: 2400,
          minDuration: 700,
          minWords: 2,
          mode: "adaptive",
          resumeFalseInterruption: true,
        },
        preemptiveGeneration: {
          enabled: true,
          preemptiveTts: false,
        },
        turnDetection: "realtime_llm",
      },
      userAwayTimeout: 14,
      userData,
    });

    session.on("user_input_transcribed" as any, (event: any) => {
      if (!event.isFinal || !event.transcript.trim()) return;
      userData.lastCallerText = event.transcript.trim();
      void callStore.addTranscriptTurn({
        callId: userData.callRecordId,
        speaker: "caller",
        text: event.transcript.trim(),
      });
    });

    session.on("conversation_item_added" as any, (event: any) => {
      const text = event.item?.type === "message" && event.item.role === "assistant" ? event.item.textContent?.trim() : undefined;
      if (!text) return;
      void callStore.addTranscriptTurn({
        callId: userData.callRecordId,
        speaker: "agent",
        text,
      });
    });

    session.on("agent_false_interruption" as any, (event: any) => {
      console.info("[livekit-agent] false interruption detected", {
        resumed: event.resumed,
        room: ctx.room.name,
      });
    });

    session.on("error" as any, (event: any) => {
      console.error("[livekit-agent] session error", {
        error: event.error instanceof Error ? event.error.message : event.error,
        room: ctx.room.name,
      });
    });

    session.on("close" as any, (event: any) => {
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      void callStore.completeCall({
        callId: userData.callRecordId,
        channel: "phone",
        confidence: event.reason === "participant_disconnected" ? 80 : 88,
        durationSeconds,
        externalCallSid: externalCallId,
        intent: "other",
        outcome: event.reason === "error" ? "LiveKit pilot call closed with an error." : "LiveKit pilot call completed.",
        status: event.reason === "error" ? "needs_review" : "new",
        summary: `LiveKit pilot call for ${context.restaurantName}.`,
      });
    });

    const openingGreeting = buildOpeningGreeting(context);
    const agent = new SignalHostLiveKitAgent(openingGreeting, {
      instructions: buildOpenAIRealtimeInstructions(context, { callerPhone }),
      tools: buildLiveKitToolContext(userData),
    });

    console.info("[livekit-agent] starting agent session", {
      callRecordId: userData.callRecordId,
      locationId,
      nodeNoiseCancellationEnabled: isNodeNoiseCancellationEnabled(),
      room: ctx.room.name,
      voice: resolveLiveKitOpenAIVoice(env, context),
    });
    await session.start({
      agent,
      inputOptions: buildLiveKitInputOptions(),
      room: ctx.room,
    });
    console.info("[livekit-agent] agent session started", {
      callRecordId: userData.callRecordId,
      room: ctx.room.name,
    });
  },
});

class SignalHostLiveKitAgent extends voice.Agent<LiveKitAgentUserData> {
  constructor(
    private readonly openingGreeting: string,
    options: ConstructorParameters<typeof voice.Agent<LiveKitAgentUserData>>[0],
  ) {
    super(options);
  }

  override async onEnter(): Promise<void> {
    console.info("[livekit-agent] agent entered room; speaking greeting", {
      greeting: this.openingGreeting,
    });
    this.session.say(this.openingGreeting, {
      addToChatCtx: true,
      allowInterruptions: false,
    });
  }
}

function buildLiveKitToolContext(userData: LiveKitAgentUserData): llm.ToolContext<LiveKitAgentUserData> {
  const tools = buildOpenAIRealtimeTools(userData.context);
  return Object.fromEntries(
    tools.map((toolDefinition) => [
      toolDefinition.name,
      llm.tool({
        description: toolDefinition.description,
        execute: async (args, options) => executeLiveKitTool(toolDefinition.name, args, options.ctx.userData),
        parameters: toolDefinition.parameters as any,
      }),
    ]),
  );
}

async function executeLiveKitTool(name: string, args: Record<string, unknown>, userData: LiveKitAgentUserData) {
  if (name === "lookup_restaurant_context") {
    return lookupRestaurantContext(userData.context, args.topic);
  }
  if (name === "lookup_business_context") {
    return lookupBusinessContext(userData.context, args.topic);
  }
  if (name === "send_guest_confirmation") {
    return sendOpenAIRealtimeGuestConfirmation({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      context: userData.context,
      guestConfirmationService: createGuestConfirmationService(userData.env),
      locationId: userData.locationId,
      rawArguments: args,
    });
  }
  if (name === "send_business_link") {
    return sendOpenAIRealtimeBusinessLink({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      context: userData.context,
      guestConfirmationService: createGuestConfirmationService(userData.env),
      locationId: userData.locationId,
      rawArguments: args,
    });
  }
  if (name === "create_customer_request") {
    return createOpenAIRealtimeCustomerRequest({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      callStore: userData.callStore,
      context: userData.context,
      locationId: userData.locationId,
      rawArguments: args,
    });
  }
  if (name === "create_reservation_request") {
    return createOpenAIRealtimeReservationRequest({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      callStore: userData.callStore,
      context: userData.context,
      locationId: userData.locationId,
      rawArguments: args,
      reservationPlatformService: createReservationPlatformService(userData.env),
    });
  }
  if (name === "request_staff_callback") {
    return requestOpenAIRealtimeStaffCallback({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      context: userData.context,
      locationId: userData.locationId,
      rawArguments: args,
      staffNotificationService: createStaffNotificationService(userData.env),
    });
  }
  if (name === "finish_call") {
    const result = finishOpenAIRealtimeCall({
      lastCallerText: userData.lastCallerText,
      rawArguments: args,
    });
    if (result.ok) {
      setTimeout(() => userData.jobContext.shutdown(result.reason), 3500);
    }
    return result;
  }
  return {
    error: `Unknown LiveKit pilot tool: ${name}`,
    ok: false,
  };
}

function buildOpeningGreeting(context: RestaurantVoiceContext) {
  return `Thank you for calling ${toSpokenRestaurantName(context.restaurantName)}. How can I help you?`;
}

function buildLiveKitInputOptions() {
  if (!isNodeNoiseCancellationEnabled()) return undefined;

  try {
    return {
      noiseCancellation: TelephonyBackgroundVoiceCancellation(),
    };
  } catch (error) {
    console.error("[livekit-agent] failed to initialize Node noise cancellation; continuing without it", {
      error: formatErrorForLog(error),
    });
    return undefined;
  }
}

function isNodeNoiseCancellationEnabled() {
  return process.env.LIVEKIT_AGENT_INPUT_NOISE_CANCELLATION === "true";
}

function parseMetadata(value: unknown): Record<string, string | undefined> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, entry]) => [key, typeof entry === "string" ? entry : undefined]),
    );
  } catch {
    return {};
  }
}

function formatErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return error;
}

function resolveLiveKitOpenAIVoice(env: VoiceServiceEnv, context: RestaurantVoiceContext) {
  const configuredVoice = context.voiceProfileId ?? context.hostName ?? context.voiceGender;
  if (env.OPENAI_REALTIME_VOICE?.trim()) return env.OPENAI_REALTIME_VOICE.trim();
  return resolveSignalHostOpenAIVoice(configuredVoice, {
    aiden: env.OPENAI_REALTIME_AIDEN_VOICE || env.OPENAI_REALTIME_THEO_VOICE || env.OPENAI_REALTIME_MALE_VOICE,
    ava: env.OPENAI_REALTIME_AVA_VOICE || env.OPENAI_REALTIME_VERA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE,
    female: env.OPENAI_REALTIME_FEMALE_VOICE,
    male: env.OPENAI_REALTIME_MALE_VOICE,
    maya: env.OPENAI_REALTIME_MAYA_VOICE || env.OPENAI_REALTIME_FEMALE_VOICE,
    miles: env.OPENAI_REALTIME_MILES_VOICE || env.OPENAI_REALTIME_MARCO_VOICE || env.OPENAI_REALTIME_MALE_VOICE,
  });
}

function resolveLiveKitRealtimeTurnDetection(env: VoiceServiceEnv) {
  const turnDetection = resolveOpenAIRealtimeTurnDetection(env);
  const { idle_timeout_ms: _idleTimeoutMs, ...supportedTurnDetection } = turnDetection as typeof turnDetection & {
    idle_timeout_ms?: number;
  };
  return supportedTurnDetection;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.LIVEKIT_AGENT_NAME?.trim() || DEFAULT_LIVEKIT_AGENT_NAME,
  }));
}
