import type { AuthMode } from "@/lib/auth";
import type { VoiceServiceHealth } from "@/lib/voice-service";

export type ProductReadinessStatus = "ready" | "partial" | "needs_setup" | "demo";
export type ProductReadinessArea =
  | "workspace"
  | "voice"
  | "phone_number"
  | "call_logging"
  | "owner_learning"
  | "owner_commands"
  | "website_chat"
  | "reports"
  | "billing"
  | "test_suite";

export interface ProductReadinessItem {
  actionLabel: string;
  actionTo: string;
  detail: string;
  id: ProductReadinessArea;
  label: string;
  status: ProductReadinessStatus;
  statusLabel: string;
  testPrompt?: string;
}

export interface ProductTestReadiness {
  headline: string;
  items: ProductReadinessItem[];
  nextItem: ProductReadinessItem;
  overallStatus: "ready_to_test" | "setup_first" | "demo_mode";
  readyCount: number;
  summary: string;
  testableCount: number;
  totalCount: number;
}

export interface ProductTestReadinessInput {
  assignedPhoneNumber?: string | null;
  assignedPhoneNumberIsDemo?: boolean;
  authMode?: AuthMode;
  authReady: boolean;
  businessName?: string;
  hasWebsiteUrl?: boolean;
  liveEnabled: boolean;
  locationId?: string | null;
  onboardingProgressPercent?: number;
  openTaskCount?: number;
  recentCallCount?: number;
  selectedPlanName?: string;
  supabaseConfigured: boolean;
  voiceHealth?: VoiceServiceHealth | null;
  voiceHealthError?: boolean;
  voiceServiceConfigured: boolean;
}

const demoWorkspaceItem: ProductReadinessItem = {
  actionLabel: "Open onboarding",
  actionTo: "/app/onboarding",
  detail: "You can inspect the product experience, but real call logs need Supabase auth and a live location.",
  id: "workspace",
  label: "Workspace and live data",
  status: "demo",
  statusLabel: "Demo",
  testPrompt: "Sign in with the live platform admin account before judging real transcripts.",
};

