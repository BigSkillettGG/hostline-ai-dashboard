import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import {
  buildFailureReply,
  buildGuardrailReply,
  classifyCallerUtterance,
  normalizeCallerUtterance,
} from "./call-guardrails";
import type { CallStore, StaffTaskPriority, StaffTaskType } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import type { GuestConfirmationService } from "./guest-confirmation-service";
import type { StaffAlertKind, StaffNotificationService } from "./notification-service";
import {
  captureCustomerName,
  capturePickupOrder,
  formatCapturedOrderTotal,
  hasOrderIntent,
  hasOrderSubmitIntent,
  mergeCapturedOrderItems,
  summarizeCapturedOrderItems,
  type CapturedOrder,
  type CapturedOrderItem,
} from "./order-intake";
import { captureReservationRequest, hasReservationIntent, type CapturedReservationRequest } from "./reservation-intake";
import { matchPhonePlaybookReply } from "./restaurant-playbook";
import type { RestaurantContextStore } from "./restaurant-context-store";
import { demoRestaurantContext, type RestaurantVoiceContext } from "./restaurant-context";
import {
  generateCallSummary,
  generateRestaurantReply,
  type RestaurantResponseTool,
  type RestaurantToolCall,
} from "./restaurant-agent";
import type {
  ConversationRelayInboundMessage,
  ConversationRelayPromptMessage,
  ConversationRelaySetupMessage,
  ConversationRelayTextMessage,
  TranscriptTurn,
} from "./types";

interface RelaySession {
  id?: string;
  callRecordId?: string;
  callSid?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  locationId?: string;
  orderCustomerName?: string;
  orderCreatedId?: string;
  orderDraftItems: CapturedOrderItem[];
  orderIntentSeen: boolean;
  unclearPromptCount: number;
  reservationCreatedId?: string;
  reservationIntentSeen: boolean;
  reservationRequest?: CapturedReservationRequest;
  staffAlertIntents: Set<StaffAlertKind>;
  staffTaskIntents: Set<StaffAlertKind>;
  startedAt: number;
  needsStaffReview: boolean;
  transcript: TranscriptTurn[];
}

interface PendingSessionCompletion {
  cancelled: boolean;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}

const RESTAURANT_RESPONSE_TOOLS: RestaurantResponseTool[] = [
  {
    description: "Look up restaurant-specific policies, FAQs, menu guidance, or knowledge base details before answering.",
    name: "lookup_policy",
    parameters: {
      additionalProperties: false,
      properties: {
        topic: {
          description: "Short topic to look up, such as parking, allergies, delivery drivers, waitlist, or dress code.",
          type: "string",
        },
      },
      required: ["topic"],
      type: "object",
    },
    type: "function",
  },
  {
    description: "Capture pickup order items mentioned by the caller when deterministic matching missed them.",
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
    description: "Submit the current pickup order draft to the staff review queue when the caller is done ordering.",
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
    description: "Create a manual reservation request for staff confirmation.",
    name: "create_reservation_request",
    parameters: {
      additionalProperties: false,
      properties: {
        date: { description: "Reservation date in YYYY-MM-DD format.", type: "string" },
        guest_name: { type: "string" },
        notes: { type: "string" },
        party_size: { minimum: 1, type: "integer" },
        time: { description: "Reservation time in HH:MM 24-hour format.", type: "string" },
      },
      required: ["date", "party_size", "time"],
      type: "object",
    },
    type: "function",
  },
  {
    description: "Create a staff follow-up task or alert for complaints, handoffs, delivery failures, sales calls, or low-confidence topics.",
    name: "escalate_to_staff",
    parameters: {
      additionalProperties: false,
      properties: {
        details: { type: "string" },
        kind: {
          enum: ["complaint", "delivery_failure", "handoff", "low_confidence", "sales"],
          type: "string",
        },
        summary: { type: "string" },
      },
      required: ["kind", "summary"],
      type: "object",
    },
    type: "function",
  },
];

const RELAY_RECONNECT_GRACE_MS = 20_000;

