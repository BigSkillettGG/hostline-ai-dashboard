import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import { buildDailyBrief, type DailyBrief } from "../../../src/domain/daily-brief";
import type {
  Call,
  CallIntent,
  CallOutcome,
  CallStatus,
  Order,
  OrderStatus,
  Reservation,
  ReservationStatus,
} from "../../../src/data/mock";
import {
  normalizeStaffTaskPriority,
  normalizeStaffTaskStatus,
  normalizeStaffTaskType,
  type StaffTask,
} from "../../../src/domain/staff-tasks";

export interface OwnerReportResult {
  configured: boolean;
  locationId: string;
  periodEnd: string;
  periodStart: string;
  report: DailyBrief;
  reportId?: string;
  timezone: string;
}

export interface OwnerReportDeliveryAttempt {
  channel?: "email" | "sms" | "webhook";
  recipient?: string;
  reason?: string;
  status: "failed" | "sent" | "skipped";
}

export interface OwnerReportDeliveryResult extends OwnerReportResult {
  delivery: {
    attempts: OwnerReportDeliveryAttempt[];
    status: "failed" | "sent" | "skipped";
  };
}

interface SupabaseLocationRow {
  id: string;
  name: string | null;
  timezone: string | null;
}

interface SupabaseReportCallRow {
  caller_name: string | null;
  caller_phone: string | null;
  confidence: number | null;
  duration_seconds: number | null;
  external_call_sid?: string | null;
  id: string;
  intent: string | null;
  location_id: string | null;
  outcome: string | null;
  recording_url: string | null;
  started_at: string;
  status: string | null;
  summary: string | null;
  twilio_payload?: unknown;
}

interface SupabaseReportOrderRow {
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  eta_minutes: number | null;
  id: string;
  notes: string | null;
  payment_mode: string | null;
  source_call_id: string | null;
  status: string | null;
  total_cents: number | null;
}

interface SupabaseReportReservationRow {
  created_at: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  id: string;
  manual_request: boolean | null;
  notes: string | null;
  party_size: number | null;
  provider: string | null;
  provider_reservation_id: string | null;
  reservation_date: string | null;
  reservation_time: string | null;
  source: string | null;
  source_call_id: string | null;
  status: string | null;
}

interface SupabaseReportStaffTaskRow {
  assigned_to: string | null;
  body: string | null;
  call_id: string | null;
  completed_at: string | null;
  created_at: string | null;
  due_at: string | null;
  id: string;
  location_id: string | null;
  order_id: string | null;
  priority: string | null;
  reservation_id: string | null;
  status: string | null;
  task_type: string | null;
  title: string | null;
}

interface SupabaseOwnerReportRow {
  id: string;
}

interface SupabaseBusinessContactRow {
  can_receive_alerts: boolean | null;
  contact_type: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  preferred_channel: string | null;
}

interface SupabaseOnboardingProfileRow {
  draft: unknown;
}

interface OwnerReportRecipient {
  email?: string;
  name: string;
  phone?: string;
  preferredChannel: "email" | "sms" | "both";
  source: "business_contacts" | "onboarding";
}

export interface OwnerReportService {
  configured: boolean;
  deliveryConfigured: boolean;
  deliverDailyReport(input?: { locationId?: string; now?: Date }): Promise<OwnerReportDeliveryResult>;
  generateDailyReport(input?: { locationId?: string; now?: Date }): Promise<OwnerReportResult>;
}

export function createOwnerReportService(env: VoiceServiceEnv): OwnerReportService {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabaseOwnerReportService(env);
  }

  return new NoopOwnerReportService();
}

class NoopOwnerReportService implements OwnerReportService {
  configured = false;
  deliveryConfigured = false;

  async deliverDailyReport(): Promise<OwnerReportDeliveryResult> {
    throw new Error("Owner report delivery needs Supabase service credentials.");
  }

  async generateDailyReport(): Promise<OwnerReportResult> {
    throw new Error("Owner reports need SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_DEMO_LOCATION_ID.");
  }
}

