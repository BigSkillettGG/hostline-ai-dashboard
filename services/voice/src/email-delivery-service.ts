import type { VoiceServiceEnv } from "./env";

export interface EmailDeliveryInput {
  html?: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string | string[];
}

export interface EmailDeliveryResult {
  id?: string;
  provider: "none" | "resend";
  status: "sent";
}

export interface EmailDeliveryService {
  configured: boolean;
  provider: "none" | "resend";
  sendEmail(input: EmailDeliveryInput): Promise<EmailDeliveryResult>;
}

export function createEmailDeliveryService(env: VoiceServiceEnv): EmailDeliveryService {
  const provider = resolveEmailProvider(env);
  if (provider === "resend" && env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmailDeliveryService({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    });
  }

  return new NoopEmailDeliveryService(provider);
}

class NoopEmailDeliveryService implements EmailDeliveryService {
  configured = false;

  constructor(readonly provider: "none" | "resend") {}

  async sendEmail(): Promise<EmailDeliveryResult> {
    throw new Error(
      this.provider === "resend"
        ? "Email delivery needs RESEND_API_KEY and EMAIL_FROM."
        : "Email delivery provider is not configured.",
    );
  }
}

class ResendEmailDeliveryService implements EmailDeliveryService {
  configured = true;
  provider = "resend" as const;

  constructor(
    private readonly options: {
      apiKey: string;
      from: string;
      replyTo?: string;
    },
  ) {}

  async sendEmail(input: EmailDeliveryInput): Promise<EmailDeliveryResult> {
    const to = normalizeRecipients(input.to);
    if (!to.length) throw new Error("Email delivery needs at least one recipient.");

    const response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: this.options.from,
        html: input.html,
        reply_to: input.replyTo ?? this.options.replyTo,
        subject: input.subject,
        text: input.text,
        to,
      }),
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Resend email delivery failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return {
      id: body.id,
      provider: "resend",
      status: "sent",
    };
  }
}

function resolveEmailProvider(env: VoiceServiceEnv): "none" | "resend" {
  if (env.EMAIL_PROVIDER === "resend" || env.RESEND_API_KEY) return "resend";
  return "none";
}

function normalizeRecipients(value: string | string[]) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => item.trim()).filter(Boolean);
}
