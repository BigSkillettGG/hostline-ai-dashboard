import type { VoiceServiceEnv } from "./env";

export interface StripeBillingReadinessCheck {
  detail: string;
  id: string;
  label: string;
  ready: boolean;
  required: boolean;
}

export interface StripeBillingReadiness {
  checks: StripeBillingReadinessCheck[];
  expectedWebhookEvents: string[];
  mode: "live" | "test" | "unknown";
  ready: boolean;
  webhookUrl?: string;
  returnUrls: {
    cancelUrl?: string;
    portalReturnUrl?: string;
    successUrl?: string;
  };
}

const expectedWebhookEvents = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
];

export function getStripeBillingReadiness(env: VoiceServiceEnv): StripeBillingReadiness {
  const publicHttpBaseUrl = env.PUBLIC_HTTP_BASE_URL?.replace(/\/$/, "");
  const dashboardBaseUrl = env.DASHBOARD_PUBLIC_URL?.replace(/\/$/, "");
  const webhookUrl = publicHttpBaseUrl ? `${publicHttpBaseUrl}/stripe/webhook` : undefined;
  const successUrl = env.STRIPE_SUCCESS_URL ?? (dashboardBaseUrl ? `${dashboardBaseUrl}/app/billing?checkout=success` : undefined);
  const cancelUrl = env.STRIPE_CANCEL_URL ?? (dashboardBaseUrl ? `${dashboardBaseUrl}/app/billing?checkout=cancelled` : undefined);
  const portalReturnUrl = env.STRIPE_PORTAL_RETURN_URL ?? (dashboardBaseUrl ? `${dashboardBaseUrl}/app/billing` : undefined);
  const hasExplicitReturnPath = Boolean(successUrl && cancelUrl && portalReturnUrl);
  const canUseRequestOrigin =
    Boolean(env.VOICE_SERVICE_ALLOWED_ORIGIN && env.VOICE_SERVICE_ALLOWED_ORIGIN !== "*") ||
    env.VOICE_SERVICE_ALLOWED_ORIGIN === "*";

  const checks: StripeBillingReadinessCheck[] = [
    {
      detail: "Needed to create Checkout and Customer Portal sessions.",
      id: "stripe_secret_key",
      label: "Stripe secret key",
      ready: Boolean(env.STRIPE_SECRET_KEY),
      required: true,
    },
    {
      detail: "Needed to verify Stripe webhook signatures before activating subscriptions.",
      id: "stripe_webhook_secret",
      label: "Stripe webhook signing secret",
      ready: Boolean(env.STRIPE_WEBHOOK_SECRET),
      required: true,
    },
    {
      detail: webhookUrl
        ? `Create a Stripe webhook endpoint with this URL: ${webhookUrl}`
        : "Set PUBLIC_HTTP_BASE_URL on the voice service so Stripe has a public webhook URL.",
      id: "stripe_webhook_url",
      label: "Stripe webhook URL",
      ready: Boolean(webhookUrl),
      required: true,
    },
    {
      detail: "Needed to persist billing accounts and mark trial numbers as paid after activation.",
      id: "supabase_billing_persistence",
      label: "Supabase billing persistence",
      ready: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID),
      required: true,
    },
    {
      detail: hasExplicitReturnPath
        ? "Success, cancel, and customer-portal return URLs are configured."
        : "Checkout can use the dashboard request origin; set DASHBOARD_PUBLIC_URL or explicit Stripe return URLs for cleaner production ops.",
      id: "stripe_return_urls",
      label: "Dashboard return URLs",
      ready: hasExplicitReturnPath || canUseRequestOrigin,
      required: false,
    },
  ];

  return {
    checks,
    expectedWebhookEvents,
    mode: inferStripeMode(env.STRIPE_SECRET_KEY),
    ready: checks.filter((check) => check.required).every((check) => check.ready),
    returnUrls: {
      cancelUrl,
      portalReturnUrl,
      successUrl,
    },
    webhookUrl,
  };
}

function inferStripeMode(secretKey?: string) {
  if (secretKey?.startsWith("sk_live_")) return "live" as const;
  if (secretKey?.startsWith("sk_test_")) return "test" as const;
  return "unknown" as const;
}
