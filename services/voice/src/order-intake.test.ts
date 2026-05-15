import { describe, expect, it } from "vitest";
import {
  applyOrderChangeRequest,
  calculateCapturedOrderTotalCents,
  captureCustomerName,
  capturePickupOrder,
  formatCapturedOrderTotal,
  hasOrderSubmitIntent,
  mergeCapturedOrderItems,
  summarizeCapturedOrderItems,
} from "./order-intake";
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

  it("can capture follow-up items after order intent was already established", () => {
    const order = capturePickupOrder("and one caesar salad", demoRestaurantContext, { requireIntent: false });

    expect(order?.items).toEqual([
      { modifiers: undefined, name: "Caesar Salad", priceCents: 1400, quantity: 1 },
    ]);
  });

  it("fuzzy matches likely transcription drift on menu items", () => {
    const order = capturePickupOrder(
      "I'd like two margarita pizzas and one casar salad for pickup",
      demoRestaurantContext,
    );

    expect(order?.items).toEqual([
      { modifiers: undefined, name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
      { modifiers: undefined, name: "Caesar Salad", priceCents: 1400, quantity: 1 },
    ]);
  });

  it("captures lowercase spoken names from STT", () => {
    expect(captureCustomerName("that is all under tim chen")).toBe("Tim Chen");
    expect(captureCustomerName("name is sarah")).toBe("Sarah");
  });

  it("detects order submission language", () => {
    expect(hasOrderSubmitIntent("that's all under Sarah")).toBe(true);
    expect(hasOrderSubmitIntent("go ahead and place it")).toBe(true);
  });

  it("merges duplicate captured items", () => {
    const items = mergeCapturedOrderItems(
      [{ name: "Margherita Pizza", priceCents: 1800, quantity: 1 }],
      [{ modifiers: ["Light cheese"], name: "Margherita Pizza", priceCents: 1800, quantity: 2 }],
    );

    expect(items).toEqual([
      { modifiers: ["Light cheese"], name: "Margherita Pizza", priceCents: 1800, quantity: 3 },
    ]);
    expect(summarizeCapturedOrderItems(items)).toBe("3 Margherita Pizza");
  });

  it("removes and changes draft order items when callers correct themselves", () => {
    const draft = [
      { name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
      { name: "Caesar Salad", priceCents: 1400, quantity: 1 },
    ];

    expect(applyOrderChangeRequest(draft, "Actually remove the caesar salad", demoRestaurantContext)).toMatchObject({
      changed: true,
      items: [{ name: "Margherita Pizza", priceCents: 1800, quantity: 2 }],
    });

    expect(applyOrderChangeRequest(draft, "Make that three margherita pizzas instead", demoRestaurantContext)).toMatchObject({
      changed: true,
      items: [
        { name: "Margherita Pizza", priceCents: 1800, quantity: 3 },
        { name: "Caesar Salad", priceCents: 1400, quantity: 1 },
      ],
    });
  });

  it("calculates an estimated pickup order subtotal", () => {
    const items = [
      { name: "Margherita Pizza", priceCents: 1800, quantity: 2 },
      { name: "Caesar Salad", priceCents: 1400, quantity: 1 },
    ];

    expect(calculateCapturedOrderTotalCents(items)).toBe(5000);
    expect(formatCapturedOrderTotal(items)).toBe("$50.00");
  });
});
