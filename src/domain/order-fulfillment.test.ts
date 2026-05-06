import { describe, expect, it } from "vitest";
import type { Order } from "@/data/mock";
import {
  buildKitchenDeliveryPayload,
  getKitchenActionLabel,
  getNextKitchenStatus,
  hasSentDeliveryAttempt,
  isActiveKitchenOrder,
  orderAgeMinutes,
  orderItemCount,
  sortKitchenTickets,
} from "./order-fulfillment";

const baseOrder: Order = {
  createdAt: "2026-05-05T18:00:00.000Z",
  customer: "Sarah",
  etaMinutes: 25,
  id: "order_1",
  items: [
    { name: "Pizza", price: 18, qty: 2 },
    { name: "Salad", price: 12, qty: 1 },
  ],
  payAtPickup: true,
  phone: "+15551234567",
  status: "new",
  total: 48,
};

describe("order fulfillment helpers", () => {
  it("returns the kitchen status progression and action labels", () => {
    expect(getNextKitchenStatus("new")).toBe("accepted");
    expect(getNextKitchenStatus("accepted")).toBe("in_progress");
    expect(getNextKitchenStatus("in_progress")).toBe("completed");
    expect(getNextKitchenStatus("completed")).toBeUndefined();

    expect(getKitchenActionLabel("new")).toBe("Accept ticket");
    expect(getKitchenActionLabel("accepted")).toBe("Start prep");
    expect(getKitchenActionLabel("in_progress")).toBe("Mark ready");
  });

  it("identifies active kitchen tickets", () => {
    expect(isActiveKitchenOrder({ ...baseOrder, status: "new" })).toBe(true);
    expect(isActiveKitchenOrder({ ...baseOrder, status: "accepted" })).toBe(true);
    expect(isActiveKitchenOrder({ ...baseOrder, status: "in_progress" })).toBe(true);
    expect(isActiveKitchenOrder({ ...baseOrder, status: "completed" })).toBe(false);
  });

  it("counts items, age, and sent delivery attempts", () => {
    expect(orderItemCount(baseOrder)).toBe(3);
    expect(orderAgeMinutes(baseOrder, new Date("2026-05-05T18:12:30.000Z"))).toBe(12);
    expect(
      hasSentDeliveryAttempt(
        {
          deliveryAttempts: [
            { destination: "kitchen_tablet", id: "attempt_1", status: "pending" },
            { destination: "printer", id: "attempt_2", status: "sent" },
          ],
        },
        "kitchen_tablet",
      ),
    ).toBe(false);
    expect(
      hasSentDeliveryAttempt(
        { deliveryAttempts: [{ destination: "kitchen_tablet", id: "attempt_3", status: "sent" }] },
        "kitchen_tablet",
      ),
    ).toBe(true);
  });

  it("builds kitchen tablet delivery payloads", () => {
    expect(buildKitchenDeliveryPayload(baseOrder, "accept_ticket")).toEqual({
      action: "accept_ticket",
      itemCount: 3,
      orderStatus: "new",
      source: "kitchen_tablet",
      total: 48,
    });
  });

  it("sorts active work before completed tickets, then oldest first", () => {
    const sorted = [
      { ...baseOrder, createdAt: "2026-05-05T18:03:00.000Z", id: "newer_new", status: "new" as const },
      { ...baseOrder, createdAt: "2026-05-05T18:02:00.000Z", id: "accepted", status: "accepted" as const },
      { ...baseOrder, createdAt: "2026-05-05T18:04:00.000Z", id: "completed", status: "completed" as const },
      { ...baseOrder, createdAt: "2026-05-05T18:01:00.000Z", id: "older_in_progress", status: "in_progress" as const },
    ].sort(sortKitchenTickets);

    expect(sorted.map((order) => order.id)).toEqual(["older_in_progress", "newer_new", "accepted", "completed"]);
  });
});
