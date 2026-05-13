import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

export type MessageThreadType =
  | "business_link"
  | "callback"
  | "general"
  | "order"
  | "reservation";

export interface RecordOutboundMessageInput {
  body: string;
  customerPhone?: string;
  locationId?: string;
  providerMessageSid?: string;
  relatedCallId?: string;
  relatedOrderId?: string;
  relatedReservationId?: string;
  restaurantName: string;
  signalhostPhone?: string;
  threadType: MessageThreadType;
}

export interface HandleInboundSmsInput {
  body: string;
  from: string;
  providerMessageSid?: string;
  rawPayload?: Record<string, string>;
  to: string;
}

export interface HandleInboundSmsResult {
  candidateCount?: number;
  replyMessage?: string;
  status: "disambiguation_needed" | "ignored_stop" | "orphaned" | "routed";
  threadId?: string;
}

export interface MessageThreadStore {
  handleInboundSms(input: HandleInboundSmsInput): Promise<HandleInboundSmsResult>;
  recordOutboundMessage(input: RecordOutboundMessageInput): Promise<{ threadId?: string }>;
}

interface MessageThreadRow {
  expires_at?: string | null;
  id: string;
  last_message_at?: string | null;
  location_id: string;
  signalhost_phone: string;
  status: string;
  thread_type: MessageThreadType;
}

interface LocationRow {
  id: string;
  name: string | null;
}

export function createMessageThreadStore(env: VoiceServiceEnv): MessageThreadStore {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabaseMessageThreadStore({
      defaultLocationId: env.SUPABASE_DEMO_LOCATION_ID,
      key: env.SUPABASE_SECRET_KEY,
      smsThreadTtlDays: env.SIGNALHOST_SMS_THREAD_TTL_DAYS,
      url: env.SUPABASE_URL,
    });
  }

  return new NoopMessageThreadStore();
}

class NoopMessageThreadStore implements MessageThreadStore {
  async recordOutboundMessage(input: RecordOutboundMessageInput) {
    console.info("[message-thread-store] Supabase not configured; outbound text thread not persisted", {
      locationId: input.locationId,
      to: input.customerPhone,
      type: input.threadType,
    });
    return {};
  }

  async handleInboundSms(input: HandleInboundSmsInput): Promise<HandleInboundSmsResult> {
    console.info("[message-thread-store] Supabase not configured; inbound SMS not persisted", {
      from: input.from,
      to: input.to,
    });
    return {
      replyMessage: "Thanks. SignalHost received your message, but text routing is not configured yet.",
      status: "orphaned",
    };
  }
}

class SupabaseMessageThreadStore implements MessageThreadStore {
  private readonly defaultLocationId: string;
  private readonly key: string;
  private readonly restUrl: string;
  private readonly smsThreadTtlDays?: number;

  constructor({
    defaultLocationId,
    key,
    smsThreadTtlDays,
    url,
  }: {
    defaultLocationId: string;
    key: string;
    smsThreadTtlDays?: number;
    url: string;
  }) {
    this.defaultLocationId = defaultLocationId;
    this.key = key;
    this.restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
    this.smsThreadTtlDays = smsThreadTtlDays;
  }

  async recordOutboundMessage(input: RecordOutboundMessageInput) {
    const customerPhone = normalizePhone(input.customerPhone);
    const locationId = normalizeLocationId(input.locationId) ?? this.defaultLocationId;
    const signalhostPhone = normalizePhone(input.signalhostPhone) ?? "shared_sender";
    if (!customerPhone || !input.body.trim()) return {};

    const now = new Date();
    const rows = await this.request<Array<{ id: string }>>("message_threads", {
      body: {
        customer_phone: customerPhone,
        expires_at: addDays(now, resolveSmsThreadTtlDays(this.smsThreadTtlDays)).toISOString(),
        last_message_at: now.toISOString(),
        location_id: locationId,
        related_call_id: input.relatedCallId ?? null,
        related_order_id: input.relatedOrderId ?? null,
        related_reservation_id: input.relatedReservationId ?? null,
        restaurant_name_snapshot: input.restaurantName,
        signalhost_phone: signalhostPhone,
        status: "open",
        thread_type: input.threadType,
        updated_at: now.toISOString(),
      },
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: "select=id",
    });
    const threadId = rows?.[0]?.id;

    await this.recordMessageEvent({
      body: input.body,
      direction: "outbound",
      fromPhone: signalhostPhone,
      providerMessageSid: input.providerMessageSid,
      status: "sent",
      threadId,
      toPhone: customerPhone,
    });

    return { threadId };
  }