export function createConversationRelayHandler(
  env: VoiceServiceEnv,
  callStore: CallStore,
  contextStore: RestaurantContextStore,
  staffNotifications: StaffNotificationService,
  guestConfirmations: GuestConfirmationService,
  lifecycle: {
    onSessionCompletion?: (completion: Promise<void>) => void;
  } = {},
) {
  const sessions = new WeakMap<WebSocket, RelaySession>();
  const sessionsByCallSid = new Map<string, RelaySession>();
  const pendingCompletions = new Map<string, PendingSessionCompletion>();

  return function handleConversationRelayConnection(ws: WebSocket, req: IncomingMessage) {
    let session: RelaySession = {
      context: demoRestaurantContext,
      orderDraftItems: [],
      orderIntentSeen: false,
      unclearPromptCount: 0,
      needsStaffReview: false,
      reservationIntentSeen: false,
      staffAlertIntents: new Set(),
      staffTaskIntents: new Set(),
      startedAt: Date.now(),
      transcript: [],
    };
    sessions.set(ws, session);

    console.info("[conversation-relay] connected", req.url);

    ws.on("message", async (data) => {
      const message = parseConversationRelayMessage(data.toString());
      if (!message) return;

      if (message.type === "setup") {
        applySetupMessage(session, message);
        const reconnect = reconnectSessionIfNeeded({
          pendingCompletions,
          session,
          sessionsByCallSid,
        });
        session = reconnect.session;
        sessions.set(ws, session);

        if (reconnect.resumed) {
          console.info("[conversation-relay] resumed existing call session", {
            callSid: session.callSid,
            sessionId: session.id,
            transcriptTurns: session.transcript.length,
          });
          return;
        }

        try {
          session.context = await contextStore.getContext(session.locationId);
        } catch (error) {
          console.error("[conversation-relay] context load failed", error);
        }

        try {
          const result = await callStore.startCall({
            locationId: session.locationId,
            setup: message,
          });
          session.callRecordId = result.callId;
        } catch (error) {
          console.error("[conversation-relay] call start persistence failed", error);
        }

        console.info("[conversation-relay] setup", {
          callSid: session.callSid,
          from: session.callerPhone,
          sessionId: session.id,
        });
        return;
      }

      if (message.type === "prompt") {
        if (message.last === false) return;

        try {
          await handlePromptMessage({
            callStore,
            env,
            guestConfirmations,
            message,
            session,
            staffNotifications,
            ws,
          });
        } catch (error) {
          session.needsStaffReview = true;
          console.error("[conversation-relay] prompt handling failed", {
            callSid: session.callSid,
            error,
            sessionId: session.id,
          });
          const reply = buildFailureReply();
          await maybeCreateSystemFailureTask({ callStore, error, session });
          persistAgentTurn({ callStore, reply, session });
          sendText(ws, reply, message.lang);
        }
        return;
      }

      if (message.type === "interrupt") {
        console.info("[conversation-relay] interrupted", {
          callSid: session.callSid,
          utteranceUntilInterrupt: message.utteranceUntilInterrupt,
        });
        return;
      }

      if (message.type === "dtmf") {
        sendText(ws, "I heard that key press. How can I help from here?");
        return;
      }

      if (message.type === "error") {
        console.warn("[conversation-relay] Twilio error", message.description);
      }
    });

    ws.on("close", (code, reasonBuffer) => {
      const durationSeconds = getSessionOffsetSeconds(session);
      const reason = reasonBuffer.toString();
      const completion = scheduleSessionCompletion({
        callStore,
        pendingCompletions,
        durationSeconds,
        env,
        sessionsByCallSid,
        session,
      }).catch((error) => console.error("[conversation-relay] call close persistence failed", error));
      lifecycle.onSessionCompletion?.(completion);
      void completion;

      console.info("[conversation-relay] closed", {
        callSid: session.callSid,
        closeCode: code,
        durationSeconds,
        reason,
        turns: session.transcript.length,
      });
    });
  };
}

function reconnectSessionIfNeeded({
  pendingCompletions,
  session,
  sessionsByCallSid,
}: {
  pendingCompletions: Map<string, PendingSessionCompletion>;
  session: RelaySession;
  sessionsByCallSid: Map<string, RelaySession>;
}) {
  if (!session.callSid) return { resumed: false, session };

  const pendingCompletion = pendingCompletions.get(session.callSid);
  if (pendingCompletion) {
    pendingCompletion.cancelled = true;
    clearTimeout(pendingCompletion.timer);
    pendingCompletions.delete(session.callSid);
    pendingCompletion.resolve();
  }

  const existingSession = sessionsByCallSid.get(session.callSid);
  if (!existingSession || existingSession === session) {
    sessionsByCallSid.set(session.callSid, session);
    return { resumed: false, session };
  }

  existingSession.id = session.id;
  existingSession.callerPhone = session.callerPhone ?? existingSession.callerPhone;
  existingSession.locationId = session.locationId ?? existingSession.locationId;
  sessionsByCallSid.set(session.callSid, existingSession);

  return { resumed: true, session: existingSession };
}

async function scheduleSessionCompletion({
  callStore,
  pendingCompletions,
  durationSeconds,
  env,
  session,
  sessionsByCallSid,
}: {
  callStore: CallStore;
  pendingCompletions: Map<string, PendingSessionCompletion>;
  durationSeconds: number;
  env: VoiceServiceEnv;
  session: RelaySession;
  sessionsByCallSid: Map<string, RelaySession>;
}) {
  if (!session.callSid) {
    await completeSessionCall({ callStore, durationSeconds, env, session });
    return;
  }

  const callSid = session.callSid;
  const pendingCompletion = await new Promise<PendingSessionCompletion>((resolvePendingCompletion) => {
    const pending: PendingSessionCompletion = {
      cancelled: false,
      resolve: () => undefined,
      timer: setTimeout(() => pending.resolve(), RELAY_RECONNECT_GRACE_MS),
    };
    pending.resolve = () => resolvePendingCompletion(pending);
    pendingCompletions.set(callSid, pending);
  });

  if (pendingCompletion.cancelled || pendingCompletions.get(callSid) !== pendingCompletion) return;
  pendingCompletions.delete(callSid);
  sessionsByCallSid.delete(callSid);

  await completeSessionCall({ callStore, durationSeconds, env, session });
}

