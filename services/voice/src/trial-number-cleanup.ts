import type { BillingService } from "./billing-service";
import type { PhoneNumberStore, TrialPhoneNumberReleaseCandidate } from "./phone-number-store";
import type { TelephonyService } from "./telephony";

export interface TrialNumberCleanupInput {
  dryRun?: boolean;
  limit?: number;
  now?: Date;
}

export interface TrialNumberCleanupResult {
  candidateCount: number;
  failed: Array<{ error: string; phoneNumber: string; providerSid: string }>;
  released: Array<{ phoneNumber: string; providerSid: string; status: "dry_run" | "released" }>;
  skipped: Array<{
    billingStatus?: string;
    error?: string;
    phoneNumber: string;
    providerSid: string;
    reason: "billing_check_failed" | "protected_billing_status";
  }>;
}

export async function releaseExpiredTrialNumbers(
  dependencies: {
    billingService: BillingService;
    phoneNumberStore: PhoneNumberStore;
    telephonyService: TelephonyService;
  },
  input: TrialNumberCleanupInput = {},
): Promise<TrialNumberCleanupResult> {
  const candidates = await dependencies.phoneNumberStore.listExpiredTrialNumbers({
    limit: input.limit,
    now: input.now,
  });
  const released: TrialNumberCleanupResult["released"] = [];
  const failed: TrialNumberCleanupResult["failed"] = [];
  const skipped: TrialNumberCleanupResult["skipped"] = [];

  for (const candidate of candidates) {
    const billingProtection = await checkBillingProtection(dependencies.billingService, candidate);
    if (billingProtection.protected) {
      skipped.push({
        billingStatus: billingProtection.status,
        error: billingProtection.error,
        phoneNumber: candidate.phoneNumber,
        providerSid: candidate.providerSid,
        reason: billingProtection.reason,
      });
      continue;
    }

    if (input.dryRun) {
      released.push({ phoneNumber: candidate.phoneNumber, providerSid: candidate.providerSid, status: "dry_run" });
      continue;
    }

    try {
      await dependencies.telephonyService.releasePhoneNumber({ providerSid: candidate.providerSid });
      await dependencies.phoneNumberStore.markNumberReleased({
        id: candidate.id,
        locationId: candidate.locationId,
        phoneNumber: candidate.phoneNumber,
        providerSid: candidate.providerSid,
        releaseReason: "trial_grace_expired",
      });
      released.push({ phoneNumber: candidate.phoneNumber, providerSid: candidate.providerSid, status: "released" });
    } catch (error) {
      failed.push({
        error: error instanceof Error ? error.message : "Release failed",
        phoneNumber: candidate.phoneNumber,
        providerSid: candidate.providerSid,
      });
    }
  }

  return { candidateCount: candidates.length, failed, released, skipped };
}

async function checkBillingProtection(
  billingService: BillingService,
  candidate: TrialPhoneNumberReleaseCandidate,
): Promise<
  | { protected: false }
  | {
      error?: string;
      protected: true;
      reason: "billing_check_failed" | "protected_billing_status";
      status?: string;
    }
> {
  try {
    const billing = await billingService.getStatus(candidate.locationId);
    const status = billing.account?.status;
    if (isProtectedBillingStatus(status)) {
      return { protected: true, reason: "protected_billing_status", status };
    }
    return { protected: false };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Billing status check failed",
      protected: true,
      reason: "billing_check_failed",
    };
  }
}

function isProtectedBillingStatus(status?: string) {
  const normalized = status?.toLowerCase();
  return (
    normalized === "active" ||
    normalized === "trialing" ||
    normalized === "past_due" ||
    normalized === "checkout_started" ||
    normalized === "incomplete"
  );
}
