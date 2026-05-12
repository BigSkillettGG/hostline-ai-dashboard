import type { CallStore, StaffTaskPriority } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import { HttpRequestError } from "./http-safety";
import type { RestaurantVoiceContext } from "./restaurant-context";
import type { RestaurantContextStore } from "./restaurant-context-store";
import {
  generateRestaurantReply,
  type RestaurantResponseTool,
  type RestaurantToolCall,
} from "./restaurant-agent";
import type { TranscriptTurn } from "./types";
import {
  businessLinkKindLabels,
  findBusinessLink,
  normalizeCustomerRequestKind,
  type BusinessLink,
  type CustomerRequestKind,
} from "../../../src/domain/business-links";

export interface WebChatTurn {
  at?: string;
  role: "assistant" | "user";
  text: string;
}

export interface WebChatMessageInput {
  locationId?: string;
  message?: string;
  transcript?: WebChatTurn[];
  visitorEmail?: string;
  visitorId?: string;
  visitorName?: string;
  visitorPhone?: string;
}

export type WebChatAction =
  | {
      link: BusinessLink;
      type: "business_link";
    }
  | {
      requestId?: string;
      requestType: CustomerRequestKind;
      taskId?: string;
      type: "customer_request";
    };

export interface WebChatMessageResult {
  actions: WebChatAction[];
  businessName: string;
  locationId?: string;
  ok: boolean;
  reply: string;
  transcript: WebChatTurn[];
}

export function createWebChatService(
  env: VoiceServiceEnv,
  restaurantContextStore: RestaurantContextStore,
  options: { callStore?: CallStore } = {},
) {
  return {
    async handleMessage(input: WebChatMessageInput): Promise<WebChatMessageResult> {
      const message = input.message?.trim();
      if (!message) {
        throw new HttpRequestError(400, "message is required.");
      }
      if (message.length > 1200) {
        throw new HttpRequestError(400, "message must be 1200 characters or fewer.");
      }

      const context = await restaurantContextStore.getContext(input.locationId);
      const transcript = normalizeWebChatTranscript(input.transcript);
      const actions: WebChatAction[] = [];
      const reply = await generateRestaurantReply({
        callerUtterance: message,
        channelInstructions: buildWebChatChannelInstructions(context),
        context,
        env,
        handleToolCall: (toolCall) => handleWebChatToolCall({
          actions,
          callStore: options.callStore,
          context,
          input,
          toolCall,
        }),
        tools: buildWebChatTools(context),
        transcript,
      });

      return {
        actions,
        businessName: context.restaurantName,
        locationId: input.locationId,
        ok: true,
        reply,
        transcript: [
          ...transcript.map(toWebChatTurn),
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
    },
  };
}

function buildWebChatTools(context: RestaurantVoiceContext): RestaurantResponseTool[] {
  const tools: RestaurantResponseTool[] = [
    {
      description: "Return a configured business link to the website visitor in chat.",
      name: "get_business_link",
      parameters: {
        additionalProperties: false,
        properties: {
          link_kind: {
            description: "The kind of link the visitor needs.",
            enum: Object.keys(businessLinkKindLabels),
            type: "string",
          },
        },
        required: ["link_kind"],
        type: "object",
      },
      strict: false,
      type: "function",
    },
    {
      description: "Create a staff follow-up request for a website visitor.",
      name: "create_customer_request",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: {
            description: "Best phone number for staff follow-up.",
            type: "string",
          },
          customer_email: {
            description: "Best email for staff follow-up.",
            type: "string",
          },
          customer_name: {
            description: "Visitor name, if provided.",
            type: "string",
          },
          details: {
            additionalProperties: true,
            description: "Useful structured details about the request.",
            type: "object",
          },
          request_type: {
            enum: [
              "callback",
              "complaint",
              "general",
              "lead",
              "order",
              "quote",
              "reservation",
              "service_appointment",
            ],
            type: "string",
          },
          summary: {
            description: "One-sentence staff-facing summary.",
            type: "string",
          },
          urgency: {
            enum: ["low", "normal", "high", "urgent"],
            type: "string",
          },
        },
        required: ["request_type", "summary"],
        type: "object",
      },
      strict: false,
      type: "function",
    },
  ];

  return tools.filter((tool) => context.businessLinks.length || tool.name !== "get_business_link");
}

