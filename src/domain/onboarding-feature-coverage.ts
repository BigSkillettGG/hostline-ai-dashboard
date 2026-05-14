export interface OnboardingFeatureCoverage {
  allVerticals?: boolean;
  feature: string;
  fieldIds: string[];
  launchTieBack: string;
  runtimeTieBack: string;
}

export const onboardingFeatureCoverage: OnboardingFeatureCoverage[] = [
  {
    allVerticals: true,
    feature: "Business identity and local time",
    fieldIds: ["businessType", "restaurantName", "concept", "primaryLocation", "timezone"],
    runtimeTieBack: "voice greeting, hours reasoning, local reports, and vertical-specific vocabulary",
    launchTieBack: "first test call, launch packet identity, and owner dashboard context",
  },
  {
    allVerticals: true,
    feature: "Owner identity and trusted command surface",
    fieldIds: ["ownerName", "ownerPhone", "ownerEmail", "additionalTrustedContacts", "knowledgeApprovalPolicy"],
    runtimeTieBack: "trusted contacts, owner-assistant commands by dashboard, phone, SMS, and agent email, knowledge approvals, and alert permissions",
    launchTieBack: "post-launch instructions for emailing, texting, calling, teaching SignalHost, and reviewing the first calls",
  },
  {
    allVerticals: true,
    feature: "Service catalog or menu knowledge",
    fieldIds: ["menuUrl", "menuUploadNotes", "menuCategories", "modifiers", "substitutionPolicy"],
    runtimeTieBack: "customer FAQs, order/request capture, substitution safety, and menu/service matching",
    launchTieBack: "first test scenarios for asking about offerings, pricing, and allowed changes",
  },
  {
    allVerticals: true,
    feature: "Hours, availability, specials, and temporary modes",
    fieldIds: ["regularHours", "servicePeriods", "specialsSchedule", "holidayExceptions", "orderingCutoffs", "liveUpdateRules"],
    runtimeTieBack: "open/closed answers, after-hours behavior, daily specials, emergency/busy modes, and expiration rules",
    launchTieBack: "owner instructions for daily updates, holiday changes, and busy-period modes",
  },
  {
    allVerticals: true,
    feature: "Orders, service requests, quote requests, and links",
    fieldIds: ["takeOrders", "orderHandlingMode", "onlineOrderingUrl", "defaultPickupEta", "paymentPolicy", "orderDestination", "orderChangePolicy"],
    runtimeTieBack: "request capture, link sending, ETA wording, payment constraints, and staff task routing",
    launchTieBack: "first calls that prove requests, links, tasks, and confirmations work",
  },
  {
    feature: "Trade appointment, quote, and intake links",
    fieldIds: ["appointmentBookingUrl", "quoteRequestUrl", "intakeFormUrl"],
    runtimeTieBack: "home-service appointment requests, estimate links, intake forms, and follow-up cards",
    launchTieBack: "trade launch testing for booking, quote, and intake workflows",
  },
  {
    allVerticals: true,
    feature: "Reservations, appointments, and larger opportunities",
    fieldIds: ["takeReservations", "reservationSourceToday", "reservationHandlingMode", "reservationProvider", "reservationBookingUrl", "partyRules", "privateEvents", "waitlistPolicy"],
    runtimeTieBack: "booking link routing, staff-confirmed requests, large opportunities, waitlist language, and scheduling limits",
    launchTieBack: "test calls for reservations, appointments, inspections, or booking-link handoff",
  },
  {
    allVerticals: true,
    feature: "Safety, complaints, human handoff, and edge cases",
    fieldIds: ["allergyPolicy", "complaintPolicy", "lostAndFoundPolicy", "hiringPolicy", "vendorCallPolicy", "humanHandoffPolicy", "feesAndRules", "customFaqs"],
    runtimeTieBack: "safe answers, urgent routing, complaint handling, job/vendor classification, and low-confidence escalation",
    launchTieBack: "owner guidance to review complaints, safety calls, and unanswered questions first",
  },
  {
    allVerticals: true,
    feature: "Alerts, reporting, learning, follow-up, and QA",
    fieldIds: ["alertPreferenceRules", "ownerReportPreferences", "unknownAnswerPolicy", "followUpPolicy", "callReviewPolicy", "opportunityScoringRules"],
    runtimeTieBack: "owner reports, follow-up queue, learning loop, transcript/audio QA, and revenue opportunity scoring",
    launchTieBack: "owner operating rules for daily reports, knowledge corrections, follow-ups, and call review",
  },
  {
    allVerticals: true,
    feature: "Voice, answer timing, and customer text follow-up",
    fieldIds: ["voiceProfileId", "tone", "greeting", "callHandling", "smsConfirmations"],
    runtimeTieBack: "OpenAI voice profile, named employee persona, greeting, answer timing, and confirmation behavior",
    launchTieBack: "voice preview, first test call, and phone-forwarding readiness",
  },
  {
    allVerticals: true,
    feature: "Phone provisioning and website chat launch",
    fieldIds: ["mainPhone", "phoneLineType", "phoneProvider", "forwardingMode", "assignedSignalHostNumber", "websiteUrl", "websitePlatform", "websiteAdminContact", "firstTestCall"],
    runtimeTieBack: "Twilio number routing, forwarding setup, agent email routing, website chat snippet, and launch-readiness checks",
    launchTieBack: "post-interview phone instructions, SignalHost email address, provider script, website snippet, and first test checklist",
  },
];
