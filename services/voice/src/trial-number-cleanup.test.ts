import { describe, expect, it, vi } from "vitest";
import { releaseExpiredTrialNumbers } from "./trial-number-cleanup";
import type { BillingService } from "./billing-service";
import type { BillingAccountRecord } from "./billing-store";
import type { PhoneNumberStore, TrialPhoneNumberReleaseCandidate } from "./phone-number-store";
import type { TelephonyService } from "./telephony";

const expiredCandidates: TrialPhoneNumberReleaseCandidate[] = [
  {
    id: "phone_1",
    locationId: "loc_1",
    phoneNumber: "+14155550101",
    providerSid: "PN101",
    trialGraceEndsAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "phone_2",
    locationId: "loc_2",
    phoneNumber: "+14155550102",
    providerSid: "PN102",
    trialGraceEndsAt: "2026-05-01T00:00:00.000Z",
  },
];

describe("trial number cleanup", () => {
  it("releases expired trial numbers when billing is not protected", async () => {
    const phoneNumberStore = createPhoneNumberStore(expiredCandidates);
    const telephonyService = createTelephonyService();

    const result = await releaseExpiredTrialNumbers({
      billingService: createBillingService({ loc_1: null, loc_2: { status: "canceled" } }),
      phoneNumberStore,
      telephonyService,
    });

    expect(result).toMatchObject({
      candidateCount: 2,
      failed: [],
      skipped: [],
      released: [
        { phoneNumber: "+14155550101", providerSid: "PN101", status: "released" },
        { phoneNumber: "+14155550102", providerSid: "PN102", status: "released" },
      ],
    });
    expect(telephonyService.releasePhoneNumber).toHaveBeenCalledTimes(2);
    expect(phoneNumberStore.markNumberReleased).toHaveBeenCalledWith(expect.objectContaining({
      locationId: "loc_1",
      releaseReason: "trial_grace_expired",
    }));
  });

  it("skips active, trialing, pending, and past-due billing statuses", async () => {
    const phoneNumberStore = createPhoneNumberStore(expiredCandidates);
    const telephonyService = createTelephonyService();

    const result = await releaseExpiredTrialNumbers({
      billingService: createBillingService({
        loc_1: { status: "active" },
        loc_2: { status: "checkout_started" },
      }),
      phoneNumberStore,
      telephonyService,
    });

    expect(result.released).toEqual([]);
    expect(result.skipped).toEqual([
      {
        billingStatus: "active",
        phoneNumber: "+14155550101",
        providerSid: "PN101",
        reason: "protected_billing_status",
      },
      {
        billingStatus: "checkout_started",
        phoneNumber: "+14155550102",
        providerSid: "PN102",
        reason: "protected_billing_status",
      },
    ]);
    expect(telephonyService.releasePhoneNumber).not.toHaveBeenCalled();
  });

  it("dry-runs releasable candidates without touching Twilio", async () => {
    const phoneNumberStore = createPhoneNumberStore([expiredCandidates[0]]);
    const telephonyService = createTelephonyService();

    const result = await releaseExpiredTrialNumbers({
      billingService: createBillingService({ loc_1: null }),
      phoneNumberStore,
      telephonyService,
    }, { dryRun: true });

    expect(result.released).toEqual([
      { phoneNumber: "+14155550101", providerSid: "PN101", status: "dry_run" },
    ]);
    expect(telephonyService.releasePhoneNumber).not.toHaveBeenCalled();
    expect(phoneNumberStore.markNumberReleased).not.toHaveBeenCalled();
  });

  it("skips release when billing status cannot be verified", async () => {
    const phoneNumberStore = createPhoneNumberStore([expiredCandidates[0]]);
    const telephonyService = createTelephonyService();

    const result = await releaseExpiredTrialNumbers({
      billingService: createBillingService({}, "Supabase billing failed"),
      phoneNumberStore,
      telephonyService,
    });

    expect(result.released).toEqual([]);
    expect(result.skipped).toEqual([
      {
        error: "Supabase billing failed",
        phoneNumber: "+14155550101",
        providerSid: "PN101",
        reason: "billing_check_failed",
      },
    ]);
    expect(telephonyService.releasePhoneNumber).not.toHaveBeenCalled();
  });
});

function createBillingService(
  accounts: Record<string, Partial<BillingAccountRecord> | null>,
  error?: string,
): BillingService {
  return {
    configured: true,
    async createCheckoutSession() {
      throw new Error("Not used");
    },
    async createCustomerPortalSession() {
      throw new Error("Not used");
    },
    async getStatus(locationId) {
      if (error) throw new Error(error);
      const account = locationId ? accounts[locationId] : null;
      return {
        account: account ? { cancelAtPeriodEnd: false, organizationId: "org_1", status: "unknown", ...account } : null,
        configured: true,
        usage: {
          estimatedOverageCents: 0,
          includedInteractions: 0,
          overageInteractions: 0,
          periodStart: "2026-05-01T00:00:00.000Z",
          remainingInteractions: 0,
          status: "not_configured",
          usedInteractions: 0,
          usageDetail: "Choose a plan to set included monthly calls and chats.",
          usagePercent: 0,
        },
      };
    },
    async handleWebhook() {
      throw new Error("Not used");
    },
  };
}

function createPhoneNumberStore(candidates: TrialPhoneNumberReleaseCandidate[]): PhoneNumberStore {
  return {
    async getLocationProvisioningGuard(locationId) {
      return { allowed: true, locationId: locationId ?? "loc_1" };
    },
    async listExpiredTrialNumbers() {
      return candidates;
    },
    async markLocationNumberPaid() {
      return undefined;
    },
    markNumberReleased: vi.fn(async () => undefined),
    async saveProvisionedNumber() {
      return undefined;
    },
  };
}

function createTelephonyService(): TelephonyService {
  return {
    configured: true,
    provisionPhoneNumber: vi.fn(async () => ({
      capabilities: { sms: true, voice: true },
      phoneNumber: "+14155550101",
      providerSid: "PN101",
      status: "in-use",
    })),
    releasePhoneNumber: vi.fn(async (input) => ({
      providerSid: input.providerSid,
      status: "released" as const,
    })),
    searchAvailableNumbers: vi.fn(async () => []),
  };
}
