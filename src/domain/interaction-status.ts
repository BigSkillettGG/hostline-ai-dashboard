import type { Call, CallFeedback } from "@/data/mock";

export type InteractionWorkflowStatus =
  | "new"
  | "resolved"
  | "needs_follow_up"
  | "needs_review"
  | "waiting_on_customer"
  | "booking_link_sent"
  | "quote_requested"
  | "escalated"
  | "spam_vendor";

export type InteractionUrgency = "low" | "normal" | "high" | "urgent";
export type InteractionValueTier = "low" | "medium" | "high" | "very_high" | "risk";
export type OwnerReportBucket =
  | "handled"
  | "knowledge_gap"
  | "low_value"
  | "open_follow_up"
  | "revenue_opportunity"
  | "risk_or_complaint";

export interface InteractionInsight {
  evidence: string[];
  followUpNeeded: boolean;
  knowledgeGap: boolean;
  ownerReportBucket: OwnerReportBucket;
  recommendedAction: string;
  tags: string[];
  urgency: InteractionUrgency;
  valueTier: InteractionValueTier;
  workflowStatus: InteractionWorkflowStatus;
}

type InsightCall = Pick<
  Call,
  | "channel"
  | "confidence"
  | "escalation"
  | "intent"
  | "orderId"
  | "outcome"
  | "reservationId"
  | "status"
  | "summary"
  | "transcript"
>;

type InsightFeedback = Pick<CallFeedback, "category" | "addedToKnowledge">;

export const interactionWorkflowLabels: Record<InteractionWorkflowStatus, string> = {
  booking_link_sent: "Link sent",
  escalated: "Escalated",
  needs_follow_up: "Needs follow-up",
  needs_review: "Needs review",
  new: "New",
  quote_requested: "Quote requested",
  resolved: "Resolved",
  spam_vendor: "Vendor/spam",
  waiting_on_customer: "Waiting on customer",
};

export const interactionUrgencyLabels: Record<InteractionUrgency, string> = {
  high: "High",
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};

export const interactionValueLabels: Record<InteractionValueTier, string> = {
  high: "High value",
  low: "Low value",
  medium: "Medium value",
  risk: "Risk",
  very_high: "Very high value",
};

export const ownerReportBucketLabels: Record<OwnerReportBucket, string> = {
  handled: "Handled",
  knowledge_gap: "Knowledge gap",
  low_value: "Low-value handled",
  open_follow_up: "Open follow-up",
  revenue_opportunity: "Revenue opportunity",
  risk_or_complaint: "Risk or complaint",
};

