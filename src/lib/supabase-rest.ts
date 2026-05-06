import type {
  Call,
  CallIntent,
  CallOutcome,
  CallStatus,
  MenuItem,
  Order,
  OrderStatus,
  Reservation,
  ReservationStatus,
  TranscriptSpeaker,
} from "@/data/mock";
import type { ParsedMenuCategory } from "@/domain/menu-ingestion";
import { calculateOnboardingProgress, type OnboardingDraft } from "@/domain/onboarding";
import type { RestaurantAgentConfig } from "@/domain/restaurant-config";
import type {
  IngestionJob,
  IngestionJobStatus,
  IngestionJobType,
  MenuSource,
  MenuSourceType,
  SyncFrequency,
  SyncStatus,
} from "@/types/sources";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabaseDemoLocationId = import.meta.env.VITE_SUPABASE_DEMO_LOCATION_ID ?? "";

const callIntents: CallIntent[] = ["order", "reservation", "faq", "hours", "other"];
const callOutcomes: CallOutcome[] = ["resolved", "order_placed", "reservation_booked", "escalated", "voicemail", "missed", "unknown"];
const callStatuses: CallStatus[] = ["new", "reviewed", "needs_review", "resolved"];
const transcriptSpeakers: TranscriptSpeaker[] = ["agent", "caller", "staff"];
const orderStatuses: OrderStatus[] = ["new", "accepted", "in_progress", "completed", "canceled"];
const reservationStatuses: ReservationStatus[] = ["pending", "confirmed", "declined", "seated", "canceled"];
const reservationSources: Reservation["source"][] = ["ai_host", "web", "walk_in"];
const menuSourceTypes: MenuSourceType[] = ["url", "file", "paste"];
const syncFrequencies: SyncFrequency[] = ["hourly", "daily", "weekly"];
const syncStatuses: SyncStatus[] = ["synced", "error", "pending", "processing"];
const ingestionJobStatuses: IngestionJobStatus[] = ["queued", "processing", "completed", "failed"];
const ingestionJobTypes: IngestionJobType[] = ["menu_source_sync", "menu_text_import", "menu_file_import"];

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

