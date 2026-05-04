import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { CallStore } from "./call-store";
import type { VoiceServiceEnv } from "./env";
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
  startedAt: number;
  transcript: TranscriptTurn[];
}

export function createConversationRelayHandler(env: VoiceServiceEnv, callStore: CallStore) {
  const sessions = new WeakMap<WebSocket, RelaySession>();

  return function handleConversationRelayConnection(ws: WebSocket, req: IncomingMessage) {
    const session: RelaySession = { startedAt: Date.now(), transcript: [] };
    sessions.set(ws, session);

    console.info("[conversation-relay] connected", req.url);

    ws.on("message", async (data) => {
      const message = parseConversationRelayMessage(data.toString());
      if (!message) return;

      if (message.type === "setup") {
        applySetupMessage(session, message);
        try {
          const result = await callStore.startCall({
            locationId: message.customParameters?.locationId,
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

        const reply = await generateRestaurantReply({
          callerUtterance: message.voicePrompt,
          context: demoRestaurantContext,
          env,
          transcript: session.transcript,
        });

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
        status: session.transcript.length ? "resolved" : "needs_review",
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