async function handlePromptMessage({
  callStore,
  env,
  guestConfirmations,
  message,
  session,
  staffNotifications,
  ws,
}: {
  callStore: CallStore;
  env: VoiceServiceEnv;
  guestConfirmations: GuestConfirmationService;
  message: ConversationRelayPromptMessage;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  ws: WebSocket;
}) {
  const turnStartedAt = Date.now();
  const utterance = normalizeCallerUtterance(message.voicePrompt);
  const classification = classifyCallerUtterance(utterance);

  if (utterance) {
    persistCallerTurn({ callStore, session, utterance });
  }

  if (classification !== "normal") {
    session.unclearPromptCount += classification === "empty" || classification === "connection_issue" ? 1 : 0;
    if (classification === "abusive") session.needsStaffReview = true;
    const reply = buildGuardrailReply({
      classification,
      repeatCount: session.unclearPromptCount,
      restaurantName: session.context.restaurantName,
    });

    if (session.unclearPromptCount >= 2 || classification === "abusive") {
      await maybeCreateStaffFollowUpTask({
        callStore,
        kind: classification === "abusive" ? "complaint" : "low_confidence",
        session,
        utterance: utterance || "Unclear or missing caller audio.",
      });
    }

    persistAgentTurn({ callStore, reply, session });
    sendText(ws, reply, message.lang);
    logTurnComplete({ classification, latencyMs: Date.now() - turnStartedAt, reply, session, utterance });
    return;
  }

  session.unclearPromptCount = 0;

  const escalationKind = classifyEscalationIntent(utterance, session.context);
  void maybeSendEscalationAlert({
    kind: escalationKind,
    session,
    staffNotifications,
    utterance,
  }).catch((error) => console.error("[conversation-relay] staff escalation alert failed", error));
  void maybeCreateStaffFollowUpTask({
    callStore,
    kind: escalationKind,
    session,
    utterance,
  }).catch((error) => console.error("[conversation-relay] staff task persistence failed", error));

  const orderOutcome = await maybeAdvanceStaffReviewOrder({
    callStore,
    guestConfirmations,
    session,
    staffNotifications,
    utterance,
  });
  const createdReservationId = await maybeCreateStaffReviewReservation({
    callStore,
    guestConfirmations,
    session,
    staffNotifications,
    utterance,
  });

  let reply = buildActionReply({
    createdReservationId,
    guestConfirmations,
    orderOutcome,
    session,
  });

  if (!reply) {
    reply = await generateRestaurantReply({
      callerUtterance: utterance,
      context: session.context,
      env,
      handleToolCall: (toolCall) =>
        executeRestaurantTool({
          callStore,
          guestConfirmations,
          session,
          staffNotifications,
          toolCall,
          utterance,
        }),
      tools: RESTAURANT_RESPONSE_TOOLS,
      transcript: session.transcript,
    });
  }

  persistAgentTurn({ callStore, reply, session });
  sendText(ws, reply, message.lang);
  logTurnComplete({ classification, latencyMs: Date.now() - turnStartedAt, reply, session, utterance });
}

export function sendText(ws: WebSocket, token: string, lang?: string) {
  const message: ConversationRelayTextMessage = {
    type: "text",
    token,
    last: true,
    interruptible: true,
    preemptible: true,
    lang,
  };

  ws.send(JSON.stringify(message));
}

function parseConversationRelayMessage(raw: string): ConversationRelayInboundMessage | null {
  try {
    const message = JSON.parse(raw) as ConversationRelayInboundMessage;
    if (!message || typeof message !== "object" || !("type" in message)) {
      console.warn("[conversation-relay] malformed message", raw);
      return null;
    }
    return message;
  } catch {
    console.warn("[conversation-relay] invalid JSON", raw);
    return null;
  }
}

function applySetupMessage(session: RelaySession, message: ConversationRelaySetupMessage) {
  session.id = message.sessionId;
  session.callSid = message.callSid;
  session.callerPhone = message.from;
  session.locationId = message.customParameters?.locationId;
}

function persistCallerTurn({
  callStore,
  session,
  utterance,
}: {
  callStore: CallStore;
  session: RelaySession;
  utterance: string;
}) {
  session.transcript.push({
    role: "caller",
    text: utterance,
    at: new Date().toISOString(),
  });
  void callStore.addTranscriptTurn({
    callId: session.callRecordId,
    offsetSeconds: getSessionOffsetSeconds(session),
    speaker: "caller",
    text: utterance,
  }).catch((error) => console.error("[conversation-relay] caller transcript persistence failed", error));
}

function persistAgentTurn({
  callStore,
  reply,
  session,
}: {
  callStore: CallStore;
  reply: string;
  session: RelaySession;
}) {
  session.transcript.push({
    role: "agent",
    text: reply,
    at: new Date().toISOString(),
  });
  void callStore.addTranscriptTurn({
    callId: session.callRecordId,
    offsetSeconds: getSessionOffsetSeconds(session),
    speaker: "agent",
    text: reply,
  }).catch((error) => console.error("[conversation-relay] agent transcript persistence failed", error));
}

function logTurnComplete({
  classification,
  latencyMs,
  reply,
  session,
  utterance,
}: {
  classification: string;
  latencyMs: number;
  reply: string;
  session: RelaySession;
  utterance: string;
}) {
  console.info("[conversation-relay] turn complete", {
    callSid: session.callSid,
    classification,
    latencyMs,
    orderDraftItemCount: session.orderDraftItems.length,
    promptLength: utterance.length,
    replyLength: reply.length,
    sessionId: session.id,
    transcriptTurns: session.transcript.length,
  });
}

function getSessionOffsetSeconds(session: RelaySession) {
  return (Date.now() - session.startedAt) / 1000;
}

