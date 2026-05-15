import { describe, expect, it } from "vitest";
import type { Call, CallFeedback } from "@/data/mock";
import { buildPilotReadiness } from "./pilot-readiness";

const recentIso = () => new Date(Date.now() - 5 * 60_000).toISOString();

describe("buildPilotReadiness", () => {
  it("blocks the pilot loop until the required service and logging pieces exist", () => {
    const readiness = buildPilotReadiness({
      supabaseConfigured: false,
      voiceConfigured: false,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.requiredReadyCount).toBe(0);
    expect(readiness.nextAction).toContain("Open Render");
  });

  it("marks required pilot checks ready when a recent call has transcript and reporting signal", () => {
    const call = buildCall();
    const readiness = buildPilotReadiness({
      calls: [call],
      feedback: [buildFeedback(call.id)],
      health: {
        ok: true,
        openAIRealtimeSipConfigured: true,
        productionReady: true,
        sharedSmsRoutingConfigured: true,
        supabaseConfigured: true,
      },
      locationId: "loc_1",
      phoneNumbers: [{ forwardingStatus: "verified", phoneNumber: "+15551234567", status: "active" }],
      realtimeConfig: {
        ready: true,
        sipUri: "sip:proj_123@sip.api.openai.com;transport=tls",
        webhookUrl: "https://voice.example.com/openai/realtime/webhook?locationId=loc_1",
      },
      supabaseConfigured: true,
      voiceConfigured: true,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.requiredReadyCount).toBe(readiness.requiredTotal);
    expect(readiness.steps.find((step) => step.id === "feedback_loop")?.status).toBe("ready");
  });

  it("keeps recordings recommended rather than blocking the core pilot loop", () => {
    const call = buildCall({ recordingUrl: undefined });
    const readiness = buildPilotReadiness({
      calls: [call],
      health: {
        ok: true,
        openAIRealtimeSipConfigured: true,
        productionReady: true,
        supabaseConfigured: true,
      },
      locationId: "loc_1",
      phoneNumbers: [{ forwardingStatus: "partial", phoneNumber: "+15551234567", status: "active" }],
      realtimeConfig: { ready: true },
      supabaseConfigured: true,
      voiceConfigured: true,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.steps.find((step) => step.id === "recording_available")?.status).toBe("recommended");
  });
});

function buildCall(overrides: Partial<Call> = {}): Call {
  return {
    caller: "Tim",
    confidence: 94,
    duration: 62,
    id: "call_1",
    intent: "faq",
    interactionInsight: {
      followUpNeeded: false,
      knowledgeGap: false,
      ownerReportBucket: "handled",
      recommendedAction: "No action needed.",
      tags: ["handled"],
      urgency: "normal",
      valueTier: "low",
      workflowStatus: "resolved",
    },
    outcome: "resolved",
    phone: "+17813072672",
    recordingUrl: "https://recordings.example.com/call.mp3",
    status: "resolved",
    summary: "Caller asked about specials.",
    time: recentIso(),
    transcript: [
      { speaker: "agent", t: "00:00", text: "Thank you for calling Olive & Ember. How can I help you?" },
      { speaker: "caller", t: "00:05", text: "Do you have specials tonight?" },
    ],
    ...overrides,
  };
}

function buildFeedback(callId: string): CallFeedback {
  return {
    callId,
    category: "good_answer",
    createdAt: recentIso(),
    id: "fb_1",
  };
}
