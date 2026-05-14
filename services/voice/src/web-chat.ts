import type { CallStore, StaffTaskPriority } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import { HttpRequestError } from "./http-safety";
import { getRuntimeBusinessProfile } from "./business-runtime";
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
  callId?: string;
  conversationId?: string;
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
  callId?: string;
  conversationId: string;
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
      const conversationId = buildWebChatConversationId(input);
      const startedAt = Date.now();
      const chatLog = await startWebChatLog({
        callStore: options.callStore,
        context,
        conversationId,
        input,
      });
      const actions: WebChatAction[] = [];
      const reply = await generateRestaurantReply({
        callerUtterance: message,
        channelInstructions: buildWebChatChannelInstructions(context),
        context,
        env,
        handleToolCall: (toolCall) => handleWebChatToolCall({
          actions,
          callId: chatLog.callId,
          callStore: options.callStore,
          context,
          input,
          toolCall,
        }),
        tools: buildWebChatTools(context),
        transcript,
      });
      const nextTranscript = [
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
      ].slice(-16);

      await persistWebChatExchange({
        actions,
        callId: chatLog.callId,
        callStore: options.callStore,
        context,
        input,
        message,
        reply,
        startedAt,
        transcript: nextTranscript,
      });

      return {
        actions,
        businessName: context.restaurantName,
        callId: chatLog.callId,
        conversationId,
        locationId: input.locationId,
        ok: true,
        reply,
        transcript: nextTranscript,
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
  callId,
  callStore,
  context,
  input,
  toolCall,
}: {
  actions: WebChatAction[];
  callId?: string;
  callStore?: CallStore;
  context: RestaurantVoiceContext;
  input: WebChatMessageInput;
  toolCall: RestaurantToolCall;
}) {
  if (toolCall.name === "get_business_link" || toolCall.name === "send_business_link") {
    return handleBusinessLinkTool({ actions, context, toolCall });
  }

  if (toolCall.name === "create_customer_request") {
    return handleCustomerRequestTool({ actions, callId, callStore, input, toolCall });
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
  callId,
  callStore,
  input,
  toolCall,
}: {
  actions: WebChatAction[];
  callId?: string;
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
    callId,
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

async function startWebChatLog({
  callStore,
  context,
  conversationId,
  input,
}: {
  callStore?: CallStore;
  context: RestaurantVoiceContext;
  conversationId: string;
  input: WebChatMessageInput;
}) {
  if (!callStore) return { callId: input.callId };
  if (input.callId?.trim()) return { callId: input.callId.trim() };

  try {
    const result = await callStore.startRealtimeCall({
      callerName: input.visitorName?.trim() || undefined,
      callerPhone: input.visitorPhone?.trim() || undefined,
      externalCallId: conversationId,
      externalSessionId: input.visitorId?.trim() || conversationId,
      locationId: input.locationId,
      provider: "web_chat",
      providerPayload: {
        businessName: context.restaurantName,
        channel: "web_chat",
        visitorEmail: input.visitorEmail?.trim() || null,
        visitorId: input.visitorId?.trim() || null,
      },
    });
    return { callId: result.callId };
  } catch (error) {
    console.warn("[web-chat] chat log start failed; continuing without persistence", {
      conversationId,
      error,
    });
    return { callId: undefined };
  }
}

async function persistWebChatExchange({
  actions,
  callId,
  callStore,
  context,
  input,
  message,
  reply,
  startedAt,
  transcript,
}: {
  actions: WebChatAction[];
  callId?: string;
  callStore?: CallStore;
  context: RestaurantVoiceContext;
  input: WebChatMessageInput;
  message: string;
  reply: string;
  startedAt: number;
  transcript: WebChatTurn[];
}) {
  if (!callStore || !callId) return;

  try {
    const durationSeconds = estimateWebChatDurationSeconds(transcript, startedAt);
    await callStore.addTranscriptTurn({
      callId,
      offsetSeconds: Math.max(0, durationSeconds - 1),
      speaker: "caller",
      text: message,
    });
    await callStore.addTranscriptTurn({
      callId,
      offsetSeconds: durationSeconds,
      speaker: "agent",
      text: reply,
    });
    await callStore.completeCall({
      callId,
      confidence: actions.length ? 88 : 76,
      durationSeconds,
      intent: inferWebChatIntent(message, actions),
      outcome: inferWebChatOutcome(actions),
      status: actions.some((action) => action.type === "customer_request") ? "needs_review" : "resolved",
      summary: buildWebChatSummary({ actions, context, input, message, reply }),
    });
  } catch (error) {
    console.warn("[web-chat] chat transcript persistence failed", {
      callId,
      error,
    });
  }
}

function buildWebChatConversationId(input: WebChatMessageInput) {
  const existing = sanitizeConversationToken(input.conversationId) ?? sanitizeConversationToken(input.visitorId);
  if (existing?.startsWith("webchat_")) return existing;
  if (existing) return `webchat_${existing}`;
  return `webchat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeConversationToken(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 160);
}

function estimateWebChatDurationSeconds(transcript: WebChatTurn[], fallbackStartedAt: number) {
  const times = transcript
    .map((turn) => Date.parse(turn.at ?? ""))
    .filter((value) => Number.isFinite(value));
  if (times.length >= 2) {
    return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 1000));
  }
  return Math.max(1, Math.round((Date.now() - fallbackStartedAt) / 1000));
}

function inferWebChatIntent(message: string, actions: WebChatAction[]) {
  if (actions.some((action) => action.type === "customer_request" && action.requestType === "order")) return "order";
  if (actions.some((action) => action.type === "customer_request" && action.requestType === "reservation")) return "reservation";
  if (actions.some((action) => action.type === "business_link" && action.link.kind === "ordering")) return "order";
  if (actions.some((action) => action.type === "business_link" && action.link.kind === "reservation")) return "reservation";
  if (/\b(hour|open|close|closing)\b/i.test(message)) return "hours";
  if (/\b(menu|parking|address|directions|special|allergy|price|cost|music|policy|today|tonight)\b/i.test(message)) return "faq";
  return "other";
}

function inferWebChatOutcome(actions: WebChatAction[]) {
  if (actions.some((action) => action.type === "customer_request")) return "message_taken";
  return "resolved";
}

function buildWebChatSummary({
  actions,
  context,
  input,
  message,
  reply,
}: {
  actions: WebChatAction[];
  context: RestaurantVoiceContext;
  input: WebChatMessageInput;
  message: string;
  reply: string;
}) {
  const visitor = input.visitorName?.trim() || input.visitorPhone?.trim() || input.visitorEmail?.trim() || "Website visitor";
  const actionSummary = actions
    .map((action) => {
      if (action.type === "business_link") return `shared ${action.link.label}`;
      return `created ${action.requestType.replace(/_/g, " ")} follow-up`;
    })
    .join("; ");

  return [
    `${visitor} chatted with ${context.restaurantName}: ${compactText(message, 170)}`,
    `SignalHost replied: ${compactText(reply, 190)}`,
    actionSummary && `Action: ${actionSummary}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function compactText(value: string, maxLength: number) {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length <= maxLength ? compacted : `${compacted.slice(0, maxLength - 3)}...`;
}

function buildWebChatChannelInstructions(context: RestaurantVoiceContext) {
  const profile = getRuntimeBusinessProfile(context);
  const linkLines = context.businessLinks.map((link) => `${businessLinkKindLabels[link.kind]}: ${link.label} (${link.url})`);
  return [
    "Channel: website chat, not a phone call.",
    "Use short chat-friendly replies: usually one to three compact sentences.",
    "Do not say anything about hearing the caller, phone audio, holds, transfers, speaking aloud, or texting unless the visitor asks.",
    `Business type: ${profile.businessNoun}. Visitor is a ${profile.customerNoun}. Staff role is ${profile.staffNoun}.`,
    profile.isRestaurant
      ? "Restaurant chat focus: answer menu, hours, reservation, order, allergy, parking, event, and policy questions from the configured context."
      : `Business chat focus: answer ${profile.offeringNoun}, service-area, ${profile.appointmentNoun}, quote, safety, payment, policy, and staff-follow-up questions from the configured context.`,
    "For links, use get_business_link and place the URL directly in the chat reply. Do not say you texted the link.",
    "If a visitor wants staff follow-up, collect their name plus best phone or email, then use create_customer_request.",
    profile.isRestaurant
      ? "For orders, reservations, quotes, and appointments, use a configured link when the business has one; otherwise collect details for staff follow-up."
      : `For ${profile.appointmentNoun}s, quotes, service requests, and callbacks, use a configured link when the business has one; otherwise collect the details ${profile.staffNoun} need for follow-up.`,
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
