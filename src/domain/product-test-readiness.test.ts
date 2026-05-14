import { describe, expect, it } from "vitest";
import { buildProductTestReadiness } from "./product-test-readiness";

describe("buildProductTestReadiness", () => {
  it("makes demo mode explicit instead of pretending live calls are available", () => {
    const readiness = buildProductTestReadiness({
      authMode: "demo",
      authReady: false,
      liveEnabled: false,
      onboardingProgressPercent: 84,
      supabaseConfigured: false,
      voiceServiceConfigured: false,
    });

    expect(readiness.overallStatus).toBe("demo_mode");
    expect(readiness.headline).toContain("Demo mode");
    expect(readiness.nextItem.id).toBe("workspace");
    expect(readiness.items.find((item) => item.id === "call_logging")?.status).toBe("demo");
  });

  it("marks the core loop ready when live voice, logs, reports, billing, and a real number are configured", () => {
    const readiness = buildProductTestReadiness({
      assignedPhoneNumber: "+1 (617) 555-0199",
      authMode: "supabase",
      authReady: true,
      businessName: "Olive & Ember",
      hasWebsiteUrl: true,
      liveEnabled: true,
      locationId: "loc_123",
      openTaskCount: 2,
      recentCallCount: 4,
      selectedPlanName: "Growth",
      supabaseConfigured: true,
      voiceHealth: {
        ok: true,
        openAIVoiceConfigured: true,
        openaiConfigured: true,
        ownerReportDeliveryConfigured: true,
        ownerReportsConfigured: true,
        productionReady: true,
        service: "signalhost-voice",
        stripeBillingConfigured: true,
        supabaseConfigured: true,
        tenantProvisioningConfigured: true,
        twilioProvisioningConfigured: true,
        twilioSignatureRequired: true,
      },
      voiceServiceConfigured: true,
    });

    expect(readiness.overallStatus).toBe("ready_to_test");
    expect(readiness.readyCount).toBe(readiness.totalCount);
    expect(readiness.nextItem.id).toBe("test_suite");
    expect(readiness.nextItem.actionTo).toBe("/app/test-suite");
  });

  it("surfaces missing voice environment without blocking the live-data diagnosis", () => {
    const readiness = buildProductTestReadiness({
      assignedPhoneNumber: "+1 (617) 555-0199",
      authMode: "supabase",
      authReady: true,
      liveEnabled: true,
      locationId: "loc_123",
      recentCallCount: 0,
      supabaseConfigured: true,
      voiceHealth: {
        ok: true,
        openAIVoiceConfigured: false,
        openaiConfigured: true,
        readinessChecks: [
          { detail: "Missing secret", id: "voice", label: "OpenAI voice", ready: false, required: true },
        ],
        service: "signalhost-voice",
        supabaseConfigured: true,
        twilioSignatureRequired: true,
      },
      voiceServiceConfigured: true,
    });

    const voice = readiness.items.find((item) => item.id === "voice");
    const logs = readiness.items.find((item) => item.id === "call_logging");

    expect(readiness.overallStatus).toBe("ready_to_test");
    expect(voice?.status).toBe("partial");
    expect(voice?.detail).toContain("OpenAI voice");
    expect(logs?.status).toBe("partial");
  });
});
