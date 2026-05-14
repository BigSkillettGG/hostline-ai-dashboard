import type { VoiceServiceEnv, VoiceServiceReadinessCheck } from "./env";

export interface EmailReadiness {
  checks: VoiceServiceReadinessCheck[];
  fallbackInboundAddress?: string;
  outboundFrom?: string;
  ready: boolean;
  receivingDomain: string;
  setupSteps: string[];
  webhookUrl?: string;
}

const defaultReceivingDomain = "agents.signalhost.ai";

export function getEmailReadiness(env: VoiceServiceEnv): EmailReadiness {
  const webhookUrl = env.PUBLIC_HTTP_BASE_URL
    ? `${env.PUBLIC_HTTP_BASE_URL.replace(/\/$/, "")}/resend/inbound-email`
    : undefined;
  const fallbackInboundAddress = env.OWNER_EMAIL_INBOUND_ADDRESS?.trim();
  const receivingDomain = domainFromEmail(fallbackInboundAddress) ?? defaultReceivingDomain;
  const hasResendProvider = env.EMAIL_PROVIDER === "resend" || Boolean(env.RESEND_API_KEY);

  const checks: VoiceServiceReadinessCheck[] = [
    {
      detail: "Needed so Resend can call the voice service when an email arrives.",
      id: "public_http_base_url",
      label: "Public voice service URL",
      ready: Boolean(webhookUrl),
      required: true,
    },
    {
      detail: "Needed to fetch received emails from Resend and send owner replies.",
      id: "resend_api_key",
      label: "Resend API key",
      ready: Boolean(env.RESEND_API_KEY && hasResendProvider),
      required: true,
    },
    {
      detail: "Needed to send replies, reports, and alerts from SignalHost.",
      id: "email_from",
      label: "Outbound from address",
      ready: Boolean(env.EMAIL_FROM),
      required: true,
    },
    {
      detail: "Needed to reject forged inbound email webhooks.",
      id: "resend_webhook_secret",
      label: "Resend webhook signing secret",
      ready: Boolean(env.RESEND_WEBHOOK_SECRET),
      required: true,
    },
    {
      detail: "Used when an inbound email is not addressed to a generated per-business alias.",
      id: "fallback_inbound_address",
      label: "Fallback inbound address",
      ready: Boolean(fallbackInboundAddress),
      required: true,
    },
    {
      detail: "Needed to match trusted owner emails, run commands, and write owner activity.",
      id: "owner_command_supabase",
      label: "Owner command storage",
      ready: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID),
      required: true,
    },
  ];

  return {
    checks,
    fallbackInboundAddress,
    outboundFrom: env.EMAIL_FROM,
    ready: checks.filter((check) => check.required).every((check) => check.ready),
    receivingDomain,
    setupSteps: [
      `In Resend, keep sending enabled for signalhost.ai and enable receiving on ${receivingDomain}.`,
      webhookUrl
        ? `Create a Resend inbound route for ${receivingDomain} and set its webhook URL to ${webhookUrl}.`
        : "Set PUBLIC_HTTP_BASE_URL on Render so SignalHost can generate the Resend webhook URL.",
      "Copy the Resend webhook signing secret into Render as RESEND_WEBHOOK_SECRET.",
      fallbackInboundAddress
        ? `Set the fallback inbound address to ${fallbackInboundAddress}.`
        : `Set OWNER_EMAIL_INBOUND_ADDRESS to updates@${receivingDomain}.`,
      "Send a test email from a trusted owner or manager email to the agent alias in the launch center.",
    ],
    webhookUrl,
  };
}

function domainFromEmail(value?: string) {
  const domain = value?.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1]?.trim().toLowerCase();
  return domain || undefined;
}