interface StaffCallSummaryInput {
  needsStaffReview?: boolean;
  orderCreatedId?: string;
  orderCustomerName?: string;
  orderDraftItems?: CapturedOrderItem[];
  orderIntentSeen?: boolean;
  reservationCreatedId?: string;
  reservationIntentSeen?: boolean;
  reservationRequest?: CapturedReservationRequest;
  staffAlertIntents?: Iterable<StaffAlertKind>;
  staffTaskIntents?: Iterable<StaffAlertKind>;
  transcript: TranscriptTurn[];
}

export function summarizeCallForStaff(input: StaffCallSummaryInput) {
  const parts: string[] = [];
  const orderItems = input.orderDraftItems ?? [];

  if (input.orderCreatedId && orderItems.length) {
    parts.push(
      `Pickup order submitted${input.orderCustomerName ? ` for ${input.orderCustomerName}` : ""}: ${summarizeCapturedOrderItems(orderItems)}; estimated subtotal ${formatCapturedOrderTotal(orderItems)}.`,
    );
  } else if (orderItems.length) {
    parts.push(`Pickup order draft: ${summarizeCapturedOrderItems(orderItems)}; estimated subtotal ${formatCapturedOrderTotal(orderItems)}.`);
  } else if (input.orderIntentSeen) {
    parts.push("Pickup order discussed, but no menu items were captured.");
  }

  if (input.reservationRequest) {
    parts.push(
      `${input.reservationCreatedId ? "Reservation request submitted" : "Reservation details captured"}: party of ${input.reservationRequest.partySize} on ${input.reservationRequest.date} at ${input.reservationRequest.time}${input.reservationRequest.guestName ? ` for ${input.reservationRequest.guestName}` : ""}.`,
    );
  } else if (input.reservationIntentSeen) {
    parts.push("Reservation discussed, but required details were incomplete.");
  }

  const followUpKinds = Array.from(
    new Set([...(input.staffTaskIntents ?? []), ...(input.staffAlertIntents ?? [])]),
  );
  if (followUpKinds.length) {
    parts.push(`Staff follow-up flagged: ${followUpKinds.map(formatStaffAlertKind).join(", ")}.`);
  } else if (input.needsStaffReview) {
    parts.push("Call marked for staff review.");
  }

  const callerTurns = input.transcript.filter((turn) => turn.role === "caller").map((turn) => turn.text);
  if (callerTurns.length) {
    parts.push(`Caller context: ${callerTurns.slice(-3).join(" / ").slice(0, 260)}.`);
  }

  if (!parts.length) return "Call ended before a caller prompt was captured.";
  return truncateSummary(parts.join(" "));
}

function summarizeSessionForStaff(session: RelaySession) {
  return summarizeCallForStaff(session);
}

async function completeSessionCall({
  callStore,
  durationSeconds,
  env,
  session,
}: {
  callStore: CallStore;
  durationSeconds: number;
  env: VoiceServiceEnv;
  session: RelaySession;
}) {
  const structuredSummary = summarizeSessionForStaff(session);
  const summary = await generateCallSummary({
    context: session.context,
    env,
    structuredSummary,
    transcript: session.transcript,
  });

  await callStore.completeCall({
    callId: session.callRecordId,
    durationSeconds,
    status: session.needsStaffReview || !session.transcript.length ? "needs_review" : "resolved",
    summary,
  });
}

function buildActionReply({
  createdReservationId,
  guestConfirmations,
  orderOutcome,
  session,
}: {
  createdReservationId: string | null;
  guestConfirmations: GuestConfirmationService;
  orderOutcome: { status: "created" | "draft" | "none"; orderId?: string };
  session: RelaySession;
}) {
  const replies: string[] = [];

  if (orderOutcome.status === "created") {
    replies.push(
      `I have sent that pickup order to the staff review queue. Estimated subtotal is ${formatCapturedOrderTotal(session.orderDraftItems)} before tax. It will be pay at pickup.${confirmationReplySuffix(session, guestConfirmations)}`,
    );
  } else if (orderOutcome.status === "draft") {
    replies.push(
      `Got it. I have ${summarizeCapturedOrderItems(session.orderDraftItems)}. Estimated subtotal is ${formatCapturedOrderTotal(session.orderDraftItems)} before tax. What else can I get for you?`,
    );
  }

  if (createdReservationId) {
    replies.push(
      `I have sent that reservation request to staff. It is not confirmed until the restaurant confirms it.${confirmationReplySuffix(session, guestConfirmations)}`,
    );
  }

  return replies.length ? replies.join(" ") : null;
}

async function executeRestaurantTool({
  callStore,
  guestConfirmations,
  session,
  staffNotifications,
  toolCall,
  utterance,
}: {
  callStore: CallStore;
  guestConfirmations: GuestConfirmationService;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  toolCall: RestaurantToolCall;
  utterance: string;
}) {
  if (toolCall.name === "lookup_policy") {
    return lookupPolicyForTool(session.context, stringArg(toolCall.arguments, "topic") ?? utterance);
  }

  if (toolCall.name === "capture_order_items") {
    return captureOrderItemsFromTool(session, toolCall.arguments);
  }

  if (toolCall.name === "submit_pickup_order") {
    const customerName = stringArg(toolCall.arguments, "customer_name");
    if (customerName) session.orderCustomerName = customerName;
    return submitPickupOrderFromTool({
      callStore,
      guestConfirmations,
      notes: stringArg(toolCall.arguments, "notes"),
      session,
      staffNotifications,
    });
  }

  if (toolCall.name === "create_reservation_request") {
    return createReservationFromTool({
      callStore,
      guestConfirmations,
      session,
      staffNotifications,
      toolCall,
    });
  }

  if (toolCall.name === "escalate_to_staff") {
    const kind = staffAlertKindArg(toolCall.arguments, "kind") ?? "handoff";
    const summary = stringArg(toolCall.arguments, "summary") ?? staffAlertSummaryFor(kind);
    const details = stringArg(toolCall.arguments, "details");
    await maybeSendEscalationAlert({
      kind,
      session,
      staffNotifications,
      utterance: [summary, details].filter(Boolean).join(" "),
    });
    await maybeCreateStaffFollowUpTask({
      callStore,
      kind,
      session,
      utterance: [summary, details].filter(Boolean).join(" "),
    });
    return {
      kind,
      status: "escalated",
      summary,
    };
  }

  return {
    error: `Unknown tool: ${toolCall.name}`,
    status: "ignored",
  };
}

