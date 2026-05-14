import type { StaffTask } from "./staff-tasks";

export type FollowUpRecoveryCategory = "knowledge" | "operations" | "revenue" | "risk" | "routine";
export type FollowUpRecoveryChannel = "call" | "email" | "staff_note" | "text";
export type FollowUpRecoveryValueTier = "low" | "medium" | "high" | "very_high" | "risk";

export interface FollowUpRecoveryInsight {
  approvalRequired: boolean;
  cadenceLabel: string;
  category: FollowUpRecoveryCategory;
  draftMessage: string;
  ownerPrompt: string;
  reason: string;
  revenueRecovery: boolean;
  riskLabel: string;
  suggestedChannel: FollowUpRecoveryChannel;
  valueLabel: string;
  valueTier: FollowUpRecoveryValueTier;
}

export interface FollowUpRecoverySummary {
  highValue: number;
  ownerApproval: number;
  recoveryTasks: StaffTask[];
  revenueOpportunities: number;
  riskItems: number;
  topTasks: StaffTask[];
}

const veryHighValuePatterns = [
  /\b(private event|buyout|catering|large party|wedding|bridal party)\b/i,
  /\b(roof replacement|full roof|new roof|storm damage|insurance claim)\b/i,
  /\b(system replacement|new hvac|new furnace|new ac|heat pump|whole home)\b/i,
  /\b(ev charger|generator|panel upgrade|rewire)\b/i,
  /\b(color correction|balayage|extensions)\b/i,
];

const highValuePatterns = [
  /\b(quote|estimate|consultation|appointment request|reservation|booking|order|service request)\b/i,
  /\b(no heat|no ac|water heater|sewer|drain|leak|repair|inspection)\b/i,
  /\b(group booking|special event|birthday|anniversary)\b/i,
];

const riskPatterns = [
  /\b(complaint|angry|upset|refund|wrong order|missing|manager)\b/i,
  /\b(allergy|allergen|severe|peanut|shellfish|gluten)\b/i,
  /\b(active leak|burst pipe|flood|gas smell|burning smell|sparking|exposed wire|no heat|no ac)\b/i,
];

const lowValuePatterns = [
  /\b(vendor|supplier|sales pitch|solicitation|robocall|spam|wrong number|job applicant|employment)\b/i,
];

export function buildFollowUpRecoveryInsight(task: StaffTask, now = new Date()): FollowUpRecoveryInsight {
  const text = taskText(task);
  const risk = task.type === "manager_callback" || matchesAny(riskPatterns, text);
  const veryHigh = matchesAny(veryHighValuePatterns, text);
  const high = task.priority === "high" || matchesAny(highValuePatterns, text);
  const lowValue = matchesAny(lowValuePatterns, text);
  const knowledge = task.type === "customer_request" || task.type === "low_confidence_review";
  const operations = task.type === "delivery_issue" || task.type === "order_follow_up";
  const commercialHigh = !operations && high;
  const revenueRecovery = !risk && !lowValue && !operations && (veryHigh || commercialHigh || task.type === "reservation_review" || task.type === "customer_request");
  const valueTier = selectValueTier({ high: commercialHigh, lowValue, revenueRecovery, risk, veryHigh });
  const category = selectCategory({ knowledge, operations, revenueRecovery, risk, task });
  const suggestedChannel = selectChannel({ category, risk, task, text });
  const approvalRequired = risk || valueTier === "high" || valueTier === "very_high" || task.type === "customer_request";

  return {
    approvalRequired,
    cadenceLabel: buildCadenceLabel(task, now),
    category,
    draftMessage: buildDraftMessage({ category, risk, task, valueTier }),
    ownerPrompt: buildOwnerPrompt({ category, task, valueTier }),
    reason: buildReason({ category, task, valueTier }),
    revenueRecovery,
    riskLabel: buildRiskLabel({ category, risk, task }),
    suggestedChannel,
    valueLabel: valueLabels[valueTier],
    valueTier,
  };
}