interface SupabaseCallOrderLinkRow {
  id: string;
  source_call_id: string | null;
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

interface SupabaseAgentConfigRow {
  after_hours_behavior: string | null;
  answer_after_rings: number | null;
  answer_faqs_enabled: boolean | null;
  call_handling_mode: string | null;
  disclosure_enabled: boolean | null;
  escalation_phone_number: string | null;
  greeting_template: string | null;
  host_name: string | null;
  id: string;
  order_destinations: unknown;
  orders_enabled: boolean | null;
  payment_mode: string | null;
  reservations_enabled: boolean | null;
  reservation_mode: string | null;
  reservation_provider: string | null;
  sms_confirmations_enabled: boolean | null;
  staff_escalation_enabled: boolean | null;
  tone: string | null;
  updated_at: string | null;
}

interface SupabasePhoneNumberRow {
  id: string;
  phone_number: string;
  provider: string | null;
  provider_sid: string | null;
  restaurant_main_line: string | null;
  forwarding_mode: string | null;
  forwarding_status: string | null;
  status: string | null;
  voice_webhook_url: string | null;
  last_verified_at: string | null;
  updated_at: string | null;
}

interface SupabaseMenuCategoryRow {
  id: string;
  name: string;
  sort_order: number | null;
}

interface SupabaseMenuItemRow {
  available: boolean | null;
  category_id: string;
  description: string | null;
  id: string;
  modifiers: unknown;
  name: string;
  prep_minutes: number | null;
  price_cents: number | null;
  upsell_suggestions: unknown;
}

interface SupabaseMenuSourceRow {
  created_at: string | null;
  file_name: string | null;
  id: string;
  label: string | null;
  last_error: string | null;
  last_synced_at: string | null;
  source_type: string | null;
  status: string | null;
  sync_frequency: string | null;
  updated_at: string | null;
  url: string | null;
}

interface SupabaseIngestionJobRow {
  completed_at: string | null;
  created_at: string | null;
  error_message: string | null;
  id: string;
  job_type: string | null;
  result: unknown;
  source_id: string | null;
  status: string | null;
}

interface SupabaseReservationRow {
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

interface SupabaseCallReservationLinkRow {
  id: string;
  source_call_id: string | null;
}

export interface PhoneNumberRecord {
  forwardingMode: string;
  forwardingStatus: string;
  id: string;
  lastVerifiedAt?: string;
  phoneNumber: string;
  provider: string;
  providerSid?: string;
  restaurantMainLine?: string;
  status: string;
  updatedAt?: string;
  voiceWebhookUrl?: string;
}

export interface MenuCategoryRecord {
  id: string;
  items: MenuItem[];
  name: string;
}

export interface CreateReservationInput {
  date: string;
  guest: string;
  manual?: boolean;
  notes?: string;
  partySize: number;
  phone?: string;
  provider?: string;
  source?: Reservation["source"];
  status?: ReservationStatus;
  time: string;
}

export interface CreateMenuSourceInput {
  frequency: SyncFrequency;
  label?: string;
  type?: MenuSourceType;
  url: string;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function isOnboardingPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isMenuPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isMenuSourcePersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isReservationPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isAgentConfigPersistenceConfigured() {
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
  const [transcriptTurns, orderLinks, reservationLinks] = callIds.length
    ? await Promise.all([
        supabaseRequest<SupabaseTranscriptTurnRow[]>(
          "transcript_turns",
          new URLSearchParams({
            call_id: `in.(${callIds.join(",")})`,
            order: "offset_seconds.asc",
            select: "call_id,speaker,text,offset_seconds",
          }),
        ),
        supabaseRequest<SupabaseCallOrderLinkRow[]>(
          "orders",
          new URLSearchParams({
            source_call_id: `in.(${callIds.join(",")})`,
            select: "id,source_call_id",
          }),
        ),
        supabaseRequest<SupabaseCallReservationLinkRow[]>(
          "reservations",
          new URLSearchParams({
            source_call_id: `in.(${callIds.join(",")})`,
            select: "id,source_call_id",
          }),
        ),
      ])
    : [[], [], []];

  return mapSupabaseCalls(calls, transcriptTurns, { orderLinks, reservationLinks });
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

export async function fetchAgentConfigFromSupabase(
  fallbackConfig: RestaurantAgentConfig,
  locationId = supabaseDemoLocationId,
): Promise<RestaurantAgentConfig | null> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase agent-config persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseAgentConfigRow[]>(
    "agent_configs",
    new URLSearchParams({
      limit: "1",
      location_id: `eq.${locationId}`,
      order: "updated_at.desc",
      select: agentConfigSelectColumns,
    }),
  );

  return rows[0] ? mapSupabaseAgentConfig(rows[0], fallbackConfig) : null;
}

export async function saveAgentConfigToSupabase(
  config: RestaurantAgentConfig,
  locationId = supabaseDemoLocationId,
) {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase agent-config persistence is not configured.");
  }

  const existingRows = await supabaseRequest<Array<Pick<SupabaseAgentConfigRow, "id">>>(
    "agent_configs",
    new URLSearchParams({
      limit: "1",
      location_id: `eq.${locationId}`,
      select: "id",
    }),
  );

  const payload = buildAgentConfigPayload(config, locationId);

  if (existingRows[0]?.id) {
    const rows = await supabaseRequest<SupabaseAgentConfigRow[]>(
      "agent_configs",
      new URLSearchParams({
        id: `eq.${existingRows[0].id}`,
        select: agentConfigSelectColumns,
      }),
      {
        body: payload,
        headers: {
          Prefer: "return=representation",
        },
        method: "PATCH",
      },
    );

    return rows[0] ?? payload;
  }

  const rows = await supabaseRequest<SupabaseAgentConfigRow[]>(
    "agent_configs",
    new URLSearchParams({
      select: agentConfigSelectColumns,
    }),
    {
      body: payload,
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );

  return rows[0] ?? payload;
}

export async function fetchPhoneNumbersFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<PhoneNumberRecord[]> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase phone-number persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabasePhoneNumberRow[]>(
    "phone_numbers",
    new URLSearchParams({
      location_id: `eq.${locationId}`,
      order: "created_at.desc",
      select:
        "id,phone_number,provider,provider_sid,restaurant_main_line,forwarding_mode,forwarding_status,status,voice_webhook_url,last_verified_at,updated_at",
    }),
  );