export function buildInteractionInsight({
  call,
  feedback = [],
}: {
  call: InsightCall;
  feedback?: InsightFeedback[];
}): InteractionInsight {
  const text = normalizedInteractionText(call);
  const evidence: string[] = [];
  const feedbackNeedsReview = feedback.some((entry) =>
    entry.category === "missing_knowledge" ||
    entry.category === "should_have_escalated" ||
    entry.category === "wrong_answer"
  );
  const pendingEscalation = Boolean(call.escalation && call.escalation.status !== "callback_made" && call.escalation.status !== "closed");
  const complaint = call.intent === "complaint" || containsAny(text, complaintTerms);
  const vendorOrSales = call.intent === "sales" || containsAny(text, vendorTerms);
  const missedOrVoicemail = call.outcome === "missed" || call.outcome === "voicemail";
  const highValueOpportunity = containsAny(text, highValueTerms);
  const quoteRequest = containsAny(text, quoteTerms);
  const bookingLinkSent = containsAny(text, bookingLinkTerms);
  const customerWaiting = containsAny(text, waitingTerms);
  const lowConfidence = call.confidence > 0 && call.confidence < 70;
  const staffOrKnowledgeUncertainty = containsAny(text, uncertaintyTerms);
  const safetyOrRisk = complaint || containsAny(text, safetyRiskTerms);
  const resolvedInteraction = isResolvedInteraction(call);
  const openRisk = safetyOrRisk && !resolvedInteraction;
  const pendingComplaintEscalation = pendingEscalation && call.escalation?.type === "complaint";
  const knowledgeGap = feedbackNeedsReview || lowConfidence || staffOrKnowledgeUncertainty || call.status === "needs_review";

  if (pendingEscalation) evidence.push("Staff callback or alert is still open.");
  if (missedOrVoicemail) evidence.push("Caller did not reach a completed answer.");
  if (knowledgeGap) evidence.push("Answer needs review or missing knowledge.");
  if (highValueOpportunity) evidence.push("High-value opportunity keywords were detected.");
  if (safetyOrRisk) evidence.push("Risk, complaint, or safety-sensitive language was detected.");

  const followUpNeeded = !resolvedInteraction && (
    pendingEscalation ||
    missedOrVoicemail ||
    feedbackNeedsReview ||
    call.outcome === "escalated" ||
    call.outcome === "manager_alerted" ||
    call.outcome === "message_taken" ||
    call.outcome === "unknown" ||
    call.status === "needs_review" ||
    highValueOpportunity ||
    quoteRequest ||
    customerWaiting
  );

  const valueTier = deriveValueTier({ call, highValueOpportunity, quoteRequest, safetyOrRisk, text });
  const urgency = deriveUrgency({ followUpNeeded, knowledgeGap, missedOrVoicemail, openRisk, pendingComplaintEscalation, vendorOrSales, valueTier });
  const workflowStatus = deriveWorkflowStatus({
    bookingLinkSent,
    call,
    customerWaiting,
    followUpNeeded,
    knowledgeGap,
    missedOrVoicemail,
    pendingEscalation,
    quoteRequest,
    vendorOrSales,
  });
  const ownerReportBucket = deriveOwnerReportBucket({ followUpNeeded, knowledgeGap, safetyOrRisk, valueTier, vendorOrSales, workflowStatus });

  return {
    evidence: evidence.length ? evidence : ["No extra action signals detected."],
    followUpNeeded,
    knowledgeGap,
    ownerReportBucket,
    recommendedAction: deriveRecommendedAction({ call, knowledgeGap, missedOrVoicemail, pendingEscalation, safetyOrRisk, text, valueTier, vendorOrSales, workflowStatus }),
    tags: deriveTags({ call, followUpNeeded, knowledgeGap, urgency, valueTier, workflowStatus }),
    urgency,
    valueTier,
    workflowStatus,
  };
}

function deriveWorkflowStatus({
  bookingLinkSent,
  call,
  customerWaiting,
  followUpNeeded,
  knowledgeGap,
  missedOrVoicemail,
  pendingEscalation,
  quoteRequest,
  vendorOrSales,
}: {
  bookingLinkSent: boolean;
  call: InsightCall;
  customerWaiting: boolean;
  followUpNeeded: boolean;
  knowledgeGap: boolean;
  missedOrVoicemail: boolean;
  pendingEscalation: boolean;
  quoteRequest: boolean;
  vendorOrSales: boolean;
}): InteractionWorkflowStatus {
  if (vendorOrSales) return "spam_vendor";
  if (isResolvedInteraction(call)) return "resolved";
  if (pendingEscalation || call.outcome === "escalated" || call.outcome === "manager_alerted") return "escalated";
  if (missedOrVoicemail || call.outcome === "message_taken") return "needs_follow_up";
  if (quoteRequest) return "quote_requested";
  if (bookingLinkSent) return "booking_link_sent";
  if (customerWaiting) return "waiting_on_customer";
  if (knowledgeGap) return "needs_review";
  if (!followUpNeeded && (call.status === "resolved" || call.status === "reviewed" || call.outcome === "resolved" || call.outcome === "order_placed" || call.outcome === "reservation_booked")) {
    return "resolved";
  }
  return "new";
}

function deriveUrgency({
  followUpNeeded,
  knowledgeGap,
  missedOrVoicemail,
  openRisk,
  pendingComplaintEscalation,
  valueTier,
  vendorOrSales,
}: {
  followUpNeeded: boolean;
  knowledgeGap: boolean;
  missedOrVoicemail: boolean;
  openRisk: boolean;
  pendingComplaintEscalation: boolean;
  valueTier: InteractionValueTier;
  vendorOrSales: boolean;
}): InteractionUrgency {
  if (openRisk || pendingComplaintEscalation) return "urgent";
  if (vendorOrSales) return "low";
  if (valueTier === "very_high" || followUpNeeded || knowledgeGap || missedOrVoicemail) return "high";
  if (valueTier === "low") return "low";
  return "normal";
}

