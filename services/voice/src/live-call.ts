import type { VoiceServiceEnv } from "./env";
import { buildTwilioRecordingStatusCallbackUrl } from "./twilio-recording-service";

export interface LiveCallConfig {
  actionUrl?: string;
  conversationRelayUrl?: string;
  locationId: string;
  publicHttpBaseUrl?: string;
  publicWsBaseUrl?: string;
  ready: boolean;
  recordingStatusCallbackUrl?: string;
  twilioSignatureRequired: boolean;
  voiceWebhookUrl?: string;
}

export function buildLiveCallConfig(env: VoiceServiceEnv, requestedLocationId?: string): LiveCallConfig {
  const locationId = requestedLocationId?.trim() || env.SUPABASE_DEMO_LOCATION_ID || "demo-location";
  const publicHttpBaseUrl = env.PUBLIC_HTTP_BASE_URL?.replace(/\/$/, "");
  const publicWsBaseUrl = env.PUBLIC_WS_BASE_URL?.replace(/\/$/, "");
  const voiceWebhookUrl = publicHttpBaseUrl
    ? appendQuery(`${publicHttpBaseUrl}/twilio/voice`, { locationId })
    : undefined;

  return {
    actionUrl: publicHttpBaseUrl ? appendQuery(`${publicHttpBaseUrl}/twilio/conversation-ended`, { locationId }) : undefined,
    conversationRelayUrl: publicWsBaseUrl ? `${publicWsBaseUrl}/twilio/conversation-relay` : undefined,
    locationId,
    publicHttpBaseUrl,
    publicWsBaseUrl,
    ready: Boolean(publicHttpBaseUrl && publicWsBaseUrl),
    recordingStatusCallbackUrl: buildTwilioRecordingStatusCallbackUrl(env, { externalCallSid: "", locationId }),
    twilioSignatureRequired: env.REQUIRE_TWILIO_SIGNATURE,
    voiceWebhookUrl,
  };
}

function appendQuery(url: string, params: Record<string, string | undefined>) {
  const nextUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value) nextUrl.searchParams.set(key, value);
  }
  return nextUrl.toString();
}