  return rows.map(mapSupabasePhoneNumber);
}

export async function fetchMenuFromSupabase(locationId = supabaseDemoLocationId): Promise<MenuCategoryRecord[]> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase menu persistence is not configured.");
  }

  const categories = await supabaseRequest<SupabaseMenuCategoryRow[]>(
    "menu_categories",
    new URLSearchParams({
      location_id: `eq.${locationId}`,
      order: "sort_order.asc",
      select: "id,name,sort_order",
    }),
  );

  const categoryIds = categories.map((category) => category.id);
  const items = categoryIds.length
    ? await supabaseRequest<SupabaseMenuItemRow[]>(
        "menu_items",
        new URLSearchParams({
          category_id: `in.(${categoryIds.join(",")})`,
          order: "name.asc",
          select: "id,category_id,name,description,price_cents,prep_minutes,available,modifiers,upsell_suggestions",
        }),
      )
    : [];

  return mapSupabaseMenu(categories, items);
}

export async function fetchMenuSourcesFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<{ jobs: IngestionJob[]; sources: MenuSource[] }> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase menu-source persistence is not configured.");
  }

  const sources = await supabaseRequest<SupabaseMenuSourceRow[]>(
    "menu_sources",
    new URLSearchParams({
      location_id: `eq.${locationId}`,
      order: "updated_at.desc",
      select: menuSourceSelectColumns,
    }),
  );

  const sourceIds = sources.map((source) => source.id);
  const jobs = sourceIds.length
    ? await supabaseRequest<SupabaseIngestionJobRow[]>(
        "ingestion_jobs",
        new URLSearchParams({
          limit: "20",
          order: "created_at.desc",
          source_id: `in.(${sourceIds.join(",")})`,
          select: ingestionJobSelectColumns,
        }),
      )
    : [];

  return {
    jobs: jobs.map(mapSupabaseIngestionJob),
    sources: sources.map(mapSupabaseMenuSource),
  };
}

export async function createMenuSourceInSupabase(
  input: CreateMenuSourceInput,
  locationId = supabaseDemoLocationId,
): Promise<{ job?: IngestionJob; source: MenuSource }> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase menu-source persistence is not configured.");
  }

  const sourceRows = await supabaseRequest<SupabaseMenuSourceRow[]>(
    "menu_sources",
    new URLSearchParams({
      select: menuSourceSelectColumns,
    }),
    {
      body: buildMenuSourceInsertPayload(input, locationId),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );
  const source = sourceRows[0];
  if (!source) throw new Error("Menu source was not created.");

  const jobRows = await createIngestionJobForSource(source, "menu_source_sync", locationId);

  return {
    job: jobRows[0] ? mapSupabaseIngestionJob(jobRows[0]) : undefined,
    source: mapSupabaseMenuSource(source),
  };
}

export async function queueMenuSourceSyncInSupabase(
  source: MenuSource,
  locationId = supabaseDemoLocationId,
): Promise<{ job?: IngestionJob; source?: MenuSource }> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase menu-source persistence is not configured.");
  }

  const updatedRows = await supabaseRequest<SupabaseMenuSourceRow[]>(
    "menu_sources",
    new URLSearchParams({
      id: `eq.${source.id}`,
      select: menuSourceSelectColumns,
    }),
    {
      body: {
        last_error: null,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      headers: {
        Prefer: "return=representation",
      },
      method: "PATCH",
    },
  );

  const jobRows = await createIngestionJobForSource(
    {
      file_name: source.fileName ?? null,
      id: source.id,
      label: source.label ?? null,
      source_type: source.type,
      sync_frequency: source.frequency,
      url: source.url ?? null,
    },
    "menu_source_sync",
    locationId,
  );

  return {
    job: jobRows[0] ? mapSupabaseIngestionJob(jobRows[0]) : undefined,
    source: updatedRows[0] ? mapSupabaseMenuSource(updatedRows[0]) : undefined,
  };
}