class SupabaseOwnerReportService implements OwnerReportService {
  configured = true;
  deliveryConfigured: boolean;
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly baseUrl: string;
  private readonly defaultLocationId: string;
  private readonly messagingServiceSid?: string;
  private readonly ownerReportWebhookUrl?: string;
  private readonly smsFromNumber?: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor(env: VoiceServiceEnv) {
    this.accountSid = env.TWILIO_ACCOUNT_SID;
    this.authToken = env.TWILIO_AUTH_TOKEN;
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.defaultLocationId = env.SUPABASE_DEMO_LOCATION_ID ?? "";
    this.deliveryConfigured = Boolean(
      env.OWNER_REPORT_WEBHOOK_URL ||
        (env.TWILIO_ACCOUNT_SID &&
          env.TWILIO_AUTH_TOKEN &&
          (env.TWILIO_SMS_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID)),
    );
    this.key = env.SUPABASE_SECRET_KEY ?? "";
    this.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
    this.ownerReportWebhookUrl = env.OWNER_REPORT_WEBHOOK_URL;
    this.restUrl = `${env.SUPABASE_URL?.replace(/\/$/, "")}/rest/v1`;
    this.smsFromNumber = env.TWILIO_SMS_FROM_NUMBER;
  }

  async deliverDailyReport(input: { locationId?: string; now?: Date } = {}): Promise<OwnerReportDeliveryResult> {
    const generated = await this.generateDailyReport(input);
    const recipients = await this.fetchOwnerReportRecipients(generated.locationId);
    const attempts: OwnerReportDeliveryAttempt[] = [];

    for (const recipient of recipients) {
      attempts.push(...await this.deliverToRecipient(generated, recipient));
    }

    if (this.ownerReportWebhookUrl) {
      attempts.push(await this.sendWebhook(generated, recipients));
    }

    if (!attempts.length) {
      attempts.push({
        reason: recipients.length ? "No supported delivery channels are configured." : "No owner report recipients are configured.",
        status: "skipped",
      });
    }

    const status = attempts.some((attempt) => attempt.status === "sent")
      ? "sent"
      : attempts.some((attempt) => attempt.status === "failed")
        ? "failed"
        : "skipped";

    if (generated.reportId) {
      await this.updateReportDeliveryStatus({
        attempts,
        reportId: generated.reportId,
        status,
      });
    }

    return {
      ...generated,
      delivery: {
        attempts,
        status,
      },
    };
  }

  async generateDailyReport(input: { locationId?: string; now?: Date } = {}): Promise<OwnerReportResult> {
    const locationId = normalizeLocationId(input.locationId) ?? this.defaultLocationId;
    const location = await this.fetchLocation(locationId);
    const timezone = location?.timezone?.trim() || "America/New_York";
    const now = input.now ?? new Date();
    const period = businessDayBounds(now, timezone);
    const [calls, orders, reservations, tasks] = await Promise.all([
      this.fetchCalls(locationId, period.start),
      this.fetchOrders(locationId, period.start),
      this.fetchReservations(locationId, period.start),
      this.fetchStaffTasks(locationId, period.start),
    ]);
    const report = buildDailyBrief({
      businessName: location?.name?.trim() || "your business",
      calls,
      now,
      orders,
      reservations,
      tasks,
    });
    const reportId = await this.saveReport({
      locationId,
      periodEnd: period.end.toISOString(),
      periodStart: period.start.toISOString(),
      report,
    });

    return {
      configured: true,
      locationId,
      periodEnd: period.end.toISOString(),
      periodStart: period.start.toISOString(),
      report,
      reportId,
      timezone,
    };
  }

  private async fetchLocation(locationId: string) {
    const rows = await this.request<SupabaseLocationRow[]>("locations", {
      method: "GET",
      query: `id=eq.${encodeURIComponent(locationId)}&limit=1&select=id,name,timezone`,
    });
    return rows[0] ?? null;
  }