function deriveValueTier({
  call,
  highValueOpportunity,
  quoteRequest,
  safetyOrRisk,
  text,
}: {
  call: InsightCall;
  highValueOpportunity: boolean;
  quoteRequest: boolean;
  safetyOrRisk: boolean;
  text: string;
}): InteractionValueTier {
  if (safetyOrRisk) return "risk";
  if (containsAny(text, veryHighValueTerms)) return "very_high";
  if (highValueOpportunity || quoteRequest) return "high";
  if (call.intent === "order" || call.intent === "reservation" || call.orderId || call.reservationId) return "medium";
  return "low";
}

function deriveOwnerReportBucket({
  followUpNeeded,
  knowledgeGap,
  safetyOrRisk,
  valueTier,
  vendorOrSales,
  workflowStatus,
}: {
  followUpNeeded: boolean;
  knowledgeGap: boolean;
  safetyOrRisk: boolean;
  valueTier: InteractionValueTier;
  vendorOrSales: boolean;
  workflowStatus: InteractionWorkflowStatus;
}): OwnerReportBucket {
  if (safetyOrRisk) return "risk_or_complaint";
  if (vendorOrSales) return "low_value";
  if (knowledgeGap) return "knowledge_gap";
  if (followUpNeeded || workflowStatus === "needs_follow_up" || workflowStatus === "escalated") return "open_follow_up";
  if (valueTier === "high" || valueTier === "very_high" || valueTier === "medium") return "revenue_opportunity";
  return "handled";
}

function deriveRecommendedAction({
  call,
  knowledgeGap,
  missedOrVoicemail,
  pendingEscalation,
  safetyOrRisk,
  text,
  valueTier,
  vendorOrSales,
  workflowStatus,
}: {
  call: InsightCall;
  knowledgeGap: boolean;
  missedOrVoicemail: boolean;
  pendingEscalation: boolean;
  safetyOrRisk: boolean;
  text: string;
  valueTier: InteractionValueTier;
  vendorOrSales: boolean;
  workflowStatus: InteractionWorkflowStatus;
}) {
  if (pendingEscalation && call.intent === "complaint") return "Manager callback needed for this complaint.";
  if (safetyOrRisk && containsAny(text, allergyTerms)) return "Have staff confirm allergy guidance before promising anything.";
  if (safetyOrRisk) return "Review quickly and route to the right human owner.";
  if (missedOrVoicemail) return "Call or text this caller back.";
  if (workflowStatus === "quote_requested") return "Follow up with quote details or schedule a consultation.";
  if (valueTier === "very_high" || valueTier === "high") return "Follow up on this high-value request.";
  if (knowledgeGap) return "Review the answer and add missing knowledge if needed.";
  if (call.orderId) return "Confirm the order reached the right destination.";
  if (call.reservationId) return "Confirm the reservation or request status.";
  if (vendorOrSales) return "Review later or dismiss as vendor/sales.";
  return "No action needed.";
}

function deriveTags({
  call,
  followUpNeeded,
  knowledgeGap,
  urgency,
  valueTier,
  workflowStatus,
}: {
  call: InsightCall;
  followUpNeeded: boolean;
  knowledgeGap: boolean;
  urgency: InteractionUrgency;
  valueTier: InteractionValueTier;
  workflowStatus: InteractionWorkflowStatus;
}) {
  const tags = new Set<string>();
  tags.add(call.channel === "web_chat" ? "web chat" : "phone");
  tags.add(call.intent.replace(/_/g, " "));
  tags.add(interactionWorkflowLabels[workflowStatus].toLowerCase());
  if (followUpNeeded) tags.add("follow-up");
  if (knowledgeGap) tags.add("knowledge gap");
  if (urgency === "urgent") tags.add("urgent");
  if (valueTier === "high" || valueTier === "very_high") tags.add("high value");
  if (valueTier === "risk") tags.add("risk");
  if (call.orderId) tags.add("order");
  if (call.reservationId) tags.add("reservation");
  return Array.from(tags);
}

