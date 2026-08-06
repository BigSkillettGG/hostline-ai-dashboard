import type { VoiceServiceEnv } from "./env";

export const PREFERRED_VOICE_RUNTIME_PROVIDER = "vapi" as const;

export type VoiceRuntimeProviderId =
  | "vapi"
  | "openai_realtime_sip"
  | "twilio_conversation_relay"
  | "livekit";

export type VoiceRuntimeLifecycle =
  | "preferred"
  | "maintained_fallback"
  | "legacy_fallback"
  | "quarantined";

export type VoiceRuntimeCapabilityStatus = "available" | "partial" | "unavailable";

export interface VoiceRuntimeCapabilities {
  businessActions: VoiceRuntimeCapabilityStatus;
  contextAndKnowledge: VoiceRuntimeCapabilityStatus;
  durableLifecycle: VoiceRuntimeCapabilityStatus;
  inboundVoice: VoiceRuntimeCapabilityStatus;
  liveTransfer: VoiceRuntimeCapabilityStatus;
}

export interface VoiceRuntimeProviderDescriptor {
  aliases: string[];
  capabilities: VoiceRuntimeCapabilities;
  configured: boolean;
  enabled: boolean;
  id: VoiceRuntimeProviderId;
  label: string;
  lifecycle: VoiceRuntimeLifecycle;
  limitations: string[];
  readyForNewAssignments: boolean;
}

export interface VoiceRuntimeCatalog {
  preferredProvider: typeof PREFERRED_VOICE_RUNTIME_PROVIDER;
  providers: VoiceRuntimeProviderDescriptor[];
  routingPolicyEnforced: false;
  schemaVersion: 1;
}

const PROVIDER_ALIASES: Record<VoiceRuntimeProviderId, string[]> = {
  livekit: ["livekit", "livekit_agent", "livekit_harbor_pilot"],
  openai_realtime_sip: ["openai_realtime_sip", "openai_realtime", "openai_sip"],
  twilio_conversation_relay: [
    "twilio_conversation_relay",
    "conversation_relay",
    "conversationrelay",
  ],
  vapi: ["vapi", "vapi_pilot"],
};

export function normalizeVoiceRuntimeProvider(value?: string | null): VoiceRuntimeProviderId | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;

  return (Object.entries(PROVIDER_ALIASES) as Array<[VoiceRuntimeProviderId, string[]]>)
    .find(([, aliases]) => aliases.includes(normalized))?.[0];
}

export function buildVoiceRuntimeCatalog(env: VoiceServiceEnv): VoiceRuntimeCatalog {
  const publicHttpConfigured = Boolean(env.PUBLIC_HTTP_BASE_URL);
  const vapiConfigured = Boolean(env.VAPI_API_KEY && publicHttpConfigured);
  const vapiEnabled = env.VAPI_PILOT_ENABLED === true;
  const openAIRealtimeConfigured = Boolean(env.OPENAI_API_KEY && publicHttpConfigured);
  const conversationRelayConfigured = Boolean(
    env.OPENAI_API_KEY &&
      env.PUBLIC_WS_BASE_URL &&
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN,
  );
  const liveKitConfigured = Boolean(
    env.LIVEKIT_URL &&
      env.LIVEKIT_API_KEY &&
      env.LIVEKIT_API_SECRET &&
      env.LIVEKIT_SIP_ENDPOINT &&
      env.LIVEKIT_INBOUND_AUTH_USERNAME &&
      env.LIVEKIT_INBOUND_AUTH_PASSWORD &&
      env.OPENAI_API_KEY,
  );
  const liveKitEnabled = Boolean(
    liveKitConfigured &&
      env.LIVEKIT_TWILIO_WEBHOOK_ENABLED &&
      env.LIVEKIT_ROUTE_ON_TWILIO_VOICE,
  );

  return {
    preferredProvider: PREFERRED_VOICE_RUNTIME_PROVIDER,
    providers: [
      {
        aliases: PROVIDER_ALIASES.vapi,
        capabilities: {
          businessActions: "partial",
          contextAndKnowledge: "available",
          durableLifecycle: "partial",
          inboundVoice: "available",
          liveTransfer: "unavailable",
        },
        configured: vapiConfigured,
        enabled: vapiEnabled,
        id: "vapi",
        label: "Vapi",
        lifecycle: "preferred",
        limitations: [
          "The current executor does not implement every action advertised by fixed assistants.",
          "Call session state is in process memory and terminal event idempotency needs hardening.",
          "Live transfer is not implemented.",
        ],
        readyForNewAssignments: Boolean(vapiConfigured && vapiEnabled && env.VAPI_WEBHOOK_SECRET),
      },
      {
        aliases: PROVIDER_ALIASES.openai_realtime_sip,
        capabilities: {
          businessActions: "available",
          contextAndKnowledge: "available",
          durableLifecycle: "partial",
          inboundVoice: "available",
          liveTransfer: "unavailable",
        },
        configured: openAIRealtimeConfigured,
        enabled: openAIRealtimeConfigured,
        id: "openai_realtime_sip",
        label: "Direct OpenAI Realtime SIP",
        lifecycle: "maintained_fallback",
        limitations: [
          "This is a maintained fallback, not the default production runtime.",
          "Business actions are tightly coupled to the direct SIP implementation.",
          "Live transfer is not implemented.",
        ],
        readyForNewAssignments: Boolean(
          openAIRealtimeConfigured && env.OPENAI_WEBHOOK_SECRET && env.TWILIO_SIP_TRUNK_SID,
        ),
      },
      {
        aliases: PROVIDER_ALIASES.twilio_conversation_relay,
        capabilities: {
          businessActions: "partial",
          contextAndKnowledge: "available",
          durableLifecycle: "partial",
          inboundVoice: "available",
          liveTransfer: "unavailable",
        },
        configured: conversationRelayConfigured,
        enabled: conversationRelayConfigured,
        id: "twilio_conversation_relay",
        label: "Twilio ConversationRelay",
        lifecycle: "legacy_fallback",
        limitations: [
          "This path is retained for fallback and testing only.",
          "It depends on a long-lived SignalHost websocket media path.",
          "New commercial features should target the shared action runtime instead of this adapter.",
        ],
        readyForNewAssignments: Boolean(
          conversationRelayConfigured && env.REQUIRE_TWILIO_SIGNATURE,
        ),
      },
      {
        aliases: PROVIDER_ALIASES.livekit,
        capabilities: {
          businessActions: "partial",
          contextAndKnowledge: "available",
          durableLifecycle: "partial",
          inboundVoice: "available",
          liveTransfer: "unavailable",
        },
        configured: liveKitConfigured,
        enabled: liveKitEnabled,
        id: "livekit",
        label: "LiveKit agent",
        lifecycle: "quarantined",
        limitations: [
          "The Harbor/LiveKit path is quarantined and must not receive default assignments.",
          "It remains available only for a deliberate, measured experiment.",
        ],
        readyForNewAssignments: false,
      },
    ],
    routingPolicyEnforced: false,
    schemaVersion: 1,
  };
}
