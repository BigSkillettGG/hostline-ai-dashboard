import type { VoiceServiceEnv } from "./env";
import type { EmailDeliveryService } from "./email-delivery-service";
import { HttpRequestError } from "./http-safety";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

export type CustomerFollowUpChannel = "email";

export interface CustomerFollowUpInput {
  channel?: CustomerFollowUpChannel;
  closeTask?: boolean;
  locationId?: string;
  message?: string;
  recipientEmail?: string;
  requestId?: string;
  subject?: string;
  taskId?: string;
}

export interface CustomerFollowUpResult {
  channel: CustomerFollowUpChannel;
  deliveryId?: string;
  recipient: string;
  requestId?: string;
  status: "sent";
  taskId: string;
  taskStatus?: "done" | "open";
}

interface SupabaseStaffTaskRow {
  body?: string | null;
  id: string;
  location_id?: string | null;
  title?: string | null;
}

interface SupabaseCustomerRequestRow {
  customer_name?: string | null;
  customer_phone?: string | null;
  details?: unknown;
  id: string;
  location_id?: string | null;
  summary?: string | null;
  title?: string | null;
}

export interface CustomerFollowUpService {
  configured: boolean;
  sendFollowUp(input: CustomerFollowUpInput): Promise<CustomerFollowUpResult>;
}

export function createCustomerFollowUpService(
  env: VoiceServiceEnv,
  emailDeliveryService: EmailDeliveryService,
): CustomerFollowUpService {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    return new SupabaseCustomerFollowUpService(env, emailDeliveryService);
  }

  return new NoopCustomerFollowUpService();
}

class NoopCustomerFollowUpService implements CustomerFollowUpService {
  configured = false;

  async sendFollowUp(): Promise<CustomerFollowUpResult> {
    throw new HttpRequestError(503, "Customer follow-ups need Supabase service credentials.");
  }
}

class SupabaseCustomerFollowUpService implements CustomerFollowUpService {
  configured: boolean;
  private readonly defaultLocationId?: string;
  private readonly emailDeliveryService: EmailDeliveryService;
  private readonly emailFrom?: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor(env: VoiceServiceEnv, emailDeliveryService: EmailDeliveryService) {
    this.configured = true;
    this.defaultLocationId = env.SUPABASE_DEMO_LOCATION_ID;
    this.emailDeliveryService = emailDeliveryService;
    this.emailFrom = env.EMAIL_FROM;
    this.key = env.SUPABASE_SECRET_KEY ?? "";
    this.restUrl = `${env.SUPABASE_URL?.replace(/\/$/, "")}/rest/v1`;
  }

  async sendFollowUp(input: CustomerFollowUpInput): Promise<CustomerFollowUpResult> {
    const taskId = input.taskId?.trim();
    if (!taskId) throw new HttpRequestError(400, "taskId is required.");

    const message = input.message?.trim();
    if (!message) throw new HttpRequestError(400, "A follow-up message is required.");

    const task = await this.fetchTask(taskId);
    const locationId = input.locationId?.trim() || task.location_id || this.defaultLocationId;
    if (!locationId) throw new HttpRequestError(400, "locationId is required.");
    if (task.location_id && task.location_id !== locationId) {
      throw new HttpRequestError(403, "This task does not belong to the requested location.");
    }

    const requestId = input.requestId?.trim() || extractCustomerRequestId(task.body);
    const request = requestId ? await this.fetchCustomerRequest(requestId, locationId) : undefined;
    const recipientEmail = input.recipientEmail?.trim() || extractEmailFromRequest(request) || extractEmailFromText(task.body);
    if (!recipientEmail) throw new HttpRequestError(400, "A customer email address is required to send this follow-up.");
    if (!isValidEmail(recipientEmail)) throw new HttpRequestError(400, "Enter a valid customer email address.");
    if (!this.emailDeliveryService.configured) {
      throw new HttpRequestError(503, "Email delivery is not configured.");
    }

    const subject = input.subject?.trim() || buildSubject(task, request);
    const delivery = await this.emailDeliveryService.sendEmail({
      html: formatFollowUpHtml({ message, subject }),
      subject,
      text: message,
      to: recipientEmail,
    });

    if (requestId) {
      await this.updateCustomerRequest({
        locationId,
        message,
        requestId,
        status: "sent",
      });
    }

    const shouldCloseTask = input.closeTask !== false;
    if (shouldCloseTask) {
      await this.updateStaffTask({
        locationId,
        status: "done",
        taskId,
      });
    }

    await this.recordMessageEvent({
      deliveryId: delivery.id,
      locationId,
      message,
      recipientEmail,
      requestId,
      subject,
      taskId,
    });

    return {
      channel: "email",
      deliveryId: delivery.id,
      recipient: recipientEmail,
      requestId,
      status: "sent",
      taskId,
      taskStatus: shouldCloseTask ? "done" : "open",
    };
  }

