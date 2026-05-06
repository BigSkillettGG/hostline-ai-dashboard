import type { VoiceServiceEnv } from "./env";
import {
  normalizeAlertRoutingConfig,
  resolveAlertRoute,
  type AlertRecipient,
  type AlertRouteKind,
  type AlertRoutingConfig,
  type AlertSeverity,
} from "../../../src/domain/alert-routing";

export type StaffAlertKind = AlertRouteKind;

export interface StaffAlertInput {
  callId?: string;
  callerPhone?: string;
  details?: string[];
  kind: StaffAlertKind;
  locationId?: string;
  restaurantName: string;
  severity?: AlertSeverity;
  summary: string;
}

export interface ResolvedStaffAlertRoute {
  emailRecipients: AlertRecipient[];
  enabled: boolean;
  fallbackUsed: boolean;
  recipients: AlertRecipient[];
  smsRecipients: AlertRecipient[];
}

export interface StaffNotificationService {
  configured: boolean;
  sendStaffAlert(input: StaffAlertInput, route?: ResolvedStaffAlertRoute): Promise<void>;
}

interface StaffAlertRoutingProvider {
  resolve(input: StaffAlertInput): Promise<ResolvedStaffAlertRoute>;
}

export function createStaffNotificationService(env: VoiceServiceEnv): StaffNotificationService {
  const channels: StaffNotificationService[] = [];

  if (
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    (env.TWILIO_SMS_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID)
  ) {
    channels.push(new TwilioSmsStaffNotificationService(env));
  }

  if (env.STAFF_ALERT_WEBHOOK_URL) {
    channels.push(new WebhookStaffNotificationService(env.STAFF_ALERT_WEBHOOK_URL));
  }

  if (!channels.length) return new NoopStaffNotificationService();

  const sink = channels.length === 1 ? channels[0] : new CompositeStaffNotificationService(channels);
  return new RoutedStaffNotificationService(sink, new SupabaseAlertRoutingProvider(env));
}

export function formatStaffAlertMessage(input: StaffAlertInput) {
  const prefix = {
    complaint: "Complaint alert",
    delivery_failure: "Order delivery failure",
    handoff: "Human handoff",
    low_confidence: "Low-confidence call",
    order: "New phone order",
    reservation: "Reservation request",
    sales: "Sales/vendor message",
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

class RoutedStaffNotificationService implements StaffNotificationService {
  configured: boolean;

  constructor(
    private readonly sink: StaffNotificationService,
    private readonly routingProvider: StaffAlertRoutingProvider,
  ) {
    this.configured = sink.configured;
  }

  async sendStaffAlert(input: StaffAlertInput) {
    const route = await this.routingProvider.resolve(input);

    if (!route.enabled) {
      console.info("[staff-alerts] route disabled; alert not sent", {
        kind: input.kind,
        summary: input.summary,
      });
      return;
    }

    await this.sink.sendStaffAlert(input, route);
  }
}

class CompositeStaffNotificationService implements StaffNotificationService {
  configured = true;

  constructor(private readonly channels: StaffNotificationService[]) {}

  async sendStaffAlert(input: StaffAlertInput, route?: ResolvedStaffAlertRoute) {
    await Promise.all(this.channels.map((channel) => channel.sendStaffAlert(input, route)));
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

  async sendStaffAlert(input: StaffAlertInput, route?: ResolvedStaffAlertRoute) {
    const recipients = route?.smsRecipients.length
      ? route.smsRecipients.map((recipient) => recipient.phone)
      : this.smsTo
        ? [this.smsTo]
        : [];

    await Promise.all(recipients.map((to) => this.sendSms(to, formatStaffAlertMessage(input))));
  }

  private async sendSms(to: string, message: string) {
    const body = new URLSearchParams({
      Body: message,
      To: to,
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

  async sendStaffAlert(input: StaffAlertInput, route?: ResolvedStaffAlertRoute) {
    const response = await fetch(this.webhookUrl, {
      body: JSON.stringify({
        ...input,
        message: formatStaffAlertMessage(input),
        route: route
          ? {
              emailRecipients: route.emailRecipients,
              fallbackUsed: route.fallbackUsed,
              recipients: route.recipients,
              smsRecipients: route.smsRecipients,
            }
          : undefined,
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

class SupabaseAlertRoutingProvider implements StaffAlertRoutingProvider {
  private readonly fallbackSmsTo?: string;
  private readonly key?: string;
  private readonly locationId?: string;
  private readonly restUrl?: string;

  constructor(env: VoiceServiceEnv) {
    this.fallbackSmsTo = env.STAFF_ALERT_SMS_TO;
    this.key = env.SUPABASE_SECRET_KEY;
    this.locationId = env.SUPABASE_DEMO_LOCATION_ID;
    this.restUrl = env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1` : undefined;
  }

  async resolve(input: StaffAlertInput): Promise<ResolvedStaffAlertRoute> {
    const config = await this.fetchConfig(input.locationId);

    if (config) {
      const resolved = resolveAlertRoute(config, input.kind, input.severity ?? defaultSeverityFor(input.kind));
      if (!resolved.enabled) return { ...resolved, fallbackUsed: false };
      if (resolved.recipients.length) return { ...resolved, fallbackUsed: false };
    }

    return this.fallbackRoute();
  }

  private async fetchConfig(locationId?: string): Promise<AlertRoutingConfig | null> {
    if (!this.restUrl || !this.key) return null;

    const resolvedLocationId = normalizeLocationId(locationId) ?? this.locationId;
    if (!resolvedLocationId) return null;

    try {
      const params = new URLSearchParams({
        limit: "1",
        location_id: `eq.${resolvedLocationId}`,
        select: "config,updated_at",
      });
      const response = await fetch(`${this.restUrl}/alert_routing_configs?${params.toString()}`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return null;

      const rows = (await response.json()) as Array<{ config: unknown; updated_at?: string | null }>;
      if (!rows[0]) return null;

      return normalizeAlertRoutingConfig({
        ...(isObjectRecord(rows[0].config) ? rows[0].config : {}),
        updatedAt: rows[0].updated_at ?? undefined,
      });
    } catch (error) {
      console.warn("[staff-alerts] alert routing lookup failed", error);
      return null;
    }
  }

  private fallbackRoute(): ResolvedStaffAlertRoute {
    const fallbackRecipient = this.fallbackSmsTo
      ? [
          {
            channel: "sms" as const,
            email: "",
            id: "env_staff_alert_sms_to",
            name: "Env staff alert recipient",
            phone: this.fallbackSmsTo,
          },
        ]
      : [];

    return {
      emailRecipients: [],
      enabled: true,
      fallbackUsed: true,
      recipients: fallbackRecipient,
      smsRecipients: fallbackRecipient,
    };
  }
}

function defaultSeverityFor(kind: StaffAlertKind): AlertSeverity {
  if (kind === "complaint" || kind === "delivery_failure") return "high";
  if (kind === "low_confidence") return "medium";
  return "medium";
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
