import { getActiveLocationId, getSupabaseAccessToken } from "@/lib/auth";
import type { OnboardingDraft } from "@/domain/onboarding";
import type { BusinessType } from "@/domain/business-templates";
import type { SignalHostVoiceGender } from "@/domain/voice-selection";

export interface VoiceServiceHealth {
  ok: boolean;
  service: string;
  openaiConfigured: boolean;
  elevenLabsConfigured: boolean;
  menuIngestionConfigured?: boolean;
  onboardedContextConfigured?: boolean;
  staffAlertsConfigured?: boolean;
  sharedSmsRoutingConfigured?: boolean;
  supabaseConfigured: boolean;
  tenantProvisioningConfigured?: boolean;
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

export interface TenantBootstrapResult {
  businessType: BusinessType;
  createdLocation: boolean;
  createdOrganization: boolean;
  locationId: string;
  membership: {
    createdAt?: string;
    id?: string;
    organizationId: string;
    role: "owner";
  };
  onboarding: {
    completedRequired: number;
    progressPercent: number;
    status: string;
    totalRequired: number;
  };
  organizationId: string;
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

export type AgentTestChannel = "phone" | "website_chat";

export interface AgentTestTurn {
  at?: string;
  role: "assistant" | "user";
  text: string;
}

export type AgentTestAction =
  | {
      link: {
        description?: string;
        kind: string;
        label: string;
        url: string;
      };
      type: "business_link";
    }
  | {
      kind: string;
      type: "guest_confirmation";
    }
  | {
      requestType: string;
      type: "customer_request";
      urgency?: string;
    }
  | {
      kind: string;
      type: "staff_callback";
      urgency?: string;
    }
  | {
      type: "reservation_request";
    }
  | {
      itemCount: number;
      type: "order_capture";
    }
  | {
      type: "pickup_order";
    }
  | {
      reason?: string;
      type: "finish_call";
    };

export interface AgentTestReplyResult {
  actions: AgentTestAction[];
  businessName: string;
  channel: AgentTestChannel;
  locationId?: string;
  ok: boolean;
  reply: string;
  transcript: AgentTestTurn[];
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

export async function fetchLiveCallConfig(locationId = getActiveLocationId()) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const params = new URLSearchParams();
  if (locationId?.trim()) params.set("locationId", locationId.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${voiceServiceBaseUrl}/twilio/live-call-config${query}`, {
    headers: buildVoiceAdminHeaders(),
  });

  if (!response.ok && response.status !== 503) {
    const body = await response.text();
    throw new Error(body || `Live call config failed with ${response.status}.`);
  }

  return (await response.json()) as LiveCallConfig;
}

export async function fetchTwiMLPreview(locationId = getActiveLocationId()) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const params = new URLSearchParams();
  if (locationId?.trim()) params.set("locationId", locationId.trim());
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${voiceServiceBaseUrl}/twilio/twiml-preview${query}`, {
    headers: buildVoiceAdminHeaders(),
  });

  const text = await response.text();
  if (!response.ok && response.status !== 503) {
    throw new Error(text || `TwiML preview failed with ${response.status}.`);
  }

  return text;
}

export async function fetchVoicePreviewAudio(text: string, voiceGender?: SignalHostVoiceGender) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/voice/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildVoiceAdminHeaders(),
    },
    body: JSON.stringify({ text, voiceGender }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Voice preview failed with ${response.status}.`);
  }

  return response.blob();
}

export async function bootstrapTenantProvisioning(input: {
  businessName?: string;
  businessType: BusinessType;
  draft: OnboardingDraft;
  ownerName?: string;
}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/tenant/bootstrap`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      ...buildVoiceAdminHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Tenant provisioning failed with ${response.status}.`);
  }

  return (await response.json()) as TenantBootstrapResult;
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
    headers: buildVoiceAdminHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Phone number search failed with ${response.status}.`);
  }

  return (await response.json()) as { numbers: AvailableVoicePhoneNumber[] };
}

export async function provisionVoicePhoneNumber(input: {
  areaCode?: string;
  contains?: string;
  country?: string;
  forwardingMode?: string;
  locationId?: string;
  phoneNumber?: string;
  restaurantMainLine?: string;
  trialDays?: number;
  trialGraceDays?: number;
}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/telephony/provision-number`, {
    body: JSON.stringify({
      ...input,
      locationId: input.locationId ?? getActiveLocationId(),
    }),
    headers: {
      "Content-Type": "application/json",
      ...buildVoiceAdminHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Phone number provisioning failed with ${response.status}.`);
  }

  return (await response.json()) as { phoneNumber: ProvisionedVoicePhoneNumber };
}

export async function releaseVoicePhoneNumber(input: {
  id?: string;
  locationId?: string;
  phoneNumber?: string;
  providerSid: string;
  releaseReason?: string;
}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/telephony/release-number`, {
    body: JSON.stringify({
      ...input,
      locationId: input.locationId ?? getActiveLocationId(),
    }),
    headers: {
      "Content-Type": "application/json",
      ...buildVoiceAdminHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Phone number release failed with ${response.status}.`);
  }

  return (await response.json()) as { phoneNumber: { providerSid: string; status: "released" } };
}

export async function runNextMenuIngestionJob(input: { jobId?: string; locationId?: string } = {}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/ingestion/run-next`, {
    body: JSON.stringify({
      ...input,
      locationId: input.locationId ?? getActiveLocationId(),
    }),
    headers: {
      "Content-Type": "application/json",
      ...buildVoiceAdminHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Menu ingestion failed with ${response.status}.`);
  }

  return (await response.json()) as RunMenuIngestionResult;
}

export async function fetchAgentTestReply(input: {
  channel?: AgentTestChannel;
  locationId?: string;
  message: string;
  scenarioId?: string;
  transcript?: AgentTestTurn[];
}) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/agent/test-reply`, {
    body: JSON.stringify({
      ...input,
      locationId: input.locationId ?? getActiveLocationId(),
    }),
    headers: {
      "Content-Type": "application/json",
      ...buildVoiceAdminHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Agent test reply failed with ${response.status}.`);
  }

  return (await response.json()) as AgentTestReplyResult;
}

function buildVoiceAdminHeaders() {
  const token = getSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
