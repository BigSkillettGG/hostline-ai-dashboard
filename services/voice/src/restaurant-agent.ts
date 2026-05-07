import type { VoiceServiceEnv } from "./env";
import { matchPhonePlaybookReply } from "./restaurant-playbook";
import type { RestaurantVoiceContext } from "./restaurant-context";
import type { TranscriptTurn } from "./types";

export interface ResponseInputMessage {
  content: string;
  role: "assistant" | "user";
}

export interface GenerateRestaurantReplyInput {
  callerUtterance: string;
  context: RestaurantVoiceContext;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_REPLY_TIMEOUT_MS">;
  transcript: TranscriptTurn[];
}

export async function generateRestaurantReply(input: GenerateRestaurantReplyInput) {
  const playbookReply = matchPhonePlaybookReply(input.callerUtterance, input.context);
  if (playbookReply) {
    console.info("[voice-agent] playbook reply generated", {
      replyLength: playbookReply.text.length,
      scenario: playbookReply.scenario,
    });
    return playbookReply.text;
  }

  if (!input.env.OPENAI_API_KEY) {
    return fallbackRestaurantReply(input.callerUtterance, input.context);
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.env.OPENAI_REPLY_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      signal: controller.signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.env.OPENAI_MODEL,
        instructions: buildRestaurantInstructions(input.context),
        input: buildConversationInput(input.callerUtterance, input.transcript),
        max_output_tokens: 220,
        store: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI response failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { output_text?: string; output?: unknown[] };
    const reply = extractOutputText(data) ?? fallbackRestaurantReply(input.callerUtterance, input.context);
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
    return fallbackRestaurantReply(input.callerUtterance, input.context);
  } finally {
    clearTimeout(timeout);
  }
}

export function buildRestaurantInstructions(context: RestaurantVoiceContext) {
  const faqLines = context.faqs
    .slice(0, 16)
    .map((faq) => `Q: ${faq.question} A: ${faq.answer}`)
    .join(" | ");
  const knowledgeLines = context.knowledgeSections
    .slice(0, 12)
    .map((section) => `${section.title}: ${section.body}`)
    .join(" | ");

  return [
    `You are ${context.hostName}, the virtual host for ${context.restaurantName}.`,
    "Sound warm, concise, and natural on the phone.",
    "Expect callers with accents, noisy phone audio, fragments, and corrections. Ask one short clarifying question when needed.",
    "Keep replies under two short sentences unless confirming an order.",
    "For multi-item orders, acknowledge captured items briefly and ask what else until the caller says they are done.",
    "If a caller is rude, stay calm and helpful. Do not argue, shame, or mirror profanity.",
    "For wrong numbers, delivery drivers, vendor calls, lost items, order changes, complaints, and human requests, be brief and collect only the details staff need for follow-up.",
    "Never collect raw credit card numbers. Payment is pay at pickup unless a POS payment flow is explicitly connected.",
    "Never guarantee allergen safety. Severe allergies require staff confirmation.",
    "If a caller asks for refunds, complaints, catering, private events, alcohol policy, or a human, escalate.",
    "Manual reservation requests are not confirmed until staff confirms them.",
    `Menu highlights: ${context.menuHighlights.join(", ")}.`,
    faqLines && `FAQs: ${faqLines}`,
    knowledgeLines && `Knowledge sections: ${knowledgeLines}`,
    `Policies: ${Object.entries(context.policies)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ")}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function fallbackRestaurantReply(callerUtterance: string, context: RestaurantVoiceContext) {
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

  return `Thanks for calling ${context.restaurantName}. I can help with hours, menu questions, pickup orders, or reservation requests.`;
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
