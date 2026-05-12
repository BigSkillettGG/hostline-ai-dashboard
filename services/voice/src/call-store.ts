import type { VoiceServiceEnv } from "./env";
import type { CapturedOrderItem } from "./order-intake";
import type { CapturedReservationRequest } from "./reservation-intake";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import type { ConversationRelaySetupMessage, TranscriptRole } from "./types";

export interface StartCallInput {
  setup: ConversationRelaySetupMessage;
  locationId?: string;
}

export interface StartRealtimeCallInput {
  callerPhone?: string;
  externalCallId: string;
  externalSessionId?: string;
  locationId?: string;
  providerPayload?: Record<string, unknown>;
}

export interface AddTranscriptTurnInput {
  callId?: string;
  speaker: TranscriptRole;
  text: string;
  offsetSeconds?: number;
}

export interface CompleteCallInput {
  callId?: string;
  confidence?: number;
  durationSeconds: number;
  intent?: "order" | "reservation" | "faq" | "hours" | "other";
  outcome?: string;
  recordingUrl?: string;
  summary?: string;
  status?: "new" | "reviewed" | "needs_review" | "resolved";
}

export interface AttachCallRecordingInput {
  callId?: string;
  durationSeconds?: number;
  externalCallSid?: string;
  providerPayload?: Record<string, unknown>;
  recordingSid?: string;
  recordingUrl: string;
}

export interface CreateStaffReviewOrderInput {
  callId?: string;
  customerName?: string;
  customerPhone?: string;
  etaMinutes?: number;
  items: CapturedOrderItem[];
  locationId?: string;
  notes?: string;
}

export interface CreateStaffReviewReservationInput extends CapturedReservationRequest {
  callId?: string;
  callerPhone?: string;
  locationId?: string;
  manualRequest?: boolean;
  provider?: string;
  providerReservationId?: string;
  status?: "pending" | "confirmed" | "declined";
}

export type StaffTaskPriority = "low" | "normal" | "high" | "urgent";
export type StaffTaskType =
  | "delivery_issue"
  | "general"
  | "low_confidence_review"
  | "manager_callback"
  | "order_follow_up"
  | "reservation_review";

export interface CreateStaffTaskInput {
  assignedTo?: string;
  body?: string;
  callId?: string;
  dueMinutes?: number;
  locationId?: string;
  priority?: StaffTaskPriority;
  title: string;
  type?: StaffTaskType;
}

export interface CallStore {
  startCall(input: StartCallInput): Promise<{ callId?: string }>;
  startRealtimeCall(input: StartRealtimeCallInput): Promise<{ callId?: string }>;
  addTranscriptTurn(input: AddTranscriptTurnInput): Promise<void>;
  attachCallRecording(input: AttachCallRecordingInput): Promise<void>;
  completeCall(input: CompleteCallInput): Promise<void>;
  createStaffTask(input: CreateStaffTaskInput): Promise<{ taskId?: string }>;
  createStaffReviewOrder(input: CreateStaffReviewOrderInput): Promise<{ orderId?: string }>;
  createStaffReviewReservation(input: CreateStaffReviewReservationInput): Promise<{ reservationId?: string }>;
}

export function createCallStore(env: VoiceServiceEnv): CallStore {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabaseCallStore({
      key: env.SUPABASE_SECRET_KEY,
      locationId: env.SUPABASE_DEMO_LOCATION_ID,
      url: env.SUPABASE_URL,
    });
  }

  return new NoopCallStore();
}

class NoopCallStore implements CallStore {
  async startCall(input: StartCallInput) {
    console.info("[call-store] Supabase not configured; call start not persisted", {
      callSid: input.setup.callSid,
    });
    return {};
  }

  async startRealtimeCall(input: StartRealtimeCallInput) {
    console.info("[call-store] Supabase not configured; realtime call start not persisted", {
      externalCallId: input.externalCallId,
    });
    return {};
  }

  async addTranscriptTurn(input: AddTranscriptTurnInput) {
    console.info("[call-store] Supabase not configured; transcript turn not persisted", {
      speaker: input.speaker,
      textLength: input.text.length,
    });
  }

  async completeCall(input: CompleteCallInput) {
    console.info("[call-store] Supabase not configured; call close not persisted", {
      durationSeconds: input.durationSeconds,
    });
  }

  async attachCallRecording(input: AttachCallRecordingInput) {
    console.info("[call-store] Supabase not configured; recording not persisted", {
      callId: input.callId,
      externalCallSid: input.externalCallSid,
      recordingSid: input.recordingSid,
    });
  }