export async function deleteMenuSourceFromSupabase(sourceId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase menu-source persistence is not configured.");
  }

  await supabaseRequest("menu_sources", new URLSearchParams({ id: `eq.${sourceId}` }), {
    method: "DELETE",
  });
}

export async function importParsedMenuToSupabase(
  categories: ParsedMenuCategory[],
  locationId = supabaseDemoLocationId,
): Promise<MenuCategoryRecord[]> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase menu persistence is not configured.");
  }

  const importableCategories = categories.filter((category) => category.items.length > 0);
  if (!importableCategories.length) {
    throw new Error("No menu items were found to import.");
  }

  await supabaseRequest("menu_categories", new URLSearchParams({ location_id: `eq.${locationId}` }), {
    method: "DELETE",
  });

  const insertedCategories = await supabaseRequest<SupabaseMenuCategoryRow[]>(
    "menu_categories",
    new URLSearchParams({
      select: "id,name,sort_order",
    }),
    {
      body: buildMenuCategoryInsertRows(importableCategories, locationId),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );

  const itemRows = buildMenuItemInsertRows(importableCategories, insertedCategories);
  const insertedItems = itemRows.length
    ? await supabaseRequest<SupabaseMenuItemRow[]>(
        "menu_items",
        new URLSearchParams({
          select: "id,category_id,name,description,price_cents,prep_minutes,available,modifiers,upsell_suggestions",
        }),
        {
          body: itemRows,
          headers: {
            Prefer: "return=representation",
          },
          method: "POST",
        },
      )
    : [];

  return mapSupabaseMenu(insertedCategories, insertedItems);
}

export async function fetchReservationsFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<Reservation[]> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase reservation persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseReservationRow[]>(
    "reservations",
    new URLSearchParams({
      limit: "200",
      location_id: `eq.${locationId}`,
      order: "reservation_date.asc,reservation_time.asc",
      select: reservationSelectColumns,
    }),
  );

  return mapSupabaseReservations(rows);
}

export async function updateReservationStatusInSupabase(
  reservationId: string,
  status: ReservationStatus,
): Promise<Reservation | undefined> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const rows = await supabaseRequest<SupabaseReservationRow[]>(
    "reservations",
    new URLSearchParams({
      id: `eq.${reservationId}`,
      select: reservationSelectColumns,
    }),
    {
      body: {
        manual_request: status === "pending",
        status,
      },
      headers: {
        Prefer: "return=representation",
      },
      method: "PATCH",
    },
  );

  return mapSupabaseReservations(rows ?? [])[0];
}

