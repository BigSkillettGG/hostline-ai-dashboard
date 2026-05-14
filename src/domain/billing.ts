import type { OnboardingDraft } from "./onboarding";

export type BillingLifecycleStatus = "active" | "grace_period" | "not_started" | "released" | "release_due" | "trialing";
export type BillingCheckoutReturn = "cancelled" | "success";
export type BillingNoticeTone = "danger" | "info" | "success" | "warning";

export interface BillingAccountRecord {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  includedInteractions?: number;
  monthlyCents?: number;
  organizationId?: string;
  overageLabel?: string;
  planId?: string;
  planName?: string;
  status?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface BillingPhoneNumberRecord {
  phoneNumber: string;
  provisioningSource?: string;
  releasedAt?: string;
  status: string;
  trialEndsAt?: string;
  trialGraceEndsAt?: string;
  trialStartedAt?: string;
}

export interface BillingSnapshot {
  billingAccount?: BillingAccountRecord;
  billingStatus: "active" | "checkout_started" | "past_due" | "trialing" | "unpaid" | "unconfigured";
  businessType?: string;
  canProvisionTrialNumber: boolean;
  estimatedOverageCents: number;
  includedInteractions: number;
  lifecycleDetail: string;
  lifecycleLabel: string;
  lifecycleStatus: BillingLifecycleStatus;
  monthlyPrice: number;
  overageLabel: string;
  overageInteractions: number;
  planId?: string;
  planName: string;
  primaryNumber?: BillingPhoneNumberRecord;
  remainingInteractions: number;
  trialDaysRemaining?: number;
  trialGraceDaysRemaining?: number;
  upgradeRequired: boolean;
  usageDetail: string;
  usagePercent: number;
  usageStatus: "not_configured" | "normal" | "over_limit" | "warning";
  usedInteractions: number;
}

export interface BillingCheckoutNotice {
  detail: string;
  title: string;
  tone: BillingNoticeTone;
}

export function normalizeCheckoutReturn(value?: string | null): BillingCheckoutReturn | undefined {
  if (value === "success") return "success";
  if (value === "cancelled" || value === "canceled") return "cancelled";
  return undefined;
}

export function buildBillingCheckoutNotice(input: {
  checkoutReturn?: BillingCheckoutReturn;
  configured?: boolean;
  fetching?: boolean;
  status: BillingSnapshot["billingStatus"];
}): BillingCheckoutNotice | undefined {
  if (input.checkoutReturn === "cancelled") {
    return {
      detail: "No payment method or subscription change was saved. You can restart checkout whenever you are ready.",
      title: "Checkout was canceled.",
      tone: "warning",
    };
  }

  if (input.checkoutReturn !== "success") return undefined;

  if (input.status === "active" || input.status === "trialing") {
    return {
      detail: "Stripe has confirmed the subscription. The trial number stays attached to this location.",
      title: "Payment is active.",
      tone: "success",
    };
  }

  if (input.status === "past_due" || input.status === "unpaid") {
    return {
      detail: "Stripe returned a billing problem. Open checkout or the customer portal to fix the payment method.",
      title: "Payment still needs attention.",
      tone: "danger",
    };
  }

  if (input.fetching) {
    return {
      detail: "Stripe sent you back to SignalHost. I am checking the subscription status now.",
      title: "Checking payment status.",
      tone: "info",
    };
  }

  if (input.configured === false) {
    return {
      detail: "The app returned from checkout, but the voice service says Stripe is not configured. Add Stripe env vars and redeploy before relying on billing state.",
      title: "Checkout returned, but Stripe is not live.",
      tone: "warning",
    };
  }

  return {
    detail: "Stripe may still be sending the webhook. Refresh status in a few seconds; if it remains stuck, check the Stripe webhook secret and Render logs.",
    title: "Waiting for Stripe confirmation.",
    tone: "info",
  };
}

export function buildBillingSnapshot(input: {
  billingAccount?: BillingAccountRecord | null;
  callsThisMonth?: number;
  draft: OnboardingDraft;
  now?: Date;
  phoneNumbers?: BillingPhoneNumberRecord[];
}): BillingSnapshot {
  const now = input.now ?? new Date();
  const billingAccount = input.billingAccount ?? undefined;
  const usedInteractions = Math.max(0, Math.round(input.callsThisMonth ?? 0));
  const selectedPlanName = stringValue(input.draft.selectedPlanName);
  const includedInteractions =
    billingAccount?.includedInteractions ??
    readInteger(input.draft.selectedPlanIncludedInteractions) ??
    defaultIncludedInteractions(selectedPlanName);
  const primaryNumber = selectPrimaryPhoneNumber(input.phoneNumbers ?? []);
  const lifecycle = deriveBillingLifecycle(primaryNumber, now);
  const overageLabel = billingAccount?.overageLabel ?? stringValue(input.draft.selectedPlanOverage) ?? defaultOverageLabel(selectedPlanName);
  const remainingInteractions = includedInteractions > 0 ? Math.max(0, includedInteractions - usedInteractions) : 0;
  const overageInteractions = includedInteractions > 0 ? Math.max(0, usedInteractions - includedInteractions) : 0;
  const estimatedOverageCents = overageInteractions * (parseOverageCents(overageLabel) ?? 0);
  const usagePercent = includedInteractions > 0 ? Math.min(100, Math.round((usedInteractions / includedInteractions) * 100)) : 0;
  const billingStatus = deriveBillingStatus(billingAccount);
  const usage = deriveUsageState({
    estimatedOverageCents,
    includedInteractions,
    overageInteractions,
    remainingInteractions,
    usagePercent,
  });

  return {
    billingAccount,
    billingStatus,
    businessType: stringValue(input.draft.businessType),
    canProvisionTrialNumber: !primaryNumber || lifecycle.status === "released",
    estimatedOverageCents,
    includedInteractions,
    lifecycleDetail: lifecycle.detail,
    lifecycleLabel: lifecycle.label,
    lifecycleStatus: lifecycle.status,
    monthlyPrice: billingAccount?.monthlyCents ? Math.round(billingAccount.monthlyCents / 100) : readInteger(input.draft.selectedPlanMonthly) ?? defaultMonthlyPrice(selectedPlanName),
    overageInteractions,
    overageLabel,
    planId: billingAccount?.planId ?? stringValue(input.draft.selectedPlanId),
    planName: billingAccount?.planName ?? selectedPlanName ?? "Unassigned",
    primaryNumber,
    remainingInteractions,
    trialDaysRemaining: lifecycle.trialDaysRemaining,
    trialGraceDaysRemaining: lifecycle.trialGraceDaysRemaining,
    upgradeRequired: (lifecycle.status === "grace_period" || lifecycle.status === "release_due") && !isPaidBillingStatus(billingStatus),
    usageDetail: usage.detail,
    usagePercent,
    usageStatus: usage.status,
    usedInteractions,
  };
}

function deriveBillingStatus(account?: BillingAccountRecord): BillingSnapshot["billingStatus"] {
  const status = account?.status?.toLowerCase();
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "unpaid" || status === "incomplete_expired" || status === "canceled") return "unpaid";
  if (status === "checkout_started" || status === "incomplete") return "checkout_started";
  return "unconfigured";
}