  async createStaffReviewOrder(input: CreateStaffReviewOrderInput) {
    console.info("[call-store] Supabase not configured; staff-review order not persisted", {
      callId: input.callId,
      itemCount: input.items.length,
    });
    return {};
  }

  async createStaffTask(input: CreateStaffTaskInput) {
    console.info("[call-store] Supabase not configured; staff task not persisted", {
      callId: input.callId,
      title: input.title,
      type: input.type,
    });
    return {};
  }

  async createStaffReviewReservation(input: CreateStaffReviewReservationInput) {
    console.info("[call-store] Supabase not configured; reservation request not persisted", {
      callId: input.callId,
      date: input.date,
      partySize: input.partySize,
      time: input.time,
    });
    return {};
  }
}

class SupabaseCallStore implements CallStore {
  private readonly key: string;
  private readonly locationId: string;
  private readonly restUrl: string;

  constructor({ key, locationId, url }: { key: string; locationId: string; url: string }) {
    this.key = key;
    this.locationId = locationId;
    this.restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
  }

  async startCall(input: StartCallInput) {
    const startedAt = new Date().toISOString();
    const rows = await this.request<Array<{ id: string }>>("calls", {
      body: {
        caller_name: input.setup.callerName ?? null,
        caller_phone: input.setup.from ?? null,
        external_call_sid: input.setup.callSid,
        external_session_id: input.setup.sessionId,
        location_id: normalizeLocationId(input.locationId) ?? this.locationId,
        started_at: startedAt,
        status: "new",
        twilio_payload: input.setup,
      },
      headers: {
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      method: "POST",
      query: "on_conflict=external_call_sid&select=id",
    });

    return { callId: rows?.[0]?.id };
  }

  async startRealtimeCall(input: StartRealtimeCallInput) {
    const startedAt = new Date().toISOString();
    const rows = await this.request<Array<{ id: string }>>("calls", {
      body: {
        caller_phone: input.callerPhone ?? null,
        external_call_sid: input.externalCallId,
        external_session_id: input.externalSessionId ?? null,
        location_id: normalizeLocationId(input.locationId) ?? this.locationId,
        started_at: startedAt,
        status: "new",
        twilio_payload: {
          provider: "openai_realtime_sip",
          ...(input.providerPayload ?? {}),
        },
      },
      headers: {
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      method: "POST",
      query: "on_conflict=external_call_sid&select=id",
    });

    return { callId: rows?.[0]?.id };
  }

  async addTranscriptTurn(input: AddTranscriptTurnInput) {
    if (!input.callId) return;

    await this.request("transcript_turns", {
      body: {
        call_id: input.callId,
        offset_seconds: input.offsetSeconds ?? 0,
        speaker: input.speaker,
        text: input.text,
      },
      method: "POST",
    });
  }

  async completeCall(input: CompleteCallInput) {
    if (!input.callId) return;

    const body: Record<string, unknown> = {
      duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
      status: input.status ?? "resolved",
      summary: input.summary ?? null,
    };
    if (input.confidence !== undefined) body.confidence = clampConfidence(input.confidence);
    if (input.intent) body.intent = input.intent;
    if (input.outcome) body.outcome = input.outcome;
    if (input.recordingUrl) body.recording_url = input.recordingUrl;

    await this.request("calls", {
      body,
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(input.callId)}`,
    });
  }

  async attachCallRecording(input: AttachCallRecordingInput) {
    if (!input.callId && !input.externalCallSid) return;

    const body: Record<string, unknown> = {
      recording_url: input.recordingUrl,
    };
    if (input.durationSeconds !== undefined) body.duration_seconds = Math.max(0, Math.round(input.durationSeconds));

    const query = input.callId
      ? `id=eq.${encodeURIComponent(input.callId)}`
      : `external_call_sid=eq.${encodeURIComponent(input.externalCallSid ?? "")}`;

    await this.request("calls", {
      body,
      method: "PATCH",
      query,
    });
  }

  async createStaffTask(input: CreateStaffTaskInput) {
    const rows = await this.request<Array<{ id: string }>>("staff_tasks", {
      body: {
        assigned_to: input.assignedTo?.trim() || null,
        body: input.body?.trim() || null,
        call_id: input.callId ?? null,
        due_at: dueAt(input.dueMinutes ?? 30),
        location_id: normalizeLocationId(input.locationId) ?? this.locationId,
        priority: input.priority ?? "normal",
        status: "open",
        task_type: input.type ?? "general",
        title: input.title.trim(),
      },
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
      query: "select=id",
    });

    return { taskId: rows?.[0]?.id };
  }

  async createStaffReviewOrder(input: CreateStaffReviewOrderInput) {
    if (!input.callId || !input.items.length) return {};

    const totalCents = input.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    const rows = await this.request<Array<{ id: string }>>("orders", {
      body: {
        customer_name: input.customerName ?? "Unknown",
        customer_phone: input.customerPhone ?? null,
        destination: "staff_review",
        eta_minutes: input.etaMinutes ?? 25,
        location_id: normalizeLocationId(input.locationId) ?? this.locationId,
        notes: input.notes ?? null,
        payment_mode: "pay_at_pickup",
        source_call_id: input.callId,
        status: "new",
        total_cents: totalCents,
      },
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
      query: "select=id",
    });

    const orderId = rows?.[0]?.id;
    if (!orderId) return {};

    await this.request("order_items", {
      body: input.items.map((item) => ({
        modifiers: item.modifiers ?? [],
        name: item.name,
        order_id: orderId,
        price_cents: item.priceCents,
        quantity: item.quantity,
      })),
      method: "POST",
    });

    await this.request("order_delivery_attempts", {
      body: buildStaffReviewOrderDeliveryAttemptPayload({
        callId: input.callId,
        itemCount: input.items.length,
        orderId,
        totalCents,
      }),
      method: "POST",
    });

    await this.request("calls", {
      body: {
        intent: "order",
        outcome: "order_placed",
        summary: `Staff-review pickup order created with ${input.items.length} item type${input.items.length === 1 ? "" : "s"}.`,
      },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(input.callId)}`,
    });

    return { orderId };
  }

  async createStaffReviewReservation(input: CreateStaffReviewReservationInput) {
    if (!input.callId) return {};

    const rows = await this.request<Array<{ id: string }>>("reservations", {
      body: {
        guest_name: input.guestName ?? "Unknown",
        guest_phone: input.callerPhone ?? null,
        location_id: normalizeLocationId(input.locationId) ?? this.locationId,
        manual_request: input.manualRequest ?? true,
        notes: buildReservationNotes(input),
        party_size: input.partySize,
        provider: input.provider ?? "manual_request",
        provider_reservation_id: input.providerReservationId ?? null,
        reservation_date: input.date,
        reservation_time: `${input.time}:00`,
        source: "ai_host",
        source_call_id: input.callId,
        status: input.status ?? "pending",
      },
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
      query: "select=id",
    });

    const reservationId = rows?.[0]?.id;
    if (!reservationId) return {};

    await this.request("calls", {
      body: {
        intent: "reservation",
        outcome: input.status === "confirmed" ? "reservation_booked" : "escalated",
        summary:
          input.status === "confirmed"
            ? `${providerLabel(input.provider)} reservation confirmed for ${input.partySize} on ${input.date} at ${input.time}.`
            : `Staff-confirmed reservation request created for ${input.partySize} on ${input.date} at ${input.time}.`,
      },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(input.callId)}`,
    });

    return { reservationId };
  }

  private async request<T = unknown>(
    table: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      method: "GET" | "POST" | "PATCH";
      query?: string;
    },
  ) {
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
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

function clampConfidence(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildReservationNotes(input: CreateStaffReviewReservationInput) {
  return [
    input.notes,
    input.status === "confirmed"
      ? `AI-created reservation confirmed through ${providerLabel(input.provider)}. Confidence: ${input.confidence}%.`
      : `AI-created staff-confirmed reservation request. Not confirmed until staff approves. Confidence: ${input.confidence}%.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function providerLabel(provider?: string) {
  if (provider === "opentable") return "OpenTable";
  return provider?.trim() || "Provider";
}

function dueAt(minutesFromNow: number) {
  return new Date(Date.now() + Math.max(1, minutesFromNow) * 60_000).toISOString();
}

function buildStaffReviewOrderDeliveryAttemptPayload(input: {
  callId?: string;
  itemCount: number;
  orderId: string;
  totalCents: number;
}) {
  const now = new Date().toISOString();

  return {
    delivered_at: now,
    destination: "staff_review",
    order_id: input.orderId,
    payload: {
      callId: input.callId,
      itemCount: input.itemCount,
      source: "voice_agent",
      totalCents: input.totalCents,
    },
    status: "sent",
  };
}