function lookupPolicyForTool(context: RestaurantVoiceContext, topic: string) {
  const normalizedTopic = normalizeToolText(topic);
  const policyMatches = Object.entries(context.policies)
    .filter(([key, value]) => value.trim() && scoreToolText(normalizedTopic, `${key} ${value}`) > 0)
    .map(([key, value]) => ({
      answer: value,
      score: scoreToolText(normalizedTopic, `${key} ${value}`),
      title: `Policy: ${key}`,
    }));
  const faqMatches = context.faqs
    .filter((faq) => scoreToolText(normalizedTopic, `${faq.question} ${faq.answer}`) > 0)
    .map((faq) => ({
      answer: faq.answer,
      score: scoreToolText(normalizedTopic, `${faq.question} ${faq.answer}`),
      title: `FAQ: ${faq.question}`,
    }));
  const knowledgeMatches = context.knowledgeSections
    .filter((section) => scoreToolText(normalizedTopic, `${section.title} ${section.body}`) > 0)
    .map((section) => ({
      answer: section.body,
      score: scoreToolText(normalizedTopic, `${section.title} ${section.body}`),
      title: section.title,
    }));
  const matches = [...policyMatches, ...faqMatches, ...knowledgeMatches]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ answer, title }) => ({ answer, title }));

  return {
    matches,
    status: matches.length ? "found" : "not_found",
    topic,
  };
}

function captureOrderItemsFromTool(session: RelaySession, args: Record<string, unknown>) {
  const rawItems = Array.isArray(args.items) ? args.items : [];
  const capturedItems: CapturedOrderItem[] = [];
  const rejectedItems: string[] = [];
  const customerName = stringArg(args, "customer_name");
  if (customerName) session.orderCustomerName = customerName;

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    const requestedName = stringArg(item, "name");
    if (!requestedName) continue;
    const capturedOrder = capturePickupOrder(requestedName, session.context, { requireIntent: false });
    const capturedItem = capturedOrder?.items[0];
    if (!capturedItem) {
      rejectedItems.push(requestedName);
      continue;
    }

    capturedItems.push({
      ...capturedItem,
      modifiers: stringArrayArg(item, "modifiers") ?? capturedItem.modifiers,
      quantity: Math.min(Math.max(numberArg(item, "quantity") ?? capturedItem.quantity, 1), 20),
    });
  }

  if (capturedItems.length) {
    session.orderIntentSeen = true;
    session.orderDraftItems = mergeCapturedOrderItems(session.orderDraftItems, capturedItems);
  }

  return {
    capturedItems,
    draftItems: session.orderDraftItems,
    estimatedSubtotal: formatCapturedOrderTotal(session.orderDraftItems),
    rejectedItems,
    status: capturedItems.length ? "captured" : "no_menu_match",
  };
}

async function submitPickupOrderFromTool({
  callStore,
  guestConfirmations,
  notes,
  session,
  staffNotifications,
}: {
  callStore: CallStore;
  guestConfirmations: GuestConfirmationService;
  notes?: string;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
}) {
  if (session.orderCreatedId) {
    return {
      orderId: session.orderCreatedId,
      status: "already_submitted",
    };
  }

  if (!session.orderDraftItems.length) {
    return {
      message: "No order items have been captured yet.",
      status: "missing_items",
    };
  }

  try {
    const result = await callStore.createStaffReviewOrder({
      callId: session.callRecordId,
      customerName: session.orderCustomerName,
      customerPhone: session.callerPhone,
      etaMinutes: session.context.defaultPickupEtaMinutes ?? 25,
      items: session.orderDraftItems,
      locationId: session.locationId,
      notes: [
        notes,
        "AI-created staff-review pickup order from model tool call. Staff should confirm before kitchen production.",
      ].filter(Boolean).join(" "),
    });
    session.orderCreatedId = result.orderId;
    void maybeSendOrderConfirmation({
      capturedOrder: {
        confidence: 70,
        customerName: session.orderCustomerName,
        items: session.orderDraftItems,
        notes: "AI-created staff-review pickup order from model tool call.",
      },
      guestConfirmations,
      session,
    }).catch((error) => console.error("[conversation-relay] guest order confirmation failed", error));
    void staffNotifications.sendStaffAlert({
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      details: [
        `Items: ${session.orderDraftItems.map((item) => `${item.quantity} ${item.name}`).join(", ")}`,
        `Estimated subtotal: ${formatCapturedOrderTotal(session.orderDraftItems)}`,
        `ETA: ${session.context.defaultPickupEtaMinutes ?? 25} min`,
        "Payment: pay at pickup",
      ],
      kind: "order",
      locationId: session.locationId,
      restaurantName: session.context.restaurantName,
      summary: `Staff-review pickup order created${session.orderCustomerName ? ` for ${session.orderCustomerName}` : ""}.`,
    }).catch((error) => console.error("[conversation-relay] order staff alert failed", error));

    return {
      estimatedSubtotal: formatCapturedOrderTotal(session.orderDraftItems),
      etaMinutes: session.context.defaultPickupEtaMinutes ?? 25,
      orderId: result.orderId,
      paymentMode: "pay_at_pickup",
      status: "submitted",
    };
  } catch (error) {
    console.error("[conversation-relay] tool order submit failed", error);
    return {
      error: error instanceof Error ? error.message : "Order submit failed",
      status: "failed",
    };
  }
}