  async handleInboundSms(input: HandleInboundSmsInput): Promise<HandleInboundSmsResult> {
    const from = normalizePhone(input.from);
    const to = normalizePhone(input.to) ?? input.to.trim();
    const body = input.body.trim();
    if (!from || !body) {
      return { status: "orphaned" };
    }

    if (isStopMessage(body)) {
      await this.recordMessageEvent({
        body,
        direction: "inbound",
        fromPhone: from,
        providerMessageSid: input.providerMessageSid,
        rawPayload: input.rawPayload,
        status: "opt_out",
        toPhone: to,
      });
      return { status: "ignored_stop" };
    }

    const candidates = await this.findCandidateThreads(from, to);
    if (candidates.length === 0) {
      await this.recordMessageEvent({
        body,
        direction: "inbound",
        fromPhone: from,
        providerMessageSid: input.providerMessageSid,
        rawPayload: input.rawPayload,
        status: "orphaned",
        toPhone: to,
      });
      return {
        replyMessage:
          "Thanks. I do not have an active SignalHost text thread for this number. Please call the business directly or start from their website.",
        status: "orphaned",
      };
    }

    const selectedIndex = parseDisambiguationChoice(body, candidates.length);
    if (candidates.length > 1 && selectedIndex === null) {
      await this.recordMessageEvent({
        body,
        direction: "inbound",
        fromPhone: from,
        providerMessageSid: input.providerMessageSid,
        rawPayload: input.rawPayload,
        status: "needs_disambiguation",
        toPhone: to,
      });
      return {
        candidateCount: candidates.length,
        replyMessage: await this.buildDisambiguationReply(candidates),
        status: "disambiguation_needed",
      };
    }

    const selectedThread = candidates[selectedIndex ?? 0];
    const businessName = await this.locationName(selectedThread.location_id);
    await this.recordMessageEvent({
      body,
      direction: "inbound",
      fromPhone: from,
      providerMessageSid: input.providerMessageSid,
      rawPayload: input.rawPayload,
      status: "routed",
      threadId: selectedThread.id,
      toPhone: to,
    });
    await this.updateThread(selectedThread.id, { last_message_at: new Date().toISOString(), status: "open" });
    await this.createStaffTask({
      body: `Customer text reply from ${from}: ${body}`,
      locationId: selectedThread.location_id,
      priority: "normal",
      title: "Review customer text reply",
      type: "customer_request",
    });

    return {
      replyMessage: `Got it. I sent that to ${businessName}.`,
      status: "routed",
      threadId: selectedThread.id,
    };
  }

  private async findCandidateThreads(customerPhone: string, signalhostPhone: string) {
    const now = encodeURIComponent(new Date().toISOString());
    const toFilter = signalhostPhone && signalhostPhone !== "shared_sender"
      ? `&signalhost_phone=eq.${encodeURIComponent(signalhostPhone)}`
      : "";
    return this.get<MessageThreadRow[]>(
      "message_threads",
      [
        `customer_phone=eq.${encodeURIComponent(customerPhone)}`,
        toFilter.replace(/^&/, ""),
        "status=in.(open,pending_disambiguation)",
        `expires_at=gte.${now}`,
        "select=id,location_id,signalhost_phone,status,thread_type,last_message_at,expires_at",
        "order=last_message_at.desc",
        "limit=5",
      ].filter(Boolean).join("&"),
    );
  }

  private async locationName(locationId: string) {
    const rows = await this.get<LocationRow[]>(
      "locations",
      `id=eq.${encodeURIComponent(locationId)}&select=id,name&limit=1`,
    );
    return rows?.[0]?.name?.trim() || "the business";
  }

  private async buildDisambiguationReply(candidates: MessageThreadRow[]) {
    const choices = await Promise.all(
      candidates.slice(0, 5).map(async (thread, index) => {
        const name = await this.locationName(thread.location_id);
        return `${index + 1} for ${name}`;
      }),
    );
    return `Which business is this for? Reply ${choices.join(", ")}.`;
  }

  private async updateThread(threadId: string, body: Record<string, unknown>) {
    await this.request("message_threads", {
      body: {
        ...body,
        updated_at: new Date().toISOString(),
      },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(threadId)}`,
    });
  }

  private async createStaffTask(input: {
    body: string;
    locationId: string;
    priority: "low" | "normal" | "high" | "urgent";
    title: string;
    type: string;
  }) {
    await this.request("staff_tasks", {
      body: {
        body: input.body,
        due_at: addMinutes(new Date(), 15).toISOString(),
        location_id: input.locationId,
        priority: input.priority,
        status: "open",
        task_type: input.type,
        title: input.title,
      },
      method: "POST",
    });
  }

  private async recordMessageEvent(input: {
    body: string;
    direction: "inbound" | "outbound";
    fromPhone: string;
    providerMessageSid?: string;
    rawPayload?: Record<string, string>;
    status: string;
    threadId?: string;
    toPhone: string;
  }) {
    await this.request("message_events", {
      body: {
        body: input.body,
        direction: input.direction,
        from_phone: input.fromPhone,
        provider: "twilio",
        provider_message_sid: input.providerMessageSid ?? null,
        raw_payload: input.rawPayload ?? {},
        status: input.status,
        thread_id: input.threadId ?? null,
        to_phone: input.toPhone,
      },
      method: "POST",
    });
  }

  private async request<T = unknown>(
    table: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      method: "GET" | "PATCH" | "POST";
      query?: string;
    },
  ): Promise<T> {
    const query = options.query ? `?${options.query}` : "";
    const response = await fetch(`${this.restUrl}/${table}${query}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: buildSupabaseServiceHeaders(this.key, options.headers),
      method: options.method,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${options.method} ${table} failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private async get<T>(table: string, query: string) {
    return this.request<T>(table, { method: "GET", query });
  }
}

export function buildSmsTwiML(message?: string) {
  if (!message?.trim()) return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message.trim())}</Message></Response>`;
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function normalizePhone(value?: string) {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function isStopMessage(value: string) {
  return /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(value.trim());
}

function parseDisambiguationChoice(value: string, candidateCount: number) {
  const match = value.trim().match(/^([1-9])$/);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < candidateCount ? index : null;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function resolveSmsThreadTtlDays(value?: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(30, Math.round(value ?? 7))) : 7;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