function isPaidBillingStatus(status: BillingSnapshot["billingStatus"]) {
  return status === "active" || status === "trialing";
}

function selectPrimaryPhoneNumber(phoneNumbers: BillingPhoneNumberRecord[]) {
  return phoneNumbers.find((number) => !isReleased(number)) ?? phoneNumbers[0];
}

function deriveBillingLifecycle(number: BillingPhoneNumberRecord | undefined, now: Date) {
  if (!number) {
    return {
      detail: "No trial number has been assigned yet.",
      label: "Not started",
      status: "not_started" as const,
    };
  }

  if (isReleased(number)) {
    return {
      detail: "This trial number has been released and no longer receives calls.",
      label: "Released",
      status: "released" as const,
    };
  }

  const trialEnds = parseDate(number.trialEndsAt);
  const graceEnds = parseDate(number.trialGraceEndsAt);

  if (graceEnds && now.getTime() > graceEnds.getTime()) {
    return {
      detail: "The cleanup grace period has ended. This number should be released unless the account is upgraded.",
      label: "Release due",
      status: "release_due" as const,
      trialGraceDaysRemaining: 0,
    };
  }

  if (trialEnds && now.getTime() > trialEnds.getTime()) {
    const graceDays = graceEnds ? daysUntil(now, graceEnds) : undefined;
    return {
      detail: graceDays === undefined
        ? "The trial has ended. Add billing before sending real traffic."
        : `${graceDays} day${graceDays === 1 ? "" : "s"} left before number cleanup.`,
      label: "Grace period",
      status: "grace_period" as const,
      trialGraceDaysRemaining: graceDays,
    };
  }

  if (trialEnds) {
    const trialDays = daysUntil(now, trialEnds);
    return {
      detail: `${trialDays} day${trialDays === 1 ? "" : "s"} left in the free trial.`,
      label: "Trial active",
      status: "trialing" as const,
      trialDaysRemaining: trialDays,
      trialGraceDaysRemaining: graceEnds ? daysUntil(now, graceEnds) : undefined,
    };
  }

  return {
    detail: "Billing is active or managed manually for this location.",
    label: "Active",
    status: "active" as const,
  };
}

