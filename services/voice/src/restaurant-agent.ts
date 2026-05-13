import type { VoiceServiceEnv } from "./env";
import { capitalize, getRuntimeBusinessProfile } from "./business-runtime";
import { matchPhonePlaybookReply } from "./restaurant-playbook";
import type { RestaurantVoiceContext } from "./restaurant-context";
import {
  captureReservationDetails,
  completeReservationRequestFromDetails,
  hasReservationIntent,
  mergeReservationDetails,
  type CapturedReservationDetails,
} from "./reservation-intake";
import type { TranscriptTurn } from "./types";

export interface ResponseInputMessage {
  content: string;
  role: "assistant" | "user";
}

export interface RestaurantResponseTool {
  description: string;
  name: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
  type: "function";
}

export interface RestaurantToolCall {
  arguments: Record<string, unknown>;
  callId: string;
  name: string;
}

export interface GenerateRestaurantReplyInput {
  callerUtterance: string;
  channelInstructions?: string;
  context: RestaurantVoiceContext;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_REPLY_TIMEOUT_MS">;
  handleToolCall?: (toolCall: RestaurantToolCall) => Promise<unknown>;
  tools?: RestaurantResponseTool[];
  transcript: TranscriptTurn[];
}

export interface GenerateCallSummaryInput {
  context: RestaurantVoiceContext;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_REPLY_TIMEOUT_MS">;
  structuredSummary: string;
  transcript: TranscriptTurn[];
}