export function buildProductTestReadiness(input: ProductTestReadinessInput): ProductTestReadiness {
  const businessName = input.businessName?.trim() || "this business";
  const voiceMissing = getVoiceMissingLabels(input.voiceHealth);
  const hasRealPhone = Boolean(input.assignedPhoneNumber?.trim()) && !input.assignedPhoneNumberIsDemo;
  const onboardingPercent = input.onboardingProgressPercent ?? 0;

  const items: ProductReadinessItem[] = [
    input.authReady && input.supabaseConfigured && input.liveEnabled
      ? item({
          detail: `Live Supabase data is connected for ${businessName}.`,
          id: "workspace",
          label: "Workspace and live data",
          status: "ready",
          statusLabel: "Live",
          testPrompt: "Refresh the dashboard after each test call and confirm the live counts change.",
        })
      : {
          ...demoWorkspaceItem,
          detail: input.authMode === "demo"
            ? "Demo auth is active. Use the live Supabase login when you want real calls, tasks, and transcripts."
            : "Supabase auth or the active location id is missing, so live test calls cannot appear here yet.",
        },
    buildVoiceItem(input, voiceMissing),
    hasRealPhone
      ? item({
          actionLabel: "Open launch center",
          actionTo: "/app/onboarding",
          detail: `${input.assignedPhoneNumber} is the current SignalHost number for testing.`,
          id: "phone_number",
          label: "Phone number and forwarding",
          status: "ready",
          statusLabel: "Assigned",
          testPrompt: "Call the SignalHost number directly, then test forwarding from the business line.",
        })
      : item({
          actionLabel: "Provision number",
          actionTo: "/app/onboarding",
          detail: input.locationId
            ? "Provision or attach a real Twilio number before the first live owner demo."
            : "Create the live location first, then provision or attach the SignalHost number.",
          id: "phone_number",
          label: "Phone number and forwarding",
          status: input.locationId ? "partial" : "needs_setup",
          statusLabel: input.locationId ? "Needs number" : "Blocked",
          testPrompt: "Use the launch center to confirm the number, forwarding mode, and test-call instructions.",
        }),
    buildCallLoggingItem(input),
    input.liveEnabled
      ? item({
          actionLabel: "Open action center",
          actionTo: "/app/tasks",
          detail: input.openTaskCount
            ? `${input.openTaskCount} open owner follow-up${input.openTaskCount === 1 ? "" : "s"} are waiting for review.`
            : "Ready to test. Ask a low-confidence question and confirm it creates a task or knowledge suggestion.",
          id: "owner_learning",
          label: "Learning loop",
          status: input.openTaskCount ? "ready" : "partial",
          statusLabel: input.openTaskCount ? "Has tasks" : "Ready to test",
          testPrompt: "Ask a question the business has not taught yet, then answer it in Action Center.",
        })
      : item({
          actionLabel: "Open action center",
          actionTo: "/app/tasks",
          detail: "The workflow exists, but live task creation needs Supabase and a location id.",
          id: "owner_learning",
          label: "Learning loop",
          status: "demo",
          statusLabel: "Demo",
        }),
    input.liveEnabled
      ? item({
          actionLabel: "Ask SignalHost",
          actionTo: "/app/assistant",
          detail: "Owner commands can be tested from the dashboard assistant and routed into live updates or reports.",
          id: "owner_commands",
          label: "Owner commands",
          status: "ready",
          statusLabel: "Ready",
          testPrompt: "Type: We're closed tomorrow. Then confirm the update appears for owner review or live use.",
        })
      : item({
          actionLabel: "Ask SignalHost",
          actionTo: "/app/assistant",
          detail: "Owner command UX is available in demo mode; live updates need Supabase.",
          id: "owner_commands",
          label: "Owner commands",
          status: "demo",
          statusLabel: "Demo",
        }),
    input.voiceServiceConfigured && input.liveEnabled
      ? item({
          actionLabel: "Open website chat",
          actionTo: "/app/website-chat",
          detail: input.hasWebsiteUrl
            ? "Website chat can use the same business context as the phone agent."
            : "Website chat is testable; add the website URL and snippet during launch setup before customer rollout.",
          id: "website_chat",
          label: "Website chat",
          status: input.hasWebsiteUrl ? "ready" : "partial",
          statusLabel: input.hasWebsiteUrl ? "Ready" : "Needs site URL",
          testPrompt: "Ask the same question by chat and phone and compare the answer quality.",
        })
      : item({
          actionLabel: "Open website chat",
          actionTo: "/app/website-chat",
          detail: "Chat needs the live voice service and Supabase location to run against real business context.",
          id: "website_chat",
          label: "Website chat",
          status: input.voiceServiceConfigured ? "demo" : "needs_setup",
          statusLabel: input.voiceServiceConfigured ? "Demo" : "Needs service",
        }),
    buildReportsItem(input),
    buildBillingItem(input),
  ];

  const readyCount = items.filter((readinessItem) => readinessItem.status === "ready").length;
  const testableCount = items.filter((readinessItem) =>
    readinessItem.status === "ready" || readinessItem.status === "partial",
  ).length;
  const requiredBlockers = items.filter((readinessItem) =>
    readinessItem.status === "needs_setup" &&
    ["workspace", "voice", "phone_number"].includes(readinessItem.id),
  );
  const overallStatus = !input.liveEnabled || input.authMode === "demo"
    ? "demo_mode"
    : requiredBlockers.length
      ? "setup_first"
      : "ready_to_test";
  const nextItem = items.find((readinessItem) => readinessItem.status !== "ready") ??
    item({
      actionLabel: "Open test suite",
      actionTo: "/app/test-suite",
      detail: "Core readiness is green. Run the critical phone and chat scenarios before a customer demo.",
      id: "test_suite",
      label: "Full product test suite",
      status: "ready",
      statusLabel: "Run now",
      testPrompt: "Start with speakerphone, multi-turn close-out, allergy handoff, texting links, and owner-command tests.",
    });

  return {
    headline: buildHeadline(overallStatus, readyCount, items.length),
    items,
    nextItem,
    overallStatus,
    readyCount,
    summary: buildSummary({
      onboardingPercent,
      overallStatus,
      readyCount,
      testableCount,
      totalCount: items.length,
    }),
    testableCount,
    totalCount: items.length,
  };
}

