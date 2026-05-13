export type KnowledgeSuggestionPriority = "low" | "normal" | "high" | "urgent";
export type KnowledgeSuggestionSource = "call_feedback" | "owner_assistant" | "staff_task" | "manual";
export type KnowledgeSuggestionStatus = "pending" | "applied" | "rejected";

export interface KnowledgeSuggestion {
  appliedKnowledgeSectionId?: string;
  body: string;
  callId?: string;
  createdAt: string;
  feedbackId?: string;
  id: string;
  locationId: string;
  priority: KnowledgeSuggestionPriority;
  reviewedAt?: string;
  source: KnowledgeSuggestionSource;
  sourceQuestion?: string;
  status: KnowledgeSuggestionStatus;
  suggestedAnswer?: string;
  title: string;
}

const priorities: KnowledgeSuggestionPriority[] = ["low", "normal", "high", "urgent"];
const sources: KnowledgeSuggestionSource[] = ["call_feedback", "owner_assistant", "staff_task", "manual"];
const statuses: KnowledgeSuggestionStatus[] = ["pending", "applied", "rejected"];

export const knowledgeSuggestionPriorityLabels: Record<KnowledgeSuggestionPriority, string> = {
  high: "High",
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};

export const knowledgeSuggestionSourceLabels: Record<KnowledgeSuggestionSource, string> = {
  call_feedback: "Call QA",
  manual: "Manual",
  owner_assistant: "Owner assistant",
  staff_task: "Staff task",
};

export const knowledgeSuggestionStatusLabels: Record<KnowledgeSuggestionStatus, string> = {
  applied: "Applied",
  pending: "Pending",
  rejected: "Rejected",
};

export function normalizeKnowledgeSuggestionPriority(value: unknown): KnowledgeSuggestionPriority {
  return normalizeEnum(value, priorities, "normal");
}

export function normalizeKnowledgeSuggestionSource(value: unknown): KnowledgeSuggestionSource {
  return normalizeEnum(value, sources, "manual");
}

export function normalizeKnowledgeSuggestionStatus(value: unknown): KnowledgeSuggestionStatus {
  return normalizeEnum(value, statuses, "pending");
}

export function buildKnowledgeSuggestionBody(input: {
  note?: string;
  sourceCallId?: string;
  suggestedAnswer?: string;
}) {
  return [
    input.note?.trim() ? `Observed issue: ${input.note.trim()}` : undefined,
    input.suggestedAnswer?.trim() ? `Approved answer or behavior: ${input.suggestedAnswer.trim()}` : undefined,
    input.sourceCallId ? `Source call: ${input.sourceCallId}` : undefined,
  ].filter((item): item is string => Boolean(item)).join("\n\n");
}

export function buildKnowledgeSuggestionTitle(input: {
  category?: string;
  note?: string;
}) {
  const note = input.note?.trim();
  if (note) {
    const firstSentence = note.split(/[.!?]/)[0]?.trim();
    if (firstSentence) return truncateTitle(firstSentence);
  }

  return `Suggested update - ${(input.category ?? "call feedback").replace(/_/g, " ")}`;
}

function truncateTitle(value: string) {
  return value.length <= 72 ? value : `${value.slice(0, 69).trim()}...`;
}

function normalizeEnum<T extends string>(value: unknown, allowedValues: T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}
