import { describe, expect, it } from "vitest";
import { buildBillingSnapshot } from "./billing";

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
});
