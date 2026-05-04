import type { VoiceServiceEnv } from "./env";
import type { RestaurantVoiceContext } from "./restaurant-context";
import type { TranscriptTurn } from "./types";

export interface GenerateRestaurantReplyInput {
  callerUtterance: string;
  context: RestaurantVoiceContext;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL">;
  transcript: TranscriptTurn[];
}

export async function generateRestaurantReply(input: GenerateRestaurantReplyInput) {
  if (!input.env.OPENAI_API_KEY) {
    return fallbackRestaurantReply(input.callerUtterance, input.context);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.env.OPENAI_MODEL,
        instructions: buildRestaurantInstructions(input.context),
        input: buildConversationInput(input.callerUtterance, input.transcript),
        max_output_tokens: 160,
        store: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI response failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as { output_text?: string; output?: unknown[] };
    return extractOutputText(data) ?? fallbackRestaurantReply(input.callerUtterance, input.context);
  } catch (error) {
    console.error("[voice-agent] Falling back after OpenAI error", error);
    return fallbackRestaurantReply(input.callerUtterance, input.context);
  }
}

export function buildRestaurantInstructions(context: RestaurantVoiceContext) {
  return [
    `You are ${context.hostName}, the virtual host for ${context.restaurantName}.`,
    "Sound warm, concise, and natural on the phone.",
    "Keep replies under two short sentences unless confirming an order.",
    "Never collect raw credit card numbers. Payment is pay at pickup unless a POS payment flow is explicitly connected.",
    "Never guarantee allergen safety. Severe allergies require staff confirmation.",
    "If a caller asks for refunds, complaints, catering, private events, alcohol policy, or a human, escalate.",
    "Manual reservation requests are not confirmed until staff confirms them.",
    `Menu highlights: ${context.menuHighlights.join(", ")}.`,
    `Policies: ${Object.entries(context.policies)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ")}`,
  ].join("\n");
}

export function fallbackRestaurantReply(callerUtterance: string, context: RestaurantVoiceContext) {
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

  return `Thanks for calling ${context.restaurantName}. I can help with hours, menu questions, pickup orders, or reservation requests.`;
}

function buildConversationInput(callerUtterance: string, transcript: TranscriptTurn[]) {
  const recentTurns = transcript
    .slice(-8)
    .map((turn) => `${turn.role === "caller" ? "Caller" : "Host"}: ${turn.text}`)
    .join("\n");

  return `${recentTurns ? `${recentTurns}\n` : ""}Caller: ${callerUtterance}\nHost:`;
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
