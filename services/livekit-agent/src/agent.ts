import { AutoSubscribe, cli, defineAgent, llm, ServerOptions, voice, type JobContext } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import {
  RoomEvent,
  TrackSource,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "@livekit/rtc-node";
import { fileURLToPath } from "node:url";
import { createGuestConfirmationService } from "../../voice/src/guest-confirmation-service";
import { HARBOR_PLUMBING_DEMO_LOCATION_ID } from "../../voice/src/livekit-handoff";
import {
  buildLiveKitRealtimeInstructions,
  createLiveKitCustomerRequest,
  createLiveKitReservationRequest,
  finishLiveKitCall,
  lookupLiveKitBusinessContext,
  lookupLiveKitRestaurantContext,
  requestLiveKitStaffCallback,
  resolveLiveKitRealtimeNoiseReduction,
  resolveLiveKitRealtimeSpeed,
  resolveLiveKitRealtimeTurnDetection,
  sendLiveKitBusinessLink,
  sendLiveKitGuestConfirmation,
} from "./realtime-runtime";
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
  lastCallerAudioAt?: number;
  lastCallerText?: string;
  locationId: string;
  noInputPrompted?: boolean;
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
    installLiveKitRoomDiagnostics(ctx, userData);
    const session = new voice.AgentSession<LiveKitAgentUserData>({
      llm: new openai.realtime.RealtimeModel({
        apiKey: env.OPENAI_API_KEY,
        inputAudioNoiseReduction: { type: resolveLiveKitRealtimeNoiseReduction(env) },
        inputAudioTranscription: {
          language: "en",
          model: "gpt-4o-mini-transcribe",
        },
        model: env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
        speed: resolveLiveKitRealtimeSpeed(env),
        turnDetection: resolveLiveKitModelTurnDetection(env),
        voice: resolveLiveKitOpenAIVoice(env, context),
      }),
      maxToolSteps: 4,
      turnHandling: {
        endpointing: {
          maxDelay: 2200,
          minDelay: 650,
          mode: "dynamic",
        },
        turnDetection: "realtime_llm",
      },
      userAwayTimeout: 14,
      userData,
    });

    session.on("user_input_transcribed" as any, (event: any) => {
      const transcript = typeof event.transcript === "string" ? event.transcript.trim() : "";
      console.info("[livekit-agent] user transcript event", {
        isFinal: Boolean(event.isFinal),
        language: event.language,
        room: ctx.room.name,
        speakerId: event.speakerId,
        transcriptPreview: transcript.slice(0, 160),
      });
      if (!event.isFinal || !transcript) return;
      userData.lastCallerText = transcript;
      void callStore.addTranscriptTurn({
        callId: userData.callRecordId,
        speaker: "caller",
        text: transcript,
      });
    });

    session.on("agent_state_changed" as any, (event: any) => {
      console.info("[livekit-agent] agent state changed", {
        newState: event.newState,
        oldState: event.oldState,
        room: ctx.room.name,
      });
    });

    session.on("user_state_changed" as any, (event: any) => {
      if (event.newState === "speaking") {
        userData.lastCallerAudioAt = Date.now();
      }
      console.info("[livekit-agent] user state changed", {
        newState: event.newState,
        oldState: event.oldState,
        room: ctx.room.name,
      });
    });

    session.on("speech_created" as any, (event: any) => {
      console.info("[livekit-agent] speech created", {
        room: ctx.room.name,
        source: event.source,
        userInitiated: event.userInitiated,
      });
    });

    session.on("metrics_collected" as any, (event: any) => {
      const metrics = event.metrics ?? {};
      console.info("[livekit-agent] metrics collected", {
        label: metrics.label,
        modelName: metrics.modelName,
        room: ctx.room.name,
        sequenceId: metrics.sequenceId,
        type: metrics.type,
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
      instructions: buildLiveKitRealtimeInstructions(context, { callerPhone }),
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
      inputOptions: await buildLiveKitInputOptions(),
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
    console.info("[livekit-agent] agent entered room; generating realtime greeting", {
      greeting: this.openingGreeting,
    });
    const greetingHandle = this.session.generateReply({
      instructions: [
        `Say exactly this greeting now: "${this.openingGreeting}"`,
        "Do not add your name.",
        "Do not mention that you are virtual or AI.",
        "Use an upbeat, confident, friendly front-desk tone.",
      ].join(" "),
    });
    void greetingHandle.waitForPlayout().then(
      () => {
        console.info("[livekit-agent] realtime greeting playout finished");
        const userData = this.session.userData;
        setTimeout(() => {
          if (userData.lastCallerText || userData.noInputPrompted) return;
          userData.noInputPrompted = true;
          console.warn("[livekit-agent] no caller transcript after greeting; prompting once", {
            callRecordId: userData.callRecordId,
            lastCallerAudioAt: userData.lastCallerAudioAt,
            locationId: userData.locationId,
          });
          const promptHandle = this.session.generateReply({
            instructions: [
              "The caller has not been transcribed after the greeting.",
              "Briefly say exactly: \"I'm here. What can I help with?\"",
              "Keep it warm and do not explain the technical issue.",
            ].join(" "),
          });
          void promptHandle.waitForPlayout().catch((error) => {
            console.error("[livekit-agent] no-input prompt failed", {
              error: formatErrorForLog(error),
            });
          });
        }, 8000);
      },
      (error) => {
        console.error("[livekit-agent] realtime greeting failed", {
          error: formatErrorForLog(error),
        });
      },
    );
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
    return lookupLiveKitRestaurantContext(userData.context, args.topic);
  }
  if (name === "lookup_business_context") {
    return lookupLiveKitBusinessContext(userData.context, args.topic);
  }
  if (name === "send_guest_confirmation") {
    return sendLiveKitGuestConfirmation({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      context: userData.context,
      guestConfirmationService: createGuestConfirmationService(userData.env),
      locationId: userData.locationId,
      rawArguments: args,
    });
  }
  if (name === "send_business_link") {
    return sendLiveKitBusinessLink({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      context: userData.context,
      guestConfirmationService: createGuestConfirmationService(userData.env),
      locationId: userData.locationId,
      rawArguments: args,
    });
  }
  if (name === "create_customer_request") {
    return createLiveKitCustomerRequest({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      callStore: userData.callStore,
      locationId: userData.locationId,
      rawArguments: args,
    });
  }
  if (name === "create_reservation_request") {
    return createLiveKitReservationRequest({
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
    return requestLiveKitStaffCallback({
      callRecordId: userData.callRecordId,
      callerPhone: userData.callerPhone,
      context: userData.context,
      locationId: userData.locationId,
      rawArguments: args,
      staffNotificationService: createStaffNotificationService(userData.env),
    });
  }
  if (name === "finish_call") {
    const result = finishLiveKitCall({
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

async function buildLiveKitInputOptions() {
  const baseOptions = {
    audioEnabled: true,
    audioNumChannels: 1,
    audioSampleRate: 24000,
    closeOnDisconnect: true,
    textEnabled: false,
    videoEnabled: false,
  };
  if (!isNodeNoiseCancellationEnabled()) return baseOptions;

  try {
    const { TelephonyBackgroundVoiceCancellation } = await import("@livekit/noise-cancellation-node");
    return {
      ...baseOptions,
      noiseCancellation: TelephonyBackgroundVoiceCancellation(),
    };
  } catch (error) {
    console.error("[livekit-agent] failed to initialize Node noise cancellation; continuing without it", {
      error: formatErrorForLog(error),
    });
    return baseOptions;
  }
}

function installLiveKitRoomDiagnostics(ctx: JobContext, userData: LiveKitAgentUserData) {
  const room = ctx.room;
  const labels = {
    callRecordId: userData.callRecordId,
    locationId: userData.locationId,
    room: room.name,
  };

  const logRemoteParticipants = (reason: string) => {
    console.info("[livekit-agent] room participant snapshot", {
      ...labels,
      reason,
      remoteParticipants: Array.from(room.remoteParticipants.values()).map((participant) => summarizeParticipant(participant)),
    });
  };

  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    console.info("[livekit-agent] room participant connected", {
      ...labels,
      participant: summarizeParticipant(participant),
    });
  });
  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    console.info("[livekit-agent] room participant disconnected", {
      ...labels,
      participant: summarizeParticipant(participant),
    });
  });
  room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    console.info("[livekit-agent] room track published", {
      ...labels,
      participant: summarizeParticipant(participant),
      publication: summarizePublication(publication),
    });
  });
  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (publication.source === TrackSource.SOURCE_MICROPHONE) {
      userData.lastCallerAudioAt = Date.now();
    }
    console.info("[livekit-agent] room track subscribed", {
      ...labels,
      participant: summarizeParticipant(participant),
      publication: summarizePublication(publication),
      trackKind: track.kind,
      trackSid: track.sid,
    });
  });
  room.on(RoomEvent.TrackSubscriptionFailed, (trackSid: string, participant: RemoteParticipant, reason?: string) => {
    console.error("[livekit-agent] room track subscription failed", {
      ...labels,
      participant: summarizeParticipant(participant),
      reason,
      trackSid,
    });
  });
  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    console.info("[livekit-agent] room track unsubscribed", {
      ...labels,
      participant: summarizeParticipant(participant),
      publication: summarizePublication(publication),
      trackKind: track.kind,
      trackSid: track.sid,
    });
  });
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    console.info("[livekit-agent] room active speakers changed", {
      ...labels,
      speakers: speakers.map((speaker) => speaker.identity),
    });
  });

  logRemoteParticipants("after-connect");
  setTimeout(() => logRemoteParticipants("after-connect-plus-2s"), 2000);
  setTimeout(() => logRemoteParticipants("after-connect-plus-6s"), 6000);
}

