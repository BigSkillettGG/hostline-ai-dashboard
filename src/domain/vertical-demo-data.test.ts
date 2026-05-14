import { describe, expect, it } from "vitest";
import { calls, orders, reservations } from "@/data/mock";
import { adaptDemoDataForBusiness } from "./vertical-demo-data";

describe("vertical demo data", () => {
  it("keeps restaurant demo data untouched", () => {
    const demo = adaptDemoDataForBusiness({ businessType: "restaurant", calls, orders, reservations });

    expect(demo.calls[0].summary).toBe(calls[0].summary);
    expect(demo.orders[0].total).toBe(orders[0].total);
    expect(demo.reservations[0].partySize).toBe(reservations[0].partySize);
  });

  it("removes restaurant-specific examples from trade demo reporting", () => {
    const demo = adaptDemoDataForBusiness({ businessType: "hvac", calls, orders, reservations });
    const allText = demo.calls.map((call) => call.summary).join(" ").toLowerCase();

    expect(allText).toContain("no heat");
    expect(allText).toContain("system replacement");
    expect(allText).not.toContain("catering");
    expect(allText).not.toContain("reservation");
    expect(demo.orders[0].total).toBe(0);
    expect(demo.reservations[0].partySize).toBe(1);
  });
});
