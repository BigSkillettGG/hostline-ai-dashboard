export type ScenarioChannel = "phone" | "website_chat" | "both";
export type ScenarioPriority = "critical" | "high" | "medium";
export type ScenarioStatus = "untested" | "passed" | "needs_work";
export type ScenarioVertical = "all" | "restaurants" | "home_services" | "salons";

export interface ScenarioRunState {
  lastRunAt?: string;
  notes?: string;
  status: ScenarioStatus;
}

export interface VoiceScenario {
  callerScript: string[];
  channel: ScenarioChannel;
  expectedBehavior: string[];
  id: string;
  listenFor: string[];
  priority: ScenarioPriority;
  tags: string[];
  title: string;
  vertical: ScenarioVertical;
}

export type ScenarioTestChannel = "phone" | "website_chat";

export interface ScenarioReplyReviewTurn {
  actions?: Array<{ type?: string }>;
  callerMessage: string;
  reply: string;
}

export const voiceScenarios: VoiceScenario[] = [
  {
    callerScript: [
      "Call from a quiet phone.",
      "Say: Hi, do you have any specials tonight?",
      "After the AI host answers, say: Great, do you have parking nearby?",
      "After the AI host answers, say: No, that's all.",
    ],
    channel: "phone",
    expectedBehavior: [
      "Uses the short greeting once.",
      "Answers specials as specials, not hours.",
      "Answers parking as the next question without restarting.",
      "Asks if anything else is needed, then says goodbye after the caller is done.",
    ],
    id: "restaurant-specials-parking-close",
    listenFor: ["No mid-call greeting restart", "Natural follow-up", "Clean goodbye"],
    priority: "critical",
    tags: ["close-out", "context", "multi-turn"],
    title: "Specials, parking, and clean close-out",
    vertical: "restaurants",
  },
  {
    callerScript: [
      "Call on speakerphone or car Bluetooth.",
      "Let the AI host answer, then wait silently for two seconds.",
      "Ask: Are you open tonight?",
      "Ask one follow-up while the AI host is speaking softly: Do you have happy hour?",
    ],
    channel: "phone",
    expectedBehavior: [
      "Ignores faint echo and room noise.",
      "Does not treat a short silence as a new call.",
      "Handles a real interruption without losing state.",
      "Keeps the conversation moving instead of looping the greeting.",
    ],
    id: "speakerphone-echo-silence",
    listenFor: ["No false interruption", "No dead-air panic", "No restart"],
    priority: "critical",
    tags: ["speakerphone", "vad", "realtime"],
    title: "Speakerphone echo and short silence",
    vertical: "all",
  },
  {
    callerScript: [
      "Say: Do you have availability at 6 tonight?",
      "When the AI host asks the missing detail, say: Two people.",
      "Give a last name only when asked for the name: Schneider.",
    ],
    channel: "phone",
    expectedBehavior: [
      "Understands '6 tonight' as a time/date request.",
      "Only asks for party size, not date and time again.",
      "Does not say 'Thanks, Schneider.'",
      "Saves or requests the reservation according to the configured reservation mode.",
    ],
    id: "reservation-shorthand-last-name",
    listenFor: ["Acknowledges known details", "No repeated questions", "Name etiquette"],
    priority: "critical",
    tags: ["reservations", "name-etiquette"],
    title: "Reservation shorthand and last-name etiquette",
    vertical: "restaurants",
  },
  {
    callerScript: [
      "Say: My son has a severe peanut allergy. Is the mushroom risotto safe?",
      "If the AI host offers staff help, say: Yes, please have someone call me.",
    ],
    channel: "phone",
    expectedBehavior: [
      "Does not guarantee allergy safety.",
      "Does not say she is transferring or placing the caller on hold.",
      "Collects the useful callback details.",
      "Says staff will follow up shortly.",
    ],
    id: "severe-allergy-staff-callback",
    listenFor: ["No false transfer", "Conservative allergy language", "Staff callback"],
    priority: "critical",
    tags: ["allergy", "escalation", "safety"],
    title: "Severe allergy handoff",
    vertical: "restaurants",
  },
  {
    callerScript: [
      "Say: Can I get a pepperoni pizza for pickup?",
      "If the AI host says it is not listed, ask: Can you just add pepperoni to a cheese pizza?",
      "Then ask: How much will that be?",
    ],
    channel: "phone",
    expectedBehavior: [
      "Uses the substitution policy.",
      "Notes reasonable requests without over-promising.",
      "Does not guarantee off-menu price or availability unless the menu confirms it.",
      "Offers staff confirmation when uncertain.",
    ],
    id: "off-menu-substitution",
    listenFor: ["No over-promise", "Staff confirmation when uncertain", "Order notes are clear"],
    priority: "high",
    tags: ["orders", "substitutions", "menu"],
    title: "Off-menu substitution request",
    vertical: "restaurants",
  },
  {
    callerScript: [
      "Say: Can you text me the reservation link?",
      "If the AI host references your number, confirm yes.",
      "Ask: Can you send the menu too?",
    ],
    channel: "phone",
    expectedBehavior: [
      "Uses caller ID when available and says only the last four digits.",
      "Acts like texting is available in pilot placeholder mode.",
      "Offers configured links naturally.",
      "Does not expose carrier registration or internal SMS setup.",
    ],
    id: "text-links-placeholder",
    listenFor: ["No internal setup language", "Uses last four digits", "Natural text offer"],
    priority: "high",
    tags: ["sms", "links", "caller-id"],
    title: "Text reservation and menu links",
    vertical: "all",
  },
  {
    callerScript: [
      "Say: I want to talk to a manager.",
      "When the AI host asks why, say: I had a bad experience last night.",
      "Ask if she can connect you now.",
    ],
    channel: "phone",
    expectedBehavior: [
      "Apologizes calmly.",
      "Collects name, callback number, and issue summary.",
      "Does not promise a live transfer.",
      "Creates a staff callback or urgent task.",
    ],
    id: "complaint-no-live-transfer",
    listenFor: ["No fake hold", "Manager callback", "Calm tone"],
    priority: "critical",
    tags: ["complaint", "handoff"],
    title: "Complaint without live transfer",
    vertical: "all",
  },
  {
    callerScript: [
      "Ask in website chat: Do you service Somerville?",
      "Then ask: Can I book an appointment for tomorrow morning?",
      "Then ask: Can you text me the booking link?",
    ],
    channel: "website_chat",
    expectedBehavior: [
      "Uses the business vertical context rather than restaurant wording.",
      "Qualifies the service request or appointment.",
      "Offers the configured booking link when available.",
      "Keeps the same knowledge behavior across chat and phone.",
    ],
    id: "service-business-chat-booking",
    listenFor: ["No restaurant wording", "Good lead qualification", "Link flow"],
    priority: "medium",
    tags: ["website-chat", "multi-vertical"],
    title: "Service business website chat booking",
    vertical: "home_services",
  },
];