export async function createReservationInSupabase(
  input: CreateReservationInput,
  locationId = supabaseDemoLocationId,
): Promise<Reservation | undefined> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase reservation persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseReservationRow[]>(
    "reservations",
    new URLSearchParams({
      select: reservationSelectColumns,
    }),
    {
      body: buildReservationInsertPayload(input, locationId),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );

  return mapSupabaseReservations(rows ?? [])[0];
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

export function mapSupabasePhoneNumber(row: SupabasePhoneNumberRow): PhoneNumberRecord {
  return {
    forwardingMode: row.forwarding_mode ?? "forward_unanswered",
    forwardingStatus: row.forwarding_status ?? "not_verified",
    id: row.id,
    lastVerifiedAt: row.last_verified_at ?? undefined,
    phoneNumber: row.phone_number,
    provider: row.provider ?? "twilio",
    providerSid: row.provider_sid ?? undefined,
    restaurantMainLine: row.restaurant_main_line ?? undefined,
    status: row.status ?? "provisioned",
    updatedAt: row.updated_at ?? undefined,
    voiceWebhookUrl: row.voice_webhook_url ?? undefined,
  };
}

export function buildAgentConfigPayload(config: RestaurantAgentConfig, locationId: string) {
  return {
    after_hours_behavior: config.afterHoursBehavior,
    answer_after_rings: config.answerAfterRings,
    answer_faqs_enabled: config.capabilities.answerFaqs,
    call_handling_mode: config.callHandlingMode,
    disclosure_enabled: config.disclosureEnabled,
    escalation_phone_number: config.escalationPhoneNumber,
    greeting_template: config.greetingTemplate,
    host_name: config.hostName,
    location_id: locationId,
    order_destinations: config.orders.destinations,
    orders_enabled: config.orders.enabled,
    payment_mode: config.orders.paymentMode,
    reservations_enabled: config.capabilities.handleReservations,
    reservation_mode: config.reservations.mode,
    reservation_provider: config.reservations.provider,
    sms_confirmations_enabled: config.capabilities.sendSmsConfirmations,
    staff_escalation_enabled: config.capabilities.escalateToStaff,
    tone: config.tone,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseAgentConfig(
  row: SupabaseAgentConfigRow,
  fallbackConfig: RestaurantAgentConfig,
): RestaurantAgentConfig {
  const ordersEnabled = row.orders_enabled ?? fallbackConfig.orders.enabled;
  const reservationsEnabled = row.reservations_enabled ?? fallbackConfig.capabilities.handleReservations;

  return {
    ...fallbackConfig,
    afterHoursBehavior: normalizeStringField(row.after_hours_behavior, fallbackConfig.afterHoursBehavior),
    answerAfterRings: row.answer_after_rings ?? fallbackConfig.answerAfterRings,
    callHandlingMode: normalizeStringField(row.call_handling_mode, fallbackConfig.callHandlingMode),
    capabilities: {
      ...fallbackConfig.capabilities,
      answerFaqs: row.answer_faqs_enabled ?? fallbackConfig.capabilities.answerFaqs,
      escalateToStaff: row.staff_escalation_enabled ?? fallbackConfig.capabilities.escalateToStaff,
      handleReservations: reservationsEnabled,
      sendSmsConfirmations: row.sms_confirmations_enabled ?? fallbackConfig.capabilities.sendSmsConfirmations,
      takeOrders: ordersEnabled,
    },
    disclosureEnabled: row.disclosure_enabled ?? fallbackConfig.disclosureEnabled,
    escalationPhoneNumber: normalizeStringField(row.escalation_phone_number, fallbackConfig.escalationPhoneNumber),
    greetingTemplate: normalizeStringField(row.greeting_template, fallbackConfig.greetingTemplate),
    hostName: normalizeStringField(row.host_name, fallbackConfig.hostName),
    orders: {
      ...fallbackConfig.orders,
      destinations: normalizeStringArrayWithFallback(row.order_destinations, fallbackConfig.orders.destinations),
      enabled: ordersEnabled,
      paymentMode: normalizeStringField(row.payment_mode, fallbackConfig.orders.paymentMode),
    },
    reservations: {
      ...fallbackConfig.reservations,
      mode: normalizeStringField(row.reservation_mode, fallbackConfig.reservations.mode),
      provider: normalizeStringField(row.reservation_provider, fallbackConfig.reservations.provider),
    },
    tone: normalizeStringField(row.tone, fallbackConfig.tone),
  };
}

export function buildMenuCategoryInsertRows(categories: ParsedMenuCategory[], locationId: string) {
  return categories.map((category, index) => ({
    location_id: locationId,
    name: category.name,
    sort_order: index,
  }));
}

export function buildMenuItemInsertRows(
  categories: ParsedMenuCategory[],
  insertedCategories: Array<Pick<SupabaseMenuCategoryRow, "id">>,
) {
  return categories.flatMap((category, categoryIndex) => {
    const insertedCategory = insertedCategories[categoryIndex];
    if (!insertedCategory) return [];

    return category.items.map((item) => ({
      available: item.available,
      category_id: insertedCategory.id,
      description: item.description ?? null,
      modifiers: item.modifiers ?? [],
      name: item.name,
      prep_minutes: item.prepMinutes,
      price_cents: item.priceCents,
      upsell_suggestions: item.upsellSuggestions ?? [],
    }));
  });
}

export function buildMenuSourceInsertPayload(input: CreateMenuSourceInput, locationId: string) {
  const url = input.url.trim();

  return {
    file_name: null,
    label: input.label?.trim() || deriveSourceLabel(url),
    last_error: null,
    location_id: locationId,
    metadata: {},
    source_type: input.type ?? "url",
    status: "pending" as SyncStatus,
    sync_frequency: input.frequency,
    updated_at: new Date().toISOString(),
    url,
  };
}

export function buildIngestionJobInsertPayload(input: {
  jobType: IngestionJobType;
  locationId: string;
  source: Pick<
    SupabaseMenuSourceRow,
    "file_name" | "id" | "label" | "source_type" | "sync_frequency" | "url"
  >;
}) {
  return {
    input: {
      fileName: input.source.file_name,
      frequency: input.source.sync_frequency,
      label: input.source.label,
      sourceType: input.source.source_type,
      url: input.source.url,
    },
    job_type: input.jobType,
    location_id: input.locationId,
    result: {},
    source_id: input.source.id,
    status: "queued" as IngestionJobStatus,
  };
}

export function mapSupabaseMenuSource(row: SupabaseMenuSourceRow): MenuSource {
  return {
    fileName: row.file_name ?? undefined,
    frequency: normalizeEnum(row.sync_frequency, syncFrequencies, "daily"),
    id: row.id,
    label: row.label?.trim() || deriveSourceLabel(row.url ?? row.file_name ?? "Menu source"),
    lastError: row.last_error ?? undefined,
    lastSyncedAt: row.last_synced_at ?? "Never",
    status: normalizeEnum(row.status, syncStatuses, "pending"),
    type: normalizeEnum(row.source_type, menuSourceTypes, "url"),
    url: row.url ?? undefined,
  };
}

export function mapSupabaseIngestionJob(row: SupabaseIngestionJobRow): IngestionJob {
  return {
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at ?? "",
    errorMessage: row.error_message ?? undefined,
    id: row.id,
    sourceId: row.source_id ?? undefined,
    status: normalizeEnum(row.status, ingestionJobStatuses, "queued"),
    summary: readResultSummary(row.result),
    type: normalizeEnum(row.job_type, ingestionJobTypes, "menu_source_sync"),
  };
}

export function mapSupabaseMenu(
  categories: SupabaseMenuCategoryRow[],
  items: SupabaseMenuItemRow[],
): MenuCategoryRecord[] {
  const itemsByCategoryId = new Map<string, SupabaseMenuItemRow[]>();

  for (const item of items) {
    const currentItems = itemsByCategoryId.get(item.category_id) ?? [];
    currentItems.push(item);
    itemsByCategoryId.set(item.category_id, currentItems);
  }

  return [...categories]
    .sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0))
    .map((category) => ({
      id: category.id,
      items: (itemsByCategoryId.get(category.id) ?? []).map((item) => ({
        available: item.available ?? true,
        description: item.description ?? undefined,
        id: item.id,
        modifiers: normalizeStringArray(item.modifiers),
        name: item.name,
        prepMinutes: item.prep_minutes ?? 10,
        price: centsToDollars(item.price_cents ?? 0),
        upsell: normalizeStringArray(item.upsell_suggestions),
      })),
      name: category.name,
  }));
}

async function createIngestionJobForSource(
  source: Pick<
    SupabaseMenuSourceRow,
    "file_name" | "id" | "label" | "source_type" | "sync_frequency" | "url"
  >,
  jobType: IngestionJobType,
  locationId: string,
) {
  return supabaseRequest<SupabaseIngestionJobRow[]>(
    "ingestion_jobs",
    new URLSearchParams({
      select: ingestionJobSelectColumns,
    }),
    {
      body: buildIngestionJobInsertPayload({ jobType, locationId, source }),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );
}

export function buildReservationInsertPayload(input: CreateReservationInput, locationId: string) {
  const status = input.status ?? "pending";

  return {
    guest_name: input.guest.trim(),
    guest_phone: input.phone?.trim() || null,
    location_id: locationId,
    manual_request: input.manual ?? status === "pending",
    notes: input.notes?.trim() || null,
    party_size: input.partySize,
    provider: input.provider?.trim() || null,
    reservation_date: input.date,
    reservation_time: normalizeReservationTime(input.time),
    source: input.source ?? "ai_host",
    status,
  };
}

export function mapSupabaseReservations(rows: SupabaseReservationRow[]): Reservation[] {
  return rows.map((row) => ({
    createdAt: row.created_at ?? undefined,
    date: row.reservation_date ?? "",
    guest: row.guest_name?.trim() || "Unknown",
    id: row.id,
    manual: row.manual_request ?? false,
    notes: row.notes ?? undefined,
    partySize: row.party_size ?? 0,
    phone: row.guest_phone?.trim() || "Unknown",
    provider: row.provider ?? undefined,
    providerReservationId: row.provider_reservation_id ?? undefined,
    source: normalizeEnum(row.source, reservationSources, "ai_host"),
    sourceCallId: row.source_call_id ?? undefined,
    status: normalizeEnum(row.status, reservationStatuses, "pending"),
    time: normalizeDisplayTime(row.reservation_time),
  }));
}

export function mapSupabaseCalls(
  calls: SupabaseCallRow[],
  transcriptTurns: SupabaseTranscriptTurnRow[],
  links: {
    orderLinks?: SupabaseCallOrderLinkRow[];
    reservationLinks?: SupabaseCallReservationLinkRow[];
  } = {},
): Call[] {
  const turnsByCallId = new Map<string, SupabaseTranscriptTurnRow[]>();
  const orderIdByCallId = mapFirstLinkByCallId(links.orderLinks ?? []);
  const reservationIdByCallId = mapFirstLinkByCallId(links.reservationLinks ?? []);

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
    orderId: orderIdByCallId.get(call.id),
    reservationId: reservationIdByCallId.get(call.id),
    transcript: (turnsByCallId.get(call.id) ?? []).map((turn) => ({
      speaker: normalizeEnum(turn.speaker, transcriptSpeakers, "caller"),
      text: turn.text,
      t: formatOffset(turn.offset_seconds ?? 0),
    })),
  }));
}

