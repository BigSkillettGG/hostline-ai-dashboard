import type { VoiceServiceEnv } from "./env";
import type { CapturedOrderItem } from "./order-intake";
import type { ConversationRelaySetupMessage, TranscriptRole } from "./types";

export interface StartCallInput {
  setup: ConversationRelaySetupMessage;
  locationId?: string;
}

export interface AddTranscriptTurnInput {
  callId?: string;
  speaker: TranscriptRole;
  text: string;
  offsetSeconds?: number;
}

export interface CompleteCallInput {
  callId?: string;
  durationSeconds: number;
  summary?: string;
  status?: "new" | "reviewed" | "needs_review" | "resolved";
}

export interface CreateStaffReviewOrderInput {
  callId?: string;
  customerName?: string;
  customerPhone?: string;
  etaMinutes?: number;
  items: CapturedOrderItem[];
  notes?: string;
}

export interface CallStore {
  startCall(input: StartCallInput): Promise<{ callId?: string }>;
  addTranscriptTurn(input: AddTranscriptTurnInput): Promise<void>;
  completeCall(input: CompleteCallInput): Promise<void>;
  createStaffReviewOrder(input: CreateStaffReviewOrderInput): Promise<{ orderId?: string }>;
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

  async createStaffReviewOrder(input: CreateStaffReviewOrderInput) {
    console.info("[call-store] Supabase not configured; staff-review order not persisted", {
      callId: input.callId,
      itemCount: input.items.length,
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
        location_id: input.locationId ?? this.locationId,
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

    await this.request("calls", {
      body: {
        duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
        status: input.status ?? "resolved",
        summary: input.summary ?? null,
      },
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(input.callId)}`,
    });
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
        location_id: this.locationId,
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
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
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
