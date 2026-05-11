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
        reservation_provider: "opentable",
        sms_confirmations_enabled: false,
      },
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
          orderChangePolicy: "Pickup order changes require the order name, phone, and requested update.",
          parking: "Parking behind the building.",
          paymentPolicy: "Pay at pickup.",
          privateEvents: "Collect event date, guest count, and phone number for the events manager.",
          regularHours: "Daily 11 AM to 9 PM.",
          reservationChangePolicy: "Reservation changes need name, date, time, and requested update.",
          reservationProvider: "Manual requests only",
          restaurantName: "Saffron Table",
          specialsSchedule: "Chef's curry special is available Friday dinner only.",
          timezone: "America/New_York",
          vendorCallPolicy: "Vendors should leave company, reason, phone, and email for the owner.",
          voiceGender: "Male - Michael",
          waitlistPolicy: "Walk-ins are welcome, but quoted waits are confirmed at the door.",
        },
      },
    });

    expect(context.restaurantName).toBe("Saffron Table");
    expect(context.hostName).toBe("Nina");
    expect(context.voiceGender).toBe("male");
    expect(context.greeting).toBe("Hello from Saffron Table, Nina speaking.");
    expect(context.defaultPickupEtaMinutes).toBe(20);
    expect(context.smsConfirmationsEnabled).toBe(false);
    expect(context.menuItems).toEqual([
      {
        aliases: ["Pad Thai", "Rice noodles with tamarind"],
        modifiers: ["No peanuts", "Add chicken"],
        name: "Pad Thai",
        priceCents: 1600,
      },
    ]);
    expect(context.policies.hours).toContain("Closed July 4");
    expect(context.policies.pickup).toContain("20 minutes");
    expect(context.policies.parking).toBe("Parking behind the building.");
    expect(context.policies.complaints).toContain("manager review");
    expect(context.policies.delivery_drivers).toContain("side pickup window");
    expect(context.policies.delivery_issues).toContain("DoorDash issues");
    expect(context.policies.employment).toContain("jobs@saffron.example");
    expect(context.policies.human_handoff).toContain("topic, and urgency");
    expect(context.policies.lost_and_found).toContain("seating area");
    expect(context.policies.order_changes).toContain("Pickup order changes");
    expect(context.policies.reservation_changes).toContain("Reservation changes");
    expect(context.policies.sales).toContain("Vendors should leave");
    expect(context.policies.specials).toContain("Chef's curry special");
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
          body: "Vendors should leave company, reason, phone, and email for the owner.",
          title: "Vendor and sales calls",
        },
      ]),
    );
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