export function summarizeScenarioRuns(
  scenarios: VoiceScenario[],
  runs: Record<string, ScenarioRunState | undefined>,
) {
  return scenarios.reduce(
    (summary, scenario) => {
      const status = runs[scenario.id]?.status ?? "untested";
      summary.total += 1;
      summary[status] += 1;
      if (scenario.priority === "critical" && status !== "passed") summary.openCritical += 1;
      return summary;
    },
    {
      needs_work: 0,
      openCritical: 0,
      passed: 0,
      total: 0,
      untested: 0,
    } as Record<ScenarioStatus, number> & { openCritical: number; total: number },
  );
}

export function buildScenarioReport(
  scenarios: VoiceScenario[],
  runs: Record<string, ScenarioRunState | undefined>,
) {
  return scenarios
    .map((scenario) => {
      const run = runs[scenario.id];
      return [
        `${scenario.title} (${scenario.priority})`,
        `Status: ${run?.status ?? "untested"}`,
        run?.notes ? `Notes: ${run.notes}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function getScenarioTestChannel(scenario: VoiceScenario): ScenarioTestChannel {
  return scenario.channel === "website_chat" ? "website_chat" : "phone";
}

export function extractScenarioTestMessages(scenario: VoiceScenario) {
  return scenario.callerScript
    .map(extractScenarioMessage)
    .filter((message): message is string => Boolean(message));
}

export function defaultScenarioTestMessage(scenario: VoiceScenario) {
  return extractScenarioTestMessages(scenario)[0] ?? scenario.callerScript[0] ?? "";
}

export function getScenarioNextTestMessage(scenario: VoiceScenario, completedUserTurns: number) {
  const messages = extractScenarioTestMessages(scenario);
  if (!messages.length) return "";
  return messages[Math.min(completedUserTurns, messages.length - 1)];
}

export function reviewScenarioReplies(scenario: VoiceScenario, turns: ScenarioReplyReviewTurn[]) {
  const issues: string[] = [];
  const laterReplies = turns.slice(1).map((turn) => turn.reply);
  const allReplies = turns.map((turn) => turn.reply).join(" ");
  const normalizedReplies = allReplies.toLowerCase();
  const finalTurn = turns.at(-1);

  if (laterReplies.some(looksLikeOpeningRestart)) {
    issues.push("Possible mid-call greeting restart after the first answer.");
  }

  if (
    (scenario.tags.includes("handoff") || scenario.tags.includes("allergy") || scenario.tags.includes("complaint")) &&
    /\b(transfer|connect you now|put you on hold|place you on hold)\b/i.test(allReplies)
  ) {
    issues.push("Possible fake live transfer or hold language.");
  }

  if (
    scenario.tags.includes("sms") &&
    /\b(twilio|carrier registration|sms provider|placeholder mode|internal setup)\b/i.test(allReplies)
  ) {
    issues.push("Exposes internal texting setup details.");
  }

  if (
    scenario.tags.includes("allergy") &&
    !/\b(staff|confirm|confirmation|cross-contact|call back|callback)\b/i.test(allReplies)
  ) {
    issues.push("Allergy answer may not be conservative enough.");
  }

  if (
    finalTurn &&
    /\b(no thanks|no,? that's all|no,? thats all|that's all|thats all|i'm good|im good)\b/i.test(finalTurn.callerMessage) &&
    !/\b(goodbye|bye|thanks for calling|thank you for calling|have a good)\b/i.test(finalTurn.reply) &&
    !finalTurn.actions?.some((action) => action.type === "finish_call")
  ) {
    issues.push("Final no/that's-all turn did not clearly close the call.");
  }

  if (
    scenario.id === "reservation-shorthand-last-name" &&
    /\b(thanks|thank you),?\s+schneider\b/i.test(normalizedReplies)
  ) {
    issues.push("Uses a bare last name as if it were a first name.");
  }

  return issues;
}

function extractScenarioMessage(scriptLine: string) {
  const trimmed = scriptLine.trim();
  if (!trimmed) return null;
  if (/\bconfirm yes\b/i.test(trimmed)) return "Yes";

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) return null;

  const prefix = trimmed.slice(0, colonIndex).toLowerCase();
  if (!/\b(say|ask|type|reply|confirm)\b/.test(prefix)) return null;

  return cleanScenarioMessage(trimmed.slice(colonIndex + 1));
}

function cleanScenarioMessage(value: string) {
  return value
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeOpeningRestart(reply: string) {
  return /\b(thank you|thanks) for calling\b/i.test(reply) ||
    /\bhow can i help\b/i.test(reply) && /\b(olive|ember|signalhost|calling)\b/i.test(reply);
}
