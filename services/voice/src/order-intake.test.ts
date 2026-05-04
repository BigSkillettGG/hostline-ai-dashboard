import { describe, expect, it } from "vitest";
import { capturePickupOrder, mergeCapturedOrderItems } from "./order-intake";
import { demoRestaurantContext } from "./restaurant-context";

describe("pickup order intake", () => {
  it("captures clear pickup orders with menu items and quantities", () => {
    const order = capturePickupOrder(
      "I'd like to place a pickup order for two margherita pizzas and a caesar salad, name is Sarah.",
      demoRestaurantContext,
    );

    expect(order?.customerName).toBe("Sarah");
    expect(order?.items).toEqual([
      { modifiers: undefined, name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
      { modifiers: undefined, name: "Caesar Salad", priceCents: 1400, quantity: 1 },
    ]);
  });

  it("does not create an order for generic questions", () => {
    expect(capturePickupOrder("What time do you close?", demoRestaurantContext)).toBeNull();
  });

  it("does not create an order for menu availability questions", () => {
    expect(capturePickupOrder("Do you have caesar salad tonight?", demoRestaurantContext)).toBeNull();
  });

  it("merges duplicate captured items", () => {
    const items = mergeCapturedOrderItems(
      [{ name: "Margherita Pizza", priceCents: 1800, quantity: 1 }],
      [{ modifiers: ["Light cheese"], name: "Margherita Pizza", priceCents: 1800, quantity: 2 }],
    );

    expect(items).toEqual([
      { modifiers: ["Light cheese"], name: "Margherita Pizza", priceCents: 1800, quantity: 3 },
    ]);
  });
});