function normalizedInteractionText(call: InsightCall) {
  return [
    call.summary,
    ...(call.transcript ?? []).map((turn) => turn.text),
    call.escalation?.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isResolvedInteraction(call: InsightCall) {
  return (
    call.status === "resolved" ||
    call.escalation?.status === "callback_made" ||
    call.escalation?.status === "closed"
  );
}

function containsAny(text: string, terms: RegExp[]) {
  return terms.some((term) => term.test(text));
}

const complaintTerms = [
  /\bcomplain(?:t|ing)?\b/,
  /\bangry\b/,
  /\bupset\b/,
  /\bfrustrated\b/,
  /\bwrong\b/,
  /\bcold\b/,
  /\brefund\b/,
];

const vendorTerms = [
  /\bsales call\b/,
  /\bsales pitch\b/,
  /\bvendor\b/,
  /\bsupplier\b/,
  /\bequipment financing\b/,
  /\brobocall\b/,
  /\bspam\b/,
];

const uncertaintyTerms = [
  /\bnot sure\b/,
  /\bunsure\b/,
  /\bunknown\b/,
  /\bcannot guarantee\b/,
  /\bcan't guarantee\b/,
  /\bcheck with (?:the )?(?:staff|team|manager)\b/,
  /\bstaff confirmation\b/,
  /\bget back to you\b/,
  /\bcall you back\b/,
  /\bsomeone(?:'s| will)? get back\b/,
  /\blow confidence\b/,
];

const highValueTerms = [
  /\bcatering\b/,
  /\bprivate event\b/,
  /\bbuyout\b/,
  /\blarge party\b/,
  /\bparty of (?:1[0-9]|[2-9][0-9])\b/,
  /\bappointment\b/,
  /\bconsultation\b/,
  /\bquote\b/,
  /\bestimate\b/,
  /\bemergency service\b/,
  /\bmaintenance plan\b/,
  /\bcolor correction\b/,
  /\bbridal\b/,
  /\bwedding\b/,
];

const veryHighValueTerms = [
  /\broof replacement\b/,
  /\bsystem replacement\b/,
  /\bwhole[- ]home\b/,
  /\bgenerator\b/,
  /\bev charger\b/,
  /\bpanel upgrade\b/,
  /\bprivate event\b/,
  /\bbuyout\b/,
  /\bcatering for (?:2[0-9]|[3-9][0-9]|[1-9][0-9]{2,})\b/,
  /\bparty of (?:2[0-9]|[3-9][0-9]|[1-9][0-9]{2,})\b/,
];

const quoteTerms = [
  /\bquote\b/,
  /\bestimate\b/,
  /\bpricing for\b/,
  /\bhow much(?: would| does| is)?\b/,
  /\bcost to\b/,
];

const bookingLinkTerms = [
  /\blink sent\b/,
  /\bbooking link\b/,
  /\breservation link\b/,
  /\bordering link\b/,
  /\bsent (?:the )?link\b/,
];

const waitingTerms = [
  /\bwaiting on customer\b/,
  /\bwaiting for customer\b/,
  /\bcustomer will\b/,
  /\bwill call back\b/,
  /\basked to text\b/,
];

const safetyRiskTerms = [
  /\bsevere allerg(?:y|ies|ic)\b/,
  /\ballerg(?:y|ies|ic)\b/,
  /\banaphylaxis\b/,
  /\bactive leak\b/,
  /\bburst pipe\b/,
  /\bflood(?:ing)?\b/,
  /\bgas smell\b/,
  /\bburning smell\b/,
  /\bsparking\b/,
  /\bexposed wire\b/,
  /\bno heat\b/,
  /\bno ac\b/,
  /\bno a\/c\b/,
  /\bemergency\b/,
  /\bstorm damage\b/,
];

const allergyTerms = [
  /\ballerg(?:y|ies|ic)\b/,
  /\banaphylaxis\b/,
  /\bpeanut\b/,
  /\bgluten\b/,
  /\bdairy\b/,
  /\bshellfish\b/,
];
