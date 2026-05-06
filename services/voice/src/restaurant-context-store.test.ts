import { describe, expect, it } from "vitest";
import { buildRestaurantContext } from "./restaurant-context-store";

describe("restaurant context store", () => {
  it("builds a voice context from onboarding, location, agent, and menu rows", () => {
    const context = buildRestaurantContext({
      agentConfig: {
        escalation_phone_number: "+15550101",
        greeting_template: "Thanks for calling {restaurant_name}, this is {host_name}. How can I help?",
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
          defaultPickupEta: "20 minutes",
          greeting: "Hello from {restaurant_name}, {host_name} speaking.",
          holidayExceptions: "Closed July 4.",
          hostName: "Nina",
          parking: "Parking behind the building.",
          paymentPolicy: "Pay at pickup.",
          privateEvents: "Collect event date, guest count, and phone number for the events manager.",
          regularHours: "Daily 11 AM to 9 PM.",
          reservationProvider: "Manual requests only",
          restaurantName: "Saffron Table",
          timezone: "America/New_York",
        },
      },
    });

    expect(context.restaurantName).toBe("Saffron Table");
    expect(context.hostName).toBe("Nina");
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
});