export function summarizeFollowUpRecovery(tasks: StaffTask[], now = new Date()): FollowUpRecoverySummary {
  const activeTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const withInsights = activeTasks.map((task) => ({
    insight: buildFollowUpRecoveryInsight(task, now),
    task,
  }));
  const recoveryTasks = withInsights
    .filter(({ insight }) => insight.revenueRecovery || insight.category === "risk" || insight.category === "knowledge")
    .map(({ task }) => task);

  return {
    highValue: withInsights.filter(({ insight }) => insight.valueTier === "high" || insight.valueTier === "very_high").length,
    ownerApproval: withInsights.filter(({ insight }) => insight.approvalRequired).length,
    recoveryTasks,
    revenueOpportunities: withInsights.filter(({ insight }) => insight.revenueRecovery).length,
    riskItems: withInsights.filter(({ insight }) => insight.category === "risk").length,
    topTasks: [...recoveryTasks].sort(rankRecoveryTask(now)).slice(0, 3),
  };
}

export function formatRecoveryChannel(channel: FollowUpRecoveryChannel) {
  if (channel === "staff_note") return "Staff note";
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

const valueLabels: Record<FollowUpRecoveryValueTier, string> = {
  high: "High value",
  low: "Low value",
  medium: "Medium value",
  risk: "Risk",
  very_high: "Very high value",
};

function selectValueTier({
  high,
  lowValue,
  revenueRecovery,
  risk,
  veryHigh,
}: {
  high: boolean;
  lowValue: boolean;
  revenueRecovery: boolean;
  risk: boolean;
  veryHigh: boolean;
}): FollowUpRecoveryValueTier {
  if (risk) return "risk";
  if (lowValue) return "low";
  if (veryHigh) return "very_high";
  if (high) return "high";
  if (revenueRecovery) return "medium";
  return "low";
}

function selectCategory({
  knowledge,
  operations,
  revenueRecovery,
  risk,
  task,
}: {
  knowledge: boolean;
  operations: boolean;
  revenueRecovery: boolean;
  risk: boolean;
  task: StaffTask;
}): FollowUpRecoveryCategory {
  if (risk || task.type === "manager_callback") return "risk";
  if (revenueRecovery) return "revenue";
  if (knowledge) return "knowledge";
  if (operations) return "operations";
  return "routine";
}

function selectChannel({
  category,
  risk,
  task,
  text,
}: {
  category: FollowUpRecoveryCategory;
  risk: boolean;
  task: StaffTask;
  text: string;
}): FollowUpRecoveryChannel {
  if (risk || task.type === "manager_callback") return "call";
  if (task.type === "low_confidence_review" || category === "operations") return "staff_note";
  if (/\b(email|quote|proposal|estimate|package|catering|private event)\b/i.test(text)) return "email";
  if (/\b(link|booking|reservation|appointment|confirm|text)\b/i.test(text)) return "text";
  return "call";
}

function buildCadenceLabel(task: StaffTask, now: Date) {
  if (!task.dueAt) {
    if (task.priority === "urgent") return "Call now";
    if (task.priority === "high") return "Handle today";
    return "Handle in next batch";
  }

  const minutesUntilDue = Math.round((new Date(task.dueAt).getTime() - now.getTime()) / 60000);
  if (minutesUntilDue < 0) return `${Math.abs(minutesUntilDue)}m overdue`;
  if (minutesUntilDue <= 15) return "Due now";
  if (minutesUntilDue <= 60) return `Within ${minutesUntilDue}m`;
  if (minutesUntilDue <= 24 * 60) return "Today";
  return "Later";
}

function buildReason({
  category,
  task,
  valueTier,
}: {
  category: FollowUpRecoveryCategory;
  task: StaffTask;
  valueTier: FollowUpRecoveryValueTier;
}) {
  if (category === "risk") return "This could affect safety, trust, or a customer relationship.";
  if (category === "knowledge") return "Answering this teaches SignalHost and prevents the same gap next time.";
  if (category === "operations") return "This can block staff or customer handoff if it stays open.";
  if (valueTier === "very_high") return "This looks like a high-ticket opportunity that should not wait.";
  if (valueTier === "high") return "This is likely revenue-bearing and should get a same-day touch.";
  if (task.type === "reservation_review") return "The customer is waiting on confirmation.";
  return "This should be closed so no customer request goes stale.";
}

function buildOwnerPrompt({
  category,
  task,
  valueTier,
}: {
  category: FollowUpRecoveryCategory;
  task: StaffTask;
  valueTier: FollowUpRecoveryValueTier;
}) {
  if (category === "risk") return "What should staff tell the customer, and who owns the callback?";
  if (category === "knowledge") return "What is the correct answer SignalHost should remember?";
  if (valueTier === "very_high" || valueTier === "high") return "Should SignalHost send this follow-up now, or should a human call first?";
  if (task.type === "reservation_review") return "Can staff confirm this request, offer alternatives, or send the booking link?";
  return "What outcome should staff record before closing this action?";
}

function buildRiskLabel({
  category,
  risk,
  task,
}: {
  category: FollowUpRecoveryCategory;
  risk: boolean;
  task: StaffTask;
}) {
  if (risk || task.priority === "urgent") return "Do not batch";
  if (category === "revenue") return "Revenue at risk";
  if (category === "knowledge") return "Future answer gap";
  if (category === "operations") return "Handoff risk";
  return "Normal";
}

function buildDraftMessage({
  category,
  risk,
  task,
  valueTier,
}: {
  category: FollowUpRecoveryCategory;
  risk: boolean;
  task: StaffTask;
  valueTier: FollowUpRecoveryValueTier;
}) {
  const topic = readableTopic(task);
  if (risk || category === "risk") {
    return `Hi, this is the team following up from your call about ${topic}. We are reviewing this now and someone will get back to you as quickly as possible.`;
  }
  if (category === "knowledge") {
    return `Thanks for your patience. The team checked on ${topic}, and we will follow up with the confirmed answer shortly.`;
  }
  if (valueTier === "very_high" || valueTier === "high") {
    return `Hi, thanks for reaching out about ${topic}. We can help with next steps. What is the best time for our team to follow up?`;
  }
  if (task.type === "reservation_review") {
    return `Thanks for your patience. We are checking availability for ${topic} and will confirm as soon as staff reviews it.`;
  }
  return `Thanks for reaching out about ${topic}. The team is reviewing it and will follow up shortly.`;
}

function rankRecoveryTask(now: Date) {
  return (first: StaffTask, second: StaffTask) => {
    const firstInsight = buildFollowUpRecoveryInsight(first, now);
    const secondInsight = buildFollowUpRecoveryInsight(second, now);
    const valueDelta = valueRank(secondInsight.valueTier) - valueRank(firstInsight.valueTier);
    if (valueDelta) return valueDelta;
    const priorityDelta = priorityRank(second.priority) - priorityRank(first.priority);
    if (priorityDelta) return priorityDelta;
    return dueRank(first, now) - dueRank(second, now);
  };
}

function valueRank(value: FollowUpRecoveryValueTier) {
  if (value === "risk") return 5;
  if (value === "very_high") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function priorityRank(priority: StaffTask["priority"]) {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "normal") return 2;
  return 1;
}

function dueRank(task: StaffTask, now: Date) {
  if (!task.dueAt) return Number.POSITIVE_INFINITY;
  return new Date(task.dueAt).getTime() - now.getTime();
}

function readableTopic(task: StaffTask) {
  const raw = task.title || task.body || "your request";
  const cleaned = raw
    .replace(/^follow up on\s+/i, "")
    .replace(/^call back\s+/i, "")
    .replace(/^confirm\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function taskText(task: StaffTask) {
  return [task.title, task.body, task.type, task.priority].filter(Boolean).join(" ");
}

function matchesAny(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}
