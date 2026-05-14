export type BillingPlanId = "basic" | "growth" | "pro";

export interface BillingPlan {
  businessType: string;
  includedInteractions: number;
  monthlyCents: number;
  name: string;
  overageLabel: string;
  planId: BillingPlanId;
  slug: string;
}

const plans: BillingPlan[] = [
  plan("restaurants", "restaurant", "basic", "Basic", 79, 250, "$0.45 per extra call or chat"),
  plan("restaurants", "restaurant", "growth", "Service", 199, 800, "$0.35 per extra call or chat"),
  plan("restaurants", "restaurant", "pro", "Scale", 399, 1800, "$0.25 per extra call or chat"),
  plan("hvac", "hvac", "basic", "Basic", 89, 200, "$0.55 per extra call or chat"),
  plan("hvac", "hvac", "growth", "Dispatch", 249, 700, "$0.40 per extra call or chat"),
  plan("hvac", "hvac", "pro", "Scale", 549, 1600, "$0.30 per extra call or chat"),
  plan("plumbers", "plumbing", "basic", "Basic", 79, 200, "$0.55 per extra call or chat"),
  plan("plumbers", "plumbing", "growth", "Dispatch", 229, 650, "$0.40 per extra call or chat"),
  plan("plumbers", "plumbing", "pro", "Scale", 499, 1500, "$0.30 per extra call or chat"),
  plan("roofers", "roofing", "basic", "Basic", 69, 175, "$0.55 per extra call or chat"),
  plan("roofers", "roofing", "growth", "Sales", 219, 600, "$0.40 per extra call or chat"),
  plan("roofers", "roofing", "pro", "Scale", 479, 1400, "$0.30 per extra call or chat"),
  plan("electricians", "electrical", "basic", "Basic", 79, 200, "$0.55 per extra call or chat"),
  plan("electricians", "electrical", "growth", "Dispatch", 239, 650, "$0.40 per extra call or chat"),
  plan("electricians", "electrical", "pro", "Scale", 519, 1500, "$0.30 per extra call or chat"),
  plan("hair-salons-barbershops", "salon_barber", "basic", "Basic", 49, 150, "$0.40 per extra call or chat"),
  plan("hair-salons-barbershops", "salon_barber", "growth", "Studio", 149, 500, "$0.30 per extra call or chat"),
  plan("hair-salons-barbershops", "salon_barber", "pro", "Scale", 349, 1200, "$0.22 per extra call or chat"),
];

export function resolveBillingPlan(input: { businessType?: string; planId?: string; planName?: string }): BillingPlan {
  const businessKey = normalizeBusinessKey(input.businessType);
  const planId = normalizePlanId(input.planId) ?? normalizePlanName(input.planName) ?? "growth";

  return (
    plans.find((candidate) => (candidate.slug === businessKey || candidate.businessType === businessKey) && candidate.planId === planId) ??
    plans.find((candidate) => candidate.slug === "restaurants" && candidate.planId === planId) ??
    plans.find((candidate) => candidate.slug === "restaurants" && candidate.planId === "growth") ??
    plans[0]
  );
}

export function listBillingPlans(input: { businessType?: string } = {}) {
  const businessKey = normalizeBusinessKey(input.businessType);
  const matches = plans.filter((candidate) => candidate.slug === businessKey || candidate.businessType === businessKey);
  return matches.length ? matches : plans.filter((candidate) => candidate.slug === "restaurants");
}

function plan(
  slug: string,
  businessType: string,
  planId: BillingPlanId,
  name: string,
  monthlyDollars: number,
  includedInteractions: number,
  overageLabel: string,
): BillingPlan {
  return {
    businessType,
    includedInteractions,
    monthlyCents: monthlyDollars * 100,
    name,
    overageLabel,
    planId,
    slug,
  };
}

function normalizeBusinessKey(value?: string) {
  const normalized = value?.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) return "restaurants";
  if (normalized === "restaurant") return "restaurants";
  if (normalized === "plumbing") return "plumbers";
  if (normalized === "roofing") return "roofers";
  if (normalized === "electrical") return "electricians";
  if (normalized === "salon-barber") return "hair-salons-barbershops";
  return normalized;
}

function normalizePlanId(value?: string): BillingPlanId | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "basic" || normalized === "growth" || normalized === "pro") return normalized;
  return undefined;
}

function normalizePlanName(value?: string): BillingPlanId | undefined {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("basic") || normalized.includes("starter")) return "basic";
  if (normalized.includes("scale") || normalized.includes("pro") || normalized.includes("premium")) return "pro";
  if (
    normalized.includes("service") ||
    normalized.includes("dispatch") ||
    normalized.includes("sales") ||
    normalized.includes("studio") ||
    normalized.includes("growth")
  ) {
    return "growth";
  }
  return undefined;
}