  private async fetchTask(taskId: string) {
    const rows = await this.request<SupabaseStaffTaskRow[]>("staff_tasks", {
      method: "GET",
      query: [
        `id=eq.${encodeURIComponent(taskId)}`,
        "limit=1",
        "select=id,location_id,title,body",
      ].join("&"),
    });

    const task = rows[0];
    if (!task) throw new HttpRequestError(404, "Staff task not found.");
    return task;
  }

  private async fetchCustomerRequest(requestId: string, locationId: string) {
    const rows = await this.request<SupabaseCustomerRequestRow[]>("customer_requests", {
      method: "GET",
      query: [
        `id=eq.${encodeURIComponent(requestId)}`,
        `location_id=eq.${encodeURIComponent(locationId)}`,
        "limit=1",
        "select=id,location_id,title,summary,customer_name,customer_phone,details",
      ].join("&"),
    });

    return rows[0];
  }

  private async updateCustomerRequest(input: {
    locationId: string;
    message: string;
    requestId: string;
    status: "sent";
  }) {
    await this.request("customer_requests", {
      body: {
        responded_at: new Date().toISOString(),
        response_channel: "email",
        response_status: input.status,
        response_text: input.message,
        status: "resolved",
        updated_at: new Date().toISOString(),
      },
      method: "PATCH",
      query: [
        `id=eq.${encodeURIComponent(input.requestId)}`,
        `location_id=eq.${encodeURIComponent(input.locationId)}`,
      ].join("&"),
    });
  }

  private async updateStaffTask(input: {
    locationId: string;
    status: "done";
    taskId: string;
  }) {
    await this.request("staff_tasks", {
      body: {
        completed_at: new Date().toISOString(),
        status: input.status,
      },
      method: "PATCH",
      query: [
        `id=eq.${encodeURIComponent(input.taskId)}`,
        `location_id=eq.${encodeURIComponent(input.locationId)}`,
      ].join("&"),
    });
  }

  private async recordMessageEvent(input: {
    deliveryId?: string;
    locationId: string;
    message: string;
    recipientEmail: string;
    requestId?: string;
    subject: string;
    taskId: string;
  }) {
    await this.request("message_events", {
      body: {
        body: input.message,
        direction: "outbound",
        from_phone: this.emailFrom ?? "signalhost-email",
        location_id: input.locationId,
        provider: "email",
        provider_message_sid: input.deliveryId ?? null,
        raw_payload: {
          requestId: input.requestId ?? null,
          subject: input.subject,
          taskId: input.taskId,
        },
        status: "sent",
        thread_id: null,
        to_phone: input.recipientEmail,
      },
      method: "POST",
    }).catch((error) => {
      console.warn("[customer-follow-up] message event log failed", error);
    });
  }

  private async request<T = unknown>(
    table: string,
    input: {
      body?: unknown;
      method: "GET" | "PATCH" | "POST";
      query?: string;
    },
  ): Promise<T> {
    const response = await fetch(`${this.restUrl}/${table}${input.query ? `?${input.query}` : ""}`, {
      body: input.body ? JSON.stringify(input.body) : undefined,
      headers: {
        ...buildSupabaseServiceHeaders(this.key),
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      method: input.method,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase customer follow-up ${table} failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

function buildSubject(task: SupabaseStaffTaskRow, request?: SupabaseCustomerRequestRow) {
  const title = request?.title?.trim() || task.title?.trim() || "your request";
  return `Following up: ${title}`;
}

function formatFollowUpHtml(input: { message: string; subject: string }) {
  return [
    "<!doctype html>",
    "<html>",
    "<body style=\"margin:0;background:#f7f3ee;color:#241913;font-family:Arial,sans-serif;\">",
    "<main style=\"max-width:640px;margin:0 auto;padding:32px 20px;\">",
    "<div style=\"background:#ffffff;border:1px solid #eadfd5;border-radius:12px;padding:28px;\">",
    `<p style="margin:0 0 8px;color:#d94a1e;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">SignalHost follow-up</p>`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;">${escapeHtml(input.subject)}</h1>`,
    `<p style="font-size:16px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(input.message)}</p>`,
    "</div>",
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

function extractCustomerRequestId(body: string | null | undefined) {
  const match = body?.match(/Customer request ID:\s*([0-9a-f-]{36})/i);
  return match?.[1];
}

function extractEmailFromRequest(request: SupabaseCustomerRequestRow | undefined) {
  return extractEmailFromDetails(request?.details);
}

function extractEmailFromDetails(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const direct = [
    record.customerEmail,
    record.customer_email,
    record.email,
    record.visitorEmail,
    record.visitor_email,
  ].find((item) => typeof item === "string" && item.trim());
  if (typeof direct === "string") return direct.trim();

  for (const nested of Object.values(record)) {
    const found = extractEmailFromDetails(nested);
    if (found) return found;
  }

  return undefined;
}

function extractEmailFromText(value: string | null | undefined) {
  return value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
