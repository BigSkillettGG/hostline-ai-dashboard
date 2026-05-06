import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { CallStore, StaffTaskPriority, StaffTaskType } from "./call-store";
import type { VoiceServiceEnv } from "./env";
import type { StaffAlertKind, StaffNotificationService } from "./notification-service";
import { capturePickupOrder, mergeCapturedOrderItems, type CapturedOrderItem } from "./order-intake";
import { captureReservationRequest, hasReservationIntent } from "./reservation-intake";
import type { RestaurantContextStore } from "./restaurant-context-store";
import { demoRestaurantContext } from "./restaurant-context";
import { generateRestaurantReply } from "./restaurant-agent";
import type {
  ConversationRelayInboundMessage,
  ConversationRelaySetupMessage,
  ConversationRelayTextMessage,
  TranscriptTurn,
} from "./types";

interface RelaySession {
  id?: string;
  callRecordId?: string;
  callSid?: string;
  callerPhone?: string;
  context: typeof demoRestaurantContext;
  locationId?: string;
  orderCreatedId?: string;
  orderDraftItems: CapturedOrderItem[];
  reservationCreatedId?: string;
  reservationIntentSeen: boolean;
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
) {
  const sessions = new WeakMap<WebSocket, RelaySession>();

  return function handleConversationRelayConnection(ws: WebSocket, req: IncomingMessage) {
    const session: RelaySession = {
      context: demoRestaurantContext,
      orderDraftItems: [],
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

        session.transcript.push({
          role: "caller",
          text: message.voicePrompt,
          at: new Date().toISOString(),
        });
        void callStore.addTranscriptTurn({
          callId: session.callRecordId,
          offsetSeconds: getSessionOffsetSeconds(session),
          speaker: "caller",
          text: message.voicePrompt,
        }).catch((error) => console.error("[conversation-relay] caller transcript persistence failed", error));

        let reply = await generateRestaurantReply({
          callerUtterance: message.voicePrompt,
          context: session.context,
          env,
          transcript: session.transcript,
        });
        const escalationKind = classifyEscalationIntent(message.voicePrompt);
        void maybeSendEscalationAlert({
          kind: escalationKind,
          session,
          staffNotifications,
          utterance: message.voicePrompt,
        }).catch((error) => console.error("[conversation-relay] staff escalation alert failed", error));
        void maybeCreateStaffFollowUpTask({
          callStore,
          kind: escalationKind,
          session,
          utterance: message.voicePrompt,
        }).catch((error) => console.error("[conversation-relay] staff task persistence failed", error));

        const createdOrderId = await maybeCreateStaffReviewOrder({
          callStore,
          session,
          staffNotifications,
          utterance: message.voicePrompt,
        });

        if (createdOrderId) {
          reply = `${reply} I have sent that pickup order to the staff review queue. It will be pay at pickup.`;
        }

        const createdReservationId = await maybeCreateStaffReviewReservation({
          callStore,
          session,
          staffNotifications,
          utterance: message.voicePrompt,
        });

        if (createdReservationId) {
          reply = `${reply} I have sent that reservation request to staff. It is not confirmed until the restaurant confirms it.`;
        }

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

        sendText(ws, reply, message.lang);
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
        summary: summarizeTranscript(session.transcript),
      }).catch((error) => console.error("[conversation-relay] call close persistence failed", error));

      console.info("[conversation-relay] closed", {
        callSid: session.callSid,
        durationSeconds,
        turns: session.transcript.length,
      });
    });
  };
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

function getSessionOffsetSeconds(session: RelaySession) {
  return (Date.now() - session.startedAt) / 1000;
}

function summarizeTranscript(transcript: TranscriptTurn[]) {
  const callerTurns = transcript.filter((turn) => turn.role === "caller");
  const lastCallerTurn = callerTurns.at(-1);
  if (!lastCallerTurn) return "Call ended before a caller prompt was captured.";
  return `Caller asked: ${lastCallerTurn.text.slice(0, 220)}`;
}

