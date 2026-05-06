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

interface StaffAlertEventLogger {
  record(input: StaffAlertEventLogInput): Promise<void>;
}

interface StaffAlertEventLogInput {
  errorMessage?: string;
  input: StaffAlertInput;
  message: string;
  route: ResolvedStaffAlertRoute;
  status: "failed" | "sent" | "skipped";
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

  const sink = channels.length === 0
    ? new NoopStaffNotificationService()
    : channels.length === 1
      ? channels[0]
      : new CompositeStaffNotificationService(channels);
  return new RoutedStaffNotificationService(
    sink,
    new SupabaseAlertRoutingProvider(env),
    new SupabaseStaffAlertEventLogger(env),
  );
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
    private readonly eventLogger: StaffAlertEventLogger,
  ) {
    this.configured = sink.configured;
  }

  async sendStaffAlert(input: StaffAlertInput) {
    const route = await this.routingProvider.resolve(input);
    const message = formatStaffAlertMessage(input);

    if (!route.enabled) {
      console.info("[staff-alerts] route disabled; alert not sent", {
        kind: input.kind,
        summary: input.summary,
      });
      await this.eventLogger.record({
        errorMessage: "Route disabled",
        input,
        message,
        route,
        status: "skipped",
      });
      return;
    }

    if (!this.sink.configured) {
      await this.sink.sendStaffAlert(input, route);
      await this.eventLogger.record({
        errorMessage: "No staff alert delivery channels configured",
        input,
        message,
        route,
        status: "skipped",
      });
      return;
    }

    try {
      await this.sink.sendStaffAlert(input, route);
      await this.eventLogger.record({
        input,
        message,
        route,
        status: "sent",
      });
    } catch (error) {
      await this.eventLogger.record({
        errorMessage: error instanceof Error ? error.message : "Staff alert delivery failed",
        input,
        message,
        route,
        status: "failed",
      });
      throw error;
    }
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

class SupabaseStaffAlertEventLogger implements StaffAlertEventLogger {
  private readonly key?: string;
  private readonly locationId?: string;
  private readonly restUrl?: string;

  constructor(env: VoiceServiceEnv) {
    this.key = env.SUPABASE_SECRET_KEY;
    this.locationId = env.SUPABASE_DEMO_LOCATION_ID;
    this.restUrl = env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1` : undefined;
  }

  async record(input: StaffAlertEventLogInput) {
    if (!this.restUrl || !this.key) return;

    const locationId = normalizeLocationId(input.input.locationId) ?? this.locationId;
    if (!locationId) return;

    try {
      const now = new Date().toISOString();
      const response = await fetch(`${this.restUrl}/staff_alert_events`, {
        body: JSON.stringify({
          call_id: normalizeUuid(input.input.callId) ?? null,
          caller_phone: input.input.callerPhone ?? null,
          channels: channelsForRoute(input.route),
          error_message: input.errorMessage ?? null,
          kind: input.input.kind,
          location_id: locationId,
          message: input.message,
          recipients: input.route.recipients,
          route_snapshot: {
            emailRecipientCount: input.route.emailRecipients.length,
            enabled: input.route.enabled,
            fallbackUsed: input.route.fallbackUsed,
            smsRecipientCount: input.route.smsRecipients.length,
          },
          sent_at: input.status === "sent" ? now : null,
          severity: input.input.severity ?? defaultSeverityFor(input.input.kind),
          status: input.status,
          summary: input.input.summary,
        }),
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        console.warn("[staff-alerts] alert event log failed", response.status, await response.text());
        return;
      }

      await this.createFollowUpTask(input, locationId, now);
    } catch (error) {
      console.warn("[staff-alerts] alert event log failed", error);
    }
  }

  private async createFollowUpTask(input: StaffAlertEventLogInput, locationId: string, createdAt: string) {
    if (!this.restUrl || !this.key || !shouldCreateStaffTask(input)) return;

    try {
      const response = await fetch(`${this.restUrl}/staff_tasks`, {
        body: JSON.stringify({
          body: buildStaffTaskBody(input),
          call_id: normalizeUuid(input.input.callId) ?? null,
          due_at: taskDueAt(input, createdAt),
          location_id: locationId,
          priority: taskPriorityFor(input),
          status: "open",
          task_type: taskTypeFor(input.input.kind),
          title: taskTitleFor(input),
        }),
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        console.warn("[staff-alerts] staff task create failed", response.status, await response.text());
      }
    } catch (error) {
      console.warn("[staff-alerts] staff task create failed", error);
    }
  }
}

function defaultSeverityFor(kind: StaffAlertKind): AlertSeverity {
  if (kind === "complaint" || kind === "delivery_failure") return "high";
  if (kind === "low_confidence") return "medium";
  return "medium";
}

function channelsForRoute(route: ResolvedStaffAlertRoute) {
  return [
    route.smsRecipients.length ? "sms" : undefined,
    route.emailRecipients.length ? "email/webhook" : undefined,
  ].filter((channel): channel is string => Boolean(channel));
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function normalizeUuid(value?: string) {
  if (!value) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function shouldCreateStaffTask(input: StaffAlertEventLogInput) {
  if (input.status === "failed") return true;
  if (input.status !== "skipped") return false;
  return (
    input.input.kind === "complaint" ||
    input.input.kind === "delivery_failure" ||
    input.input.kind === "handoff" ||
    input.input.kind === "low_confidence"
  );
}

function taskTypeFor(kind: StaffAlertKind) {
  if (kind === "delivery_failure") return "delivery_issue";
  if (kind === "low_confidence") return "low_confidence_review";
  if (kind === "reservation") return "reservation_review";
  if (kind === "order") return "order_follow_up";
  if (kind === "complaint" || kind === "handoff") return "manager_callback";
  return "general";
}

function taskPriorityFor(input: StaffAlertEventLogInput) {
  const severity = input.input.severity ?? defaultSeverityFor(input.input.kind);
  if (input.status === "failed" && severity === "high") return "urgent";
  if (input.status === "failed") return "high";
  if (severity === "high") return "high";
  return "normal";
}

function taskTitleFor(input: StaffAlertEventLogInput) {
  const noun = {
    complaint: "complaint callback",
    delivery_failure: "delivery failure",
    handoff: "human handoff",
    low_confidence: "low-confidence call",
    order: "order follow-up",
    reservation: "reservation request",
    sales: "sales call",
  } satisfies Record<StaffAlertKind, string>;

  return input.status === "failed"
    ? `Resolve failed ${noun[input.input.kind]} alert`
    : `Review skipped ${noun[input.input.kind]} alert`;
}

function buildStaffTaskBody(input: StaffAlertEventLogInput) {
  const parts = [
    input.input.summary,
    input.errorMessage && `Alert issue: ${input.errorMessage}`,
    input.input.callerPhone && `Caller: ${input.input.callerPhone}`,
    ...(input.input.details ?? []),
  ].filter(Boolean);

  return truncate(parts.join("\n"), 900);
}

function taskDueAt(input: StaffAlertEventLogInput, createdAt: string) {
  const dueMinutes = taskPriorityFor(input) === "urgent" ? 15 : 60;
  return new Date(new Date(createdAt).getTime() + dueMinutes * 60_000).toISOString();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
