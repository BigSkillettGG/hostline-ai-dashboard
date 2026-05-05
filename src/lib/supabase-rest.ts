import type {
  Call,
  CallIntent,
  CallOutcome,
  CallStatus,
  Order,
  OrderStatus,
  TranscriptSpeaker,
} from "@/data/mock";
import { calculateOnboardingProgress, type OnboardingDraft } from "@/domain/onboarding";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabaseDemoLocationId = import.meta.env.VITE_SUPABASE_DEMO_LOCATION_ID ?? "";

const callIntents: CallIntent[] = ["order", "reservation", "faq", "hours", "other"];
const callOutcomes: CallOutcome[] = ["resolved", "order_placed", "reservation_booked", "escalated", "voicemail", "missed", "unknown"];
const callStatuses: CallStatus[] = ["new", "reviewed", "needs_review", "resolved"];
const transcriptSpeakers: TranscriptSpeaker[] = ["agent", "caller", "staff"];
const orderStatuses: OrderStatus[] = ["new", "accepted", "in_progress", "completed", "canceled"];

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

interface SupabaseOrderRow {
  id: string;
  source_call_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string | null;
  total_cents: number | null;
  eta_minutes: number | null;
  payment_mode: string | null;
  notes: string | null;
  created_at: string;
}

interface SupabaseOrderItemRow {
  order_id: string;
  name: string;
  quantity: number | null;
  price_cents: number | null;
  modifiers: unknown;
  notes: string | null;
}

interface SupabaseOnboardingProfileRow {
  completed_required: number | null;
  draft: unknown;
  location_id: string;
  progress_percent: number | null;
  status: string | null;
  total_required: number | null;
  updated_at: string | null;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function isOnboardingPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
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

export async function fetchOrdersFromSupabase(): Promise<Order[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const orders = await supabaseRequest<SupabaseOrderRow[]>(
    "orders",
    new URLSearchParams({
      limit: "100",
      order: "created_at.desc",
      select: "id,source_call_id,customer_name,customer_phone,status,total_cents,eta_minutes,payment_mode,notes,created_at",
    }),
  );

  const orderIds = orders.map((order) => order.id);
  const orderItems = orderIds.length
    ? await supabaseRequest<SupabaseOrderItemRow[]>(
        "order_items",
        new URLSearchParams({
          order_id: `in.(${orderIds.join(",")})`,
          select: "order_id,name,quantity,price_cents,modifiers,notes",
        }),
      )
    : [];

  return mapSupabaseOrders(orders, orderItems);
}

export async function updateOrderStatusInSupabase(orderId: string, status: OrderStatus) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  await supabaseRequest("orders", new URLSearchParams({ id: `eq.${orderId}` }), {
    body: {
      status,
    },
    method: "PATCH",
  });
}

export async function fetchOnboardingProfileFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<OnboardingDraft | null> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase onboarding persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseOnboardingProfileRow[]>(
    "onboarding_profiles",
    new URLSearchParams({
      limit: "1",
      location_id: `eq.${locationId}`,
      select: "location_id,draft,progress_percent,completed_required,total_required,status,updated_at",
    }),
  );

  const draft = rows?.[0]?.draft;
  return isObjectRecord(draft) ? (draft as OnboardingDraft) : null;
}

export async function saveOnboardingProfileToSupabase(
  draft: OnboardingDraft,
  locationId = supabaseDemoLocationId,
) {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase onboarding persistence is not configured.");
  }

  const payload = buildOnboardingProfilePayload(draft, locationId);
  const rows = await supabaseRequest<SupabaseOnboardingProfileRow[]>(
    "onboarding_profiles",
    new URLSearchParams({
      on_conflict: "location_id",
      select: "location_id,progress_percent,completed_required,total_required,status,updated_at",
    }),
    {
      body: payload,
      headers: {
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      method: "POST",
    },
  );

  return rows?.[0] ?? payload;
}

export function buildOnboardingProfilePayload(draft: OnboardingDraft, locationId: string) {
  const progress = calculateOnboardingProgress(draft);

  return {
    completed_required: progress.completedRequired,
    draft,
    location_id: locationId,
    progress_percent: progress.percent,
    status: progress.percent === 100 ? "ready_for_test_call" : "in_progress",
    total_required: progress.totalRequired,
    updated_at: new Date().toISOString(),
  };
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

export function mapSupabaseOrders(
  orders: SupabaseOrderRow[],
  orderItems: SupabaseOrderItemRow[],
): Order[] {
  const itemsByOrderId = new Map<string, SupabaseOrderItemRow[]>();

  for (const item of orderItems) {
    const currentItems = itemsByOrderId.get(item.order_id) ?? [];
    currentItems.push(item);
    itemsByOrderId.set(item.order_id, currentItems);
  }

  return orders.map((order) => {
    const items = (itemsByOrderId.get(order.id) ?? []).map((item) => ({
      modifiers: normalizeStringArray(item.modifiers),
      name: item.name,
      notes: item.notes ?? undefined,
      price: centsToDollars(item.price_cents ?? 0),
      qty: item.quantity ?? 1,
    }));

    return {
      id: order.id,
      createdAt: order.created_at,
      customer: order.customer_name?.trim() || "Unknown",
      etaMinutes: order.eta_minutes ?? 0,
      items,
      notes: order.notes ?? undefined,
      payAtPickup: order.payment_mode === "pay_at_pickup",
      phone: order.customer_phone?.trim() || "Unknown",
      sourceCallId: order.source_call_id ?? undefined,
      status: normalizeEnum(order.status, orderStatuses, "new"),
      total: centsToDollars(order.total_cents ?? calculateItemsTotalCents(items)),
    };
  });
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

function centsToDollars(cents: number) {
  return cents / 100;
}

function calculateItemsTotalCents(items: Array<{ price: number; qty: number }>) {
  return Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length ? strings : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function supabaseRequest<T>(
  table: string,
  params: URLSearchParams,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: "GET" | "PATCH" | "POST";
  },
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...options?.headers,
    },
    method: options?.method ?? "GET",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${table} request failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
