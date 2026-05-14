import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { BillingStore } from "./billing-store";
import { resolveBillingPlan } from "./billing-plans";
import type { VoiceServiceEnv } from "./env";
import { HttpRequestError } from "./http-safety";
import type { PhoneNumberStore } from "./phone-number-store";

export interface CreateCheckoutSessionInput {
  businessType?: string;
  cancelUrl?: string;
  customerEmail?: string;
  locationId?: string;
  planId?: string;
  planName?: string;
  successUrl?: string;
}

export interface CreateCustomerPortalInput {
  locationId?: string;
  returnUrl?: string;
}

export interface BillingService {
  configured: boolean;
  createCheckoutSession(input: CreateCheckoutSessionInput, headers?: IncomingHttpHeaders): Promise<{ id: string; url: string }>;
  createCustomerPortalSession(input: CreateCustomerPortalInput, headers?: IncomingHttpHeaders): Promise<{ id: string; url: string }>;
  getStatus(locationId?: string): Promise<{ account: Awaited<ReturnType<BillingStore["getAccountByLocation"]>>; configured: boolean }>;
  handleWebhook(input: { rawBody: string; signature?: string }): Promise<{ handled: boolean; type?: string }>;
}

export function createBillingService(
  env: VoiceServiceEnv,
  store: BillingStore,
  phoneNumberStore?: Pick<PhoneNumberStore, "markLocationNumberPaid">,
): BillingService {
  return new StripeBillingService(env, store, phoneNumberStore);
}

class StripeBillingService implements BillingService {
  configured: boolean;
  private readonly env: VoiceServiceEnv;
  private readonly phoneNumberStore?: Pick<PhoneNumberStore, "markLocationNumberPaid">;
  private readonly store: BillingStore;

  constructor(env: VoiceServiceEnv, store: BillingStore, phoneNumberStore?: Pick<PhoneNumberStore, "markLocationNumberPaid">) {
    this.configured = Boolean(env.STRIPE_SECRET_KEY);
    this.env = env;
    this.phoneNumberStore = phoneNumberStore;
    this.store = store;
  }

