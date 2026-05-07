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
import { generateRestaurantReply } from "./restaurant-agent";
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

export function createConversationRelayHandler(
  env: VoiceServiceEnv,
  callStore: CallStore,
  contextStore: RestaurantContextStore,
  staffNotifications: StaffNotificationService,
  guestConfirmations: GuestConfirmationService,
) {
  const sessions = new WeakMap<WebSocket, RelaySession>();

  return function handleConversationRelayConnection(ws: WebSocket, req: IncomingMessage) {
    const session: RelaySession = {
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

    ws.on("close", () => {
      const durationSeconds = getSessionOffsetSeconds(session);
      void callStore.completeCall({
        callId: session.callRecordId,
        durationSeconds,
        status: session.needsStaffReview || !session.transcript.length ? "needs_review" : "resolved",
        summary: summarizeSessionForStaff(session),
      }).catch((error) => console.error("[conversation-relay] call close persistence failed", error));

      console.info("[conversation-relay] closed", {
        callSid: session.callSid,
        durationSeconds,
        turns: session.transcript.length,
      });
    });
  };
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

function formatStaffAlertKind(kind: StaffAlertKind) {
  return kind.replaceAll("_", " ");
}

function truncateSummary(value: string) {
  return value.length <= 700 ? value : `${value.slice(0, 697)}...`;
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
