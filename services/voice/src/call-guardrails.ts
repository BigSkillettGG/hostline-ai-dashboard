export type CallerUtteranceClass = "abusive" | "connection_issue" | "empty" | "normal";

const abusivePattern =
  /\b(fuck|fucking|shit|bullshit|asshole|idiot|stupid|sucks|hate you|terrible bot|useless)\b/i;
const connectionIssuePattern =
  /\b(can'?t hear|cannot hear|bad connection|you there|are you there|repeat that|say that again|lost you|cutting out|static)\b/i;

export function normalizeCallerUtterance(utterance: string | undefined) {
  return (utterance ?? "").replace(/\s+/g, " ").trim();
}

export function classifyCallerUtterance(utterance: string): CallerUtteranceClass {
  const normalized = normalizeCallerUtterance(utterance);
  if (!normalized || normalized.length <= 1) return "empty";
  if (connectionIssuePattern.test(normalized)) return "connection_issue";
  if (abusivePattern.test(normalized)) return "abusive";
  return "normal";
}

export function buildGuardrailReply({
  classification,
  repeatCount = 0,
  restaurantName,
}: {
  classification: CallerUtteranceClass;
  repeatCount?: number;
  restaurantName: string;
}) {
  if (classification === "connection_issue") {
    return "I am here. I may have missed part of that, so could you say it one more time?";
  }

  if (classification === "abusive") {
    return "I want to help. I can take an order, answer a restaurant question, or send a manager a callback request.";
  }

  if (repeatCount >= 2) {
    return `I am sorry, I am still not catching that clearly. You can call ${restaurantName} again, or I can flag this for staff follow-up.`;
  }

  return "I am sorry, I did not catch that. Could you repeat it?";
}

export function buildFailureReply() {
  return "I am sorry, something glitched on my side. I am flagging this call for staff review so the restaurant can follow up.";
}
