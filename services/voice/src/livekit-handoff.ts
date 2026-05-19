import type { VoiceServiceEnv } from "./env";
import { buildTwilioRecordingStatusCallbackUrl } from "./twilio-recording-service";

export const HARBOR_PLUMBING_DEMO_LOCATION_ID = "22222222-2222-4222-8222-222222222222";

const DEFAULT_LIVEKIT_AGENT_NAME = "signalhost-harbor";
const DEFAULT_LIVEKIT_ROOM_PREFIX = "harbor-call-";

type LiveKitHandoffEnv = Pick<
  VoiceServiceEnv,
  | "LIVEKIT_AGENT_NAME"
  | "LIVEKIT_API_KEY"
  | "LIVEKIT_API_SECRET"
  | "LIVEKIT_HARBOR_LOCATION_IDS"
  | "LIVEKIT_INBOUND_AUTH_PASSWORD"
  | "LIVEKIT_INBOUND_AUTH_USERNAME"
  | "LIVEKIT_KRISP_ENABLED"
  | "LIVEKIT_PHONE_NUMBER"
  | "LIVEKIT_PILOT_LOCATION_IDS"
  | "LIVEKIT_ROOM_PREFIX"
  | "LIVEKIT_ROUTE_ON_TWILIO_VOICE"
  | "LIVEKIT_SIP_ENDPOINT"
  | "LIVEKIT_URL"
  | "OPENAI_API_KEY"
  | "PUBLIC_HTTP_BASE_URL"
  | "TWILIO_CALL_RECORDING_ENABLED"
>;

export interface LiveKitPilotCheck {
  detail: string;
  id: string;
  label: string;
  ready: boolean;
  required: boolean;
}

export interface LiveKitPilotConfig {
  agentName: string;
  agentRuntimeReady: boolean;
  callRoutingReady: boolean;
  checks: LiveKitPilotCheck[];
  dispatchRuleJson: Record<string, unknown>;
  enabledForLocation: boolean;
  inboundTrunkJson: Record<string, unknown>;
  krispEnabled: boolean;
  locationId: string;
  ready: boolean;
  roomPrefix: string;
  routeOnTwilioVoice: boolean;
  sipEndpoint?: string;
  sipUri?: string;
  twilioVoiceWebhookUrl?: string;
}

export interface LiveKitTwiMLInput {
  callSid?: string;
  dialedPhone?: string;
  env: LiveKitHandoffEnv;
  fallbackActionUrl?: string;
  locationId?: string;
}

export function buildLiveKitPilotConfig(env: LiveKitHandoffEnv, requestedLocationId?: string): LiveKitPilotConfig {
  const locationId = requestedLocationId?.trim() || HARBOR_PLUMBING_DEMO_LOCATION_ID;
  const enabledForLocation = isLiveKitPilotLocation(env, locationId);
  const sipEndpoint = normalizeSipEndpoint(env.LIVEKIT_SIP_ENDPOINT);
  const agentName = env.LIVEKIT_AGENT_NAME?.trim() || DEFAULT_LIVEKIT_AGENT_NAME;
  const roomPrefix = env.LIVEKIT_ROOM_PREFIX?.trim() || DEFAULT_LIVEKIT_ROOM_PREFIX;
  const krispEnabled = env.LIVEKIT_KRISP_ENABLED !== false;
  const phoneNumber = normalizePhoneNumber(env.LIVEKIT_PHONE_NUMBER);
  const twilioVoiceWebhookUrl = env.PUBLIC_HTTP_BASE_URL
    ? appendQuery(`${env.PUBLIC_HTTP_BASE_URL.replace(/\/$/, "")}/twilio/livekit-voice`, { locationId })
    : undefined;

  const checks: LiveKitPilotCheck[] = [
    {
      detail: "Harbor is the only default LiveKit pilot so the other demo numbers stay on the current OpenAI Realtime path.",
      id: "pilot_location",
      label: "Pilot location",
      ready: enabledForLocation,
      required: true,
    },
    {
      detail: "Needed so Twilio can bridge the call to LiveKit SIP.",
      id: "livekit_sip_endpoint",
      label: "LiveKit SIP endpoint",
      ready: Boolean(sipEndpoint),
      required: true,
    },
    {
      detail: "Must match the username/password on the LiveKit inbound trunk.",
      id: "livekit_sip_auth",
      label: "LiveKit SIP auth",
      ready: Boolean(env.LIVEKIT_INBOUND_AUTH_USERNAME && env.LIVEKIT_INBOUND_AUTH_PASSWORD),
      required: true,
    },
    {
      detail: "Needed by the LiveKit agent worker when it joins SIP rooms.",
      id: "livekit_agent_credentials",
      label: "LiveKit agent credentials",
      ready: Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET),
      required: true,
    },
    {
      detail: "Keeps OpenAI as the brain while LiveKit handles SIP, rooms, and noise reduction.",
      id: "openai_api_key",
      label: "OpenAI API key",
      ready: Boolean(env.OPENAI_API_KEY),
      required: true,
    },
    {
      detail: "Needed for the Twilio webhook URL and optional recording callback.",
      id: "public_voice_url",
      label: "Public voice URL",
      ready: Boolean(env.PUBLIC_HTTP_BASE_URL),
      required: true,
    },
    {
      detail: "Optional fallback number used when Twilio does not include the dialed phone number in webhook params.",
      id: "livekit_phone_number",
      label: "Pilot phone number",
      ready: Boolean(phoneNumber),
      required: false,
    },
  ];

  const callRoutingReady = Boolean(enabledForLocation && sipEndpoint && env.LIVEKIT_INBOUND_AUTH_USERNAME && env.LIVEKIT_INBOUND_AUTH_PASSWORD);
  const agentRuntimeReady = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.OPENAI_API_KEY);
  const ready = checks.filter((check) => check.required).every((check) => check.ready);

  return {
    agentName,
    agentRuntimeReady,
    callRoutingReady,
    checks,
    dispatchRuleJson: buildLiveKitDispatchRuleJson({ agentName, locationId, roomPrefix }),
    enabledForLocation,
    inboundTrunkJson: buildLiveKitInboundTrunkJson({
      authPassword: env.LIVEKIT_INBOUND_AUTH_PASSWORD,
      authUsername: env.LIVEKIT_INBOUND_AUTH_USERNAME,
      krispEnabled,
      phoneNumber,
    }),
    krispEnabled,
    locationId,
    ready,
    roomPrefix,
    routeOnTwilioVoice: Boolean(env.LIVEKIT_ROUTE_ON_TWILIO_VOICE && enabledForLocation),
    sipEndpoint,
    sipUri: sipEndpoint ? `sip:${sipEndpoint}` : undefined,
    twilioVoiceWebhookUrl,
  };
}

