import type { Call, Order, Reservation } from "../data/mock";
import { buildDailyBrief, type DailyBrief } from "./daily-brief";
import { buildInteractionInsight } from "./interaction-status";
import { isActiveStaffTask, sortStaffTasks, type StaffTask } from "./staff-tasks";
import {
  getVerticalInsightProfile,
  getVerticalOwnerSuggestions,
  type VerticalInsightProfile,
} from "./vertical-insights";

export type OwnerAssistantIntent =
  | "calls"
  | "complaints"
  | "daily_summary"
  | "follow_ups"
  | "knowledge_gaps"
  | "live_update"
  | "opportunities"
  | "orders"
  | "reservations"
  | "urgent"
  | "unknown";

export interface OwnerAssistantResponse {
  answer: string;
  bullets: string[];
  confidence: "high" | "medium";
  intent: OwnerAssistantIntent;
  suggestedActions: string[];
  title: string;
}

export interface OwnerAssistantContext {
  businessType?: string;
  businessName: string;
  calls: Call[];
  now?: Date;
  orders: Order[];
  reservations: Reservation[];
  tasks: StaffTask[];
}

export const ownerAssistantSuggestions = getVerticalOwnerSuggestions("restaurant");

export function buildOwnerAssistantResponse(question: string, context: OwnerAssistantContext): OwnerAssistantResponse {
  const intent = classifyOwnerQuestion(question);
  const profile = getVerticalInsightProfile(context.businessType);
  const brief = buildDailyBrief(context);
  const recentCalls = recentItems(context.calls, (call) => call.time, context.now);
  const recentOrders = recentItems(context.orders, (order) => order.createdAt, context.now);
  const recentReservations = recentItems(context.reservations, (reservation) => reservation.createdAt, context.now);
  const activeTasks = context.tasks.filter(isActiveStaffTask).sort(sortStaffTasks);

  if (intent === "daily_summary") return dailySummaryResponse(brief);
  if (intent === "urgent") return urgentResponse({ activeTasks, brief, recentCalls });
  if (intent === "follow_ups") return followUpsResponse(brief, activeTasks);
  if (intent === "opportunities") return opportunitiesResponse({ brief, profile, recentCalls });
  if (intent === "knowledge_gaps") return knowledgeGapsResponse(brief);
  if (intent === "complaints") return complaintResponse(recentCalls);
  if (intent === "orders") return orderResponse(recentOrders, profile);
  if (intent === "reservations") return reservationResponse(recentReservations, profile);
  if (intent === "calls") return callsResponse({ brief, recentCalls });
  return fallbackResponse(brief, profile);
}

export function classifyOwnerQuestion(question: string): OwnerAssistantIntent {
  const text = question.toLowerCase();
  if (containsAny(text, ["summary", "report", "happened", "today", "brief", "handled"])) return "daily_summary";
  if (containsAny(text, ["urgent", "emergency", "asap", "priority", "right now"])) return "urgent";
  if (containsAny(text, ["follow up", "follow-up", "callback", "open task", "needs attention", "todo", "to do"])) return "follow_ups";
  if (containsAny(text, ["lead", "opportunity", "high value", "quote", "estimate", "private event", "catering", "revenue"])) return "opportunities";
  if (containsAny(text, ["didn't know", "did not know", "not know", "knowledge", "missing", "couldn't answer", "could not answer", "improve"])) return "knowledge_gaps";
  if (containsAny(text, ["complaint", "angry", "upset", "refund", "bad call"])) return "complaints";
  if (containsAny(text, ["order", "pickup", "sales total", "food"])) return "orders";
  if (containsAny(text, ["reservation", "booking", "table", "appointment"])) return "reservations";
  if (containsAny(text, ["call", "chat", "volume", "how many"])) return "calls";
  return "unknown";
}

function dailySummaryResponse(brief: DailyBrief): OwnerAssistantResponse {
  return {
    answer: brief.ownerMessage,
    bullets: [
      `${brief.totals.calls} calls and ${brief.totals.chats} website chats`,
      `${brief.totals.openFollowUps} open follow-ups`,
      `${brief.totals.highValue} high-value opportunities`,
      `${brief.totals.knowledgeGaps} answers to improve`,
    ],
    confidence: "high",
    intent: "daily_summary",
    suggestedActions: brief.followUps.length ? ["Review open follow-ups", "Copy daily brief"] : ["Copy daily brief"],
    title: "Today at a glance",
  };
}

