import { describe, expect, it } from "vitest";
import { demoRestaurantContext } from "./restaurant-context";
import { matchPhonePlaybookReply } from "./restaurant-playbook";

describe("restaurant phone playbook", () => {
  it("answers common policy questions without the model", () => {
    expect(matchPhonePlaybookReply("Are you open tonight?", demoRestaurantContext)).toMatchObject({
      scenario: "hours",
      text: expect.stringContaining("Tuesday"),
    });
    expect(matchPhonePlaybookReply("Where can I park?", demoRestaurantContext)).toMatchObject({
      scenario: "parking",
      text: expect.stringContaining("Metered"),
    });
  });

  it("keeps allergy and payment handling conservative", () => {
    expect(matchPhonePlaybookReply("I have a severe peanut allergy", demoRestaurantContext)).toMatchObject({
      scenario: "allergy",
      staffAlertKind: "low_confidence",
      text: expect.stringContaining("staff confirmation"),
    });
    expect(matchPhonePlaybookReply("Can I pay over the phone with a card?", demoRestaurantContext)).toMatchObject({
      scenario: "payment",
      text: expect.stringContaining("cannot take card numbers"),
    });
  });

  it("routes complaints, vendor calls, and lost items to staff follow-up", () => {
    expect(matchPhonePlaybookReply("My order was wrong and I need a refund", demoRestaurantContext)).toMatchObject({
      scenario: "complaint",
      staffAlertKind: "complaint",
    });
    expect(matchPhonePlaybookReply("I'm a wine rep calling about a vendor account", demoRestaurantContext)).toMatchObject({
      scenario: "vendor_sales",
      staffAlertKind: "sales",
    });
    expect(matchPhonePlaybookReply("I left my wallet there last night", demoRestaurantContext)).toMatchObject({
      scenario: "lost_and_found",
      staffAlertKind: "handoff",
    });
  });

  it("handles restaurant phone edge cases politely", () => {
    expect(matchPhonePlaybookReply("Sorry wrong number", demoRestaurantContext)).toMatchObject({
      scenario: "wrong_number",
      text: expect.stringContaining("No problem"),
    });
    expect(matchPhonePlaybookReply("I'm a DoorDash driver picking up for Sarah", demoRestaurantContext)).toMatchObject({
      scenario: "delivery_driver",
      text: expect.stringContaining("pickup counter"),
    });
    expect(matchPhonePlaybookReply("Can I change my reservation?", demoRestaurantContext)).toMatchObject({
      scenario: "change_or_cancel",
      staffAlertKind: "handoff",
    });
  });
});
