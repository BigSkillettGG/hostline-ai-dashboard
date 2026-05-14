import {
  businessLinkKindLabels,
  findBusinessLink,
  normalizeCustomerRequestKind,
  type BusinessLink,
  type CustomerRequestKind,
} from "../../../src/domain/business-links";
import { getRuntimeBusinessProfile } from "./business-runtime";
import type { VoiceServiceEnv } from "./env";
import { HttpRequestError } from "./http-safety";
import { buildRestaurantLocalTimeContext, lookupBusinessContext, lookupRestaurantContext } from "./openai-realtime-sip";
import type { RestaurantVoiceContext } from "./restaurant-context";
import {
  generateRestaurantReply,
  type RestaurantResponseTool,
  type RestaurantToolCall,
} from "./restaurant-agent";
import type { TranscriptTurn } from "./types";

export type AgentTestChannel = "phone" | "website_chat";

export interface AgentTestTurn {
  at?: string;
  role: "assistant" | "user";
  text: string;
}

export interface AgentTestReplyInput {
  channel?: AgentTestChannel;
  locationId?: string;
  message?: string;
  scenarioId?: string;
  transcript?: AgentTestTurn[];
}

export type AgentTestAction =
  | {
      link: BusinessLink;
      type: "business_link";
    }
  | {
      kind: string;
      type: "guest_confirmation";
    }
  | {
      requestType: CustomerRequestKind;
      type: "customer_request";
      urgency?: string;
    }
  | {
      kind: string;
      type: "staff_callback";
      urgency?: string;
    }
  | {
      type: "reservation_request";
    }
  | {
      itemCount: number;
      type: "order_capture";
    }
  | {
      type: "pickup_order";
    }
  | {
      reason?: string;
      type: "finish_call";
    };

export interface AgentTestReplyResult {
  actions: AgentTestAction[];
  businessName: string;
  channel: AgentTestChannel;
  locationId?: string;
  ok: boolean;
  reply: string;
  transcript: AgentTestTurn[];
}

export async function generateAgentTestReply({
  context,
  env,
  input,
}: {
  context: RestaurantVoiceContext;
  env: Pick<VoiceServiceEnv, "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_REPLY_TIMEOUT_MS">;
  input: AgentTestReplyInput;
}): Promise<AgentTestReplyResult> {
  const message = input.message?.trim();
  if (!message) {
    throw new HttpRequestError(400, "message is required.");
  }
  if (message.length > 1200) {
    throw new HttpRequestError(400, "message must be 1200 characters or fewer.");
  }

  const channel = input.channel === "website_chat" ? "website_chat" : "phone";
  const transcript = normalizeAgentTestTranscript(input.transcript);
  const actions: AgentTestAction[] = [];
  const reply = await generateRestaurantReply({
    callerUtterance: message,
    channelInstructions: buildAgentTestInstructions(context, channel, input.scenarioId),
    context,
    env,
    handleToolCall: (toolCall) => handleAgentTestToolCall({
      actions,
      channel,
      context,
      toolCall,
    }),
    tools: buildAgentTestTools(context, channel),
    transcript,
  });

  return {
    actions,
    businessName: context.restaurantName,
    channel,
    locationId: input.locationId,
    ok: true,
    reply,
    transcript: [
      ...transcript.map(toAgentTestTurn),
      {
        at: new Date().toISOString(),
        role: "user" as const,
        text: message,
      },
      {
        at: new Date().toISOString(),
        role: "assistant" as const,
        text: reply,
      },
    ].slice(-16),
  };
}