function urgentResponse({
  activeTasks,
  brief,
  recentCalls,
}: {
  activeTasks: StaffTask[];
  brief: DailyBrief;
  recentCalls: Call[];
}): OwnerAssistantResponse {
  const urgentCalls = recentCalls
    .map((call) => ({ call, insight: buildInteractionInsight({ call }) }))
    .filter((item) => item.insight.urgency === "urgent");
  const urgentTasks = activeTasks.filter((task) => task.priority === "urgent");
  const bullets = [
    ...urgentCalls.slice(0, 4).map(({ call, insight }) => `${call.caller}: ${insight.recommendedAction}`),
    ...urgentTasks.slice(0, 4).map((task) => `${task.title}: ${task.body ?? "Open staff task."}`),
  ];

  return {
    answer: bullets.length
      ? `Yes. I found ${bullets.length} urgent item${bullets.length === 1 ? "" : "s"} that should be handled quickly.`
      : "No urgent calls or tasks are open right now.",
    bullets: bullets.length ? bullets : ["No urgent complaint, safety, or emergency items found in the last 24 hours."],
    confidence: "high",
    intent: "urgent",
    suggestedActions: bullets.length ? ["Open Action Center", "Review urgent calls"] : ["Ask for open follow-ups"],
    title: "Urgent items",
  };
}

function followUpsResponse(brief: DailyBrief, activeTasks: StaffTask[]): OwnerAssistantResponse {
  const bullets = brief.followUps.length
    ? brief.followUps.map((item) => `${item.title}: ${item.action}`)
    : activeTasks.slice(0, 5).map((task) => `${task.title}: ${task.body ?? "Open staff task."}`);

  return {
    answer: bullets.length
      ? `There are ${bullets.length} follow-up item${bullets.length === 1 ? "" : "s"} I would handle next.`
      : "Nothing needs follow-up right now.",
    bullets: bullets.length ? bullets : ["No open customer follow-ups or active staff tasks."],
    confidence: "high",
    intent: "follow_ups",
    suggestedActions: bullets.length ? ["Open Action Center", "Review calls"] : ["Ask for today's summary"],
    title: "Open follow-ups",
  };
}

function opportunitiesResponse({
  brief,
  profile,
  recentCalls,
}: {
  brief: DailyBrief;
  profile: VerticalInsightProfile;
  recentCalls: Call[];
}): OwnerAssistantResponse {
  const opportunities = recentCalls
    .map((call) => ({ call, insight: buildInteractionInsight({ call }) }))
    .filter((item) => item.insight.valueTier === "high" || item.insight.valueTier === "very_high" || item.insight.valueTier === "medium")
    .slice(0, 5);

  return {
    answer: opportunities.length
      ? `I found ${opportunities.length} revenue opportunity${opportunities.length === 1 ? "" : "ies"} from the last 24 hours.`
      : "I do not see high-value opportunities in the last 24 hours yet.",
    bullets: opportunities.length
      ? opportunities.map(({ call, insight }) => `${call.caller}: ${call.summary} ${insight.recommendedAction}`)
      : [`High-value count in today's brief: ${brief.totals.highValue}`],
    confidence: "high",
    intent: "opportunities",
    suggestedActions: opportunities.length ? ["Open follow-up queue", "Review high-value calls"] : ["Ask for call volume"],
    title: profile.highValueLabel,
  };
}

function knowledgeGapsResponse(brief: DailyBrief): OwnerAssistantResponse {
  return {
    answer: brief.suggestedUpdates.length
      ? `I found ${brief.suggestedUpdates.length} possible knowledge update${brief.suggestedUpdates.length === 1 ? "" : "s"}.`
      : "I do not see any obvious knowledge gaps from today's interactions.",
    bullets: brief.suggestedUpdates.length
      ? brief.suggestedUpdates.map((item) => `${item.title}: ${item.detail}`)
      : ["No low-confidence or missing-knowledge calls found today."],
    confidence: "high",
    intent: "knowledge_gaps",
    suggestedActions: brief.suggestedUpdates.length ? ["Open Knowledge Base", "Review calls with low confidence"] : ["Ask about complaints"],
    title: "Knowledge to improve",
  };
}

function complaintResponse(recentCalls: Call[]): OwnerAssistantResponse {
  const complaints = recentCalls.filter((call) => call.intent === "complaint" || /complaint|upset|angry|refund|wrong/i.test(call.summary));

  return {
    answer: complaints.length
      ? `Yes. I found ${complaints.length} complaint or risk call${complaints.length === 1 ? "" : "s"}.`
      : "No complaint calls are showing in the last 24 hours.",
    bullets: complaints.length
      ? complaints.slice(0, 5).map((call) => `${call.caller}: ${call.summary}`)
      : ["No complaint, refund, or upset-caller summaries found today."],
    confidence: "high",
    intent: "complaints",
    suggestedActions: complaints.length ? ["Review complaint calls", "Open Action Center"] : ["Ask for urgent calls"],
    title: "Complaints",
  };
}

