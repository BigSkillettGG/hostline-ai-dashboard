import { describe, expect, it } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import { buildRestaurantContext, createCachedRestaurantContextStore } from "./restaurant-context-store";

describe("restaurant context store", () => {
  it("builds a voice context from onboarding, location, agent, and menu rows", () => {
    const context = buildRestaurantContext({
      agentConfig: {
        escalation_phone_number: "+15550101",
        greeting_template: "Thanks for calling {restaurant_name}, this is {host_name}. How can I help you?",
        host_name: "Maya",
        reservation_mode: "manual_request",
        reservation_provider: "opentable",
        sms_confirmations_enabled: false,
      },
      businessLiveSettings: {
        active_mode: "busy",
        updated_at: "2026-05-13T20:00:00.000Z",
      },
      businessLiveUpdates: [
        {
          body: "Tonight's special is lobster ravioli.",
          cleared_at: null,
          created_at: "2026-05-13T19:55:00.000Z",
          expiration: "today_close",
          expires_at: "2099-05-13T23:59:59.999Z",
          id: "live_1",
          mode: null,
          source: "owner_text",
          title: "Tonight's special",
          update_type: "special",
        },
        {
          body: "Use only in emergency mode.",
          cleared_at: null,
          created_at: "2026-05-13T19:50:00.000Z",
          expiration: "until_cleared",
          expires_at: null,
          id: "live_2",
          mode: "emergency",
          source: "dashboard",
          title: "Emergency-only note",
          update_type: "policy",
        },
      ],
      faqs: [
        {
          answer: "Gift cards are sold at the host stand.",
          is_active: true,
          question: "Do you sell gift cards?",
        },
        {
          answer: "This should not be included.",
          is_active: false,
          question: "Inactive question",
        },
      ],
      knowledgeSections: [
        {
          body: "Step-free entrance is available on Main Street.",
          is_active: true,
          title: "Accessibility",
        },
        {
          body: "Feedback: Vera did not close the loop after answering.\n\nPreferred answer: Answer directly, then ask if the caller needs anything else.\n\nSource call: call_123",
          is_active: true,
          title: "Call tuning - Bad close-out",
        },
        {
          body: "This should not be included.",
          is_active: false,
          title: "Inactive section",
        },
      ],
      location: {
        address: "10 Main St",
        ai_host_phone: "+15550199",
        cuisine: "Thai",
        id: "location_1",
        name: "Saffron Table",
        phone: "+15550100",
        timezone: "America/New_York",
      },
      menuCategories: [{ id: "cat_1", name: "Noodles" }],
      menuItems: [
        {
          available: true,
          category_id: "cat_1",
          description: "Rice noodles with tamarind",
          modifiers: ["No peanuts", "Add chicken"],
          name: "Pad Thai",
          price_cents: 1600,
        },
        {
          available: false,
          category_id: "cat_1",
          description: null,
          modifiers: [],
          name: "Sold Out Curry",
          price_cents: 1800,
        },
      ],
      onboardingProfile: {
        draft: {
          allergyPolicy: "Nut allergies require staff confirmation.",
          complaintPolicy: "Collect the issue, apology notes, name, callback number, and manager review request.",
          defaultPickupEta: "20 minutes",
          deliveryDriverPolicy: "Drivers use the side pickup window and give the app name.",
          deliveryPolicy: "DoorDash issues start in DoorDash, then staff can review with the order number.",
          donationPressPolicy: "Collect organization, deadline, and media contact.",
          greeting: "Hello from {restaurant_name}, {host_name} speaking.",
          hiringPolicy: "Applicants should email jobs@saffron.example.",
          holidayExceptions: "Closed July 4.",
          hostName: "Nina",
          humanHandoffPolicy: "Take the caller name, phone, topic, and urgency for callback.",
          lostAndFoundPolicy: "Collect item, visit time, seating area, and callback number.",
          onlineOrderingUrl: "https://saffron.example/order",
          orderChangePolicy: "Pickup order changes require the order name, phone, and requested update.",
          parking: "Parking behind the building.",
          paymentPolicy: "Pay at pickup.",
          orderHandlingMode: "Send online ordering link",
          privateEvents: "Collect event date, guest count, and phone number for the events manager.",
          regularHours: "Daily 11 AM to 9 PM.",
          reservationHandlingMode: "Create request for staff confirmation",
          reservationChangePolicy: "Reservation changes need name, date, time, and requested update.",
          reservationSourceToday: "Paper book",
          reservationProvider: "Manual requests only",
          restaurantName: "Saffron Table",
          additionalTrustedContacts: "Rin, manager, +15550177, can receive urgent alerts and suggest knowledge.",
          alertPreferenceRules: "Complaints and catering leads text Rin immediately; vendor calls stay in daily summary.",
          ownerReportPreferences: "Daily owner report at 9 PM by email and weekly report Monday morning.",
          unknownAnswerPolicy: "Do not guess; collect the question, name, callback, and create a staff task.",
          knowledgeApprovalPolicy: "Owner approves permanent knowledge",
          liveUpdateRules: "Chef specials expire at close; closure notices expire after the stated date.",
          followUpPolicy: "Catering and large-party leads need same-day follow-up reminders.",
          callReviewPolicy: "Review first-week calls, complaints, allergies, and low-confidence answers.",
          opportunityScoringRules: "Catering and large parties are high value; vendor calls are low priority.",
          specialsSchedule: "Chef's curry special is available Friday dinner only.",
          substitutionPolicy: "No off-menu noodles. Simple sauce-on-side requests are okay; allergy substitutions need staff confirmation.",
          timezone: "America/New_York",
          vendorCallPolicy: "Vendors should leave company, reason, phone, and email for the owner.",
          voiceGender: "Male - Michael",
          waitlistPolicy: "Walk-ins are welcome, but quoted waits are confirmed at the door.",
        },
      },
    });

    expect(context.restaurantName).toBe("Saffron Table");
    expect(context.hostName).toBe("Miles");
    expect(context.voiceGender).toBe("male");
    expect(context.voiceProfileId).toBe("miles");
    expect(context.greeting).toBe("Thank you for calling Saffron Table. How can I help you?");
    expect(context.defaultPickupEtaMinutes).toBe(20);
    expect(context.smsConfirmationsEnabled).toBe(false);
    expect(context.businessLiveContext?.activeMode.id).toBe("busy");
    expect(context.businessLiveContext?.activeUpdates.map((update) => update.id)).toEqual(["live_1"]);
    expect(context.businessLiveContext?.instructionBlock).toContain("lobster ravioli");
    expect(context.menuItems).toEqual([
      {
        aliases: ["Pad Thai"],
        modifiers: ["No peanuts", "Add chicken"],
        name: "Pad Thai",
        priceCents: 1600,
      },
    ]);
    expect(context.policies.hours).toContain("Closed July 4");
    expect(context.policies.pickup).toContain("20 minutes");
    expect(context.policies.pickup).toContain("online ordering link");
    expect(context.orderSettings).toMatchObject({
      enabled: true,
      handlingMode: "online_link",
      onlineOrderingUrl: "https://saffron.example/order",
    });
    expect(context.businessLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ordering",
          url: "https://saffron.example/order",
        }),
      ]),
    );
    expect(context.policies.parking).toBe("Parking behind the building.");
    expect(context.policies.complaints).toContain("manager review");
    expect(context.policies.delivery_drivers).toContain("side pickup window");
    expect(context.policies.delivery_issues).toContain("DoorDash issues");
    expect(context.policies.employment).toContain("jobs@saffron.example");
    expect(context.policies.human_handoff).toContain("topic, and urgency");
    expect(context.policies.lost_and_found).toContain("seating area");
    expect(context.policies.order_changes).toContain("Pickup order changes");
    expect(context.policies.reservation_changes).toContain("Reservation changes");
    expect(context.policies.reservations).toContain("Handling mode");
    expect(context.reservationSettings).toMatchObject({
      enabled: true,
      handlingMode: "manual_request",
      provider: "none",
      sourceToday: "Paper book",
    });
    expect(context.policies.sales).toContain("Vendors should leave");
    expect(context.policies.specials).toContain("Chef's curry special");
    expect(context.policies.specials).toContain("lobster ravioli");
    expect(context.policies.live_updates).toContain("Business mode: Busy");
    expect(context.policies.trusted_contacts).toContain("Rin, manager");
    expect(context.policies.alert_preferences).toContain("Complaints and catering");
    expect(context.policies.owner_reporting).toContain("Daily owner report");
    expect(context.policies.unknown_answers).toContain("Do not guess");
    expect(context.policies.knowledge_approval).toContain("Owner approves");
    expect(context.policies.live_update_rules).toContain("Chef specials");
    expect(context.policies.follow_up).toContain("Catering and large-party");
    expect(context.policies.call_review).toContain("first-week calls");
    expect(context.policies.opportunity_scoring).toContain("large parties");
    expect(context.policies.substitutions).toContain("No off-menu noodles");
    expect(context.policies.waitlist).toContain("quoted waits");
    expect(context.faqs).toEqual([
      {
        answer: "Gift cards are sold at the host stand.",
        question: "Do you sell gift cards?",
      },
    ]);
    expect(context.knowledgeSections).toEqual(
      expect.arrayContaining([
        {
          body: "Step-free entrance is available on Main Street.",
          title: "Accessibility",
        },
        {
          body: "Collect event date, guest count, and phone number for the events manager.",
          title: "Private events and catering",
        },
        {
          body: "Collect item, visit time, seating area, and callback number.",
          title: "Lost and found",
        },
        {
          body: "Drivers use the side pickup window and give the app name.",
          title: "Delivery drivers",
        },
        {
          body: "No off-menu noodles. Simple sauce-on-side requests are okay; allergy substitutions need staff confirmation.",
          title: "Menu substitutions and off-menu requests",
        },
        {
          body: "Vendors should leave company, reason, phone, and email for the owner.",
          title: "Vendor and sales calls",
        },
        {
          body: "Rin, manager, +15550177, can receive urgent alerts and suggest knowledge.",
          title: "Trusted contacts and permissions",
        },
        {
          body: "Catering and large-party leads need same-day follow-up reminders.",
          title: "Follow-up and revenue recovery",
        },
      ]),
    );
    expect(context.knowledgeSections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Call tuning - Bad close-out",
        }),
      ]),
    );
    expect(context.behaviorTuningNotes).toEqual([
      {
        body: "Feedback: Vera did not close the loop after answering.\n\nPreferred answer: Answer directly, then ask if the caller needs anything else.\n\nSource call: call_123",
        kind: "behavior_tuning",
        title: "Call tuning - Bad close-out",
      },
    ]);
  });

  it("falls back to location data and demo-safe policies when onboarding is missing", () => {
    const context = buildRestaurantContext({
      location: {
        address: "55 Market St",
        ai_host_phone: null,
        cuisine: "Bakery, coffee",
        id: "location_2",
        name: "Morning House",
        phone: null,
        timezone: "America/Chicago",
      },
    });

    expect(context.restaurantName).toBe("Morning House");
    expect(context.timezone).toBe("America/Chicago");
    expect(context.smsConfirmationsEnabled).toBe(true);
    expect(context.menuHighlights).toEqual(["Bakery", "coffee"]);
    expect(context.policies.location).toBe("55 Market St");
  });

  it("builds generic business context and link types for service businesses", () => {
    const context = buildRestaurantContext({
      location: {
        address: "Somerville, MA",
        ai_host_phone: null,
        cuisine: null,
        id: "location_service",
        name: "Harbor Plumbing",
        phone: null,
        timezone: "America/New_York",
      },
      onboardingProfile: {
        draft: {
          appointmentBookingUrl: "https://harbor.example/book",
          businessType: "plumbing",
          concept: "Plumbing repairs, water heaters, drains, and emergency leak calls.",
          intakeFormUrl: "https://harbor.example/intake",
          menuCategories: "Leaks, drains, water heaters, fixtures, emergency service.",
          menuUrl: "https://harbor.example/services",
          quoteRequestUrl: "https://harbor.example/quote",
          restaurantName: "Harbor Plumbing",
        },
      },
    });

    expect(context.businessType).toBe("plumbing");
    expect(context.restaurantName).toBe("Harbor Plumbing");
    expect(context.menuHighlights).toEqual(["Leaks", "drains", "water heaters", "fixtures", "emergency service."]);
    expect(context.menuItems).toEqual([]);
    expect(context.faqs).toEqual([]);
    expect(context.policies.payment).toContain("Payment, diagnostic fees, deposits, and financing");
    expect(context.policies.specials).toContain("Service catalog promotions");
    expect(context.policies.waitlist).toContain("Appointment availability");
    expect(context.knowledgeSections).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Tonight's specials" }),
    ]));
    expect(context.businessLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "booking", url: "https://harbor.example/book" }),
        expect.objectContaining({ kind: "quote", url: "https://harbor.example/quote" }),
        expect.objectContaining({ kind: "intake", url: "https://harbor.example/intake" }),
        expect.objectContaining({ kind: "menu", url: "https://harbor.example/services" }),
      ]),
    );
    expect(context.knowledgeSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Quote request link", body: "https://harbor.example/quote" }),
        expect.objectContaining({ title: "Intake form link", body: "https://harbor.example/intake" }),
      ]),
    );
  });

  it("uses a canonical public greeting without changing the stored name", () => {
    const context = buildRestaurantContext({
      agentConfig: {
        escalation_phone_number: null,
        greeting_template: "Thanks for calling {restaurant_name}. This is {host_name}. How can I help you?",
        host_name: "Vera",
        reservation_mode: null,
        reservation_provider: null,
        sms_confirmations_enabled: true,
      },
      location: {
        address: null,
        ai_host_phone: null,
        cuisine: null,
        id: "location_3",
        name: "Olive & Ember",
        phone: null,
        timezone: "America/Los_Angeles",
      },
    });

    expect(context.restaurantName).toBe("Olive & Ember");
    expect(context.greeting).toBe("Thank you for calling Olive and Ember. How can I help you?");
  });

  it("caches restaurant context lookups by location for the TTL window", async () => {
    let lookupCount = 0;
    const store = createCachedRestaurantContextStore(
      {
        async getContext() {
          lookupCount += 1;
          return {
            ...demoRestaurantContext,
            restaurantName: `Cached ${lookupCount}`,
          };
        },
      },
      60_000,
    );

    await expect(store.getContext("loc_1")).resolves.toMatchObject({ restaurantName: "Cached 1" });
    await expect(store.getContext("loc_1")).resolves.toMatchObject({ restaurantName: "Cached 1" });
    await expect(store.getContext("loc_2")).resolves.toMatchObject({ restaurantName: "Cached 2" });
    expect(lookupCount).toBe(2);
  });
});
