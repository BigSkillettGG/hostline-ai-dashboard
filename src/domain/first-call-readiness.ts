export type FirstCallReadinessStatus = "manual" | "missing" | "ready";

export interface FirstCallVoiceHealth {
  elevenLabsConfigured?: boolean;
  ok?: boolean;
  onboardedContextConfigured?: boolean;
  openaiConfigured?: boolean;
  productionReady?: boolean;
  readinessChecks?: Array<{
    label: string;
    ready: boolean;
    required: boolean;
  }>;
  supabaseConfigured?: boolean;
  twilioProvisioningConfigured?: boolean;
  twilioSignatureRequired?: boolean;
}

export interface FirstCallLiveConfig {
  conversationRelayUrl?: string;
  ready?: boolean;
  voiceWebhookUrl?: string;
}

export interface FirstCallReadinessInput {
  health?: FirstCallVoiceHealth;
  liveCallConfig?: FirstCallLiveConfig;
  locationId?: string;
  twimlPreview?: string;
  voiceConfigured: boolean;
}

export interface FirstCallReadinessStep {
  detail: string;
  id: string;
  label: string;
  status: FirstCallReadinessStatus;
}

export interface FirstCallReadiness {
  autoReady: boolean;
  manualSteps: FirstCallReadinessStep[];
  missingCount: number;
  nextAction: string;
  readyCount: number;
  steps: FirstCallReadinessStep[];
  totalCount: number;
}

export function buildFirstCallReadiness(input: FirstCallReadinessInput): FirstCallReadiness {
  const missingRequiredChecks = input.health?.readinessChecks?.filter((check) => check.required && !check.ready) ?? [];
  const hasLocationId = Boolean(input.locationId?.trim());
  const hasWebhookTargets = Boolean(input.liveCallConfig?.voiceWebhookUrl && input.liveCallConfig.conversationRelayUrl);
  const rendersConversationRelay = Boolean(input.twimlPreview?.includes("<ConversationRelay"));

  const steps: FirstCallReadinessStep[] = [
    step("dashboard_connection", "Dashboard connected", "Voice service URL is present in the dashboard environment.", input.voiceConfigured),
    step("location_id", "Location selected", "A Supabase location ID is selected for this test call.", hasLocationId),
    step("voice_service_online", "Voice service online", "The deployed voice service responds to health checks.", Boolean(input.health?.ok)),
    step(
      "provider_secrets",
      "Provider secrets loaded",
      "OpenAI, ElevenLabs, Twilio, and Supabase are configured on the voice backend.",
      Boolean(
        input.health?.openaiConfigured &&
          input.health.elevenLabsConfigured &&
          input.health.supabaseConfigured &&
          input.health.twilioProvisioningConfigured,
      ),
    ),
    step(
      "production_readiness",
      "Required service checks",
      missingRequiredChecks.length
        ? `Missing: ${missingRequiredChecks.map((check) => check.label).join(", ")}.`
        : "Deployment URLs, CORS, auth, provider keys, and Twilio signature checks are ready.",
      Boolean(input.health?.productionReady),
    ),
    step("restaurant_context", "Restaurant context", "Vera can load this restaurant's profile, menu, FAQs, and policies.", Boolean(input.health?.onboardedContextConfigured)),
    step("webhook_targets", "Webhook targets", "Twilio voice webhook and ConversationRelay websocket URLs are generated.", hasWebhookTargets),
    step("twiml_preview", "TwiML preview", "The Twilio response includes ConversationRelay for the selected location.", rendersConversationRelay),
    step("twilio_signatures", "Twilio signatures", "Incoming Twilio requests require signature validation.", Boolean(input.health?.twilioSignatureRequired)),
  ];

  const manualSteps: FirstCallReadinessStep[] = [
    {
      detail: input.liveCallConfig?.voiceWebhookUrl
        ? `Set the Twilio number's Voice webhook to ${input.liveCallConfig.voiceWebhookUrl}.`
        : "Deploy the voice service first so the exact Twilio Voice webhook URL can be generated.",
      id: "twilio_number_webhook",
      label: "Twilio number webhook",
      status: "manual",
    },
    {
      detail: "Call the Twilio number and test hours, parking, pickup order, reservation, allergy, and bad-connection prompts.",
      id: "first_call_script",
      label: "First test call",
      status: "manual",
    },
  ];

  const readyCount = steps.filter((item) => item.status === "ready").length;
  const missingCount = steps.length - readyCount;

  return {
    autoReady: missingCount === 0,
    manualSteps,
    missingCount,
    nextAction: buildNextAction(steps, manualSteps),
    readyCount,
    steps,
    totalCount: steps.length,
  };
}

function step(id: string, label: string, detail: string, ready: boolean): FirstCallReadinessStep {
  return {
    detail,
    id,
    label,
    status: ready ? "ready" : "missing",
  };
}

function buildNextAction(steps: FirstCallReadinessStep[], manualSteps: FirstCallReadinessStep[]) {
  const missing = steps.find((item) => item.status === "missing");
  if (missing) return missing.detail;
  return manualSteps[0]?.detail ?? "Ready for the first test call.";
}