function isReleased(number: BillingPhoneNumberRecord) {
  return number.status === "released" || Boolean(number.releasedAt);
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function daysUntil(from: Date, to: Date) {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

function readInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveUsageState(input: {
  estimatedOverageCents: number;
  includedInteractions: number;
  overageInteractions: number;
  remainingInteractions: number;
  usagePercent: number;
}) {
  if (input.includedInteractions <= 0) {
    return {
      detail: "Choose a plan to set included monthly calls and chats.",
      status: "not_configured" as const,
    };
  }

  if (input.overageInteractions > 0) {
    const estimate = input.estimatedOverageCents > 0
      ? ` Estimated overage so far: ${formatCents(input.estimatedOverageCents)}.`
      : "";
    return {
      detail: `${input.overageInteractions.toLocaleString()} interaction${input.overageInteractions === 1 ? "" : "s"} over the included monthly amount.${estimate}`,
      status: "over_limit" as const,
    };
  }

  if (input.usagePercent >= 80) {
    return {
      detail: `${input.remainingInteractions.toLocaleString()} interaction${input.remainingInteractions === 1 ? "" : "s"} left before overage starts.`,
      status: "warning" as const,
    };
  }

  return {
    detail: `${input.remainingInteractions.toLocaleString()} included interaction${input.remainingInteractions === 1 ? "" : "s"} remaining this month.`,
    status: "normal" as const,
  };
}

function parseOverageCents(label: string) {
  const match = label.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const dollars = Number.parseFloat(match[1]);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

function formatCents(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value / 100);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function defaultIncludedInteractions(planName: unknown) {
  const normalized = String(planName ?? "").toLowerCase();
  if (normalized.includes("scale") || normalized.includes("pro") || normalized.includes("premium")) return 1800;
  if (normalized.includes("service") || normalized.includes("dispatch") || normalized.includes("growth") || normalized.includes("studio")) return 800;
  if (normalized.includes("basic") || normalized.includes("starter")) return 250;
  return 0;
}

function defaultMonthlyPrice(planName: unknown) {
  const normalized = String(planName ?? "").toLowerCase();
  if (normalized.includes("scale") || normalized.includes("pro") || normalized.includes("premium")) return 399;
  if (normalized.includes("service") || normalized.includes("dispatch") || normalized.includes("growth") || normalized.includes("studio")) return 199;
  if (normalized.includes("basic") || normalized.includes("starter")) return 79;
  return 0;
}

function defaultOverageLabel(planName: unknown) {
  const normalized = String(planName ?? "").toLowerCase();
  if (normalized.includes("scale") || normalized.includes("pro") || normalized.includes("premium")) return "$0.25 per extra call or chat";
  if (normalized.includes("service") || normalized.includes("dispatch") || normalized.includes("growth") || normalized.includes("studio")) return "$0.35 per extra call or chat";
  if (normalized.includes("basic") || normalized.includes("starter")) return "$0.45 per extra call or chat";
  return "Set after plan selection";
}
