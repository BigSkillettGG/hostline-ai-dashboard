import type { Call, Order, Reservation } from "../data/mock";
import { buildInteractionInsight, interactionValueLabels, type InteractionInsight } from "./interaction-status";
import { isActiveStaffTask, type StaffTask } from "./staff-tasks";
import { formatVerticalIntent, getVerticalInsightProfile, type VerticalInsightProfile } from "./vertical-insights";

export interface DailyBriefMetric {
  label: string;
  value: string;
}

export interface DailyBriefFollowUp {
  action: string;
  detail: string;
  id: string;
  kind: "call" | "task";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
}

export interface DailyBriefSuggestion {
  detail: string;
  id: string;
  title: string;
}

export interface DailyBrief {
  copyText: string;
  dateLabel: string;
  followUps: DailyBriefFollowUp[];
  headline: string;
  metrics: DailyBriefMetric[];
  ownerMessage: string;
  suggestedUpdates: DailyBriefSuggestion[];
  totals: {
    calls: number;
    chats: number;
    complaints: number;
    highValue: number;
    knowledgeGaps: number;
    openFollowUps: number;
    orders: number;
    reservations: number;
    revenueCents: number;
    urgent: number;
  };
}

type DailyBriefCall = Call & { insight?: InteractionInsight };

export function buildDailyBrief({
  businessType,
  businessName,
  calls,
  now = new Date(),
  orders,
  reservations,
  tasks,
}: {
  businessType?: string;
  businessName: string;
  calls: Call[];
  now?: Date;
  orders: Order[];
  reservations: Reservation[];
  tasks: StaffTask[];
}): DailyBrief {
  const profile = getVerticalInsightProfile(businessType);
  const recentCalls = calls.filter((call) => isWithinLastHours(call.time, 24, now));
  const recentOrders = orders.filter((order) => isWithinLastHours(order.createdAt, 24, now));
  const recentReservations = reservations.filter((reservation) =>
    reservation.createdAt ? isWithinLastHours(reservation.createdAt, 24, now) : recentCalls.some((call) => call.reservationId === reservation.id),
  );
  const activeTasks = tasks.filter(isActiveStaffTask);
  const callsWithInsight: DailyBriefCall[] = recentCalls.map((call) => ({
    ...call,
    insight: buildInteractionInsight({ call }),
  }));
  const urgentCalls = callsWithInsight.filter((call) => call.insight?.urgency === "urgent");
  const highValueCalls = callsWithInsight.filter((call) =>
    call.insight?.valueTier === "high" || call.insight?.valueTier === "very_high",
  );
  const knowledgeGapCalls = callsWithInsight.filter((call) => call.insight?.knowledgeGap);
  const followUpCalls = callsWithInsight.filter((call) => call.insight?.followUpNeeded);
  const complaintCalls = callsWithInsight.filter((call) => call.intent === "complaint");
  const chats = recentCalls.filter((call) => call.channel === "web_chat").length;
  const revenueCents = Math.round(recentOrders.reduce((sum, order) => sum + order.total, 0) * 100);
  const followUps = buildFollowUps(followUpCalls, activeTasks);
  const suggestedUpdates = buildSuggestedUpdates(knowledgeGapCalls, callsWithInsight, businessType);
  const openFollowUps = followUps.length;
  const totals = {
    calls: recentCalls.length,
    chats,
    complaints: complaintCalls.length,
    highValue: highValueCalls.length,
    knowledgeGaps: knowledgeGapCalls.length,
    openFollowUps,
    orders: recentOrders.length,
    reservations: recentReservations.length,
    revenueCents,
    urgent: urgentCalls.length,
  };
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(now);
  const headline = buildHeadline(totals, businessName);
  const ownerMessage = buildOwnerMessage({ businessName, dateLabel, profile, totals });
  const metrics = [
    { label: "Calls", value: String(totals.calls) },
    { label: "Chats", value: String(totals.chats) },
    { label: profile.primaryWorkflow.metricLabel, value: String(totals.orders) },
    { label: profile.secondaryWorkflow.metricLabel, value: String(totals.reservations) },
    { label: "Open follow-ups", value: String(totals.openFollowUps) },
    { label: "High-value", value: String(totals.highValue) },
  ];

  return {
    copyText: buildCopyText({ businessName, dateLabel, followUps, ownerMessage, profile, suggestedUpdates, totals }),
    dateLabel,
    followUps,
    headline,
    metrics,
    ownerMessage,
    suggestedUpdates,
    totals,
  };
}

function buildHeadline(totals: DailyBrief["totals"], businessName: string) {
  if (!totals.calls && !totals.chats) return `No new customer interactions for ${businessName} yet today.`;
  if (totals.urgent > 0) return `${totals.urgent} urgent item${plural(totals.urgent)} ${totals.urgent === 1 ? "needs" : "need"} attention.`;
  if (totals.openFollowUps > 0) return `${totals.openFollowUps} follow-up${plural(totals.openFollowUps)} should be handled next.`;
  if (totals.highValue > 0) return `${totals.highValue} high-value opportunity${plural(totals.highValue)} captured.`;
  return `SignalHost handled today's front desk work.`;
}