  private async fetchCalls(locationId: string, periodStart: Date): Promise<Call[]> {
    const rows = await this.request<SupabaseReportCallRow[]>("calls", {
      method: "GET",
      query: [
        `location_id=eq.${encodeURIComponent(locationId)}`,
        `started_at=gte.${encodeURIComponent(periodStart.toISOString())}`,
        "order=started_at.desc",
        "limit=500",
        "select=id,caller_name,caller_phone,external_call_sid,started_at,duration_seconds,intent,location_id,outcome,confidence,status,summary,recording_url,twilio_payload",
      ].join("&"),
    });

    return rows.map(mapCall);
  }

  private async fetchOrders(locationId: string, periodStart: Date): Promise<Order[]> {
    const rows = await this.request<SupabaseReportOrderRow[]>("orders", {
      method: "GET",
      query: [
        `location_id=eq.${encodeURIComponent(locationId)}`,
        `created_at=gte.${encodeURIComponent(periodStart.toISOString())}`,
        "order=created_at.desc",
        "limit=500",
        "select=id,source_call_id,customer_name,customer_phone,status,total_cents,eta_minutes,payment_mode,notes,created_at",
      ].join("&"),
    });

    return rows.map(mapOrder);
  }

  private async fetchReservations(locationId: string, periodStart: Date): Promise<Reservation[]> {
    const rows = await this.request<SupabaseReportReservationRow[]>("reservations", {
      method: "GET",
      query: [
        `location_id=eq.${encodeURIComponent(locationId)}`,
        `created_at=gte.${encodeURIComponent(periodStart.toISOString())}`,
        "order=created_at.desc",
        "limit=500",
        "select=id,guest_name,guest_phone,party_size,reservation_date,reservation_time,status,source,source_call_id,manual_request,provider,provider_reservation_id,notes,created_at",
      ].join("&"),
    });

    return rows.map(mapReservation);
  }

  private async fetchStaffTasks(locationId: string, periodStart: Date): Promise<StaffTask[]> {
    const rows = await this.request<SupabaseReportStaffTaskRow[]>("staff_tasks", {
      method: "GET",
      query: [
        `location_id=eq.${encodeURIComponent(locationId)}`,
        `created_at=gte.${encodeURIComponent(periodStart.toISOString())}`,
        "order=created_at.desc",
        "limit=500",
        "select=id,location_id,call_id,order_id,reservation_id,title,body,status,task_type,priority,assigned_to,due_at,completed_at,created_at",
      ].join("&"),
    });

    return rows.map(mapStaffTask);
  }

