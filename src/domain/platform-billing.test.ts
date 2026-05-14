import { describe, expect, it } from "vitest";
import { mapDirectoryTenantToBillingTenant, mapMockTenantToBillingTenant, summarizePlatformBilling } from "./platform-billing";

describe("platform billing", () => {
  it("maps live tenant usage, overage, and trial cleanup state", () => {
    const tenant = mapDirectoryTenantToBillingTenant({
      addressOrArea: "Waltham, MA",
      aiHostPhone: "+17815550100",
      businessLabel: "HVAC",
      businessType: "hvac",
      callsThisMonth: 860,
      createdAt: "2026-05-01T12:00:00.000Z",
      includedInteractions: 800,
      locationId: "loc_1",
      locationName: "Summit Air",
      monthlyPrice: 249,
      onboardingProgressPercent: 100,
      onboardingStatus: "ready_for_test_call",
      organizationId: "org_1",
      organizationName: "Summit Air",
      ownerEmail: "owner@summit.test",
      ownerName: "Owner",
      overageLabel: "$0.40 per extra call or chat",
      phoneStatus: "in-use",
      planName: "Dispatch",
      billingStatus: "active",
      status: "healthy",
      timezone: "America/New_York",
      trialEndsAt: "2026-05-10T12:00:00.000Z",
      trialGraceEndsAt: "2026-05-24T12:00:00.000Z",
      trialStartedAt: "2026-05-03T12:00:00.000Z",
    }, new Date("2026-05-13T12:00:00.000Z"));

    expect(tenant.usageStatus).toBe("over_limit");
    expect(tenant.overageInteractions).toBe(60);
    expect(tenant.estimatedOverageCents).toBe(2400);
    expect(tenant.trialStatus).toBe("grace_period");
    expect(tenant.billingStatus).toBe("active");
  });

  it("does not flag paid phone numbers for trial cleanup when stale trial dates remain", () => {
    const tenant = mapDirectoryTenantToBillingTenant({
      addressOrArea: "Waltham, MA",
      aiHostPhone: "+17815550100",
      businessLabel: "HVAC",
      businessType: "hvac",
      callsThisMonth: 400,
      createdAt: "2026-05-01T12:00:00.000Z",
      includedInteractions: 800,
      locationId: "loc_1",
      locationName: "Summit Air",
      monthlyPrice: 249,
      onboardingProgressPercent: 100,
      onboardingStatus: "ready_for_test_call",
      organizationId: "org_1",
      organizationName: "Summit Air",
      ownerEmail: "owner@summit.test",
      ownerName: "Owner",
      phoneStatus: "active",
      planName: "Dispatch",
      status: "healthy",
      timezone: "America/New_York",
      trialEndsAt: "2026-05-10T12:00:00.000Z",
      trialGraceEndsAt: "2026-05-24T12:00:00.000Z",
      trialStartedAt: "2026-05-03T12:00:00.000Z",
    }, new Date("2026-05-25T12:00:00.000Z"));

    expect(tenant.trialStatus).toBe("active");
  });

  it("summarizes platform billing risk across tenants", () => {
    const rows = [
      mapMockTenantToBillingTenant({
        aiNumber: "+1",
        callsThisMonth: 100,
        city: "Boston, MA",
        createdAt: "2026-05-01",
        id: "a",
        includedCalls: 200,
        mrrCents: 7900,
        name: "A",
        ownerEmail: "a@test.com",
        plan: "Starter",
        status: "healthy",
      }),
      mapMockTenantToBillingTenant({
        aiNumber: "+2",
        callsThisMonth: 900,
        city: "Boston, MA",
        createdAt: "2026-05-01",
        id: "b",
        includedCalls: 800,
        mrrCents: 19900,
        name: "B",
        ownerEmail: "b@test.com",
        plan: "Growth",
        status: "critical",
      }),
    ];

    expect(summarizePlatformBilling(rows)).toMatchObject({
      arr: 3336,
      criticalSetupCount: 1,
      estimatedOverageCents: 3500,
      mrr: 278,
      overPlanCount: 1,
      tenantCount: 2,
    });
  });
});
