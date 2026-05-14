import { describe, expect, it } from "vitest";
import { businessTemplates } from "./business-templates";
import { buildPostInterviewLaunchGuide, buildWebsiteChatSnippet, normalizePhoneLineType } from "./launch-guide";
import { assignedDemoPhoneNumber, createOnboardingDraftForBusiness } from "./onboarding";

describe("post-interview launch guide", () => {
  it("builds a website snippet with the location and vertical prompts", () => {
    const snippet = buildWebsiteChatSnippet({
      appBaseUrl: "https://signalhost.ai/",
      businessName: "RidgeLine Roofing",
      locationId: "loc_123",
      template: businessTemplates.roofing,
      voiceServiceUrl: "https://voice.signalhost.ai/",
    });

    expect(snippet).toContain('src="https://signalhost.ai/signalhost-chat.js"');
    expect(snippet).toContain('data-location-id="loc_123"');
    expect(snippet).toContain("Can I request an inspection?");
    expect(snippet).not.toContain("Can I make a reservation?");
  });

  it("tailors phone forwarding instructions for mobile lines", () => {
    const draft = createOnboardingDraftForBusiness("restaurant", {
      assignedSignalHostNumber: "+16175550199",
      forwardingMode: "Forward only unanswered calls",
      mainPhone: "+16175550100",
      phoneLineType: "Mobile phone",
      phoneProvider: "Verizon",
      websitePlatform: "Squarespace",
    });
    const guide = buildPostInterviewLaunchGuide({
      assignedNumber: "+16175550199",
      businessName: "Olive & Ember",
      draft,
      locationId: "loc_123",
      template: businessTemplates.restaurant,
      voiceServiceUrl: "https://voice.signalhost.ai",
    });

    expect(guide.phoneForwarding.setupLabel).toBe("Mobile phone with Verizon");
    expect(guide.phoneForwarding.steps.join(" ")).toContain("mobile phone");
    expect(guide.phoneForwarding.providerScript).toContain("Verizon");
    expect(guide.websiteChat.steps.join(" ")).toContain("Squarespace");
  });

  it("warns when launch information is missing", () => {
    const guide = buildPostInterviewLaunchGuide({
      assignedNumber: assignedDemoPhoneNumber,
      businessName: "Summit Air",
      draft: createOnboardingDraftForBusiness("hvac", {
        assignedSignalHostNumber: assignedDemoPhoneNumber,
        mainPhone: "",
        phoneLineType: "",
        websitePlatform: "",
      }),
      template: businessTemplates.hvac,
    });

    expect(guide.readinessWarnings).toEqual(
      expect.arrayContaining([
        "Add the current business main line before forwarding.",
        "Choose mobile, landline, VoIP, or not sure so setup instructions match the phone system.",
        "Assign a real SignalHost number before forwarding customer calls.",
      ]),
    );
  });

  it("carries owner-control answers into the launch packet", () => {
    const draft = createOnboardingDraftForBusiness("roofing", {
      alertPreferenceRules: "Active leaks text owner and production manager immediately.",
      ownerReportPreferences: "Daily report at 6 PM and weekly storm report Monday morning.",
      unknownAnswerPolicy: "Do not guess; collect the question, address, photos, and callback number.",
      knowledgeApprovalPolicy: "Owner approves permanent knowledge",
      liveUpdateRules: "Storm mode expires when owner clears it.",
      followUpPolicy: "Inspection leads get follow-up reminder after 24 hours.",
      callReviewPolicy: "Review storm calls, complaints, and low-confidence answers.",
    });

    const guide = buildPostInterviewLaunchGuide({
      assignedNumber: "+16175550199",
      businessName: "RidgeLine Roofing",
      draft,
      template: businessTemplates.roofing,
    });

    expect(guide.ownerOperatingRules.steps.join(" ")).toContain("Active leaks text owner");
    expect(guide.ownerOperatingRules.steps.join(" ")).toContain("Daily report at 6 PM");
    expect(guide.ownerOperatingRules.steps.join(" ")).toContain("Do not guess");
    expect(guide.launchPacketText).toContain("Inspection leads get follow-up");
  });

  it("normalizes common phone line labels", () => {
    expect(normalizePhoneLineType("Cell / mobile")).toBe("mobile");
    expect(normalizePhoneLineType("Landline")).toBe("landline");
    expect(normalizePhoneLineType("VoIP / PBX")).toBe("voip");
    expect(normalizePhoneLineType("I do not know")).toBe("unknown");
  });
});