async function maybeCreateStaffReviewOrder({
  callStore,
  session,
  staffNotifications,
  utterance,
}: {
  callStore: CallStore;
  session: RelaySession;
  staffNotifications: StaffNotificationService;
  utterance: string;
}) {
  if (session.orderCreatedId || !session.callRecordId) return null;

  const capturedOrder = capturePickupOrder(utterance, session.context);
  if (!capturedOrder) return null;

  session.orderDraftItems = mergeCapturedOrderItems(session.orderDraftItems, capturedOrder.items);
  if (!session.orderDraftItems.length) return null;

  try {
    const result = await callStore.createStaffReviewOrder({
      callId: session.callRecordId,
      customerName: capturedOrder.customerName,
      customerPhone: session.callerPhone,
      etaMinutes: session.context.defaultPickupEtaMinutes ?? 25,
      items: session.orderDraftItems,
      locationId: session.locationId,
      notes: `${capturedOrder.notes} Confidence: ${capturedOrder.confidence}%.`,
    });

    session.orderCreatedId = result.orderId;
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
      summary: `Staff-review pickup order created${capturedOrder.customerName ? ` for ${capturedOrder.customerName}` : ""}.`,
    }).catch((error) => console.error("[conversation-relay] order staff alert failed", error));
    return result.orderId ?? null;
  } catch (error) {
    console.error("[conversation-relay] staff-review order persistence failed", error);
    return null;
  }
}

async function maybeCreateStaffReviewReservation({
  callStore,
  session,
  staffNotifications,
  utterance,
}: {
  callStore: CallStore;
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

  try {
    const result = await callStore.createStaffReviewReservation({
      ...capturedReservation,
      callId: session.callRecordId,
      callerPhone: session.callerPhone,
      locationId: session.locationId,
    });

    session.reservationCreatedId = result.reservationId;
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

export function classifyEscalationIntent(utterance: string): StaffAlertKind | null {
  const normalized = utterance.toLowerCase();

  if (/\b(refund|complain|complaint|wrong order|incorrect|bad service|terrible|upset|angry)\b/.test(normalized)) {
    return "complaint";
  }

  if (
    /\b(cater|catering|private event|buyout|large party|wedding|corporate|banquet|alcohol|liquor|wine|cocktail|allergen|allergy|allergic|gluten|celiac|dairy|nut|peanut|shellfish)\b/.test(normalized)
  ) {
    return "low_confidence";
  }

  if (/\b(human|person|someone|staff|owner|manager|call me back|callback|call back)\b/.test(normalized)) {
    return "handoff";
  }

  return null;
}

function staffAlertSummaryFor(kind: StaffAlertKind) {
  if (kind === "complaint") return "Complaint or refund risk detected.";
  if (kind === "low_confidence") return "Caller asked about a topic that needs staff review.";
  return "Caller asked for a human handoff.";
}

function staffTaskTitleFor(kind: StaffAlertKind) {
  if (kind === "complaint") return "Call back complaint guest";
  if (kind === "low_confidence") return "Review low-confidence call";
  return "Follow up with caller";
}

function staffTaskTypeFor(kind: StaffAlertKind): StaffTaskType {
  if (kind === "complaint" || kind === "handoff") return "manager_callback";
  if (kind === "low_confidence") return "low_confidence_review";
  return "general";
}

function staffTaskPriorityFor(kind: StaffAlertKind): StaffTaskPriority {
  if (kind === "complaint") return "urgent";
  if (kind === "handoff") return "high";
  return "normal";
}

function staffTaskDueMinutesFor(kind: StaffAlertKind) {
  if (kind === "complaint") return 10;
  if (kind === "handoff") return 15;
  return 45;
}

function buildStaffTaskBody(kind: StaffAlertKind, utterance: string) {
  return [
    staffAlertSummaryFor(kind),
    `Caller said: ${utterance.slice(0, 500)}`,
  ].join("\n");
}
