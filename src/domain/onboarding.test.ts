import { describe, expect, it } from "vitest";
import {
  assignedDemoPhoneNumber,
  calculateOnboardingProgress,
  createOnboardingDraftForBusiness,
  getBusinessOnboardingSections,
  getOnboardingBusinessTemplate,
  onboardingSections,
  productionWorkstreams,
  sampleOnboardingDraft,
} from "./onboarding";
import { businessTypeOptions } from "./business-templates";

describe("restaurant onboarding scope", () => {
  it("covers the production onboarding interview areas", () => {
    expect(getBusinessOnboardingSections("restaurant").map((section) => section.id)).toEqual([
      "basics",
      "menus",
      "hours",
      "orders",
      "reservations",
      "policies",
      "escalations",
      "owner",
      "voice",
      "launch",
    ]);
  });

  it("branches onboarding copy and variables for plumbing", () => {
    const sections = getBusinessOnboardingSections({ businessType: "plumbing" });
    const basics = sections.find((section) => section.id === "basics");
    const services = sections.find((section) => section.id === "menus");
    const requests = sections.find((section) => section.id === "orders");
    const allFields = sections.flatMap((section) => section.fields);

    expect(getOnboardingBusinessTemplate("plumbing").workspaceLabel).toBe("Plumbing");
    expect(basics?.title).toBe("Business basics");
    expect(services?.title).toBe("Services and pricing");
    expect(requests?.title).toBe("Service request workflow");
    expect(allFields.find((field) => field.id === "restaurantName")?.label).toBe("Business name");
    expect(allFields.find((field) => field.id === "quoteRequestUrl")?.label).toBe("Quote request link");
    expect(allFields.find((field) => field.id === "appointmentBookingUrl")?.label).toBe("Appointment booking link");
  });

  it("starts with the six launch industries", () => {
    expect(businessTypeOptions.map((option) => option.value)).toEqual([
      "restaurant",
      "hvac",
      "plumbing",
      "roofing",
      "electrical",
      "salon_barber",
    ]);
  });

  it("keeps restaurant-only setup from showing generic quote fields", () => {
    const fieldIds = getBusinessOnboardingSections("restaurant").flatMap((section) => section.fields.map((field) => field.id));

    expect(fieldIds).toContain("businessType");
    expect(fieldIds).not.toContain("quoteRequestUrl");
    expect(fieldIds).not.toContain("appointmentBookingUrl");
  });

  it("creates vertical-specific sample drafts instead of restaurant defaults", () => {
    const hvacDraft = createOnboardingDraftForBusiness("hvac");
    const salonDraft = createOnboardingDraftForBusiness("salon_barber");

    expect(hvacDraft.businessType).toBe("hvac");
    expect(hvacDraft.restaurantName).toBe("Summit Air");
    expect(hvacDraft.menuCategories).toContain("No heat");
    expect(hvacDraft.menuCategories).not.toContain("wood-fired pizza");
    expect(hvacDraft.reservationProvider).toBe("ServiceTitan");

    expect(salonDraft.businessType).toBe("salon_barber");
    expect(salonDraft.restaurantName).toBe("Luna Studio");
    expect(salonDraft.menuCategories).toContain("Haircuts");
    expect(salonDraft.reservationProvider).toBe("Vagaro");
  });

  it("keeps the remaining production build visible", () => {
    expect(productionWorkstreams).toHaveLength(14);
  });

  it("asks for restaurant-specific policies behind common phone playbook scenarios", () => {
    const fieldIds = onboardingSections.flatMap((section) => section.fields.map((field) => field.id));

    expect(fieldIds).toEqual(
      expect.arrayContaining([
        "complaintPolicy",
        "deliveryDriverPolicy",
        "deliveryPolicy",
        "donationPressPolicy",
        "hiringPolicy",
        "humanHandoffPolicy",
        "additionalTrustedContacts",
        "alertPreferenceRules",
        "ownerReportPreferences",
        "unknownAnswerPolicy",
        "knowledgeApprovalPolicy",
        "liveUpdateRules",
        "followUpPolicy",
        "callReviewPolicy",
        "opportunityScoringRules",
        "lostAndFoundPolicy",
        "onlineOrderingUrl",
        "orderChangePolicy",
        "orderHandlingMode",
        "phoneLineType",
        "phoneProvider",
        "reservationBookingUrl",
        "reservationChangePolicy",
        "reservationHandlingMode",
        "reservationSourceToday",
        "privateRoomPolicy",
        "seatingAreas",
        "substitutionPolicy",
        "vendorCallPolicy",
        "waitlistPolicy",
        "websiteAdminContact",
        "websitePlatform",
        "websiteUrl",
      ]),
    );
  });

  it("calculates launch-readiness progress from required fields", () => {
    const progress = calculateOnboardingProgress(sampleOnboardingDraft, getBusinessOnboardingSections(sampleOnboardingDraft));

    expect(progress.percent).toBeGreaterThan(70);
    expect(progress.completedRequired).toBeLessThanOrEqual(progress.totalRequired);
    expect(progress.missingBySection).toHaveLength(onboardingSections.length);
  });

  it("does not treat the demo SignalHost number as launch-ready", () => {
    const progress = calculateOnboardingProgress(
      {
        ...sampleOnboardingDraft,
        assignedSignalHostNumber: assignedDemoPhoneNumber,
      },
      getBusinessOnboardingSections(sampleOnboardingDraft),
    );

    expect(progress.missingBySection.find((section) => section.id === "launch")?.missing).toContain("SignalHost number");
  });
});