  private async saveReport(input: {
    locationId: string;
    periodEnd: string;
    periodStart: string;
    report: DailyBrief;
  }) {
    const rows = await this.request<SupabaseOwnerReportRow[]>("owner_reports", {
      body: {
        copy_text: input.report.copyText,
        delivery_channels: [],
        follow_ups: input.report.followUps,
        generated_at: new Date().toISOString(),
        location_id: input.locationId,
        metrics: input.report.metrics,
        owner_message: input.report.ownerMessage,
        period_end: input.periodEnd,
        period_start: input.periodStart,
        report_type: "daily",
        status: "ready",
        suggested_updates: input.report.suggestedUpdates,
        title: input.report.headline,
        totals: input.report.totals,
      },
      headers: {
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      method: "POST",
      query: "on_conflict=location_id,report_type,period_start&select=id",
    });

    return rows[0]?.id;
  }

  private async fetchOwnerReportRecipients(locationId: string): Promise<OwnerReportRecipient[]> {
    const contacts = await this.fetchBusinessContacts(locationId);
    if (contacts.length) return contacts;

    return this.fetchOnboardingOwnerContact(locationId);
  }

  private async fetchBusinessContacts(locationId: string): Promise<OwnerReportRecipient[]> {
    try {
      const rows = await this.request<SupabaseBusinessContactRow[]>("business_contacts", {
        method: "GET",
        query: [
          `location_id=eq.${encodeURIComponent(locationId)}`,
          "can_receive_alerts=eq.true",
          "contact_type=in.(owner,manager)",
          "order=created_at.asc",
          "select=contact_type,name,phone,email,preferred_channel,can_receive_alerts",
        ].join("&"),
      });

      return rows
        .map(mapBusinessContactRecipient)
        .filter((recipient): recipient is OwnerReportRecipient => Boolean(recipient));
    } catch (error) {
      if (!isMissingOptionalTableError(error, "business_contacts")) throw error;
      return [];
    }
  }

  private async fetchOnboardingOwnerContact(locationId: string): Promise<OwnerReportRecipient[]> {
    const rows = await this.request<SupabaseOnboardingProfileRow[]>("onboarding_profiles", {
      method: "GET",
      query: `location_id=eq.${encodeURIComponent(locationId)}&limit=1&select=draft`,
    });
    const draft = isObjectRecord(rows[0]?.draft) ? rows[0].draft : {};
    const recipient = mapOnboardingRecipient(draft);
    return recipient ? [recipient] : [];
  }

  private async deliverToRecipient(
    report: OwnerReportResult,
    recipient: OwnerReportRecipient,
  ): Promise<OwnerReportDeliveryAttempt[]> {
    const attempts: OwnerReportDeliveryAttempt[] = [];
    const wantsSms = recipient.preferredChannel === "sms" || recipient.preferredChannel === "both";
    const wantsEmail = recipient.preferredChannel === "email" || recipient.preferredChannel === "both";

    if (wantsSms) {
      attempts.push(await this.sendSms(recipient.phone, formatOwnerReportSms(report), recipient));
    }

    if (wantsEmail) {
      attempts.push({
        channel: "email",
        reason: recipient.email ? "Email delivery provider is not configured yet." : "Recipient has no email address.",
        recipient: recipient.email,
        status: "skipped",
      });
    }

    return attempts;
  }

  private async sendSms(
    to: string | undefined,
    message: string,
    recipient: OwnerReportRecipient,
  ): Promise<OwnerReportDeliveryAttempt> {
    if (!to?.trim()) {
      return {
        channel: "sms",
        reason: "Recipient has no phone number.",
        recipient: recipient.name,
        status: "skipped",
      };
    }

    if (!this.accountSid || !this.authToken || (!this.messagingServiceSid && !this.smsFromNumber)) {
      return {
        channel: "sms",
        reason: "Twilio SMS delivery is not configured.",
        recipient: to,
        status: "skipped",
      };
    }

    const body = new URLSearchParams({
      Body: message,
      To: to.trim(),
    });
    if (this.messagingServiceSid) {
      body.set("MessagingServiceSid", this.messagingServiceSid);
    } else if (this.smsFromNumber) {
      body.set("From", this.smsFromNumber);
    }

    try {
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
        return {
          channel: "sms",
          reason: `Twilio returned ${response.status}: ${await response.text()}`,
          recipient: to,
          status: "failed",
        };
      }

      return { channel: "sms", recipient: to, status: "sent" };
    } catch (error) {
      return {
        channel: "sms",
        reason: error instanceof Error ? error.message : "SMS delivery failed.",
        recipient: to,
        status: "failed",
      };
    }
  }

