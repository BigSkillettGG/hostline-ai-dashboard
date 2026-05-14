import type { Call, CallFeedback } from "@/data/mock";

export type PilotReadinessStatus = "ready" | "missing" | "recommended";

export interface PilotReadinessStep {
  action?: string;
  detail: string;
  id: string;
  label: string;
  required: boolean;
  status: PilotReadinessStatus;
}

export interface PilotReadinessHealth {
  ok?: boolean;
  openAIRealtimeSipConfigured?: boolean;
  openAIVoiceConfigured?: boolean;
  openaiConfigured?: boolean;
  productionReady?: boolean;
  sharedSmsRoutingConfigured?: boolean;
  supabaseConfigured?: boolean;
}

export interface PilotReadinessRealtimeConfig {
  ready?: boolean;
  sipUri?: string;
  webhookUrl?: string;
}

export interface PilotReadinessRealtimePreflight {
  ready?: boolean;
}

export interface PilotReadinessEmail {
  ready?: boolean;
}

export interface PilotReadinessPhoneNumber {
  forwardingStatus?: string;
  phoneNumber?: string;
  releasedAt?: string;
  status?: string;
}

export interface PilotReadinessInput {
  calls?: Call[];
  emailReadiness?: PilotReadinessEmail;
  feedback?: CallFeedback[];
  health?: PilotReadinessHealth;
  locationId?: string;
  phoneNumbers?: PilotReadinessPhoneNumber[];
  realtimeConfig?: PilotReadinessRealtimeConfig;
  realtimePreflight?: PilotReadinessRealtimePreflight;
  supabaseConfigured: boolean;
  voiceConfigured: boolean;
}

export interface PilotReadiness {
  latestCall?: Call;
  nextAction: string;
  ready: boolean;
  recommendedCount: number;
  requiredReadyCount: number;
  requiredTotal: number;
  steps: PilotReadinessStep[];
}

const recentWindowMs = 24 * 60 * 60 * 1000;

