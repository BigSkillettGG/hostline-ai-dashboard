import { describe, expect, it } from "vitest";
import { buildBillingCheckoutNotice, buildBillingSnapshot, normalizeCheckoutReturn } from "./billing";

const draft = {
  selectedPlanIncludedInteractions: "800",
  selectedPlanMonthly: "199",
  selectedPlanName: "Service",
  selectedPlanOverage: "$0.35 per extra call or chat",
};

describe("billing snapshot", () => {
  it("shows a trial as active before the trial end date", () => {
    const snapshot = buildBillingSnapshot({
      callsThisMonth: 240,
      draft,
      now: new Date("2026-05-10T12:00:00.000Z"),
      phoneNumbers: [{
        phoneNumber: "+16175550199",
        status: "in-use",
        trialEndsAt: "2026-05-12T12:00:00.000Z",
        trialGraceEndsAt: "2026-05-26T12:00:00.000Z",
      }],
    });

    expect(snapshot.lifecycleStatus).toBe("trialing");
    expect(snapshot.trialDaysRemaining).toBe(2);
    expect(snapshot.upgradeRequired).toBe(false);
    expect(snapshot.remainingInteractions).toBe(560);
    expect(snapshot.overageInteractions).toBe(0);
    expect(snapshot.estimatedOverageCents).toBe(0);
    expect(snapshot.usageStatus).toBe("normal");
    expect(snapshot.usagePercent).toBe(30);
  });

  it("requires upgrade during grace and flags release due after grace", () => {
    const graceSnapshot = buildBillingSnapshot({
      draft,
      now: new Date("2026-05-13T12:00:00.000Z"),
      phoneNumbers: [{
        phoneNumber: "+16175550199",
        status: "in-use",
        trialEndsAt: "2026-05-12T12:00:00.000Z",
        trialGraceEndsAt: "2026-05-26T12:00:00.000Z",
      }],
    });
    const releaseSnapshot = buildBillingSnapshot({
      draft,
      now: new Date("2026-05-27T12:00:00.000Z"),
      phoneNumbers: [{
        phoneNumber: "+16175550199",
        status: "in-use",
        trialEndsAt: "2026-05-12T12:00:00.000Z",
        trialGraceEndsAt: "2026-05-26T12:00:00.000Z",
      }],
    });

    expect(graceSnapshot.lifecycleStatus).toBe("grace_period");
    expect(graceSnapshot.upgradeRequired).toBe(true);
    expect(releaseSnapshot.lifecycleStatus).toBe("release_due");
    expect(releaseSnapshot.upgradeRequired).toBe(true);
  });

  it("allows trial provisioning only when no active number exists", () => {
    expect(buildBillingSnapshot({ draft, phoneNumbers: [] }).canProvisionTrialNumber).toBe(true);
    expect(buildBillingSnapshot({
      draft,
      phoneNumbers: [{ phoneNumber: "+16175550199", status: "in-use" }],
    }).canProvisionTrialNumber).toBe(false);
    expect(buildBillingSnapshot({
      draft,
      phoneNumbers: [{ phoneNumber: "+16175550199", releasedAt: "2026-05-20T12:00:00.000Z", status: "released" }],
    }).canProvisionTrialNumber).toBe(true);
  });

  it("treats an active Stripe subscription as paid even after the trial date", () => {
    const snapshot = buildBillingSnapshot({
      billingAccount: {
        cancelAtPeriodEnd: false,
        includedInteractions: 1800,
        monthlyCents: 39900,
        organizationId: "org_123",
        planId: "pro",
        planName: "Scale",
        status: "active",
      },
      draft,
      now: new Date("2026-05-27T12:00:00.000Z"),
      phoneNumbers: [{
        phoneNumber: "+16175550199",
        status: "in-use",
        trialEndsAt: "2026-05-12T12:00:00.000Z",
        trialGraceEndsAt: "2026-05-26T12:00:00.000Z",
      }],
    });

    expect(snapshot.billingStatus).toBe("active");
    expect(snapshot.monthlyPrice).toBe(399);
    expect(snapshot.planName).toBe("Scale");
    expect(snapshot.upgradeRequired).toBe(false);
  });

  it("surfaces overage counts and estimated overage dollars", () => {
    const snapshot = buildBillingSnapshot({
      callsThisMonth: 860,
      draft,
      now: new Date("2026-05-10T12:00:00.000Z"),
      phoneNumbers: [{ phoneNumber: "+16175550199", status: "in-use" }],
    });

    expect(snapshot.usagePercent).toBe(100);
    expect(snapshot.remainingInteractions).toBe(0);
    expect(snapshot.overageInteractions).toBe(60);
    expect(snapshot.estimatedOverageCents).toBe(2100);
    expect(snapshot.usageStatus).toBe("over_limit");
    expect(snapshot.usageDetail).toContain("60 interactions over");
    expect(snapshot.usageDetail).toContain("$21.00");
  });

  it("warns before a plan crosses into overage", () => {
    const snapshot = buildBillingSnapshot({
      callsThisMonth: 650,
      draft,
      now: new Date("2026-05-10T12:00:00.000Z"),
      phoneNumbers: [{ phoneNumber: "+16175550199", status: "in-use" }],
    });

    expect(snapshot.usageStatus).toBe("warning");
    expect(snapshot.remainingInteractions).toBe(150);
    expect(snapshot.usageDetail).toContain("150 interactions left");
  });

  it("normalizes Stripe return parameters", () => {
    expect(normalizeCheckoutReturn("success")).toBe("success");
    expect(normalizeCheckoutReturn("cancelled")).toBe("cancelled");
    expect(normalizeCheckoutReturn("canceled")).toBe("cancelled");
    expect(normalizeCheckoutReturn("anything-else")).toBeUndefined();
  });

  it("explains checkout return states for owners", () => {
    expect(buildBillingCheckoutNotice({
      checkoutReturn: "cancelled",
      status: "unconfigured",
    })).toMatchObject({
      title: "Checkout was canceled.",
      tone: "warning",
    });

    expect(buildBillingCheckoutNotice({
      checkoutReturn: "success",
      status: "active",
    })).toMatchObject({
      title: "Payment is active.",
      tone: "success",
    });

    expect(buildBillingCheckoutNotice({
      checkoutReturn: "success",
      fetching: false,
      status: "checkout_started",
    })).toMatchObject({
      title: "Waiting for Stripe confirmation.",
      tone: "info",
    });
  });
});
