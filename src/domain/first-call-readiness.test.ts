import { describe, expect, it } from "vitest";
import { buildFirstCallReadiness } from "./first-call-readiness";

describe("buildFirstCallReadiness", () => {
  it("surfaces the first missing automatic setup action", () => {
    const readiness = buildFirstCallReadiness({
      locationId: "",
      voiceConfigured: false,
    });

    expect(readiness.autoReady).toBe(false);
    expect(readiness.missingCount).toBe(readiness.totalCount);
    expect(readiness.nextAction).toBe("Voice service URL is present in the dashboard environment.");
  });

  it("marks the automatic checklist ready before manual Twilio setup", () => {
    const readiness = buildFirstCallReadiness({
      health: {
        ok: true,
        onboardedContextConfigured: true,
        openAIVoiceConfigured: true,
        openaiConfigured: true,
        productionReady: true,
        readinessChecks: [],
        supabaseConfigured: true,
        twilioProvisioningConfigured: true,
        twilioSignatureRequired: true,
      },
      liveCallConfig: {
        conversationRelayUrl: "wss://voice.example.com/twilio/conversation-relay",
        voiceWebhookUrl: "https://voice.example.com/twilio/voice?locationId=loc_1",
      },
      locationId: "loc_1",
      twimlPreview: "<Response><Connect><ConversationRelay /></Connect></Response>",
      voiceConfigured: true,
    });

    expect(readiness.autoReady).toBe(true);
    expect(readiness.readyCount).toBe(readiness.totalCount);
    expect(readiness.nextAction).toContain("https://voice.example.com/twilio/voice?locationId=loc_1");
    expect(readiness.manualSteps.map((step) => step.status)).toEqual(["manual", "manual"]);
  });

  it("lists missing production readiness labels in the service-check detail", () => {
    const readiness = buildFirstCallReadiness({
      health: {
        ok: true,
        openAIVoiceConfigured: true,
        openaiConfigured: true,
        readinessChecks: [
          { label: "OpenAI replies", ready: true, required: true },
          { label: "Twilio signatures", ready: false, required: true },
          { label: "Staff alerts", ready: false, required: false },
        ],
      },
      locationId: "loc_1",
      voiceConfigured: true,
    });

    expect(readiness.steps.find((step) => step.id === "production_readiness")?.detail).toBe("Missing: Twilio signatures.");
  });
});
