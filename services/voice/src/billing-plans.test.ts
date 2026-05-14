import { describe, expect, it } from "vitest";
import { listBillingPlans, resolveBillingPlan } from "./billing-plans";

describe("billing plans", () => {
  it("resolves vertical-specific plan prices instead of trusting client-submitted dollars", () => {
    expect(resolveBillingPlan({ businessType: "restaurant", planId: "growth" })).toMatchObject({
      includedInteractions: 800,
      monthlyCents: 19900,
      name: "Service",
    });
    expect(resolveBillingPlan({ businessType: "hvac", planId: "growth" })).toMatchObject({
      includedInteractions: 700,
      monthlyCents: 24900,
      name: "Dispatch",
    });
  });

  it("falls back from public slugs and plan names", () => {
    expect(resolveBillingPlan({ businessType: "hair-salons-barbershops", planName: "Studio" })).toMatchObject({
      monthlyCents: 14900,
      planId: "growth",
    });
  });

  it("lists only the plans for the selected vertical", () => {
    expect(listBillingPlans({ businessType: "plumbing" }).map((plan) => plan.monthlyCents)).toEqual([7900, 22900, 49900]);
    expect(listBillingPlans({ businessType: "unknown" }).map((plan) => plan.businessType)).toEqual([
      "restaurant",
      "restaurant",
      "restaurant",
    ]);
  });
});
