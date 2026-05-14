import type { Tenant } from "@/data/tenants";
import type { TenantDirectoryRecord, TenantDirectoryStatus } from "@/lib/supabase-rest";

export type PlatformBillingSource = "demo" | "live";
export type PlatformBillingTrialStatus = "active" | "grace_period" | "no_dates" | "no_number" | "released" | "release_due" | "trialing";
export type PlatformBillingUsageStatus = "near_limit" | "normal" | "not_configured" | "over_limit";

export interface PlatformBillingTenant {
  aiHostPhone?: string;
  billingStatus?: string;
  billingUpdatedAt?: string;
  businessLabel: string;
  callsThisMonth: number;
  estimatedOverageCents: number;
  id: string;
  includedInteractions: number;
  locationId: string;
  monthlyPrice: number;
  name: string;
  overageLabel?: string;
  overageInteractions: number;
  ownerEmail: string;
  planName: string;
  source: PlatformBillingSource;
  status: TenantDirectoryStatus;
  trialGraceEndsAt?: string;
  trialStatus: PlatformBillingTrialStatus;
  usagePercent: number;
  usageStatus: PlatformBillingUsageStatus;
}

export interface PlatformBillingSummary {
  arr: number;
  cleanupRiskCount: number;
  criticalSetupCount: number;
  demoCount: number;
  estimatedOverageCents: number;
  liveCount: number;
  mrr: number;
  nearLimitCount: number;
  overPlanCount: number;
  tenantCount: number;
}

export function mapDirectoryTenantToBillingTenant(
  tenant: TenantDirectoryRecord,
  now = new Date(),
): PlatformBillingTenant {
  return buildBillingTenant({
    aiHostPhone: tenant.aiHostPhone,
    businessLabel: tenant.businessLabel,
    callsThisMonth: tenant.callsThisMonth,
    id: tenant.locationId,
    includedInteractions: tenant.includedInteractions,
    locationId: tenant.locationId,
    monthlyPrice: tenant.monthlyPrice,
    name: tenant.locationName,
    billingStatus: tenant.billingStatus,
    billingUpdatedAt: tenant.billingUpdatedAt,
    overageLabel: tenant.overageLabel,
    ownerEmail: tenant.ownerEmail,
    phoneReleasedAt: tenant.phoneReleasedAt,
    phoneStatus: tenant.phoneStatus,
    planName: tenant.planName,
    source: "live",
    status: tenant.status,
    trialEndsAt: tenant.trialEndsAt,
    trialGraceEndsAt: tenant.trialGraceEndsAt,
  }, now);
}

export function mapMockTenantToBillingTenant(tenant: Tenant, now = new Date()): PlatformBillingTenant {
  return buildBillingTenant({
    aiHostPhone: tenant.aiNumber,
    businessLabel: "Restaurant",
    callsThisMonth: tenant.callsThisMonth,
    id: tenant.id,
    includedInteractions: tenant.includedCalls,
    locationId: tenant.id,
    monthlyPrice: Math.round(tenant.mrrCents / 100),
    name: tenant.name,
    ownerEmail: tenant.ownerEmail,
    planName: tenant.plan,
    source: "demo",
    status: tenant.status,
  }, now);
}

export function summarizePlatformBilling(rows: PlatformBillingTenant[]): PlatformBillingSummary {
  const mrr = rows.reduce((sum, tenant) => sum + tenant.monthlyPrice, 0);

  return {
    arr: mrr * 12,
    cleanupRiskCount: rows.filter((tenant) => tenant.trialStatus === "grace_period" || tenant.trialStatus === "release_due").length,
    criticalSetupCount: rows.filter((tenant) => tenant.status === "critical").length,
    demoCount: rows.filter((tenant) => tenant.source === "demo").length,
    estimatedOverageCents: rows.reduce((sum, tenant) => sum + tenant.estimatedOverageCents, 0),
    liveCount: rows.filter((tenant) => tenant.source === "live").length,
    mrr,
    nearLimitCount: rows.filter((tenant) => tenant.usageStatus === "near_limit").length,
    overPlanCount: rows.filter((tenant) => tenant.usageStatus === "over_limit").length,
    tenantCount: rows.length,
  };
}