function summarizeParticipant(participant: RemoteParticipant) {
  return {
    identity: participant.identity,
    kind: participant.info.kind,
    metadata: participant.metadata,
    name: participant.name,
    sid: participant.sid,
    trackCount: participant.trackPublications.size,
    tracks: Array.from(participant.trackPublications.values()).map((publication) => summarizePublication(publication)),
  };
}

function summarizePublication(publication: RemoteTrackPublication) {
  return {
    kind: publication.kind,
    muted: publication.muted,
    sid: publication.sid,
    source: publication.source,
    subscribed: publication.subscribed,
    trackSid: publication.track?.sid,
  };
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

function resolveLiveKitModelTurnDetection(env: VoiceServiceEnv) {
  const turnDetection = resolveLiveKitRealtimeTurnDetection(env);
  const { idle_timeout_ms: _idleTimeoutMs, ...supportedTurnDetection } = turnDetection as typeof turnDetection & {
    idle_timeout_ms?: number;
  };
  return supportedTurnDetection;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  installProcessDiagnostics();
  console.info("[livekit-agent] booting worker", {
    agentName: process.env.LIVEKIT_AGENT_NAME?.trim() || DEFAULT_LIVEKIT_AGENT_NAME,
    liveKitUrlConfigured: Boolean(process.env.LIVEKIT_URL?.trim()),
    nodeNoiseCancellationEnabled: isNodeNoiseCancellationEnabled(),
    openAIConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim()),
  });
  cli.runApp(new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.LIVEKIT_AGENT_NAME?.trim() || DEFAULT_LIVEKIT_AGENT_NAME,
  }));
}

function installProcessDiagnostics() {
  process.on("uncaughtException", (error) => {
    console.error("[livekit-agent] uncaught exception", {
      error: formatErrorForLog(error),
    });
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[livekit-agent] unhandled rejection", {
      error: formatErrorForLog(reason),
    });
  });
  process.on("SIGINT", () => {
    console.info("[livekit-agent] SIGINT received");
  });
  process.on("SIGTERM", () => {
    console.info("[livekit-agent] SIGTERM received");
  });
  process.on("exit", (code) => {
    console.info("[livekit-agent] process exiting", { code });
  });
}