  async getStatus(locationId?: string) {
    return {
      account: await this.store.getAccountByLocation(locationId),
      configured: this.configured,
    };
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput, headers: IncomingHttpHeaders = {}) {
    this.assertConfigured();
    const locationId = input.locationId ?? this.env.SUPABASE_DEMO_LOCATION_ID;
    const organizationId = await this.store.getLocationOrganizationId(locationId);
    if (!organizationId) {
      throw new HttpRequestError(400, "A real location with an organization is required before checkout.");
    }

    const plan = resolveBillingPlan({
      businessType: input.businessType,
      planId: input.planId,
      planName: input.planName,
    });
    const successUrl = resolveReturnUrl({
      env: this.env,
      fallbackPath: "/app/billing?checkout=success",
      headers,
      explicitUrl: input.successUrl,
      configuredUrl: this.env.STRIPE_SUCCESS_URL,
    });
    const cancelUrl = resolveReturnUrl({
      env: this.env,
      fallbackPath: "/app/billing?checkout=cancelled",
      headers,
      explicitUrl: input.cancelUrl,
      configuredUrl: this.env.STRIPE_CANCEL_URL,
    });

    await this.store.upsertAccount({
      includedInteractions: plan.includedInteractions,
      locationId,
      monthlyCents: plan.monthlyCents,
      organizationId,
      overageLabel: plan.overageLabel,
      planId: plan.planId,
      planName: plan.name,
      status: "checkout_started",
    });

    const session = await this.stripeRequest<StripeCheckoutSession>("/v1/checkout/sessions", {
      "allow_promotion_codes": "true",
      "billing_address_collection": "auto",
      "client_reference_id": organizationId,
      "customer_email": input.customerEmail?.trim(),
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][metadata][business_type]": plan.businessType,
      "line_items[0][price_data][product_data][metadata][plan_id]": plan.planId,
      "line_items[0][price_data][product_data][name]": `SignalHost ${plan.name}`,
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][unit_amount]": String(plan.monthlyCents),
      "line_items[0][quantity]": "1",
      "metadata[business_type]": plan.businessType,
      "metadata[included_interactions]": String(plan.includedInteractions),
      "metadata[location_id]": locationId,
      "metadata[organization_id]": organizationId,
      "metadata[overage_label]": plan.overageLabel,
      "metadata[plan_id]": plan.planId,
      "metadata[plan_name]": plan.name,
      "mode": "subscription",
      "subscription_data[metadata][business_type]": plan.businessType,
      "subscription_data[metadata][included_interactions]": String(plan.includedInteractions),
      "subscription_data[metadata][location_id]": locationId,
      "subscription_data[metadata][organization_id]": organizationId,
      "subscription_data[metadata][overage_label]": plan.overageLabel,
      "subscription_data[metadata][plan_id]": plan.planId,
      "subscription_data[metadata][plan_name]": plan.name,
      "success_url": successUrl,
      "cancel_url": cancelUrl,
    });

    if (!session.id || !session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    await this.store.upsertAccount({
      includedInteractions: plan.includedInteractions,
      locationId,
      monthlyCents: plan.monthlyCents,
      organizationId,
      overageLabel: plan.overageLabel,
      planId: plan.planId,
      planName: plan.name,
      status: "checkout_started",
      stripeCheckoutSessionId: session.id,
    });

    return { id: session.id, url: session.url };
  }

  async createCustomerPortalSession(input: CreateCustomerPortalInput, headers: IncomingHttpHeaders = {}) {
    this.assertConfigured();
    const account = await this.store.getAccountByLocation(input.locationId ?? this.env.SUPABASE_DEMO_LOCATION_ID);
    if (!account?.stripeCustomerId) {
      throw new HttpRequestError(409, "No Stripe customer exists yet. Start checkout first.");
    }

    const returnUrl = resolveReturnUrl({
      env: this.env,
      fallbackPath: "/app/billing",
      headers,
      explicitUrl: input.returnUrl,
      configuredUrl: this.env.STRIPE_PORTAL_RETURN_URL,
    });

    const session = await this.stripeRequest<StripePortalSession>("/v1/billing_portal/sessions", {
      customer: account.stripeCustomerId,
      return_url: returnUrl,
    });

    if (!session.id || !session.url) {
      throw new Error("Stripe did not return a customer portal URL.");
    }

    return { id: session.id, url: session.url };
  }

  async handleWebhook(input: { rawBody: string; signature?: string }) {
    if (!this.env.STRIPE_WEBHOOK_SECRET) {
      throw new HttpRequestError(503, "Stripe webhook secret is not configured.");
    }
    verifyStripeSignature({
      rawBody: input.rawBody,
      secret: this.env.STRIPE_WEBHOOK_SECRET,
      signatureHeader: input.signature,
    });

    const event = JSON.parse(input.rawBody) as StripeEvent;
    if (event.type === "checkout.session.completed") {
      await this.handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
      return { handled: true, type: event.type };
    }

    if (event.type.startsWith("customer.subscription.")) {
      await this.handleSubscription(event.data.object as StripeSubscription);
      return { handled: true, type: event.type };
    }

    if (event.type === "invoice.payment_failed") {
      await this.handleInvoice(event.data.object as StripeInvoice, "past_due");
      return { handled: true, type: event.type };
    }

    if (event.type === "invoice.payment_succeeded") {
      await this.handleInvoice(event.data.object as StripeInvoice, "active");
      return { handled: true, type: event.type };
    }

    return { handled: false, type: event.type };
  }

  private async handleCheckoutCompleted(session: StripeCheckoutSession) {
    const metadata = session.metadata ?? {};
    const organizationId = metadata.organization_id;
    if (!organizationId) return;

    await this.store.upsertAccount({
      includedInteractions: integerMetadata(metadata.included_interactions),
      locationId: metadata.location_id,
      organizationId,
      overageLabel: metadata.overage_label,
      planId: metadata.plan_id,
      planName: metadata.plan_name,
      status: "active",
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: stringId(session.customer),
      stripeSubscriptionId: stringId(session.subscription),
    });
    await this.markLocationNumberPaid(metadata.location_id, "stripe_checkout_completed");
  }

  private async handleSubscription(subscription: StripeSubscription) {
    const metadata = subscription.metadata ?? {};
    const organizationId = metadata.organization_id;
    if (!organizationId) return;

    await this.store.upsertAccount({
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: timestampToIso(subscription.current_period_end),
      currentPeriodStart: timestampToIso(subscription.current_period_start),
      includedInteractions: integerMetadata(metadata.included_interactions),
      locationId: metadata.location_id,
      organizationId,
      overageLabel: metadata.overage_label,
      planId: metadata.plan_id,
      planName: metadata.plan_name,
      status: subscription.status ?? "unknown",
      stripeCustomerId: stringId(subscription.customer),
      stripeSubscriptionId: subscription.id,
      trialEnd: timestampToIso(subscription.trial_end),
    });
    if (isPhoneNumberProtectedBySubscription(subscription.status)) {
      await this.markLocationNumberPaid(metadata.location_id, `stripe_subscription_${subscription.status ?? "unknown"}`);
    }
  }

  private async handleInvoice(invoice: StripeInvoice, status: string) {
    const subscriptionId = stringId(invoice.subscription);
    if (!subscriptionId) return;
    const organizationId = invoice.subscription_details?.metadata?.organization_id;
    if (!organizationId) return;
    const locationId = invoice.subscription_details?.metadata?.location_id;

    await this.store.upsertAccount({
      organizationId,
      status,
      stripeCustomerId: stringId(invoice.customer),
      stripeSubscriptionId: subscriptionId,
    });
    if (status === "active") {
      await this.markLocationNumberPaid(locationId, "stripe_invoice_payment_succeeded");
    }
  }

  private async markLocationNumberPaid(locationId?: string, reason?: string) {
    if (!locationId || !this.phoneNumberStore) return;
    await this.phoneNumberStore.markLocationNumberPaid({ locationId, reason });
  }

  private async stripeRequest<T>(path: string, params: Record<string, string | undefined>) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") body.set(key, value);
    }

    const response = await fetch(`https://api.stripe.com${path}`, {
      body,
      headers: {
        Authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Stripe request failed: ${response.status} ${text}`);
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  private assertConfigured() {
    if (!this.configured) {
      throw new HttpRequestError(503, "Stripe billing is not configured.");
    }
  }
}

interface StripeEvent {
  data: { object: unknown };
  type: string;
}

interface StripeCheckoutSession {
  customer?: string | { id?: string } | null;
  id?: string;
  metadata?: Record<string, string | undefined>;
  subscription?: string | { id?: string } | null;
  url?: string;
}

interface StripeSubscription {
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  current_period_start?: number | null;
  customer?: string | { id?: string } | null;
  id?: string;
  metadata?: Record<string, string | undefined>;
  status?: string;
  trial_end?: number | null;
}

interface StripeInvoice {
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  subscription_details?: {
    metadata?: Record<string, string | undefined>;
  };
}

interface StripePortalSession {
  id?: string;
  url?: string;
}

function resolveReturnUrl({
  configuredUrl,
  env,
  explicitUrl,
  fallbackPath,
  headers,
}: {
  configuredUrl?: string;
  env: VoiceServiceEnv;
  explicitUrl?: string;
  fallbackPath: string;
  headers: IncomingHttpHeaders;
}) {
  const candidate = explicitUrl || configuredUrl;
  if (candidate && isAllowedReturnUrl(candidate, env)) return candidate;

  const origin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
  if (origin && isAllowedReturnUrl(origin, env)) return `${origin.replace(/\/$/, "")}${fallbackPath}`;

  const dashboardBaseUrl = env.DASHBOARD_PUBLIC_URL?.replace(/\/$/, "");
  if (dashboardBaseUrl) return `${dashboardBaseUrl}${fallbackPath}`;

  return `http://localhost:5173${fallbackPath}`;
}

function isAllowedReturnUrl(value: string, env: VoiceServiceEnv) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
    const allowed = env.VOICE_SERVICE_ALLOWED_ORIGIN;
    if (!allowed || allowed === "*") return true;
    return allowed.split(",").map((origin) => origin.trim().replace(/\/$/, "")).includes(url.origin);
  } catch {
    return false;
  }
}

function verifyStripeSignature({
  rawBody,
  secret,
  signatureHeader,
}: {
  rawBody: string;
  secret: string;
  signatureHeader?: string;
}) {
  const entries = Object.fromEntries((signatureHeader ?? "").split(",").map((entry) => {
    const [key, value] = entry.split("=");
    return [key, value];
  }));
  const timestamp = entries.t;
  const signature = entries.v1;
  if (!timestamp || !signature) {
    throw new HttpRequestError(400, "Missing Stripe signature.");
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new HttpRequestError(400, "Invalid Stripe signature.");
  }
}

function timestampToIso(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : undefined;
}

function isPhoneNumberProtectedBySubscription(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "active" || normalized === "trialing" || normalized === "past_due";
}

function stringId(value?: string | { id?: string } | null) {
  if (typeof value === "string") return value;
  return value?.id;
}

function integerMetadata(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