async function createReservationFromTool({
  callStore,
  guestConfirmations,
  session,
  staffNotifications,
  toolCall,
}: {
  callStore: CallStore;
  guestConfirmations: GuestConfirmationService;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  toolCall: RestaurantToolCall;
}) {
  if (session.reservationCreatedId) {
    return {
      reservationId: session.reservationCreatedId,
      status: "already_submitted",
    };
  }

  const partySize = numberArg(toolCall.arguments, "party_size");
  const date = stringArg(toolCall.arguments, "date");
  const time = stringArg(toolCall.arguments, "time");
  if (!partySize || !date || !time) {
    return {
      message: "Reservation requests need date, time, and party size.",
      status: "missing_details",
    };
  }

  const capturedReservation: CapturedReservationRequest = {
    confidence: 70,
    date,
    guestName: stringArg(toolCall.arguments, "guest_name"),
    notes: stringArg(toolCall.arguments, "notes"),
    partySize,
    time,
  };
  session.reservationIntentSeen = true;
  session.reservationRequest = capturedReservation;

  try {
    const result = await callStore.createStaffReviewReservation({
      ...capturedReservation,
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      locationId: session.locationId,
    });
    session.reservationCreatedId = result.reservationId;
    void maybeSendReservationConfirmation({
      capturedReservation,
      guestConfirmations,
      session,
    }).catch((error) => console.error("[conversation-relay] guest reservation confirmation failed", error));
    void staffNotifications.sendStaffAlert({
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      details: [
        `Party: ${capturedReservation.partySize}`,
        `When: ${capturedReservation.date} at ${capturedReservation.time}`,
        capturedReservation.guestName ? `Name: ${capturedReservation.guestName}` : "Name: not captured",
        capturedReservation.notes ? `Notes: ${capturedReservation.notes}` : "Status: needs staff confirmation",
      ],
      kind: "reservation",
      locationId: session.locationId,
      restaurantName: session.context.restaurantName,
      summary: "Staff-confirmed reservation request captured.",
    }).catch((error) => console.error("[conversation-relay] reservation staff alert failed", error));

    return {
      reservationId: result.reservationId,
      status: "submitted",
    };
  } catch (error) {
    console.error("[conversation-relay] tool reservation submit failed", error);
    return {
      error: error instanceof Error ? error.message : "Reservation submit failed",
      status: "failed",
    };
  }
}

function formatStaffAlertKind(kind: StaffAlertKind) {
  return kind.replaceAll("_", " ");
}

function truncateSummary(value: string) {
  return value.length <= 700 ? value : `${value.slice(0, 697)}...`;
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.round(Number(value));
  return undefined;
}

function stringArrayArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings.map((item) => item.trim()) : undefined;
}

function staffAlertKindArg(args: Record<string, unknown>, key: string): StaffAlertKind | undefined {
  const value = stringArg(args, key);
  if (
    value === "complaint" ||
    value === "delivery_failure" ||
    value === "handoff" ||
    value === "low_confidence" ||
    value === "sales"
  ) {
    return value;
  }
  return undefined;
}

function normalizeToolText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreToolText(topic: string, candidate: string) {
  const topicTokens = new Set(normalizeToolText(topic).split(/\s+/).filter((token) => token.length > 1));
  const candidateTokens = new Set(normalizeToolText(candidate).split(/\s+/).filter((token) => token.length > 1));
  let score = 0;
  for (const token of topicTokens) {
    if (candidateTokens.has(token)) score += 1;
  }
  return score;
}