  private async sendWebhook(
    report: OwnerReportResult,
    recipients: OwnerReportRecipient[],
  ): Promise<OwnerReportDeliveryAttempt> {
    if (!this.ownerReportWebhookUrl) {
      return { channel: "webhook", reason: "Owner report webhook is not configured.", status: "skipped" };
    }

    try {
      const response = await fetch(this.ownerReportWebhookUrl, {
        body: JSON.stringify({
          locationId: report.locationId,
          periodEnd: report.periodEnd,
          periodStart: report.periodStart,
          recipients,
          report: report.report,
          reportId: report.reportId,
          timezone: report.timezone,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        return {
          channel: "webhook",
          reason: `Webhook returned ${response.status}: ${await response.text()}`,
          recipient: this.ownerReportWebhookUrl,
          status: "failed",
        };
      }

      return { channel: "webhook", recipient: this.ownerReportWebhookUrl, status: "sent" };
    } catch (error) {
      return {
        channel: "webhook",
        reason: error instanceof Error ? error.message : "Webhook delivery failed.",
        recipient: this.ownerReportWebhookUrl,
        status: "failed",
      };
    }
  }

  private async updateReportDeliveryStatus(input: {
    attempts: OwnerReportDeliveryAttempt[];
    reportId: string;
    status: "failed" | "sent" | "skipped";
  }) {
    await this.request("owner_reports", {
      body: {
        delivery_channels: input.attempts,
        error_message: input.attempts.find((attempt) => attempt.status === "failed")?.reason ?? null,
        sent_at: input.status === "sent" ? new Date().toISOString() : null,
        status: input.status === "skipped" ? "ready" : input.status,
      },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(input.reportId)}`,
    });
  }

  private async request<T>(
    table: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      method: "GET" | "PATCH" | "POST";
      query?: string;
    },
  ) {
    const response = await fetch(`${this.restUrl}/${table}${options.query ? `?${options.query}` : ""}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: buildSupabaseServiceHeaders(this.key, options.headers),
      method: options.method,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase owner report ${options.method} ${table} failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

function mapCall(row: SupabaseReportCallRow): Call {
  const channel = readCallChannel(row);
  return {
    caller: row.caller_name?.trim() || (channel === "web_chat" ? "Website visitor" : "Unknown"),
    channel,
    confidence: row.confidence ?? 0,
    duration: row.duration_seconds ?? 0,
    id: row.id,
    intent: normalizeEnum(row.intent, callIntents, "other"),
    locationId: row.location_id ?? undefined,
    outcome: normalizeEnum(row.outcome, callOutcomes, "unknown"),
    phone: row.caller_phone?.trim() || (channel === "web_chat" ? "Website chat" : "Unknown"),
    recordingUrl: row.recording_url ?? undefined,
    status: normalizeEnum(row.status, callStatuses, "new"),
    summary: row.summary?.trim() || "No summary available yet.",
    time: row.started_at,
    transcript: [],
  };
}

function mapOrder(row: SupabaseReportOrderRow): Order {
  return {
    createdAt: row.created_at,
    customer: row.customer_name?.trim() || "Unknown",
    etaMinutes: row.eta_minutes ?? 0,
    id: row.id,
    items: [],
    notes: row.notes ?? undefined,
    payAtPickup: row.payment_mode === "pay_at_pickup",
    phone: row.customer_phone?.trim() || "Unknown",
    sourceCallId: row.source_call_id ?? undefined,
    status: normalizeEnum(row.status, orderStatuses, "new"),
    total: (row.total_cents ?? 0) / 100,
  };
}

function mapReservation(row: SupabaseReportReservationRow): Reservation {
  return {
    createdAt: row.created_at ?? undefined,
    date: row.reservation_date ?? "",
    guest: row.guest_name?.trim() || "Unknown",
    id: row.id,
    manual: row.manual_request ?? undefined,
    notes: row.notes ?? undefined,
    partySize: row.party_size ?? 0,
    phone: row.guest_phone?.trim() || "Unknown",
    provider: row.provider ?? undefined,
    providerReservationId: row.provider_reservation_id ?? undefined,
    source: normalizeEnum(row.source, reservationSources, "ai_host"),
    sourceCallId: row.source_call_id ?? undefined,
    status: normalizeEnum(row.status, reservationStatuses, "pending"),
    time: normalizeDisplayTime(row.reservation_time),
  };
}

function mapStaffTask(row: SupabaseReportStaffTaskRow): StaffTask {
  return {
    assignedTo: row.assigned_to ?? undefined,
    body: row.body ?? undefined,
    callId: row.call_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    dueAt: row.due_at ?? undefined,
    id: row.id,
    locationId: row.location_id ?? undefined,
    orderId: row.order_id ?? undefined,
    priority: normalizeStaffTaskPriority(row.priority),
    reservationId: row.reservation_id ?? undefined,
    status: normalizeStaffTaskStatus(row.status),
    title: row.title?.trim() || "Staff task",
    type: normalizeStaffTaskType(row.task_type),
  };
}

function mapBusinessContactRecipient(row: SupabaseBusinessContactRow): OwnerReportRecipient | null {
  const phone = stringValue(row.phone);
  const email = stringValue(row.email);
  if (!phone && !email) return null;

  return {
    email,
    name: stringValue(row.name) ?? stringValue(row.contact_type) ?? "Owner",
    phone,
    preferredChannel: normalizePreferredChannel(row.preferred_channel),
    source: "business_contacts",
  };
}

function mapOnboardingRecipient(draft: Record<string, unknown>): OwnerReportRecipient | null {
  const phone = stringValue(draft.ownerPhone);
  const email = stringValue(draft.ownerEmail);
  if (!phone && !email) return null;

  return {
    email,
    name: stringValue(draft.ownerName) ?? "Owner",
    phone,
    preferredChannel: phone ? "sms" : "email",
    source: "onboarding",
  };
}

function formatOwnerReportSms(input: OwnerReportResult) {
  const totals = input.report.totals;
  const parts = [
    input.report.ownerMessage,
    totals.openFollowUps ? `${totals.openFollowUps} follow-up${totals.openFollowUps === 1 ? "" : "s"} need attention.` : "",
    totals.highValue ? `${totals.highValue} high-value opportunit${totals.highValue === 1 ? "y" : "ies"} captured.` : "",
    "Reply STOP to opt out.",
  ].filter(Boolean);
  const message = parts.join(" ");
  return message.length <= 600 ? message : `${message.slice(0, 597)}...`;
}

function readCallChannel(row: SupabaseReportCallRow) {
  const payload = row.twilio_payload;
  const provider = payload && typeof payload === "object" && !Array.isArray(payload)
    ? String((payload as Record<string, unknown>).provider ?? "")
    : "";
  return provider === "web_chat" || row.external_call_sid?.startsWith("webchat_") ? "web_chat" : "phone";
}

function normalizeDisplayTime(time: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
}

function businessDayBounds(now: Date, timeZone: string) {
  const local = localDateParts(now, timeZone);
  const start = zonedLocalTimeToUtc(local.year, local.month, local.day, 0, 0, 0, timeZone);
  const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1, 0, 0, 0));
  const nextLocal = localDateParts(nextDay, "UTC");
  const end = zonedLocalTimeToUtc(nextLocal.year, nextLocal.month, nextLocal.day, 0, 0, 0, timeZone);

  return { end: now < end ? now : end, start };
}

function zonedLocalTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const correctedOffset = timeZoneOffsetMs(firstPass, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset);
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = localDateParts(date, timeZone, true);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function localDateParts(date: Date, timeZone: string, includeTime = false) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: includeTime ? "2-digit" : undefined,
    hourCycle: "h23",
    minute: includeTime ? "2-digit" : undefined,
    month: "2-digit",
    second: includeTime ? "2-digit" : undefined,
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.day),
    hour: Number(values.hour ?? 0),
    minute: Number(values.minute ?? 0),
    month: Number(values.month),
    second: Number(values.second ?? 0),
    year: Number(values.year),
  };
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function normalizePreferredChannel(value: string | null | undefined): OwnerReportRecipient["preferredChannel"] {
  if (value === "email" || value === "both") return value;
  return "sms";
}

function normalizeEnum<T extends string>(value: string | null | undefined, allowedValues: readonly T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMissingOptionalTableError(error: unknown, table: string) {
  return error instanceof Error && new RegExp(`${table}|relation .* does not exist|404|42P01`, "i").test(error.message);
}

const callIntents: CallIntent[] = ["order", "reservation", "faq", "hours", "complaint", "sales", "other"];
const callOutcomes: CallOutcome[] = [
  "resolved",
  "order_placed",
  "reservation_booked",
  "escalated",
  "manager_alerted",
  "message_taken",
  "voicemail",
  "missed",
  "unknown",
];
const callStatuses: CallStatus[] = ["new", "reviewed", "needs_review", "resolved"];
const orderStatuses: OrderStatus[] = ["new", "accepted", "in_progress", "completed", "canceled"];
const reservationStatuses: ReservationStatus[] = ["pending", "confirmed", "declined", "seated", "canceled"];
const reservationSources: Reservation["source"][] = ["ai_host", "web", "walk_in"];
