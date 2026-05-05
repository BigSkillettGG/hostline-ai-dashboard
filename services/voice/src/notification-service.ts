import type { VoiceServiceEnv } from "./env";

export type StaffAlertKind = "complaint" | "handoff" | "order" | "reservation";

export interface StaffAlertInput {
  callId?: string;
  callerPhone?: string;
  details?: string[];
  kind: StaffAlertKind;
  locationId?: string;
  restaurantName: string;
  summary: string;
}

export interface StaffNotificationService {
  configured: boolean;
  sendStaffAlert(input: StaffAlertInput): Promise<void>;
}

export function createStaffNotificationService(env: VoiceServiceEnv): StaffNotificationService {
  const channels: StaffNotificationService[] = [];

  if (
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.STAFF_ALERT_SMS_TO &&
    (env.TWILIO_SMS_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID)
  ) {
    channels.push(new TwilioSmsStaffNotificationService(env));
  }

  if (env.STAFF_ALERT_WEBHOOK_URL) {
    channels.push(new WebhookStaffNotificationService(env.STAFF_ALERT_WEBHOOK_URL));
  }

  if (!channels.length) return new NoopStaffNotificationService();
  if (channels.length === 1) return channels[0];
  return new CompositeStaffNotificationService(channels);
}

export function formatStaffAlertMessage(input: StaffAlertInput) {
  const prefix = {
    complaint: "Complaint alert",
    handoff: "Human handoff",
    order: "New phone order",
    reservation: "Reservation request",
  } satisfies Record<StaffAlertKind, string>;

  const parts = [
    `${prefix[input.kind]} - ${input.restaurantName}`,
    input.callerPhone && `Caller: ${input.callerPhone}`,
    input.summary,
    ...(input.details ?? []),
  ].filter(Boolean);

  return truncate(parts.join("\n"), 900);
}

class NoopStaffNotificationService implements StaffNotificationService {
  configured = false;

  async sendStaffAlert(input: StaffAlertInput) {
    console.info("[staff-alerts] not configured; alert not sent", {
      kind: input.kind,
      summary: input.summary,
    });
  }
}

class CompositeStaffNotificationService implements StaffNotificationService {
  configured = true;

  constructor(private readonly channels: StaffNotificationService[]) {}

  async sendStaffAlert(input: StaffAlertInput) {
    await Promise.all(this.channels.map((channel) => channel.sendStaffAlert(input)));
  }
}

class TwilioSmsStaffNotificationService implements StaffNotificationService {
  configured = true;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly baseUrl: string;
  private readonly messagingServiceSid?: string;
  private readonly smsFromNumber?: string;
  private readonly smsTo: string;

  constructor(env: VoiceServiceEnv) {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
    this.smsFromNumber = env.TWILIO_SMS_FROM_NUMBER;
    this.smsTo = env.STAFF_ALERT_SMS_TO ?? "";
  }

  async sendStaffAlert(input: StaffAlertInput) {
    const body = new URLSearchParams({
      Body: formatStaffAlertMessage(input),
      To: this.smsTo,
    });

    if (this.messagingServiceSid) {
      body.set("MessagingServiceSid", this.messagingServiceSid);
    } else if (this.smsFromNumber) {
      body.set("From", this.smsFromNumber);
    }

    const response = await fetch(
      `${this.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
      {
        body,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Twilio staff alert failed: ${response.status} ${responseBody}`);
    }
  }
}

class WebhookStaffNotificationService implements StaffNotificationService {
  configured = true;

  constructor(private readonly webhookUrl: string) {}

  async sendStaffAlert(input: StaffAlertInput) {
    const response = await fetch(this.webhookUrl, {
      body: JSON.stringify({
        ...input,
        message: formatStaffAlertMessage(input),
        sentAt: new Date().toISOString(),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Staff alert webhook failed: ${response.status} ${body}`);
    }
  }
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