async function maybeAdvanceStaffReviewOrder({
  callStore,
  guestConfirmations,
  session,
  staffNotifications,
  utterance,
}: {
  callStore: CallStore;
  guestConfirmations: GuestConfirmationService;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  utterance: string;
}): Promise<{ status: "created" | "draft" | "none"; orderId?: string }> {
  if (session.orderCreatedId || !session.callRecordId) return { status: "none" };

  if (hasOrderIntent(utterance)) {
    session.orderIntentSeen = true;
  }

  const capturedName = captureCustomerName(utterance);
  if (capturedName) {
    session.orderCustomerName = capturedName;
  }

  const capturedOrder = capturePickupOrder(utterance, session.context, {
    requireIntent: !session.orderIntentSeen,
  });

  if (capturedOrder) {
    session.orderDraftItems = mergeCapturedOrderItems(session.orderDraftItems, capturedOrder.items);
    if (capturedOrder.customerName) session.orderCustomerName = capturedOrder.customerName;
  }

  if (!session.orderDraftItems.length) return { status: "none" };

  const submitOrder =
    hasOrderSubmitIntent(utterance) ||
    Boolean(session.orderCustomerName && capturedOrder && capturedOrder.items.length > 1);

  if (!submitOrder) return { status: "draft" };

  try {
    const result = await callStore.createStaffReviewOrder({
      callId: session.callRecordId,
      customerName: session.orderCustomerName,
      customerPhone: session.callerPhone,
      etaMinutes: session.context.defaultPickupEtaMinutes ?? 25,
      items: session.orderDraftItems,
      locationId: session.locationId,
      notes: `AI-created staff-review pickup order. Staff should confirm before kitchen production. Confidence: ${
        capturedOrder?.confidence ?? 75
      }%.`,
    });

    session.orderCreatedId = result.orderId;
    void maybeSendOrderConfirmation({
      capturedOrder: {
        confidence: capturedOrder?.confidence ?? 75,
        customerName: session.orderCustomerName,
        items: session.orderDraftItems,
        notes: "AI-created staff-review pickup order. Staff should confirm before kitchen production.",
      },
      guestConfirmations,
      session,
    }).catch((error) => console.error("[conversation-relay] guest order confirmation failed", error));
    void staffNotifications.sendStaffAlert({
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      details: [
        `Items: ${session.orderDraftItems.map((item) => `${item.quantity} ${item.name}`).join(", ")}`,
        `ETA: ${session.context.defaultPickupEtaMinutes ?? 25} min`,
        `Payment: pay at pickup`,
      ],
      kind: "order",
      locationId: session.locationId,
      restaurantName: session.context.restaurantName,
      summary: `Staff-review pickup order created${session.orderCustomerName ? ` for ${session.orderCustomerName}` : ""}.`,
    }).catch((error) => console.error("[conversation-relay] order staff alert failed", error));
    return { orderId: result.orderId, status: "created" };
  } catch (error) {
    console.error("[conversation-relay] staff-review order persistence failed", error);
    return { status: "none" };
  }
}

async function maybeCreateStaffReviewReservation({
  callStore,
  guestConfirmations,
  session,
  staffNotifications,
  utterance,
}: {
  callStore: CallStore;
  guestConfirmations: GuestConfirmationService;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  utterance: string;
}) {
  if (session.reservationCreatedId || !session.callRecordId) return null;

  const intentInUtterance = hasReservationIntent(utterance);
  if (intentInUtterance) {
    session.reservationIntentSeen = true;
  }

  const capturedReservation = captureReservationRequest(utterance, {
    requireIntent: !session.reservationIntentSeen,
  });
  if (!capturedReservation) return null;
  session.reservationRequest = capturedReservation;

  try {
    const result = await callStore.createStaffReviewReservation({
      ...capturedReservation,
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      locationId: session.locationId,
    });

    session.reservationCreatedId = result.reservationId;
    void maybeSendReservationConfirmation({
      capturedReservation,
      guestConfirmations,
      session,
    }).catch((error) => console.error("[conversation-relay] guest reservation confirmation failed", error));
    void staffNotifications.sendStaffAlert({
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      details: [
        `Party: ${capturedReservation.partySize}`,
        `When: ${capturedReservation.date} at ${capturedReservation.time}`,
        capturedReservation.guestName ? `Name: ${capturedReservation.guestName}` : "Name: not captured",
        capturedReservation.notes ? `Notes: ${capturedReservation.notes}` : "Status: needs staff confirmation",
      ],
      kind: "reservation",
      locationId: session.locationId,
      restaurantName: session.context.restaurantName,
      summary: "Staff-confirmed reservation request captured.",
    }).catch((error) => console.error("[conversation-relay] reservation staff alert failed", error));
    return result.reservationId ?? null;
  } catch (error) {
    console.error("[conversation-relay] reservation request persistence failed", error);
    return null;
  }
}

async function maybeSendOrderConfirmation({
  capturedOrder,
  guestConfirmations,
  session,
}: {
  capturedOrder: CapturedOrder;
  guestConfirmations: GuestConfirmationService;
  session: RelaySession;
}) {
  if (!shouldSendGuestConfirmation(session, guestConfirmations)) return;

  await guestConfirmations.sendOrderConfirmation({
    customerName: capturedOrder.customerName,
    etaMinutes: session.context.defaultPickupEtaMinutes ?? 25,
    items: session.orderDraftItems,
    orderId: session.orderCreatedId,
    restaurantName: session.context.restaurantName,
    to: session.callerPhone,
  });
}

async function maybeSendReservationConfirmation({
  capturedReservation,
  guestConfirmations,
  session,
}: {
  capturedReservation: CapturedReservationRequest;
  guestConfirmations: GuestConfirmationService;
  session: RelaySession;
}) {
  if (!shouldSendGuestConfirmation(session, guestConfirmations)) return;

  await guestConfirmations.sendReservationConfirmation({
    date: capturedReservation.date,
    guestName: capturedReservation.guestName,
    partySize: capturedReservation.partySize,
    reservationId: session.reservationCreatedId,
    restaurantName: session.context.restaurantName,
    time: capturedReservation.time,
    to: session.callerPhone,
  });
}

function shouldSendGuestConfirmation(session: RelaySession, guestConfirmations: GuestConfirmationService) {
  return Boolean(session.context.smsConfirmationsEnabled && guestConfirmations.configured && session.callerPhone);
}

function confirmationReplySuffix(session: RelaySession, guestConfirmations: GuestConfirmationService) {
  return shouldSendGuestConfirmation(session, guestConfirmations) ? " I will text you a confirmation." : "";
}