function buildOwnerMessage({
  businessName,
  dateLabel,
  profile,
  totals,
}: {
  businessName: string;
  dateLabel: string;
  profile: VerticalInsightProfile;
  totals: DailyBrief["totals"];
}) {
  const handled = [
    `${totals.calls} call${plural(totals.calls)}`,
    totals.chats ? `${totals.chats} website chat${plural(totals.chats)}` : "",
    totals.orders ? `${totals.orders} ${pluralPhrase(totals.orders, profile.primaryWorkflow.singular, profile.primaryWorkflow.plural)}` : "",
    totals.reservations ? `${totals.reservations} ${pluralPhrase(totals.reservations, profile.secondaryWorkflow.ownerPhrase, profile.secondaryWorkflow.plural)}` : "",
  ].filter(Boolean);
  const attention = [
    totals.urgent ? `${totals.urgent} urgent` : "",
    totals.complaints ? `${totals.complaints} complaint${plural(totals.complaints)}` : "",
    totals.knowledgeGaps ? `${totals.knowledgeGaps} answer${plural(totals.knowledgeGaps)} to improve` : "",
    totals.openFollowUps ? `${totals.openFollowUps} open follow-up${plural(totals.openFollowUps)}` : "",
  ].filter(Boolean);
  const revenue = totals.revenueCents > 0
    ? ` I captured about ${formatMoneyFromCents(totals.revenueCents)} in ${profile.primaryWorkflow.ownerPhrase} value.`
    : "";
  const attentionSentence = attention.length
    ? ` I flagged ${joinHumanList(attention)}.`
    : " Nothing needs immediate attention right now.";

  return `For ${businessName} on ${dateLabel}, I handled ${joinHumanList(handled) || "no customer interactions yet"}.${revenue}${attentionSentence}`;
}

function buildFollowUps(calls: DailyBriefCall[], tasks: StaffTask[]): DailyBriefFollowUp[] {
  const callFollowUps = calls.map((call) => ({
    action: call.insight?.recommendedAction ?? "Review this interaction.",
    detail: call.summary,
    id: call.id,
    kind: "call" as const,
    priority: call.insight?.urgency ?? "normal",
    title: `${call.caller} · ${interactionValueLabels[call.insight?.valueTier ?? "low"]}`,
  }));
  const taskFollowUps = tasks.map((task) => ({
    action: task.body ?? "Complete the staff task.",
    detail: task.title,
    id: task.id,
    kind: "task" as const,
    priority: task.priority,
    title: task.title,
  }));

  return [...callFollowUps, ...taskFollowUps]
    .sort((first, second) => priorityRank(second.priority) - priorityRank(first.priority))
    .slice(0, 5);
}

function buildSuggestedUpdates(
  knowledgeGapCalls: DailyBriefCall[],
  calls: DailyBriefCall[],
  businessType?: string,
): DailyBriefSuggestion[] {
  const suggestions: DailyBriefSuggestion[] = knowledgeGapCalls.slice(0, 3).map((call) => ({
    detail: call.summary,
    id: `knowledge-${call.id}`,
    title: "Review or add missing knowledge",
  }));
  const topicCounts = new Map<string, number>();
  for (const call of calls) {
    topicCounts.set(call.intent, (topicCounts.get(call.intent) ?? 0) + 1);
  }
  const repeatedTopic = [...topicCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((first, second) => second[1] - first[1])
    .at(0);

  if (repeatedTopic && !suggestions.some((suggestion) => suggestion.id === `topic-${repeatedTopic[0]}`)) {
    suggestions.push({
      detail: `${repeatedTopic[1]} people asked about ${formatVerticalIntent(repeatedTopic[0], businessType).toLowerCase()} in the last 24 hours.`,
      id: `topic-${repeatedTopic[0]}`,
      title: "Consider making this easier to find",
    });
  }

  return suggestions.slice(0, 4);
}

function buildCopyText({
  businessName,
  dateLabel,
  followUps,
  ownerMessage,
  profile,
  suggestedUpdates,
  totals,
}: {
  businessName: string;
  dateLabel: string;
  followUps: DailyBriefFollowUp[];
  ownerMessage: string;
  profile: VerticalInsightProfile;
  suggestedUpdates: DailyBriefSuggestion[];
  totals: DailyBrief["totals"];
}) {
  const lines = [
    `SignalHost Daily Brief - ${businessName} - ${dateLabel}`,
    "",
    ownerMessage,
    "",
    "Numbers:",
    `- Calls: ${totals.calls}`,
    `- Website chats: ${totals.chats}`,
    `- ${profile.primaryWorkflow.copyLabel}: ${totals.orders}`,
    `- ${profile.secondaryWorkflow.copyLabel}: ${totals.reservations}`,
    `- High-value opportunities: ${totals.highValue}`,
    `- Open follow-ups: ${totals.openFollowUps}`,
    `- Knowledge gaps: ${totals.knowledgeGaps}`,
  ];

  if (followUps.length) {
    lines.push("", "Open follow-ups:");
    followUps.forEach((item) => lines.push(`- ${item.title}: ${item.action}`));
  }

  if (suggestedUpdates.length) {
    lines.push("", "Suggested updates:");
    suggestedUpdates.forEach((item) => lines.push(`- ${item.title}: ${item.detail}`));
  }

  return lines.join("\n");
}

function priorityRank(priority: DailyBriefFollowUp["priority"]) {
  return {
    high: 2,
    low: 0,
    normal: 1,
    urgent: 3,
  }[priority];
}

function isWithinLastHours(value: string | undefined, hours: number, now: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return now.getTime() - time <= hours * 60 * 60_000;
}

function joinHumanList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function plural(count: number) {
  return count === 1 ? "" : "s";
}

function pluralPhrase(count: number, singular: string, pluralValue: string) {
  return count === 1 ? singular : pluralValue;
}

function formatMoneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}