function buildBillingTenant(input: {
  aiHostPhone?: string;
  businessLabel: string;
  callsThisMonth: number;
  id: string;
  includedInteractions: number;
  locationId: string;
  monthlyPrice: number;
  name: string;
  billingStatus?: string;
  billingUpdatedAt?: string;
  overageLabel?: string;
  ownerEmail: string;
  phoneReleasedAt?: string;
  phoneStatus?: string;
  planName: string;
  source: PlatformBillingSource;
  status: TenantDirectoryStatus;
  trialEndsAt?: string;
  trialGraceEndsAt?: string;
}, now: Date): PlatformBillingTenant {
  const includedInteractions = Math.max(0, Math.round(input.includedInteractions));
  const callsThisMonth = Math.max(0, Math.round(input.callsThisMonth));
  const overageInteractions = includedInteractions > 0 ? Math.max(0, callsThisMonth - includedInteractions) : 0;
  const usagePercent = includedInteractions > 0 ? Math.min(100, Math.round((callsThisMonth / includedInteractions) * 100)) : 0;
  const usageStatus = getUsageStatus({ includedInteractions, overageInteractions, usagePercent });
  const trialStatus = getTrialStatus(input, now);

  return {
    aiHostPhone: input.aiHostPhone,
    billingStatus: input.billingStatus,
    billingUpdatedAt: input.billingUpdatedAt,
    businessLabel: input.businessLabel,
    callsThisMonth,
    estimatedOverageCents: overageInteractions * overageCents(input.overageLabel ?? input.planName),
    id: input.id,
    includedInteractions,
    locationId: input.locationId,
    monthlyPrice: Math.max(0, Math.round(input.monthlyPrice)),
    name: input.name,
    overageLabel: input.overageLabel,
    overageInteractions,
    ownerEmail: input.ownerEmail,
    planName: input.planName || "Unassigned",
    source: input.source,
    status: input.status,
    trialGraceEndsAt: input.trialGraceEndsAt,
    trialStatus,
    usagePercent,
    usageStatus,
  };
}

function getUsageStatus(input: {
  includedInteractions: number;
  overageInteractions: number;
  usagePercent: number;
}): PlatformBillingUsageStatus {
  if (input.includedInteractions <= 0) return "not_configured";
  if (input.overageInteractions > 0) return "over_limit";
  if (input.usagePercent >= 80) return "near_limit";
  return "normal";
}

function getTrialStatus(input: {
  aiHostPhone?: string;
  phoneReleasedAt?: string;
  phoneStatus?: string;
  trialEndsAt?: string;
  trialGraceEndsAt?: string;
}, now: Date): PlatformBillingTrialStatus {
  if (input.phoneReleasedAt || input.phoneStatus === "released") return "released";
  if (!input.aiHostPhone) return "no_number";
  if (input.phoneStatus === "active") return "active";

  const trialEndsAt = parseDate(input.trialEndsAt);
  const trialGraceEndsAt = parseDate(input.trialGraceEndsAt);
  if (!trialEndsAt && !trialGraceEndsAt) return "no_dates";

  if (trialGraceEndsAt && now.getTime() > trialGraceEndsAt.getTime()) return "release_due";
  if (trialEndsAt && now.getTime() > trialEndsAt.getTime()) return "grace_period";
  return trialEndsAt ? "trialing" : "active";
}

function overageCents(labelOrPlanName: string) {
  const explicitRate = labelOrPlanName.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (explicitRate) {
    const dollars = Number.parseFloat(explicitRate[1]);
    if (Number.isFinite(dollars)) return Math.round(dollars * 100);
  }

  const normalized = labelOrPlanName.toLowerCase();
  if (normalized.includes("pro") || normalized.includes("scale")) return 25;
  if (normalized.includes("starter") || normalized.includes("basic")) return 45;
  return 35;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