function mapFirstLinkByCallId(rows: Array<{ id: string; source_call_id: string | null }>) {
  const links = new Map<string, string>();

  for (const row of rows) {
    if (row.source_call_id && !links.has(row.source_call_id)) {
      links.set(row.source_call_id, row.id);
    }
  }

  return links;
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

function normalizeReservationTime(time: string) {
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time;
  if (/^\d{2}:\d{2}$/.test(time)) return `${time}:00`;
  return time;
}

function normalizeDisplayTime(time: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
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

function normalizeStringArrayWithFallback<T extends string>(value: unknown, fallback: T[]): T[] {
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter((item): item is T => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings : fallback;
}

function normalizeStringField<T extends string>(value: string | null | undefined, fallback: T): T {
  return value?.trim() ? (value.trim() as T) : fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function deriveSourceLabel(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value.trim() || "Menu source";
  }
}

function readResultSummary(value: unknown) {
  if (!isObjectRecord(value)) return undefined;
  const summary = value.summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : undefined;
}

async function supabaseRequest<T>(
  table: string,
  params: URLSearchParams,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: "DELETE" | "GET" | "PATCH" | "POST";
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

const reservationSelectColumns =
  "id,guest_name,guest_phone,party_size,reservation_date,reservation_time,status,source,source_call_id,manual_request,provider,provider_reservation_id,notes,created_at";

const agentConfigSelectColumns =
  "id,host_name,tone,greeting_template,disclosure_enabled,call_handling_mode,answer_after_rings,after_hours_behavior,escalation_phone_number,answer_faqs_enabled,orders_enabled,reservations_enabled,sms_confirmations_enabled,staff_escalation_enabled,order_destinations,payment_mode,reservation_mode,reservation_provider,updated_at";

const menuSourceSelectColumns =
  "id,source_type,label,url,file_name,sync_frequency,status,last_synced_at,last_error,created_at,updated_at";

const ingestionJobSelectColumns =
  "id,source_id,job_type,status,result,error_message,created_at,completed_at";