async function maybeSendEscalationAlert({
  kind,
  session,
  staffNotifications,
  utterance,
}: {
  kind: StaffAlertKind | null;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  utterance: string;
}) {
  if (!kind || session.staffAlertIntents.has(kind)) return;

  session.staffAlertIntents.add(kind);
  await staffNotifications.sendStaffAlert({
    callId: session.callRecordId,
    callerPhone: session.callerPhone,
    details: [`Caller said: ${utterance.slice(0, 260)}`],
    kind,
    locationId: session.locationId,
    restaurantName: session.context.restaurantName,
    severity: kind === "complaint" ? "high" : "medium",
    summary: staffAlertSummaryFor(kind),
  });
}

async function maybeCreateStaffFollowUpTask({
  callStore,
  kind,
  session,
  utterance,
}: {
  callStore: CallStore;
  kind: StaffAlertKind | null;
  session: RelaySession;
  utterance: string;
}) {
  if (!kind || session.staffTaskIntents.has(kind)) return;

  session.staffTaskIntents.add(kind);
  session.needsStaffReview = true;

  await callStore.createStaffTask({
    body: buildStaffTaskBody(kind, utterance),
    callId: session.callRecordId,
    dueMinutes: staffTaskDueMinutesFor(kind),
    locationId: session.locationId,
    priority: staffTaskPriorityFor(kind),
    title: staffTaskTitleFor(kind),
    type: staffTaskTypeFor(kind),
  });
}

async function maybeCreateSystemFailureTask({
  callStore,
  error,
  session,
}: {
  callStore: CallStore;
  error: unknown;
  session: RelaySession;
}) {
  if (session.staffTaskIntents.has("low_confidence")) return;
  session.staffTaskIntents.add("low_confidence");

  await callStore.createStaffTask({
    body: `Voice service prompt handling failed. ${error instanceof Error ? error.message : String(error)}`,
    callId: session.callRecordId,
    dueMinutes: 10,
    locationId: session.locationId,
    priority: "urgent",
    title: "Review failed live call",
    type: "low_confidence_review",
  });
}

export function classifyEscalationIntent(
  utterance: string,
  context: RestaurantVoiceContext = demoRestaurantContext,
): StaffAlertKind | null {
  const normalized = utterance.toLowerCase();

  if (/\b(refund|complain|complaint|wrong order|incorrect|bad service|terrible|upset|angry|fuck|shit|bullshit|asshole|useless)\b/.test(normalized)) {
    return "complaint";
  }

  if (/\b(doordash|uber eats|grubhub|delivery app).{0,60}\b(missing|wrong|late|never arrived|never delivered|not delivered|refund)\b/.test(normalized)) {
    return "delivery_failure";
  }

  if (/\b(sales|vendor|supplier|wholesale|marketing|advertising|seo|linen|produce|distributor|beer rep|wine rep)\b/.test(normalized)) {
    return "sales";
  }

  if (
    /\b(cater|catering|private event|buyout|large party|wedding|corporate|banquet|alcohol|liquor|wine|cocktail|allergen|allergy|allergic|gluten|celiac|dairy|nut|peanut|shellfish)\b/.test(normalized)
  ) {
    return "low_confidence";
  }

  if (/\b(human|person|someone|staff|owner|manager|call me back|callback|call back|lost and found|lost my|left my|forgot my|job|hiring|application|resume|cancel|change|modify|reschedule)\b/.test(normalized)) {
    return "handoff";
  }

  const playbookMatch = matchPhonePlaybookReply(utterance, context);
  if (playbookMatch?.staffAlertKind) return playbookMatch.staffAlertKind;

  return null;
}

function staffAlertSummaryFor(kind: StaffAlertKind) {
  if (kind === "complaint") return "Complaint or refund risk detected.";
  if (kind === "delivery_failure") return "Delivery app or order handoff issue detected.";
  if (kind === "low_confidence") return "Caller asked about a topic that needs staff review.";
  if (kind === "sales") return "Vendor or sales call captured.";
  return "Caller asked for a human handoff.";
}

function staffTaskTitleFor(kind: StaffAlertKind) {
  if (kind === "complaint") return "Call back complaint guest";
  if (kind === "delivery_failure") return "Review delivery issue";
  if (kind === "low_confidence") return "Review low-confidence call";
  if (kind === "sales") return "Review vendor message";
  return "Follow up with caller";
}

function staffTaskTypeFor(kind: StaffAlertKind): StaffTaskType {
  if (kind === "complaint" || kind === "handoff") return "manager_callback";
  if (kind === "delivery_failure") return "delivery_issue";
  if (kind === "low_confidence") return "low_confidence_review";
  return "general";
}

function staffTaskPriorityFor(kind: StaffAlertKind): StaffTaskPriority {
  if (kind === "complaint") return "urgent";
  if (kind === "delivery_failure") return "high";
  if (kind === "handoff") return "high";
  if (kind === "sales") return "low";
  return "normal";
}

function staffTaskDueMinutesFor(kind: StaffAlertKind) {
  if (kind === "complaint") return 10;
  if (kind === "delivery_failure") return 15;
  if (kind === "handoff") return 15;
  if (kind === "sales") return 240;
  return 45;
}

function buildStaffTaskBody(kind: StaffAlertKind, utterance: string) {
  return [
    staffAlertSummaryFor(kind),
    `Caller said: ${utterance.slice(0, 500)}`,
  ].join("\n");
}
