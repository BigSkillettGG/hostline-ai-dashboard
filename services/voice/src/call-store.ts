import type { VoiceServiceEnv } from "./env";
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

export interface CallStore {
  startCall(input: StartCallInput): Promise<{ callId?: string }>;
  addTranscriptTurn(input: AddTranscriptTurnInput): Promise<void>;
  completeCall(input: CompleteCallInput): Promise<void>;
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