function buildVoiceItem(input: ProductTestReadinessInput, missing: string[]): ProductReadinessItem {
  if (!input.voiceServiceConfigured) {
    return item({
      actionLabel: "Open voice agent",
      actionTo: "/app/voice-agent",
      detail: "VITE_VOICE_SERVICE_URL is missing, so the dashboard cannot reach the deployed voice service.",
      id: "voice",
      label: "Phone agent service",
      status: "needs_setup",
      statusLabel: "No service URL",
    });
  }

  if (input.voiceHealthError) {
    return item({
      actionLabel: "Open voice agent",
      actionTo: "/app/voice-agent",
      detail: "The dashboard has a voice service URL, but the health check failed.",
      id: "voice",
      label: "Phone agent service",
      status: "partial",
      statusLabel: "Check service",
      testPrompt: "Open the voice agent page and run the service check before another call.",
    });
  }

  if (!input.voiceHealth) {
    return item({
      actionLabel: "Open voice agent",
      actionTo: "/app/voice-agent",
      detail: "Checking the deployed service for OpenAI voice, Supabase logging, and Twilio readiness.",
      id: "voice",
      label: "Phone agent service",
      status: "partial",
      statusLabel: "Checking",
    });
  }

  if (input.voiceHealth.ok && missing.length === 0) {
    return item({
      actionLabel: "Open voice agent",
      actionTo: "/app/voice-agent",
      detail: "OpenAI realtime voice, Supabase logging, and production checks are passing.",
      id: "voice",
      label: "Phone agent service",
      status: "ready",
      statusLabel: "Healthy",
      testPrompt: "Make one FAQ call, one task/escalation call, and one owner-command test.",
    });
  }

  return item({
    actionLabel: "Open voice agent",
    actionTo: "/app/voice-agent",
    detail: `Voice service is reachable, but missing: ${missing.join(", ")}.`,
    id: "voice",
    label: "Phone agent service",
    status: "partial",
    statusLabel: "Needs env",
    testPrompt: "Fix the missing env vars in Render, redeploy, then rerun the service check.",
  });
}

function buildCallLoggingItem(input: ProductTestReadinessInput): ProductReadinessItem {
  if (!input.liveEnabled) {
    return item({
      actionLabel: "Open calls",
      actionTo: "/app/calls",
      detail: "Calls and transcripts will stay demo-only until Supabase live data and a location id are active.",
      id: "call_logging",
      label: "Call logs and transcripts",
      status: "demo",
      statusLabel: "Demo",
    });
  }

  if ((input.recentCallCount ?? 0) > 0) {
    return item({
      actionLabel: "Review calls",
      actionTo: "/app/calls",
      detail: `${input.recentCallCount} recent live call${input.recentCallCount === 1 ? "" : "s"} are available for transcript review.`,
      id: "call_logging",
      label: "Call logs and transcripts",
      status: "ready",
      statusLabel: "Logging",
      testPrompt: "Open a recent call and verify transcript, summary, intent, and outcome.",
    });
  }

  return item({
    actionLabel: "Review calls",
    actionTo: "/app/calls",
    detail: "The live call log is connected, but no calls have been captured for this location yet.",
    id: "call_logging",
    label: "Call logs and transcripts",
    status: "partial",
    statusLabel: "Waiting",
    testPrompt: "Make a short phone call, refresh, and confirm it appears in Calls.",
  });
}

function buildReportsItem(input: ProductTestReadinessInput): ProductReadinessItem {
  if (!input.liveEnabled) {
    return item({
      actionLabel: "Open dashboard",
      actionTo: "/app",
      detail: "Narrative reports can be previewed with demo data; live delivery needs Supabase.",
      id: "reports",
      label: "Reports and daily brief",
      status: "demo",
      statusLabel: "Demo",
    });
  }

  if (input.voiceHealth?.ownerReportsConfigured) {
    return item({
      actionLabel: "Send report",
      actionTo: "/app",
      detail: input.voiceHealth.ownerReportDeliveryConfigured
        ? "Owner reports and delivery channels are configured."
        : "Owner reports can be generated; email delivery remains a later setup item.",
      id: "reports",
      label: "Reports and daily brief",
      status: input.voiceHealth.ownerReportDeliveryConfigured ? "ready" : "partial",
      statusLabel: input.voiceHealth.ownerReportDeliveryConfigured ? "Delivery ready" : "Generate ready",
      testPrompt: "Click Save report, then Send report if a delivery channel is configured.",
    });
  }

  return item({
    actionLabel: "Send report",
    actionTo: "/app",
    detail: "The dashboard brief is available, but deployed owner report generation is not confirmed yet.",
    id: "reports",
    label: "Reports and daily brief",
    status: "partial",
    statusLabel: "Needs check",
  });
}