export function buildPilotReadiness(input: PilotReadinessInput): PilotReadiness {
  const latestCall = getLatestCall(input.calls ?? []);
  const recentCall = latestCall && isRecentCall(latestCall);
  const activeNumber = getActivePhoneNumber(input.phoneNumbers ?? []);
  const feedback = input.feedback ?? [];

  const steps: PilotReadinessStep[] = [
    requiredStep(
      "voice_service",
      "Voice backend online",
      input.voiceConfigured && Boolean(input.health?.ok && input.health?.productionReady),
      input.health?.productionReady
        ? "Render is online and required production checks are passing."
        : "The Render voice service must pass health and production readiness checks.",
      "Open Render, confirm the latest deploy succeeded, then click Check service.",
    ),
    requiredStep(
      "openai_realtime",
      "OpenAI Realtime SIP ready",
      Boolean(input.health?.openAIRealtimeSipConfigured || input.realtimeConfig?.ready || input.realtimePreflight?.ready),
      input.realtimeConfig?.sipUri
        ? `OpenAI SIP URI is available: ${input.realtimeConfig.sipUri}.`
        : "OpenAI Realtime should be the active phone path for pilot calls.",
      "Confirm the Twilio SIP trunk points at the OpenAI project SIP URI and the OpenAI webhook points at SignalHost.",
    ),
    requiredStep(
      "supabase_logging",
      "Supabase call logging ready",
      input.supabaseConfigured && Boolean(input.health?.supabaseConfigured) && Boolean(input.locationId?.trim()),
      "The dashboard and voice service both need the same live location ID so calls, transcripts, and insights land in one place.",
      "Set VITE_SUPABASE_* in Lovable, SUPABASE_* in Render, and select the live test location ID.",
    ),
    requiredStep(
      "active_number",
      "SignalHost number active",
      Boolean(activeNumber),
      activeNumber?.phoneNumber
        ? `${activeNumber.phoneNumber} is saved for this location.`
        : "A live Twilio number should be saved for this location.",
      "Provision or attach a Twilio number before routing real pilot traffic.",
    ),
    requiredStep(
      "first_live_call",
      "Recent live call logged",
      Boolean(recentCall),
      recentCall
        ? `Latest call was saved ${formatRelativeAge(latestCall.time)}.`
        : "Make a fresh test call and refresh this page; the call should appear in Supabase within a few seconds.",
      "Call the SignalHost number directly and ask one normal question plus one follow-up.",
    ),
    requiredStep(
      "transcript_saved",
      "Transcript saved",
      Boolean(latestCall?.transcript?.some((turn) => turn.text.trim())),
      latestCall?.transcript?.length
        ? `${latestCall.transcript.length} transcript turn${latestCall.transcript.length === 1 ? "" : "s"} saved on the latest call.`
        : "The latest call needs caller and SignalHost turns saved for review.",
      "Open Super Calls after the test call and confirm the transcript is visible.",
    ),
    requiredStep(
      "reporting_signal",
      "Reporting signal created",
      Boolean(latestCall?.interactionInsight),
      latestCall?.interactionInsight
        ? `${latestCall.interactionInsight.ownerReportBucket.replace(/_/g, " ")} - ${latestCall.interactionInsight.workflowStatus.replace(/_/g, " ")}.`
        : "The latest call needs an interaction insight so reports know if it was handled, high-value, risky, or a knowledge gap.",
      "If this stays missing, rerun the call insight migration and redeploy the dashboard.",
    ),
    recommendedStep(
      "feedback_loop",
      "Feedback loop tested",
      feedback.length > 0,
      feedback.length
        ? `${feedback.length} feedback note${feedback.length === 1 ? "" : "s"} saved for the latest call.`
        : "Save one QA note on the latest call and confirm the call insight updates.",
      "Open Super Calls or Call QA, add one feedback note, then refresh Telephony.",
    ),
    recommendedStep(
      "forwarding_verified",
      "Forwarding verified",
      activeNumber?.forwardingStatus === "verified",
      activeNumber?.forwardingStatus
        ? `Forwarding status is ${activeNumber.forwardingStatus.replace(/_/g, " ")}.`
        : "Direct, no-answer, and busy-line forwarding should be tested before a restaurant forwards real traffic.",
      "Run the direct-call test first, then no-answer and busy-line forwarding tests.",
    ),
    recommendedStep(
      "recording_available",
      "Recording attached",
      Boolean(latestCall?.recordingUrl),
      latestCall?.recordingUrl
        ? "The latest call has a recording link for owner review."
        : "Recordings are not attached to the latest call yet; transcripts are still usable for pilot tuning.",
      "Keep this as a pilot follow-up if OpenAI SIP recording is not enabled yet.",
    ),
    recommendedStep(
      "owner_delivery",
      "Owner delivery channels",
      Boolean(input.emailReadiness?.ready || input.health?.sharedSmsRoutingConfigured),
      input.emailReadiness?.ready
        ? "Owner email delivery is ready for reports and follow-ups."
        : input.health?.sharedSmsRoutingConfigured
          ? "Shared texting is ready for owner/customer follow-up."
          : "Email or SMS should be enabled before relying on automated follow-up.",
      "Finish Resend email delivery first; SMS can stay placeholder until carrier registration is complete.",
    ),
  ];

  const required = steps.filter((step) => step.required);
  const requiredReadyCount = required.filter((step) => step.status === "ready").length;
  const recommendedCount = steps.filter((step) => !step.required && step.status !== "ready").length;
  const next = steps.find((step) => step.required && step.status !== "ready") ?? steps.find((step) => step.status !== "ready");

  return {
    latestCall,
    nextAction: next?.action ?? next?.detail ?? "Ready to run the pilot test loop.",
    ready: requiredReadyCount === required.length,
    recommendedCount,
    requiredReadyCount,
    requiredTotal: required.length,
    steps,
  };
}

function requiredStep(id: string, label: string, ready: boolean, detail: string, action: string): PilotReadinessStep {
  return {
    action,
    detail,
    id,
    label,
    required: true,
    status: ready ? "ready" : "missing",
  };
}

function recommendedStep(id: string, label: string, ready: boolean, detail: string, action: string): PilotReadinessStep {
  return {
    action,
    detail,
    id,
    label,
    required: false,
    status: ready ? "ready" : "recommended",
  };
}

function getLatestCall(calls: Call[]) {
  return [...calls].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
}

function isRecentCall(call: Call) {
  const timestamp = new Date(call.time).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= recentWindowMs;
}

function getActivePhoneNumber(records: PilotReadinessPhoneNumber[]) {
  return records.find((record) => record.status !== "released" && !record.releasedAt);
}

function formatRelativeAge(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}