function orderResponse(recentOrders: Order[], profile: VerticalInsightProfile): OwnerAssistantResponse {
  const total = recentOrders.reduce((sum, order) => sum + order.total, 0);
  const label = profile.primaryWorkflow;
  const valueLine = total > 0 ? [`Captured ${label.ownerPhrase} value: ${formatMoney(total)}`] : [];

  return {
    answer: `There ${recentOrders.length === 1 ? "was" : "were"} ${recentOrders.length} ${recentOrders.length === 1 ? label.singular : label.plural} in the last 24 hours.`,
    bullets: recentOrders.length
      ? [
          ...valueLine,
          ...recentOrders.slice(0, 4).map((order) =>
            `${order.customer}: ${order.total > 0 ? `${formatMoney(order.total)} - ` : ""}${order.status.replace(/_/g, " ")}`,
          ),
        ]
      : [`No ${label.plural} captured in the last 24 hours.`],
    confidence: "high",
    intent: "orders",
    suggestedActions: recentOrders.length ? [`Open ${label.metricLabel}`, "Review follow-up status"] : ["Ask for today's summary"],
    title: label.metricLabel,
  };
}

function reservationResponse(recentReservations: Reservation[], profile: VerticalInsightProfile): OwnerAssistantResponse {
  const label = profile.secondaryWorkflow;

  return {
    answer: `There ${recentReservations.length === 1 ? "was" : "were"} ${recentReservations.length} ${recentReservations.length === 1 ? label.ownerPhrase : label.plural} in the last 24 hours.`,
    bullets: recentReservations.length
      ? recentReservations.slice(0, 5).map((reservation) =>
          profile.businessType === "restaurant"
            ? `${reservation.guest}: party of ${reservation.partySize} on ${reservation.date} at ${reservation.time} - ${reservation.status}`
            : `${reservation.guest}: ${reservation.date} at ${reservation.time} - ${reservation.status}`,
        )
      : [`No ${label.plural} captured in the last 24 hours.`],
    confidence: "high",
    intent: "reservations",
    suggestedActions: recentReservations.length ? [`Open ${label.metricLabel}`, "Review pending requests"] : ["Ask for open follow-ups"],
    title: label.metricLabel,
  };
}

function callsResponse({
  brief,
  recentCalls,
}: {
  brief: DailyBrief;
  recentCalls: Call[];
}): OwnerAssistantResponse {
  const intentCounts = new Map<string, number>();
  recentCalls.forEach((call) => intentCounts.set(call.intent, (intentCounts.get(call.intent) ?? 0) + 1));
  const topIntents = [...intentCounts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 4)
    .map(([intent, count]) => `${titleCase(intent)}: ${count}`);

  return {
    answer: `SignalHost handled ${brief.totals.calls} call${brief.totals.calls === 1 ? "" : "s"} and ${brief.totals.chats} website chat${brief.totals.chats === 1 ? "" : "s"} in the last 24 hours.`,
    bullets: topIntents.length ? topIntents : ["No calls or chats yet in the last 24 hours."],
    confidence: "high",
    intent: "calls",
    suggestedActions: ["Review calls", "Ask what needs follow-up"],
    title: "Call volume",
  };
}

function fallbackResponse(brief: DailyBrief, profile: VerticalInsightProfile): OwnerAssistantResponse {
  const suggestions = getVerticalOwnerSuggestions(profile.businessType);

  return {
    answer: `I can help with today's summary, urgent calls, open follow-ups, ${profile.highValueLabel.toLowerCase()}, complaints, ${profile.primaryWorkflow.plural}, ${profile.secondaryWorkflow.plural}, and knowledge gaps. For now: ${brief.headline}`,
    bullets: suggestions.slice(0, 5),
    confidence: "medium",
    intent: "unknown",
    suggestedActions: ["Try a suggested question", "Open daily brief"],
    title: "Ask SignalHost",
  };
}

function recentItems<T>(items: T[], getDate: (item: T) => string | undefined, now = new Date()) {
  return items.filter((item) => {
    const value = getDate(item);
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && now.getTime() - time <= 24 * 60 * 60_000;
  });
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