function buildBillingItem(input: ProductTestReadinessInput): ProductReadinessItem {
  const configured = Boolean(input.voiceHealth?.stripeBillingConfigured);
  const provisioningReady = Boolean(input.voiceHealth?.tenantProvisioningConfigured && input.voiceHealth?.twilioProvisioningConfigured);
  const planLabel = input.selectedPlanName?.trim() || "selected plan";

  if (configured && provisioningReady) {
    return item({
      actionLabel: "Open billing",
      actionTo: "/app/billing",
      detail: `Stripe billing, tenant provisioning, and Twilio number lifecycle are ready for the ${planLabel}.`,
      id: "billing",
      label: "Billing and lifecycle",
      status: "ready",
      statusLabel: "Ready",
      testPrompt: "Run a checkout test and confirm plan, trial, usage, and number-release status.",
    });
  }

  if (input.liveEnabled) {
    return item({
      actionLabel: "Open billing",
      actionTo: "/app/billing",
      detail: configured
        ? "Stripe is configured; finish tenant provisioning and Twilio number lifecycle checks."
        : "Billing can be reviewed in the UI, but Stripe checkout is not confirmed on the voice service.",
      id: "billing",
      label: "Billing and lifecycle",
      status: "partial",
      statusLabel: configured ? "Provisioning check" : "Needs Stripe",
      testPrompt: "Use the billing page only for UX review until Stripe env vars are live.",
    });
  }

  return item({
    actionLabel: "Open billing",
    actionTo: "/app/billing",
    detail: "Billing UX is available in demo mode; live subscriptions need Supabase and Stripe.",
    id: "billing",
    label: "Billing and lifecycle",
    status: "demo",
    statusLabel: "Demo",
  });
}

function item(input: Omit<ProductReadinessItem, "actionLabel" | "actionTo"> & Partial<Pick<ProductReadinessItem, "actionLabel" | "actionTo">>): ProductReadinessItem {
  return {
    actionLabel: "Open",
    actionTo: "/app",
    ...input,
  };
}

function getVoiceMissingLabels(health?: VoiceServiceHealth | null) {
  if (!health) return [];

  const missing = [
    !health.openaiConfigured ? "OpenAI" : "",
    !health.openAIVoiceConfigured ? "OpenAI voice" : "",
    !health.supabaseConfigured ? "Supabase service role" : "",
    !health.twilioSignatureRequired ? "Twilio signature enforcement" : "",
  ].filter(Boolean);
  const failedRequiredChecks = health.readinessChecks
    ?.filter((check) => check.required && !check.ready)
    .map((check) => check.label) ?? [];

  return Array.from(new Set([...missing, ...failedRequiredChecks]));
}

function buildHeadline(overallStatus: ProductTestReadiness["overallStatus"], readyCount: number, totalCount: number) {
  if (overallStatus === "ready_to_test") return "Ready for a real product test";
  if (overallStatus === "demo_mode") return "Demo mode: useful for UX, not live-call proof";
  return `${readyCount} of ${totalCount} product areas are ready`;
}

function buildSummary(input: {
  onboardingPercent: number;
  overallStatus: ProductTestReadiness["overallStatus"];
  readyCount: number;
  testableCount: number;
  totalCount: number;
}) {
  if (input.overallStatus === "ready_to_test") {
    return `${input.testableCount} of ${input.totalCount} areas are testable now. Start with phone, then verify logs, learning, chat, reports, and billing.`;
  }
  if (input.overallStatus === "demo_mode") {
    return `The product UI is available, and onboarding is ${input.onboardingPercent}% complete. Switch to live Supabase auth and location data before judging real calls.`;
  }
  return `${input.readyCount} of ${input.totalCount} areas are ready. Clear the setup blockers first, then run the full test sequence.`;
}