async function handleWebChatToolCall({
  actions,
  callStore,
  context,
  input,
  toolCall,
}: {
  actions: WebChatAction[];
  callStore?: CallStore;
  context: RestaurantVoiceContext;
  input: WebChatMessageInput;
  toolCall: RestaurantToolCall;
}) {
  if (toolCall.name === "get_business_link" || toolCall.name === "send_business_link") {
    return handleBusinessLinkTool({ actions, context, toolCall });
  }

  if (toolCall.name === "create_customer_request") {
    return handleCustomerRequestTool({ actions, callStore, input, toolCall });
  }

  return {
    ok: false,
    message: `Unknown tool: ${toolCall.name}`,
  };
}

function handleBusinessLinkTool({
  actions,
  context,
  toolCall,
}: {
  actions: WebChatAction[];
  context: RestaurantVoiceContext;
  toolCall: RestaurantToolCall;
}) {
  const link = findBusinessLink(context.businessLinks, toolCall.arguments.link_kind);
  if (!link) {
    return {
      ok: false,
      message: "No configured link is available for that request. Offer to collect contact details for staff follow-up.",
    };
  }

  actions.push({
    link,
    type: "business_link",
  });

  return {
    label: link.label,
    ok: true,
    url: link.url,
    message: `Use this link directly in your reply: ${link.label} - ${link.url}`,
  };
}

async function handleCustomerRequestTool({
  actions,
  callStore,
  input,
  toolCall,
}: {
  actions: WebChatAction[];
  callStore?: CallStore;
  input: WebChatMessageInput;
  toolCall: RestaurantToolCall;
}) {
  const requestType = normalizeCustomerRequestKind(toolCall.arguments.request_type);
  const summary = stringArgument(toolCall.arguments.summary);
  if (!summary) {
    return {
      ok: false,
      message: "Ask one short clarifying question so staff get a useful summary.",
    };
  }

  const customerPhone = stringArgument(toolCall.arguments.callback_phone) ?? input.visitorPhone?.trim();
  const customerEmail = stringArgument(toolCall.arguments.customer_email) ?? input.visitorEmail?.trim();
  if (!customerPhone && !customerEmail) {
    return {
      ok: false,
      message: "Collect the visitor's best phone or email before saving a staff follow-up request.",
    };
  }

  const result = await callStore?.createCustomerRequest({
    customerName: stringArgument(toolCall.arguments.customer_name) ?? input.visitorName,
    customerPhone,
    details: {
      ...(objectArgument(toolCall.arguments.details) ?? {}),
      channel: "web_chat",
      customerEmail,
      visitorId: input.visitorId,
    },
    locationId: input.locationId,
    priority: normalizePriority(toolCall.arguments.urgency, requestType),
    requestType,
    summary,
  }) ?? {};

  actions.push({
    requestId: result.requestId,
    requestType,
    taskId: result.taskId,
    type: "customer_request",
  });

  return {
    ok: true,
    requestId: result.requestId,
    requestType,
    taskId: result.taskId,
  };
}

function buildWebChatChannelInstructions(context: RestaurantVoiceContext) {
  const linkLines = context.businessLinks.map((link) => `${businessLinkKindLabels[link.kind]}: ${link.label} (${link.url})`);
  return [
    "Channel: website chat, not a phone call.",
    "Use short chat-friendly replies: usually one to three compact sentences.",
    "Do not say anything about hearing the caller, phone audio, holds, transfers, speaking aloud, or texting unless the visitor asks.",
    "For links, use get_business_link and place the URL directly in the chat reply. Do not say you texted the link.",
    "If a visitor wants staff follow-up, collect their name plus best phone or email, then use create_customer_request.",
    "For orders, reservations, quotes, and appointments, use a configured link when the business has one; otherwise collect details for staff follow-up.",
    linkLines.length ? `Configured links available for this business: ${linkLines.join(" | ")}` : "No website links are configured yet.",
  ].join("\n");
}

function normalizeWebChatTranscript(turns?: WebChatTurn[]): TranscriptTurn[] {
  return (turns ?? [])
    .slice(-12)
    .map((turn) => ({
      at: turn.at ?? new Date().toISOString(),
      role: turn.role === "assistant" ? "agent" as const : "caller" as const,
      text: String(turn.text ?? "").trim().slice(0, 1000),
    }))
    .filter((turn) => turn.text);
}

function toWebChatTurn(turn: TranscriptTurn): WebChatTurn {
  return {
    at: turn.at,
    role: turn.role === "agent" ? "assistant" : "user",
    text: turn.text,
  };
}

function stringArgument(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function objectArgument(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function normalizePriority(value: unknown, requestType: CustomerRequestKind): StaffTaskPriority {
  if (value === "low" || value === "normal" || value === "high" || value === "urgent") return value;
  if (requestType === "complaint") return "urgent";
  if (requestType === "callback" || requestType === "lead" || requestType === "quote") return "high";
  return "normal";
}
