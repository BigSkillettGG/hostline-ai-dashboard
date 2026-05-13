export type CustomerRequestResponseStatus = "not_needed" | "drafted" | "sent" | "failed" | "skipped";

export interface CustomerRequestResolutionDraft {
  answer: string;
  customerMessage: string;
  knowledgeBody: string;
  knowledgeTitle: string;
  sourceQuestion: string;
}

const responseStatuses: CustomerRequestResponseStatus[] = ["not_needed", "drafted", "sent", "failed", "skipped"];

export function normalizeCustomerRequestResponseStatus(value: unknown): CustomerRequestResponseStatus {
  return responseStatuses.includes(value as CustomerRequestResponseStatus)
    ? (value as CustomerRequestResponseStatus)
    : "not_needed";
}

export function buildCustomerRequestResolutionDraft(input: {
  answer: string;
  businessName?: string;
  callId?: string;
  customerContext?: string;
  sourceQuestion: string;
  title?: string;
}): CustomerRequestResolutionDraft {
  const answer = input.answer.trim();
  const sourceQuestion = input.sourceQuestion.trim() || "Customer asked an unresolved question.";
  const knowledgeTitle = buildCustomerKnowledgeTitle(input.title ?? sourceQuestion);
  const customerMessage = buildCustomerMessage(answer, input.businessName);
  const knowledgeBody = [
    `Customer question: ${sourceQuestion}`,
    input.customerContext?.trim() ? `Original context: ${input.customerContext.trim()}` : undefined,
    `Approved answer: ${answer}`,
    input.callId ? `Source call: ${input.callId}` : undefined,
  ].filter((item): item is string => Boolean(item)).join("\n\n");

  return {
    answer,
    customerMessage,
    knowledgeBody,
    knowledgeTitle,
    sourceQuestion,
  };
}

export function buildCustomerMessage(answer: string, businessName?: string) {
  const trimmed = ensureTerminalPunctuation(answer.trim());
  const prefix = businessName?.trim()
    ? `Thanks for your patience. ${businessName} confirmed:`
    : "Thanks for your patience. The team confirmed:";

  return `${prefix} ${trimmed}`;
}

export function buildCustomerKnowledgeTitle(value: string) {
  const normalized = value
    .replace(/^summary:\s*/i, "")
    .replace(/^customer asked:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const title = normalized ? `Customer answer - ${normalized}` : "Customer answer";

  return title.length <= 86 ? title : `${title.slice(0, 83).trim()}...`;
}

function ensureTerminalPunctuation(value: string) {
  if (!value) return value;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