export function buildLiveKitTwiML({
  callSid,
  dialedPhone,
  env,
  fallbackActionUrl,
  locationId,
}: LiveKitTwiMLInput): string | undefined {
  const config = buildLiveKitPilotConfig(env, locationId);
  const sipEndpoint = config.sipEndpoint;
  const phoneNumber = normalizePhoneNumber(dialedPhone) ?? normalizePhoneNumber(env.LIVEKIT_PHONE_NUMBER);
  if (!config.callRoutingReady || !sipEndpoint || !phoneNumber || !env.LIVEKIT_INBOUND_AUTH_USERNAME || !env.LIVEKIT_INBOUND_AUTH_PASSWORD) {
    return undefined;
  }

  const recordingCallbackUrl = env.TWILIO_CALL_RECORDING_ENABLED === "false"
    ? undefined
    : buildTwilioRecordingStatusCallbackUrl(env, {
      externalCallSid: callSid ?? "",
      locationId: config.locationId,
    });
  const dialAttributes = recordingCallbackUrl
    ? [
      ` record="record-from-answer-dual"`,
      ` recordingStatusCallback="${escapeXmlAttribute(recordingCallbackUrl)}"`,
      ` recordingStatusCallbackMethod="POST"`,
      ` recordingStatusCallbackEvent="completed absent"`,
    ].join("")
    : "";
  const actionAttributes = fallbackActionUrl
    ? ` action="${escapeXmlAttribute(fallbackActionUrl)}" method="POST" timeout="12"`
    : "";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Response>`,
    `  <Dial${dialAttributes}${actionAttributes}>`,
    `    <Sip username="${escapeXmlAttribute(env.LIVEKIT_INBOUND_AUTH_USERNAME)}" password="${escapeXmlAttribute(env.LIVEKIT_INBOUND_AUTH_PASSWORD)}">sip:${escapeXmlText(phoneNumber)}@${escapeXmlText(sipEndpoint)};transport=tcp</Sip>`,
    `  </Dial>`,
    `</Response>`,
  ].join("\n");
}

export function isLiveKitPilotLocation(env: LiveKitHandoffEnv, locationId?: string) {
  const normalizedLocationId = locationId?.trim().toLowerCase();
  if (!normalizedLocationId) return false;
  const pilotIds = parseLiveKitPilotLocationIds(env.LIVEKIT_PILOT_LOCATION_IDS || env.LIVEKIT_HARBOR_LOCATION_IDS);
  return pilotIds.has("*") || pilotIds.has("all") || pilotIds.has(normalizedLocationId);
}

export function shouldRouteTwilioVoiceToLiveKit(env: LiveKitHandoffEnv, locationId?: string) {
  return Boolean(env.LIVEKIT_ROUTE_ON_TWILIO_VOICE && isLiveKitPilotLocation(env, locationId));
}

export function parseLiveKitPilotLocationIds(rawValue?: string) {
  const value = rawValue?.trim() || HARBOR_PLUMBING_DEMO_LOCATION_ID;
  return new Set(
    value
      .split(/[,\s]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildLiveKitInboundTrunkJson({
  authPassword,
  authUsername,
  krispEnabled,
  phoneNumber,
}: {
  authPassword?: string;
  authUsername?: string;
  krispEnabled: boolean;
  phoneNumber?: string;
}) {
  return {
    trunk: {
      name: "SignalHost Harbor Plumbing inbound",
      numbers: phoneNumber ? [phoneNumber] : ["+1XXXXXXXXXX"],
      authUsername: authUsername || "<choose-a-username>",
      authPassword: authPassword || "<choose-a-password>",
      krispEnabled,
    },
  };
}

function buildLiveKitDispatchRuleJson({
  agentName,
  locationId,
  roomPrefix,
}: {
  agentName: string;
  locationId: string;
  roomPrefix: string;
}) {
  return {
    dispatch_rule: {
      name: "SignalHost Harbor Plumbing dispatch",
      rule: {
        dispatchRuleIndividual: {
          roomPrefix,
        },
      },
      roomConfig: {
        agents: [
          {
            agentName,
            metadata: JSON.stringify({
              locationId,
              signalHostPilot: "harbor-plumbing",
              vertical: "plumbing",
            }),
          },
        ],
      },
    },
  };
}

function normalizeSipEndpoint(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed
    .replace(/^sip:/i, "")
    .replace(/;transport=(?:tcp|tls|udp)$/i, "")
    .replace(/\/+$/, "");
}

function normalizePhoneNumber(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return undefined;
}

function appendQuery(url: string, params: Record<string, string | undefined>) {
  const nextUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value) nextUrl.searchParams.set(key, value);
  }
  return nextUrl.toString();
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
