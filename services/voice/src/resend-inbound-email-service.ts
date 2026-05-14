import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { VoiceServiceEnv } from "./env";
import type { EmailDeliveryService } from "./email-delivery-service";
import type { OwnerEmailCommandService } from "./owner-email-command-service";

export interface ResendInboundEmailResult {
  emailId?: string;
  ownerCommandStatus?: string;
  replyDelivery?: "failed" | "sent" | "skipped";
  status: "ignored" | "processed";
}

export interface ResendInboundEmailService {
  configured: boolean;
  verificationConfigured: boolean;
  handleWebhook(input: { headers: IncomingHttpHeaders; rawBody: string }): Promise<ResendInboundEmailResult>;
}

interface ResendWebhookEvent {
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    message_id?: string;
    subject?: string;
    to?: string | string[];
  };
  type?: string;
}

interface ResendReceivedEmail {
  bcc?: string[];
  cc?: string[];
  created_at?: string;
  from?: string;
  html?: string;
  id?: string;
  message_id?: string;
  subject?: string;
  text?: string;
  to?: string[];
}

export function createResendInboundEmailService(
  env: VoiceServiceEnv,
  ownerEmailCommandService: OwnerEmailCommandService,
  emailDeliveryService: EmailDeliveryService,
): ResendInboundEmailService {
  return new DefaultResendInboundEmailService(env, ownerEmailCommandService, emailDeliveryService);
}

class DefaultResendInboundEmailService implements ResendInboundEmailService {
  configured: boolean;
  verificationConfigured: boolean;
  private readonly apiKey?: string;
  private readonly inboundReplyTo?: string;
  private readonly webhookSecret?: string;

  constructor(
    private readonly env: VoiceServiceEnv,
    private readonly ownerEmailCommandService: OwnerEmailCommandService,
    private readonly emailDeliveryService: EmailDeliveryService,
  ) {
    this.apiKey = env.RESEND_API_KEY;
    this.inboundReplyTo = env.OWNER_EMAIL_INBOUND_ADDRESS;
    this.webhookSecret = env.RESEND_WEBHOOK_SECRET;
    this.configured = Boolean(env.RESEND_API_KEY && ownerEmailCommandService.configured);
    this.verificationConfigured = Boolean(env.RESEND_WEBHOOK_SECRET);
  }

  async handleWebhook(input: { headers: IncomingHttpHeaders; rawBody: string }): Promise<ResendInboundEmailResult> {
    if (!this.configured || !this.apiKey) {
      throw new Error("Resend inbound email needs RESEND_API_KEY and owner email commands configured.");
    }

    if (!this.webhookSecret && this.env.NODE_ENV === "production") {
      throw new Error("Resend inbound email needs RESEND_WEBHOOK_SECRET in production.");
    }

    if (this.webhookSecret) {
      verifySvixSignature({
        headers: input.headers,
        rawBody: input.rawBody,
        secret: this.webhookSecret,
      });
    }

    const event = JSON.parse(input.rawBody) as ResendWebhookEvent;
    if (event.type !== "email.received") {
      return { status: "ignored" };
    }

    const emailId = event.data?.email_id?.trim();
    if (!emailId) throw new Error("Resend email.received webhook is missing data.email_id.");

    const email = await this.retrieveReceivedEmail(emailId);
    const toEmails = normalizeEmailList(email.to ?? event.data?.to);
    const fromEmail = email.from ?? event.data?.from;
    const providerMessageId = email.message_id ?? event.data?.message_id ?? emailId;
    const ownerResult = await this.ownerEmailCommandService.handleInboundEmail({
      fromEmail,
      html: email.html,
      locationId: resolveLocationIdFromRecipients(toEmails),
      providerMessageId,
      rawPayload: {
        emailId,
        eventCreatedAt: event.created_at,
        eventType: event.type,
        provider: "resend",
        recipientCount: toEmails.length,
      },
      subject: email.subject ?? event.data?.subject,
      text: email.text,
      toEmail: toEmails[0],
    });

    const replyDelivery = await this.sendOwnerCommandReply({
      email,
      ownerReply: ownerResult.replyMessage,
      toEmail: fromEmail,
      toOriginal: toEmails[0],
    });

    return {
      emailId,
      ownerCommandStatus: ownerResult.status,
      replyDelivery,
      status: "processed",
    };
  }

  private async retrieveReceivedEmail(emailId: string): Promise<ResendReceivedEmail> {
    const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Resend received email retrieval failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as ResendReceivedEmail;
  }

  private async sendOwnerCommandReply(input: {
    email: ResendReceivedEmail;
    ownerReply: string;
    toEmail?: string;
    toOriginal?: string;
  }): Promise<ResendInboundEmailResult["replyDelivery"]> {
    const to = normalizeEmail(input.toEmail);
    if (!to || !input.ownerReply.trim()) return "skipped";
    if (!this.emailDeliveryService.configured) return "skipped";

    try {
      await this.emailDeliveryService.sendEmail({
        headers: buildReplyHeaders(input.email),
        replyTo: this.inboundReplyTo ?? input.toOriginal,
        subject: replySubject(input.email.subject),
        text: input.ownerReply,
        to,
      });
      return "sent";
    } catch (error) {
      console.warn("[resend-inbound-email] owner command reply delivery failed", error);
      return "failed";
    }
  }
}

export function verifySvixSignature(input: {
  headers: IncomingHttpHeaders;
  rawBody: string;
  secret: string;
  toleranceSeconds?: number;
}) {
  const id = firstHeader(input.headers["svix-id"]);
  const timestamp = firstHeader(input.headers["svix-timestamp"]);
  const signature = firstHeader(input.headers["svix-signature"]);
  if (!id || !timestamp || !signature) {
    throw new Error("Missing Resend webhook signature headers.");
  }

  const timestampNumber = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampNumber)) {
    throw new Error("Invalid Resend webhook timestamp.");
  }

  const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) {
    throw new Error("Resend webhook timestamp is outside the allowed tolerance.");
  }

  const signedContent = `${id}.${timestamp}.${input.rawBody}`;
  const expected = createHmac("sha256", normalizeSvixSecret(input.secret))
    .update(signedContent)
    .digest();
  const signatures = signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.match(/^v1,([^ ]+)$/)?.[1])
    .filter((part): part is string => Boolean(part));

  if (!signatures.some((candidate) => safeCompare(expected, Buffer.from(candidate, "base64")))) {
    throw new Error("Invalid Resend webhook signature.");
  }
}

function buildReplyHeaders(email: ResendReceivedEmail) {
  const headers: Record<string, string> = {};
  if (email.message_id) {
    headers["In-Reply-To"] = email.message_id;
    headers.References = email.message_id;
  }
  return Object.keys(headers).length ? headers : undefined;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSvixSecret(secret: string) {
  return secret.startsWith("whsec_") ? Buffer.from(secret.slice("whsec_".length), "base64") : Buffer.from(secret);
}

function safeCompare(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeEmailList(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => normalizeEmail(item)).filter((item): item is string => Boolean(item));
}

function normalizeEmail(value?: string) {
  return value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim().toLowerCase();
}

function replySubject(subject?: string) {
  const trimmed = subject?.trim();
  if (!trimmed) return "Re: SignalHost update";
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function resolveLocationIdFromRecipients(recipients: string[]) {
  for (const recipient of recipients) {
    const localPart = recipient.split("@")[0] ?? "";
    const match = localPart.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (match) return match[0];
  }
  return undefined;
}
