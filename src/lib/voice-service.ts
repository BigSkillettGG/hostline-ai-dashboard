export interface VoiceServiceHealth {
  ok: boolean;
  service: string;
  openaiConfigured: boolean;
  elevenLabsConfigured: boolean;
  menuIngestionConfigured?: boolean;
  onboardedContextConfigured?: boolean;
  staffAlertsConfigured?: boolean;
  supabaseConfigured: boolean;
  twilioProvisioningConfigured?: boolean;
  twilioSignatureRequired: boolean;
  productionReady?: boolean;
  readinessChecks?: VoiceServiceReadinessCheck[];
}

export interface VoiceServiceReadinessCheck {
  detail: string;
  id: string;
  label: string;
  ready: boolean;
  required: boolean;
}

export interface AvailableVoicePhoneNumber {
  capabilities: Record<string, boolean>;
  friendlyName?: string;
  locality?: string;
  phoneNumber: string;
  region?: string;
}

export interface ProvisionedVoicePhoneNumber {
  capabilities: Record<string, boolean>;
  phoneNumber: string;
  providerSid: string;
  status: string;
  voiceWebhookUrl?: string;
}

export interface RunMenuIngestionResult {
  categoryCount?: number;
  errorMessage?: string;
  itemCount?: number;
  jobId?: string;
  processed: boolean;
  reason?: string;
  status?: "completed" | "failed";
  summary?: string;
}

export interface LiveCallConfig {
  actionUrl?: string;
  conversationRelayUrl?: string;
  locationId: string;
  publicHttpBaseUrl?: string;
  publicWsBaseUrl?: string;
  ready: boolean;
  twilioSignatureRequired: boolean;
  voiceWebhookUrl?: string;
}

export const voiceServiceBaseUrl = (import.meta.env.VITE_VOICE_SERVICE_URL ?? "").replace(/\/$/, "");
const internalApiKey = import.meta.env.VITE_HOSTLINE_INTERNAL_API_KEY ?? "";

export function isVoiceServiceConfigured() {
  return Boolean(voiceServiceBaseUrl);
}

export async function fetchVoiceServiceHealth() {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Voice service health check failed with ${response.status}.`);
  }

  return (await response.json()) as VoiceServiceHealth;
}

export async function fetchLiveCallConfig(locationId?: string) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const params = new URLSearchParams();
  if (locationId?.trim()) params.set("locationId", locationId.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${voiceServiceBaseUrl}/twilio/live-call-config${query}`, {
    headers: buildInternalHeaders(),
  });

  if (!response.ok && response.status !== 503) {
    const body = await response.text();
    throw new Error(body || `Live call config failed with ${response.status}.`);
  }

  return (await response.json()) as LiveCallConfig;
}

export async function fetchTwiMLPreview(locationId?: string) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const params = new URLSearchParams();
  if (locationId?.trim()) params.set("locationId", locationId.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${voiceServiceBaseUrl}/twilio/twiml-preview${query}`, {
    headers: buildInternalHeaders(),
  });

  const text = await response.text();
  if (!response.ok && response.status !== 503) {
    throw new Error(text || `TwiML preview failed with ${response.status}.`);
  }

  return text;
}

export async function fetchVoicePreviewAudio(text: string) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/voice/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Voice preview failed with ${response.status}.`);
  }

  return response.blob();
}

export async function searchAvailableVoicePhoneNumbers(input: {
  areaCode?: string;
  contains?: string;
  country?: string;
  limit?: number;
}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const params = new URLSearchParams();
  if (input.areaCode?.trim()) params.set("areaCode", input.areaCode.trim());
  if (input.contains?.trim()) params.set("contains", input.contains.trim());
  if (input.country?.trim()) params.set("country", input.country.trim());
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(`${voiceServiceBaseUrl}/telephony/available-numbers?${params.toString()}`, {
    headers: buildInternalHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Phone number search failed with ${response.status}.`);
  }

  return (await response.json()) as { numbers: AvailableVoicePhoneNumber[] };
}

export async function provisionVoicePhoneNumber(input: {
  forwardingMode?: string;
  locationId?: string;
  phoneNumber: string;
  restaurantMainLine?: string;
}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/telephony/provision-number`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      ...buildInternalHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Phone number provisioning failed with ${response.status}.`);
  }

  return (await response.json()) as { phoneNumber: ProvisionedVoicePhoneNumber };
}

export async function runNextMenuIngestionJob(input: { jobId?: string; locationId?: string } = {}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/ingestion/run-next`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      ...buildInternalHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Menu ingestion failed with ${response.status}.`);
  }

  return (await response.json()) as RunMenuIngestionResult;
}

function buildInternalHeaders() {
  return internalApiKey ? { "x-hostline-api-key": internalApiKey } : {};
}
