import type { Call, CallIntent, CallOutcome, CallStatus, TranscriptSpeaker } from "@/data/mock";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

const callIntents: CallIntent[] = ["order", "reservation", "faq", "hours", "other"];
const callOutcomes: CallOutcome[] = ["resolved", "order_placed", "reservation_booked", "escalated", "voicemail", "missed", "unknown"];
const callStatuses: CallStatus[] = ["new", "reviewed", "needs_review", "resolved"];
const transcriptSpeakers: TranscriptSpeaker[] = ["agent", "caller", "staff"];

interface SupabaseCallRow {
  id: string;
  caller_name: string | null;
  caller_phone: string | null;
  started_at: string;
  duration_seconds: number | null;
  intent: string | null;
  outcome: string | null;
  confidence: number | null;
  status: string | null;
  summary: string | null;
}

interface SupabaseTranscriptTurnRow {
  call_id: string;
  speaker: string;
  text: string;
  offset_seconds: number | null;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export async function fetchCallsFromSupabase(): Promise<Call[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const calls = await supabaseRequest<SupabaseCallRow[]>(
    "calls",
    new URLSearchParams({
      limit: "100",
      order: "started_at.desc",
      select: "id,caller_name,caller_phone,started_at,duration_seconds,intent,outcome,confidence,status,summary",
    }),
  );

  const callIds = calls.map((call) => call.id);
  const transcriptTurns = callIds.length
    ? await supabaseRequest<SupabaseTranscriptTurnRow[]>(
        "transcript_turns",
        new URLSearchParams({
          call_id: `in.(${callIds.join(",")})`,
          order: "offset_seconds.asc",
          select: "call_id,speaker,text,offset_seconds",
        }),
      )
    : [];

  return mapSupabaseCalls(calls, transcriptTurns);
}

export function mapSupabaseCalls(
  calls: SupabaseCallRow[],
  transcriptTurns: SupabaseTranscriptTurnRow[],
): Call[] {
  const turnsByCallId = new Map<string, SupabaseTranscriptTurnRow[]>();

  for (const turn of transcriptTurns) {
    const currentTurns = turnsByCallId.get(turn.call_id) ?? [];
    currentTurns.push(turn);
    turnsByCallId.set(turn.call_id, currentTurns);
  }

  return calls.map((call) => ({
    id: call.id,
    caller: call.caller_name?.trim() || "Unknown",
    phone: call.caller_phone?.trim() || "Unknown",
    time: call.started_at,
    duration: call.duration_seconds ?? 0,
    intent: normalizeEnum(call.intent, callIntents, "other"),
    outcome: normalizeEnum(call.outcome, callOutcomes, "unknown"),
    confidence: call.confidence ?? 0,
    status: normalizeEnum(call.status, callStatuses, "new"),
    summary: call.summary?.trim() || "No summary available yet.",
    transcript: (turnsByCallId.get(call.id) ?? []).map((turn) => ({
      speaker: normalizeEnum(turn.speaker, transcriptSpeakers, "caller"),
      text: turn.text,
      t: formatOffset(turn.offset_seconds ?? 0),
    })),
  }));
}

function normalizeEnum<T extends string>(value: string | null | undefined, allowedValues: T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

function formatOffset(offsetSeconds: number) {
  const totalSeconds = Math.max(0, Math.round(offsetSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

async function supabaseRequest<T>(table: string, params: URLSearchParams) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${table} request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}