export async function generateRestaurantReply(input: GenerateRestaurantReplyInput) {
  const playbookReply = matchPhonePlaybookReply(input.callerUtterance, input.context);
  if (playbookReply && shouldAnswerWithPlaybookImmediately(playbookReply.scenario)) {
    console.info("[voice-agent] playbook reply generated", {
      replyLength: playbookReply.text.length,
      scenario: playbookReply.scenario,
    });
    return playbookReply.text;
  }
  if (playbookReply) {
    console.info("[voice-agent] model handling context-sensitive playbook scenario", {
      scenario: playbookReply.scenario,
    });
  }

  const reservationClarifyingReply = buildReservationClarifyingReply(input.callerUtterance, input.transcript);
  if (reservationClarifyingReply) {
    console.info("[voice-agent] reservation clarification generated", {
      replyLength: reservationClarifyingReply.length,
    });
    return reservationClarifyingReply;
  }

  if (!input.env.OPENAI_API_KEY) {
    return withConversationalFollowUp(fallbackRestaurantReply(input.callerUtterance, input.context), input.callerUtterance);
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.env.OPENAI_REPLY_TIMEOUT_MS);
  try {
    const data = await createResponseWithOptionalTools({
      controller,
      env: input.env,
      handleToolCall: input.handleToolCall,
      instructions: [
        buildRestaurantInstructions(input.context),
        input.channelInstructions,
      ].filter(Boolean).join("\n"),
      input: buildConversationInput(input.callerUtterance, input.transcript),
      maxOutputTokens: 220,
      tools: input.tools,
    });
    const reply = withConversationalFollowUp(
      extractOutputText(data) ?? fallbackRestaurantReply(input.callerUtterance, input.context),
      input.callerUtterance,
    );
    console.info("[voice-agent] OpenAI reply generated", {
      latencyMs: Date.now() - startedAt,
      model: input.env.OPENAI_MODEL,
      replyLength: reply.length,
    });
    return reply;
  } catch (error) {
    console.error("[voice-agent] Falling back after OpenAI error", {
      error,
      latencyMs: Date.now() - startedAt,
      model: input.env.OPENAI_MODEL,
    });
    return withConversationalFollowUp(fallbackRestaurantReply(input.callerUtterance, input.context), input.callerUtterance);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateCallSummary(input: GenerateCallSummaryInput) {
  if (!input.env.OPENAI_API_KEY || input.transcript.length < 2) {
    return input.structuredSummary;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(2500, input.env.OPENAI_REPLY_TIMEOUT_MS));

  try {
    const profile = getRuntimeBusinessProfile(input.context);
    const data = await createResponseWithOptionalTools({
      controller,
      env: input.env,
      instructions: [
        `Summarize this ${input.context.restaurantName} phone call for ${profile.staffNoun}.`,
        profile.isRestaurant
          ? "Use one compact paragraph. Include captured orders, reservation requests, complaints, handoffs, caller needs, and any missing follow-up details."
          : "Use one compact paragraph. Include service, appointment, quote, complaint, callback, caller needs, urgency, and any missing follow-up details.",
        "Do not invent facts. If the structured summary already captures the important outcome, preserve it.",
      ].join("\n"),
      input: [
        {
          content: `Structured summary: ${input.structuredSummary}`,
          role: "user",
        },
        ...buildConversationInput("Summarize the call for staff.", input.transcript),
      ],
      maxOutputTokens: 180,
    });
    const summary = extractOutputText(data);
    console.info("[voice-agent] OpenAI call summary generated", {
      latencyMs: Date.now() - startedAt,
      model: input.env.OPENAI_MODEL,
      summaryLength: summary?.length ?? 0,
    });
    return summary ? compactSummary(summary) : input.structuredSummary;
  } catch (error) {
    console.error("[voice-agent] Falling back after OpenAI summary error", {
      error,
      latencyMs: Date.now() - startedAt,
      model: input.env.OPENAI_MODEL,
    });
    return input.structuredSummary;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildRestaurantInstructions(context: RestaurantVoiceContext) {
  const businessLabels = buildBusinessInstructionLabels(context);
  const profile = getRuntimeBusinessProfile(context);
  const faqLines = context.faqs
    .slice(0, 16)
    .map((faq) => `Q: ${faq.question} A: ${faq.answer}`)
    .join(" | ");
  const knowledgeLines = context.knowledgeSections
    .slice(0, 12)
    .map((section) => `${section.title}: ${section.body}`)
    .join(" | ");
  const behaviorTuningLines = formatBehaviorTuningNotes(context.behaviorTuningNotes);

  return [
    `You are ${context.hostName}, the virtual host for ${context.restaurantName}.`,
    `Business profile: ${profile.businessNoun}; caller is a ${profile.customerNoun}; staff role is ${profile.staffNoun}; primary offering is ${profile.offeringNoun}; booking unit is ${profile.appointmentNoun}.`,
    businessLabels.personalityLine,
    "Do not sound like an IVR, a support chatbot, a scripted call center agent, or a generic AI assistant.",
    businessLabels.languageLine,
    "Default answer shape: a brief natural acknowledgement, a direct answer, then the next step or a short loop-closing question.",
    businessLabels.emotionalTemperatureLine,
    "Vary acknowledgements and transitions. Do not start every answer with the same phrase.",
    "Avoid stiff phrases like 'I can assist you with that,' 'please provide,' 'certainly,' and 'is there anything else I may assist you with today?'",
    "Do not be funny, sassy, flirty, theatrical, or overly chatty.",
    "Do not repeat the opening greeting after the first turn; continue the same call and answer the new question directly.",
    "Answer the caller's actual current question. Do not jump to hours, reservations, or ordering just because one related word appears.",
    "After answering a simple informational question, ask a light follow-up such as: Anything else I can help you with?",
    "Do not add that generic follow-up when you already asked a specific next question, are collecting order or reservation details, or are handling complaints, allergies, handoffs, delivery issues, vendors, or lost items.",
    behaviorTuningLines && `Active QA tuning notes from reviewed calls: ${behaviorTuningLines}`,
    behaviorTuningLines &&
      "Apply these QA tuning notes when relevant. They override general style guidance, but never mention QA, feedback, internal notes, or source calls to callers.",
    businessLabels.contextLine,
    "Expect callers with accents, noisy phone audio, fragments, and corrections. Ask one short clarifying question when needed.",
    businessLabels.appointmentDetailLine,
    "Keep replies under two short sentences unless confirming an order.",
    businessLabels.requestCollectionLine,
    `Name etiquette for ${businessLabels.nameContextNoun}: collect the exact name for staff records, but be careful when speaking it back.`,
    "If the caller gives a clear first name, you may personalize with it, such as 'Thanks, Sarah.'",
    "If the caller gives a full name, you may use the first name casually and say the order or reservation is under the full name or last name.",
    "If the caller gives only one name and it may be a last name or is unclear, do not address them by that bare name. Say 'Thanks' or 'I'll put that under Schneider,' not 'Thanks, Schneider.'",
    "Do not infer Mr., Ms., or Mrs. from the sound of the caller's voice. Use an honorific only if the caller says it, such as 'Mr. Schneider' or 'Dr. Patel.'",
    businessLabels.toolUseLine,
    "When a tool captures or submits something, make your final spoken reply coherent with the tool result. Do not repeat yourself.",
    "If a caller is rude, stay calm and helpful. Do not argue, shame, or mirror profanity.",
    businessLabels.operationalEdgeCasesLine,
    "There is no live staff transfer in this pilot. Never say you are connecting, transferring, or placing the caller on hold for staff.",
    "If staff confirmation is needed, collect the caller name, callback number, and question, then say you are sending it to staff so someone can call them back shortly.",
    "If you do not know an answer after checking context, do not guess. Offer a staff callback instead.",
    businessLabels.paymentLine,
    profile.safetyLine,
    businessLabels.substitutionLine,
    businessLabels.escalationLine,
    businessLabels.manualBookingLine,
    `${businessLabels.highlightsLabel}: ${context.menuHighlights.join(", ")}.`,
    faqLines && `FAQs: ${faqLines}`,
    knowledgeLines && `Knowledge sections: ${knowledgeLines}`,
    `Policies: ${Object.entries(context.policies)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ")}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function formatBehaviorTuningNotes(notes: RestaurantVoiceContext["behaviorTuningNotes"]) {
  return notes
    .slice(0, 8)
    .map((section) => {
      const title = section.title.replace(/^call tuning\s*-\s*/i, "").trim() || "Reviewed call note";
      const body = compactBehaviorTuningBody(section.body);
      return body ? `${title}: ${body}` : "";
    })
    .filter(Boolean)
    .join(" | ");
}

function compactBehaviorTuningBody(body: string) {
  const compacted = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^source call:/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return compacted.length <= 360 ? compacted : `${compacted.slice(0, 357)}...`;
}

function buildBusinessInstructionLabels(context: RestaurantVoiceContext) {
  const profile = getRuntimeBusinessProfile(context);
  if (profile.isRestaurant) {
    return {
      appointmentDetailLine:
        "For reservations, acknowledge any date, time, or party size the caller already gave and ask only for the missing detail. Never ask again for a detail already spoken.",
      contextLine:
        "Use the full restaurant context before deciding intent; specials, happy hour, today's menu, and featured dishes are not hours questions unless the caller asks when the restaurant opens or closes.",
      emotionalTemperatureLine:
        "Match the emotional temperature: brighter for greetings and easy reservations, careful for allergies, calm for complaints, and crisp for delivery drivers or vendors.",
      escalationLine: "If a caller asks for refunds, complaints, catering, private events, alcohol policy, or a human, escalate.",
      highlightsLabel: "Menu highlights",
      languageLine: "Use contractions and plain restaurant language. Prefer 'we're open until 10 tonight' over 'the restaurant closes at 10 PM.'",
      manualBookingLine: "Manual reservation requests are not confirmed until staff confirms them.",
      nameContextNoun: "orders and reservations",
      operationalEdgeCasesLine:
        "For wrong numbers, delivery drivers, vendor calls, lost items, order changes, complaints, and human requests, be brief and collect only the details staff need for follow-up.",
      paymentLine: "Never collect raw credit card numbers. Payment is pay at pickup unless a POS payment flow is explicitly connected.",
      personalityLine: "Personality target: sound like a polished restaurant host who is warm, lightly upbeat, calm under pressure, and efficient.",
      requestCollectionLine: "For multi-item orders, acknowledge captured items briefly and ask what else until the caller says they are done.",
      substitutionLine:
        "For substitutions and off-menu requests, use the restaurant policy. If the request is allowed and obvious, note it as a request. If it is uncertain, tell the caller staff must confirm and do not guarantee availability, price, or allergy safety.",
      toolUseLine:
        "Use available tools when you need to look up restaurant policy, capture an order item, submit an order, create a reservation request, or escalate to staff.",
    };
  }

  return {
    appointmentDetailLine:
      `For ${profile.appointmentNoun}, estimate, quote, or callback requests, acknowledge any service need, location, date, time, or urgency the caller already gave and ask only for the missing detail.`,
    contextLine:
      "Use the full business context before deciding intent; services, appointments, quotes, current availability, and policies are not hours questions unless the customer asks when the business opens or closes.",
    emotionalTemperatureLine:
      `Match the emotional temperature: brighter for greetings and easy ${profile.appointmentNoun} requests, careful for urgent or safety-sensitive issues, calm for complaints, and crisp for vendors.`,
    escalationLine:
      "If a caller asks for complaints, refunds, urgent safety issues, emergency service, uncertain pricing, out-of-scope work, or a human, escalate or create a staff callback.",
    highlightsLabel: `${capitalize(profile.offeringNoun)} highlights`,
    languageLine:
      "Use contractions and plain customer-service language. Prefer 'we can have someone call you back shortly' over stiff or robotic phrasing.",
    manualBookingLine:
      `${capitalize(profile.appointmentNoun)} and quote requests are not confirmed until staff confirms them unless the business context explicitly says they can be confirmed automatically.`,
    nameContextNoun: `${profile.appointmentNoun}, service, quote, and callback requests`,
    operationalEdgeCasesLine:
      `For wrong numbers, vendor calls, lost items, existing-job follow-up, complaints, and human requests, be brief and collect only the details ${profile.staffNoun} need for follow-up.`,
    paymentLine:
      "Never collect raw credit card numbers. Payment, deposit, diagnostic, and estimate details must follow the configured business policy.",
    personalityLine:
      `Personality target: sound like a polished ${profile.staffNoun} who is warm, lightly upbeat, calm under pressure, and efficient. ${profile.speechStyleLine}`,
    requestCollectionLine: profile.serviceRequestLine,
    substitutionLine:
      "For unusual services, out-of-scope requests, substitutions, and price-sensitive questions, use the business policy. If uncertain, collect the details for staff confirmation and do not guarantee availability, price, timing, or safety.",
    toolUseLine:
      `Use available tools when you need to look up business policy, send a configured link, create a customer request for ${profile.customerRequestExamples.join(", ")}, or escalate to ${profile.staffNoun}.`,
  };
}

const immediatePlaybookScenarios = new Set([
  "wrong_number",
  "complaint",
  "human_handoff",
  "vendor_sales",
  "donations_press",
  "lost_and_found",
  "employment",
  "delivery_driver",
  "delivery_issue",
  "change_or_cancel",
  "allergy",
  "private_event",
  "large_party",
  "payment",
  "order_status",
]);

function shouldAnswerWithPlaybookImmediately(scenario: string) {
  return immediatePlaybookScenarios.has(scenario);
}

export function withConversationalFollowUp(reply: string, callerUtterance: string) {
  const trimmedReply = reply.trim();
  if (!trimmedReply) return reply;
  if (!shouldAddConversationalFollowUp(trimmedReply, callerUtterance)) return reply;
  return `${trimmedReply} Anything else I can help you with?`;
}

function shouldAddConversationalFollowUp(reply: string, callerUtterance: string) {
  if (reply.includes("?")) return false;
  if (/\b(anything else|something else|what else|can i help you with anything else)\b/i.test(reply)) return false;

  const utterance = callerUtterance.toLowerCase();
  if (
    /\b(allergy|allergic|refund|complaint|manager|human|person|staff|call back|callback|lost|left|forgot|vendor|supplier|sales|delivery driver|doordash|uber eats|grubhub|catering|private event|large party|job|hiring|apply)\b/.test(
      utterance,
    )
  ) {
    return false;
  }

  return true;
}

async function createResponseWithOptionalTools({
  controller,
  env,
  handleToolCall,
  input,
  instructions,
  maxOutputTokens,
  tools,
}: {
  controller: AbortController;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL">;
  handleToolCall?: (toolCall: RestaurantToolCall) => Promise<unknown>;
  input: unknown[];
  instructions: string;
  maxOutputTokens: number;
  tools?: RestaurantResponseTool[];
}) {
  const first = await createOpenAIResponse({
    controller,
    env,
    input,
    instructions,
    maxOutputTokens,
    tools,
  });

  const toolCalls = extractToolCalls(first);
  if (!toolCalls.length || !handleToolCall || !tools?.length) return first;

  const toolOutputs = [];
  for (const toolCall of toolCalls) {
    toolOutputs.push({
      call_id: toolCall.callId,
      output: JSON.stringify(await handleToolCall(toolCall)),
      type: "function_call_output",
    });
  }

  return createOpenAIResponse({
    controller,
    env,
    input: [...input, ...(Array.isArray(first.output) ? first.output : []), ...toolOutputs],
    instructions,
    maxOutputTokens,
    tools,
  });
}

async function createOpenAIResponse({
  controller,
  env,
  input,
  instructions,
  maxOutputTokens,
  tools,
}: {
  controller: AbortController;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL">;
  input: unknown[];
  instructions: string;
  maxOutputTokens: number;
  tools?: RestaurantResponseTool[];
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    signal: controller.signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      max_tool_calls: tools?.length ? 3 : undefined,
      store: false,
      tools: tools?.length ? tools : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI response failed: ${response.status} ${body}`);
  }

  return (await response.json()) as { output_text?: string; output?: unknown[] };
}

function extractToolCalls(data: { output?: unknown[] }): RestaurantToolCall[] {
  return (data.output ?? [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { arguments?: unknown; call_id?: unknown; name?: unknown; type?: unknown };
      if (candidate.type !== "function_call" || typeof candidate.name !== "string" || typeof candidate.call_id !== "string") {
        return null;
      }

      return {
        arguments: parseToolArguments(candidate.arguments),
        callId: candidate.call_id,
        name: candidate.name,
      };
    })
    .filter((toolCall): toolCall is RestaurantToolCall => Boolean(toolCall));
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function fallbackRestaurantReply(callerUtterance: string, context: RestaurantVoiceContext) {
  const reservationClarifyingReply = buildReservationClarifyingReply(callerUtterance, []);
  if (reservationClarifyingReply) return reservationClarifyingReply;

  const playbookReply = matchPhonePlaybookReply(callerUtterance, context);
  if (playbookReply) return playbookReply.text;

  const utterance = callerUtterance.toLowerCase();

  if (utterance.includes("hour") || utterance.includes("open") || utterance.includes("close")) {
    return context.policies.hours;
  }

  if (utterance.includes("allerg") || utterance.includes("gluten") || utterance.includes("dairy")) {
    return "I can note that for the staff, but severe allergies need staff confirmation because cross-contact is possible.";
  }

  if (utterance.includes("reservation") || utterance.includes("table") || utterance.includes("book")) {
    return "I can help with a reservation request. What date, time, party size, and name should I send to the staff?";
  }

  if (utterance.includes("order") || utterance.includes("pickup") || utterance.includes("pizza")) {
    return "I can help with a pickup order. What would you like, and what name should I put it under?";
  }

  if (utterance.includes("parking") || utterance.includes("park")) {
    return context.policies.parking;
  }

  const faqAnswer = findFaqAnswer(callerUtterance, context);
  if (faqAnswer) return faqAnswer;

  const knowledgeAnswer = findKnowledgeAnswer(callerUtterance, context);
  if (knowledgeAnswer) return knowledgeAnswer;

  if (context.businessType && context.businessType !== "restaurant") {
    return `Thanks for calling ${context.restaurantName}. I can help with hours, service questions, appointment requests, quotes, or staff callbacks.`;
  }

  return `Thanks for calling ${context.restaurantName}. I can help with hours, menu questions, pickup orders, or reservation requests.`;
}

export function buildReservationClarifyingReply(callerUtterance: string, transcript: TranscriptTurn[] = []) {
  const activeContext = hasRecentReservationContext(transcript) || isReservationCollectionIntent(callerUtterance);
  const currentDetails = captureReservationDetails(callerUtterance, {
    allowBarePartySize: activeContext,
    requireIntent: false,
  });

  if (!isReservationCollectionIntent(callerUtterance) && !(activeContext && currentDetails)) return null;

  const details = collectReservationDetails(callerUtterance, transcript, activeContext);
  if (completeReservationRequestFromDetails(details)) return null;

  return buildMissingReservationDetailsReply(details, callerUtterance, transcript);
}

function collectReservationDetails(
  callerUtterance: string,
  transcript: TranscriptTurn[],
  initialActiveContext: boolean,
) {
  let details: CapturedReservationDetails | undefined;
  let activeContext = initialActiveContext;
  const callerTexts = transcript
    .slice(-8)
    .filter((turn) => turn.role === "caller")
    .map((turn) => turn.text);

  if (callerTexts.at(-1)?.toLowerCase().trim() !== callerUtterance.toLowerCase().trim()) {
    callerTexts.push(callerUtterance);
  }

  for (const text of callerTexts) {
    if (isReservationCollectionIntent(text) || hasReservationIntent(text)) activeContext = true;
    if (!activeContext) continue;
    details = mergeReservationDetails(
      details,
      captureReservationDetails(text, {
        allowBarePartySize: activeContext,
        requireIntent: false,
      }),
    );
  }

  return details;
}

function buildMissingReservationDetailsReply(
  details: CapturedReservationDetails | undefined,
  callerUtterance: string,
  transcript: TranscriptTurn[],
) {
  const knownPrefix = formatKnownReservationDetails(details, `${transcript.map((turn) => turn.text).join(" ")} ${callerUtterance}`);
  const missing = {
    date: !details?.date,
    partySize: !details?.partySize,
    time: !details?.time,
  };

  if (missing.date && missing.time && missing.partySize) {
    return "Sure, what day and time are you looking for, and how many people?";
  }

  const ask = reservationMissingQuestion(missing);
  return knownPrefix ? `${knownPrefix} ${ask}` : ask;
}

function reservationMissingQuestion(missing: { date: boolean; partySize: boolean; time: boolean }) {
  if (missing.partySize && !missing.date && !missing.time) return "How many people should I check for?";
  if (missing.date && !missing.partySize && !missing.time) return "What night should I check?";
  if (missing.time && !missing.date && !missing.partySize) return "What time are you hoping for?";
  if (missing.partySize && missing.time && !missing.date) return "What time are you hoping for, and how many people?";
  if (missing.partySize && missing.date && !missing.time) return "What night should I check, and how many people?";
  if (missing.date && missing.time && !missing.partySize) return "What day and time are you looking for?";
  return "What else should I add to that reservation request?";
}

function formatKnownReservationDetails(details: CapturedReservationDetails | undefined, sourceText: string) {
  if (!details) return "";

  const date = details.date ? formatReservationDate(details.date, sourceText) : undefined;
  const time = details.time ? formatReservationTime(details.time) : undefined;
  const party = details.partySize ? `${details.partySize} ${details.partySize === 1 ? "person" : "people"}` : undefined;

  if (date && time && party) return `For ${party} at ${time} ${date}, sure.`;
  if (date && time) return `For ${time} ${date}, sure.`;
  if (date && party) return `For ${party} ${date}, sure.`;
  if (time && party) return `For ${party} at ${time}, sure.`;
  if (date) return `For ${date}, sure.`;
  if (time) return `For ${time}, sure.`;
  if (party) return `For ${party}, sure.`;
  return "";
}

function formatReservationDate(date: string, sourceText: string) {
  if (/\b(today|tonight)\b/i.test(sourceText)) return "tonight";
  if (/\btomorrow\b/i.test(sourceText)) return "tomorrow";

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year, month - 1, day));
}

function formatReservationTime(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return time;
  const hour12 = hour24 % 12 || 12;
  return minute ? `${hour12}:${minute.toString().padStart(2, "0")}` : `${hour12}`;
}

function hasRecentReservationContext(transcript: TranscriptTurn[]) {
  return transcript.slice(-6).some((turn) => {
    if (turn.role === "caller") return isReservationCollectionIntent(turn.text) || hasReservationIntent(turn.text);
    return /\b(what day and time|how many people|party size|reservation request|what night|what time)\b/i.test(turn.text);
  });
}

function isReservationCollectionIntent(utterance: string) {
  if (!hasReservationIntent(utterance) && !/\b(availability|available|seat us|fit us in)\b/i.test(utterance)) {
    return false;
  }

  if (/\b(do you take|do you accept|do you have reservations|reservation policy)\b/i.test(utterance)) {
    return false;
  }

  return /\b(make|book|reserve|get|need|want|looking for|availability|available|table for|party of|at \d{1,2})\b/i.test(utterance);
}

const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "at",
  "can",
  "do",
  "does",
  "for",
  "have",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "there",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);

function findFaqAnswer(callerUtterance: string, context: RestaurantVoiceContext) {
  const utteranceTokens = tokenize(callerUtterance);
  if (!utteranceTokens.size) return null;

  let bestScore = 0;
  let bestAnswer: string | null = null;

  for (const faq of context.faqs) {
    const questionTokens = tokenize(faq.question);
    const answerTokens = tokenize(faq.answer);
    const score = scoreTokens(utteranceTokens, questionTokens, 2) + scoreTokens(utteranceTokens, answerTokens, 1);

    if (score > bestScore) {
      bestScore = score;
      bestAnswer = faq.answer;
    }
  }

  return bestScore >= 2 ? bestAnswer : null;
}

function findKnowledgeAnswer(callerUtterance: string, context: RestaurantVoiceContext) {
  const utteranceTokens = tokenize(callerUtterance);
  if (!utteranceTokens.size) return null;

  let bestScore = 0;
  let bestBody: string | null = null;

  for (const section of context.knowledgeSections) {
    const titleTokens = tokenize(section.title);
    const bodyTokens = tokenize(section.body);
    const score = scoreTokens(utteranceTokens, titleTokens, 2) + scoreTokens(utteranceTokens, bodyTokens, 1);

    if (score > bestScore) {
      bestScore = score;
      bestBody = section.body;
    }
  }

  return bestScore >= 2 ? bestBody : null;
}

function scoreTokens(utteranceTokens: Set<string>, candidateTokens: Set<string>, weight: number) {
  let score = 0;

  for (const token of utteranceTokens) {
    if (candidateTokens.has(token)) score += weight;
  }

  return score;
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

export function buildConversationInput(callerUtterance: string, transcript: TranscriptTurn[]): ResponseInputMessage[] {
  const recentTurns = transcript.slice(-8);
  const messages = recentTurns.map((turn) => ({
    content: turn.text,
    role: turn.role === "caller" ? "user" as const : "assistant" as const,
  }));
  const lastTurn = recentTurns.at(-1);
  const currentCallerAlreadyIncluded =
    lastTurn?.role === "caller" && normalizeComparableText(lastTurn.text) === normalizeComparableText(callerUtterance);

  if (!currentCallerAlreadyIncluded) {
    messages.push({
      content: callerUtterance,
      role: "user",
    });
  }

  return messages;
}

function extractOutputText(data: { output_text?: string; output?: unknown[] }) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  for (const item of data.output ?? []) {
    if (!item || typeof item !== "object" || !("content" in item)) continue;
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }

  return null;
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compactSummary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 700 ? normalized : `${normalized.slice(0, 697)}...`;
}
