import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

export interface BillingAccountRecord {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  includedInteractions?: number;
  locationId?: string;
  monthlyCents?: number;
  organizationId: string;
  overageLabel?: string;
  planId?: string;
  planName?: string;
  status: string;
  stripeCheckoutSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEnd?: string;
  updatedAt?: string;
}

export interface BillingAccountUpdate {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  includedInteractions?: number;
  locationId?: string;
  monthlyCents?: number;
  organizationId?: string;
  overageLabel?: string;
  planId?: string;
  planName?: string;
  status?: string;
  stripeCheckoutSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEnd?: string;
}

export interface BillingStore {
  configured: boolean;
  getAccountByLocation(locationId?: string): Promise<BillingAccountRecord | null>;
  getLocationOrganizationId(locationId?: string): Promise<string | null>;
  upsertAccount(input: BillingAccountUpdate & { organizationId: string }): Promise<void>;
}

export function createBillingStore(env: VoiceServiceEnv): BillingStore {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    return new SupabaseBillingStore({
      defaultLocationId: env.SUPABASE_DEMO_LOCATION_ID,
      key: env.SUPABASE_SECRET_KEY,
      url: env.SUPABASE_URL,
    });
  }

  return new NoopBillingStore();
}

class NoopBillingStore implements BillingStore {
  configured = false;

  async getAccountByLocation(): Promise<BillingAccountRecord | null> {
    return null;
  }

  async getLocationOrganizationId(): Promise<string | null> {
    return null;
  }

  async upsertAccount(input: BillingAccountUpdate & { organizationId: string }): Promise<void> {
    console.info("[billing-store] Supabase not configured; billing account not persisted", {
      organizationId: input.organizationId,
      status: input.status,
    });
  }
}

class SupabaseBillingStore implements BillingStore {
  configured = true;
  private readonly defaultLocationId?: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor({ defaultLocationId, key, url }: { defaultLocationId?: string; key: string; url: string }) {
    this.defaultLocationId = defaultLocationId;
    this.key = key;
    this.restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
  }

  async getAccountByLocation(locationId?: string) {
    const normalizedLocationId = normalizeLocationId(locationId) ?? this.defaultLocationId;
    const organizationId = await this.getLocationOrganizationId(normalizedLocationId);
    if (!organizationId) return null;

    const rows = await this.get<BillingAccountRow[]>(
      "billing_accounts",
      new URLSearchParams({
        limit: "1",
        organization_id: `eq.${organizationId}`,
        select: billingAccountSelectColumns,
      }),
    );

    return rows[0] ? mapBillingAccount(rows[0]) : null;
  }

  async getLocationOrganizationId(locationId?: string) {
    const normalizedLocationId = normalizeLocationId(locationId) ?? this.defaultLocationId;
    if (!normalizedLocationId) return null;

    const rows = await this.get<Array<{ organization_id: string | null }>>(
      "locations",
      new URLSearchParams({
        id: `eq.${normalizedLocationId}`,
        limit: "1",
        select: "organization_id",
      }),
    );

    return rows[0]?.organization_id ?? null;
  }

  async upsertAccount(input: BillingAccountUpdate & { organizationId: string }) {
    const now = new Date().toISOString();
    await this.request("billing_accounts", {
      body: {
        cancel_at_period_end: input.cancelAtPeriodEnd,
        current_period_end: input.currentPeriodEnd,
        current_period_start: input.currentPeriodStart,
        included_interactions: input.includedInteractions,
        location_id: normalizeLocationId(input.locationId),
        monthly_cents: input.monthlyCents,
        organization_id: input.organizationId,
        overage_label: input.overageLabel,
        plan_id: input.planId,
        plan_name: input.planName,
        status: input.status,
        stripe_checkout_session_id: input.stripeCheckoutSessionId,
        stripe_customer_id: input.stripeCustomerId,
        stripe_subscription_id: input.stripeSubscriptionId,
        trial_end: input.trialEnd,
        updated_at: now,
      },
      headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
      method: "POST",
      query: "on_conflict=organization_id",
    });
  }

  private async request(
    table: string,
    options: {
      body: Record<string, unknown>;
      headers?: Record<string, string>;
      method: "POST";
      query?: string;
    },
  ) {
    const body = Object.fromEntries(Object.entries(options.body).filter(([, value]) => value !== undefined));
    const query = options.query ? `?${options.query}` : "";
    const response = await fetch(`${this.restUrl}/${table}${query}`, {
      body: JSON.stringify(body),
      headers: buildSupabaseServiceHeaders(this.key, options.headers),
      method: options.method,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase ${options.method} ${table} failed: ${response.status} ${text}`);
    }
  }

  private async get<T>(table: string, params: URLSearchParams): Promise<T> {
    const response = await fetch(`${this.restUrl}/${table}?${params.toString()}`, {
      headers: buildSupabaseServiceHeaders(this.key),
      method: "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase GET ${table} failed: ${response.status} ${body}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

interface BillingAccountRow {
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  current_period_start: string | null;
  included_interactions: number | null;
  location_id: string | null;
  monthly_cents: number | null;
  organization_id: string;
  overage_label: string | null;
  plan_id: string | null;
  plan_name: string | null;
  status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  updated_at: string | null;
}

const billingAccountSelectColumns =
  "organization_id,location_id,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,status,plan_id,plan_name,monthly_cents,included_interactions,overage_label,current_period_start,current_period_end,trial_end,cancel_at_period_end,updated_at";

function mapBillingAccount(row: BillingAccountRow): BillingAccountRecord {
  return {
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end ?? undefined,
    currentPeriodStart: row.current_period_start ?? undefined,
    includedInteractions: row.included_interactions ?? undefined,
    locationId: row.location_id ?? undefined,
    monthlyCents: row.monthly_cents ?? undefined,
    organizationId: row.organization_id,
    overageLabel: row.overage_label ?? undefined,
    planId: row.plan_id ?? undefined,
    planName: row.plan_name ?? undefined,
    status: row.status ?? "unknown",
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? undefined,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    trialEnd: row.trial_end ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}
