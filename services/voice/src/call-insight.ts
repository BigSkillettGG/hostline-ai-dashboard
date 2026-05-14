import { buildInteractionInsight } from "../../../src/domain/interaction-status";
import type {
  InteractionUrgency,
  InteractionValueTier,
  InteractionWorkflowStatus,
  OwnerReportBucket,
} from "../../../src/domain/interaction-status";

export interface CallInsightInput {
  channel?: "phone" | "web_chat";
  confidence?: number;
  intent?: string;
  orderId?: string;
  outcome?: string;
  reservationId?: string;
  status?: string;
  summary?: string;
}

export interface PersistedCallInsightPatch {
  follow_up_needed: boolean;
  knowledge_gap: boolean;
  owner_report_bucket: OwnerReportBucket;
  recommended_action: string;
  tags: string[];
  urgency: InteractionUrgency;
  value_tier: InteractionValueTier;
  workflow_status: InteractionWorkflowStatus;
}

export function buildPersistedCallInsightPatch(input: CallInsightInput): PersistedCallInsightPatch {
  const insight = buildInteractionInsight({
    call: {
      channel: input.channel ?? "phone",
      confidence: input.confidence ?? 0,
      escalation: undefined,
      intent: normalizeCallIntent(input.intent),
      orderId: input.orderId,
      outcome: normalizeCallOutcome(input.outcome),
      reservationId: input.reservationId,
      status: normalizeCallStatus(input.status),
      summary: input.summary ?? "",
      transcript: [],
    },
  });

  return {
    follow_up_needed: insight.followUpNeeded,
    knowledge_gap: insight.knowledgeGap,
    owner_report_bucket: insight.ownerReportBucket,
    recommended_action: insight.recommendedAction,
    tags: insight.tags,
    urgency: insight.urgency,
    value_tier: insight.valueTier,
    workflow_status: insight.workflowStatus,
  };
}

function normalizeCallIntent(value?: string) {
  if (
    value === "order" ||
    value === "reservation" ||
    value === "faq" ||
    value === "hours" ||
    value === "complaint" ||
    value === "sales" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function normalizeCallStatus(value?: string) {
  if (value === "new" || value === "reviewed" || value === "needs_review" || value === "resolved") {
    return value;
  }
  return "new";
}

function normalizeCallOutcome(value?: string) {
  if (
    value === "resolved" ||
    value === "order_placed" ||
    value === "reservation_booked" ||
    value === "escalated" ||
    value === "manager_alerted" ||
    value === "message_taken" ||
    value === "voicemail" ||
    value === "missed" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}