export function buildAgentTestTools(
  context: RestaurantVoiceContext,
  channel: AgentTestChannel = "phone",
): RestaurantResponseTool[] {
  const profile = getRuntimeBusinessProfile(context);
  const lookupName = profile.isRestaurant ? "lookup_restaurant_context" : "lookup_business_context";
  const tools: RestaurantResponseTool[] = [
    {
      description: profile.isRestaurant
        ? "Look up restaurant facts, policies, FAQs, menu highlights, specials, hours, parking, reservations, pickup, payment, allergy, delivery, lost item, complaint, vendor, or human handoff details before answering."
        : `Look up ${profile.businessNoun} facts, policies, FAQs, ${profile.offeringNoun} highlights, service area, hours, ${profile.appointmentNoun}s, quote policy, payment, safety, complaint, vendor, or human handoff details before answering.`,
      name: lookupName,
      parameters: {
        additionalProperties: false,
        properties: {
          topic: {
            type: "string",
          },
        },
        required: ["topic"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Send a configured business link after the caller asks for it or agrees to receive it by text.",
      name: channel === "website_chat" ? "get_business_link" : "send_business_link",
      parameters: {
        additionalProperties: false,
        properties: {
          link_kind: {
            enum: Object.keys(businessLinkKindLabels),
            type: "string",
          },
          phone_number: {
            type: "string",
          },
        },
        required: ["link_kind"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Create a simulated staff-facing customer request for leads, service appointments, quotes, order requests, reservation requests, callbacks, or other workflows.",
      name: "create_customer_request",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: { type: "string" },
          caller_name: { type: "string" },
          details: {
            additionalProperties: true,
            type: "object",
          },
          request_type: {
            enum: ["callback", "complaint", "general", "lead", "order", "quote", "reservation", "service_appointment"],
            type: "string",
          },
          summary: { type: "string" },
          urgency: {
            enum: ["low", "normal", "high", "urgent"],
            type: "string",
          },
        },
        required: ["request_type", "summary"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Create a simulated staff callback for severe allergies, unknown answers, complaints, human requests, unavailable items, unusual substitutions, or anything staff must confirm.",
      name: "request_staff_callback",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: { type: "string" },
          caller_name: { type: "string" },
          kind: {
            enum: ["allergy", "complaint", "delivery_failure", "handoff", "low_confidence", "order", "reservation", "sales"],
            type: "string",
          },
          question: { type: "string" },
          reason: { type: "string" },
          urgency: {
            enum: ["low", "medium", "high"],
            type: "string",
          },
        },
        required: ["kind", "reason"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Send a simulated caller-approved confirmation or helpful follow-up text.",
      name: "send_guest_confirmation",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: { type: "string" },
          kind: {
            enum: ["appointment", "order", "quote", "request", "reservation", "note"],
            type: "string",
          },
          message: { type: "string" },
          phone_number: { type: "string" },
        },
        required: ["kind"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Save a simulated restaurant reservation request after collecting date, time, party size, and guest name.",
      name: "create_reservation_request",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: { type: "string" },
          notes: { type: "string" },
          party_size: { type: "number" },
          phone_number: { type: "string" },
          reservation_date: { type: "string" },
          reservation_time: { type: "string" },
        },
        required: ["guest_name", "party_size", "reservation_date", "reservation_time"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Capture pickup order items mentioned by the caller.",
      name: "capture_order_items",
      parameters: {
        additionalProperties: false,
        properties: {
          customer_name: { type: "string" },
          items: {
            items: {
              additionalProperties: false,
              properties: {
                modifiers: {
                  items: { type: "string" },
                  type: "array",
                },
                name: { type: "string" },
                quantity: { minimum: 1, type: "integer" },
              },
              required: ["name", "quantity"],
              type: "object",
            },
            type: "array",
          },
        },
        required: ["items"],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Submit the simulated pickup order after the caller is done ordering.",
      name: "submit_pickup_order",
      parameters: {
        additionalProperties: false,
        properties: {
          customer_name: { type: "string" },
          notes: { type: "string" },
        },
        required: [],
        type: "object",
      },
      type: "function",
    },
    {
      description: "Finish the simulated phone call only after the caller clearly says they are done or says goodbye.",
      name: "finish_call",
      parameters: {
        additionalProperties: false,
        properties: {
          closing_line: { type: "string" },
          reason: {
            enum: ["caller_done", "caller_goodbye", "wrong_number_complete", "silent_or_abandoned"],
            type: "string",
          },
        },
        required: ["reason"],
        type: "object",
      },
      type: "function",
    },
  ];

  return tools
    .filter((tool) => context.businessLinks.length || !["get_business_link", "send_business_link"].includes(tool.name))
    .filter((tool) => profile.isRestaurant || !["capture_order_items", "submit_pickup_order", "create_reservation_request"].includes(tool.name))
    .filter((tool) => channel === "phone" || tool.name !== "finish_call");
}

export async function handleAgentTestToolCall({
  actions,
  channel,
  context,
  toolCall,
}: {
  actions: AgentTestAction[];
  channel: AgentTestChannel;
  context: RestaurantVoiceContext;
  toolCall: RestaurantToolCall;
}) {
  const profile = getRuntimeBusinessProfile(context);
  const lookupName = profile.isRestaurant ? "lookup_restaurant_context" : "lookup_business_context";

  if (toolCall.name === lookupName || toolCall.name === "lookup_policy") {
    return profile.isRestaurant
      ? lookupRestaurantContext(context, toolCall.arguments.topic)
      : lookupBusinessContext(context, toolCall.arguments.topic);
  }

  if (toolCall.name === "get_business_link" || toolCall.name === "send_business_link") {
    const link = findBusinessLink(context.businessLinks, toolCall.arguments.link_kind);
    if (!link) {
      return {
        ok: false,
        message: "No configured link matches that request. Offer staff follow-up instead of inventing a URL.",
      };
    }

    actions.push({
      link,
      type: "business_link",
    });

    return channel === "website_chat"
      ? {
          label: link.label,
          message: `Use this link directly in your reply: ${link.label} - ${link.url}`,
          ok: true,
          url: link.url,
        }
      : {
          label: link.label,
          message: `Simulated text of ${link.label}. Tell the caller it is sent.`,
          ok: true,
          sentToLastFour: stringArg(toolCall.arguments, "phone_number")?.slice(-4) ?? "caller ID",
          url: link.url,
        };
  }

  if (toolCall.name === "send_guest_confirmation") {
    const kind = stringArg(toolCall.arguments, "kind") ?? "note";
    actions.push({
      kind,
      type: "guest_confirmation",
    });
    return {
      kind,
      message: "Simulated text confirmation. Tell the caller the text is sent.",
      ok: true,
      sentToLastFour: stringArg(toolCall.arguments, "phone_number")?.slice(-4) ?? "caller ID",
    };
  }

  if (toolCall.name === "request_staff_callback" || toolCall.name === "escalate_to_staff") {
    const kind = stringArg(toolCall.arguments, "kind") ?? "handoff";
    const urgency = stringArg(toolCall.arguments, "urgency");
    actions.push({
      kind,
      type: "staff_callback",
      urgency,
    });
    return {
      kind,
      message: "Simulated staff callback request. Tell the caller staff will call them back shortly.",
      ok: true,
      urgency,
    };
  }

  if (toolCall.name === "create_customer_request") {
    const requestType = normalizeCustomerRequestKind(toolCall.arguments.request_type);
    const urgency = stringArg(toolCall.arguments, "urgency");
    actions.push({
      requestType,
      type: "customer_request",
      urgency,
    });
    return {
      message: `Simulated ${requestType} request saved for staff follow-up.`,
      ok: true,
      requestType,
      urgency,
    };
  }

  if (toolCall.name === "create_reservation_request") {
    actions.push({
      type: "reservation_request",
    });
    return {
      message: "Simulated reservation request saved for staff confirmation.",
      ok: true,
      status: "staff_confirmation_needed",
    };
  }

  if (toolCall.name === "capture_order_items") {
    const itemCount = Array.isArray(toolCall.arguments.items) ? toolCall.arguments.items.length : 0;
    actions.push({
      itemCount,
      type: "order_capture",
    });
    return {
      itemCount,
      message: "Simulated order items captured.",
      ok: true,
    };
  }

  if (toolCall.name === "submit_pickup_order") {
    actions.push({
      type: "pickup_order",
    });
    return {
      message: "Simulated pickup order sent to staff.",
      ok: true,
      status: "staff_review",
    };
  }

  if (toolCall.name === "finish_call") {
    const reason = stringArg(toolCall.arguments, "reason");
    actions.push({
      reason,
      type: "finish_call",
    });
    return {
      message: "Simulated phone call finish. Say the closing line and stop.",
      ok: true,
      reason,
    };
  }

  return {
    message: `Unknown tool: ${toolCall.name}`,
    ok: false,
  };
}

function buildAgentTestInstructions(
  context: RestaurantVoiceContext,
  channel: AgentTestChannel,
  scenarioId?: string,
) {
  const profile = getRuntimeBusinessProfile(context);
  const linkLines = context.businessLinks.map((link) => `${businessLinkKindLabels[link.kind]}: ${link.label} (${link.url})`);

  if (channel === "website_chat") {
    return [
      "Channel: Scenario Lab website chat simulation.",
      "Answer exactly as the website visitor should see it in chat. The dashboard tool calls are safe simulations.",
      "Use short chat-friendly replies: usually one to three compact sentences.",
      "Do not say anything about hearing the caller, phone audio, holds, transfers, speaking aloud, or texting unless the visitor asks.",
      `Current ${profile.businessNoun} local time: ${buildRestaurantLocalTimeContext(context)}.`,
      "For links, use get_business_link and place the URL directly in the chat reply. Do not say you texted the link.",
      "If staff follow-up is needed, collect the best phone or email, then use create_customer_request.",
      linkLines.length ? `Configured links available: ${linkLines.join(" | ")}` : "No website links are configured yet.",
      scenarioId && `Scenario Lab case id: ${scenarioId}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "Channel: Scenario Lab live phone simulation.",
    "Answer exactly as SignalHost should sound to a real caller. The dashboard tool calls are safe simulations.",
    `Current ${profile.businessNoun} local time: ${buildRestaurantLocalTimeContext(context)}. Use this for today, tonight, tomorrow, open-now, and booking-date questions.`,
    "This is one continuous phone call. Do not repeat the opening greeting unless the transcript is empty and the caller only said hello.",
    "Keep the voice warm, lightly upbeat, specific to the caller's question, and never IVR-like.",
    "After answering any normal question or completing any task, ask a short loop-closing question such as 'Can I help you with anything else?' unless the caller already clearly said goodbye.",
    "If the caller says no, no thanks, that's all, that's it, I'm good, or similar after a loop-closing question, use finish_call with a short closing line like 'Thanks for calling. Goodbye.'",
    "If a tool result says simulated, do not use the word simulated with the caller. Speak as if this is the live caller experience.",
    linkLines.length ? `Configured links available for texts: ${linkLines.join(" | ")}` : "No textable business links are configured yet.",
    scenarioId && `Scenario Lab case id: ${scenarioId}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeAgentTestTranscript(turns?: AgentTestTurn[]): TranscriptTurn[] {
  return (turns ?? [])
    .slice(-12)
    .map((turn) => ({
      at: turn.at ?? new Date().toISOString(),
      role: turn.role === "assistant" ? "agent" as const : "caller" as const,
      text: String(turn.text ?? "").trim().slice(0, 1000),
    }))
    .filter((turn) => turn.text);
}

function toAgentTestTurn(turn: TranscriptTurn): AgentTestTurn {
  return {
    at: turn.at,
    role: turn.role === "agent" ? "assistant" : "user",
    text: turn.text,
  };
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
