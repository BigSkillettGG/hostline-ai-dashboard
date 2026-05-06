import type {
  Call,
  CallIntent,
  CallOutcome,
  CallStatus,
  MenuItem,
  Order,
  OrderDeliveryStatus,
  OrderStatus,
  Reservation,
  ReservationStatus,
  TranscriptSpeaker,
} from "@/data/mock";
import { getActiveOrganizationId, getSupabaseAccessToken } from "@/lib/auth";
import type { ParsedMenuCategory } from "@/domain/menu-ingestion";
import { calculateOnboardingProgress, type OnboardingDraft } from "@/domain/onboarding";
import {
  defaultAlertRoutingConfig,
  normalizeAlertRoutingConfig,
  type AlertRecipient,
  type AlertRouteKind,
  type AlertRoutingConfig,
  type AlertSeverity,
} from "@/domain/alert-routing";
import {
  channelsForRecipients,
  normalizeStaffAlertEventStatus,
  type StaffAlertEvent,
} from "@/domain/alert-events";
import {
  normalizeStaffTaskPriority,
  normalizeStaffTaskStatus,
  normalizeStaffTaskType,
  type StaffTask,
  type StaffTaskPriority,
  type StaffTaskStatus,
  type StaffTaskType,
} from "@/domain/staff-tasks";
import {
  normalizeInviteEmail,
  normalizeTeamRole,
  type TeamInvitation,
  type TeamInviteStatus,
  type TeamMember,
} from "@/domain/team";
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
const orderDeliveryStatuses: OrderDeliveryStatus[] = ["pending", "sent", "failed", "not_configured"];
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
  destination: string | null;
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

interface SupabaseOrderDeliveryAttemptRow {
  created_at: string | null;
  delivered_at: string | null;
  destination: string | null;
  error_message: string | null;
  id: string;
  order_id: string;
  status: string | null;
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

interface SupabaseAlertRoutingConfigRow {
  config: unknown;
  id: string;
  updated_at: string | null;
}

interface SupabaseStaffAlertEventRow {
  call_id: string | null;
  caller_phone: string | null;
  channels: unknown;
  created_at: string | null;
  error_message: string | null;
  id: string;
  kind: string | null;
  message: string | null;
  recipients: unknown;
  route_snapshot: unknown;
  sent_at: string | null;
  severity: string | null;
  status: string | null;
  summary: string | null;
}

interface SupabaseStaffTaskRow {
  assigned_to: string | null;
  body: string | null;
  call_id: string | null;
  completed_at: string | null;
  created_at: string | null;
  due_at: string | null;
  id: string;
  order_id: string | null;
  priority: string | null;
  reservation_id: string | null;
  status: string | null;
  task_type: string | null;
  title: string;
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
  verification_results: unknown;
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

interface SupabaseTeamMemberRow {
  created_at: string | null;
  id: string;
  member_email: string | null;
  member_name: string | null;
  role: string | null;
  user_id: string | null;
}

interface SupabaseTeamInvitationRow {
  created_at: string | null;
  email: string;
  expires_at: string | null;
  id: string;
  invited_by: string | null;
  role: string | null;
  status: string | null;
}

export interface PhoneNumberRecord {
  forwardingMode: string;
  forwardingStatus: string;
  forwardingVerification: ForwardingVerification;
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

export type ForwardingTestStatus = "pending" | "passed" | "failed" | "not_applicable";

export interface ForwardingVerification {
  busyForwarding?: ForwardingTestStatus;
  directCall?: ForwardingTestStatus;
  noAnswerForwarding?: ForwardingTestStatus;
  notes?: string;
  updatedAt?: string;
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

export interface CreateOrderDeliveryAttemptInput {
  destination: string;
  errorMessage?: string;
  orderId: string;
  payload?: Record<string, unknown>;
  status?: OrderDeliveryStatus;
}

export interface CreateStaffTaskInput {
  assignedTo?: string;
  body?: string;
  callId?: string;
  dueAt?: string;
  orderId?: string;
  priority?: StaffTaskPriority;
  reservationId?: string;
  status?: StaffTaskStatus;
  title: string;
  type?: StaffTaskType;
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

export function isAlertRoutingPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isStaffAlertEventPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isStaffTaskPersistenceConfigured() {
  return Boolean(isSupabaseConfigured() && supabaseDemoLocationId);
}

export function isTeamPersistenceConfigured(organizationId = getActiveOrganizationId()) {
  return Boolean(isSupabaseConfigured() && organizationId);
}

export async function fetchTeamMembersFromSupabase(
  organizationId = getActiveOrganizationId(),
): Promise<TeamMember[]> {
  if (!isTeamPersistenceConfigured(organizationId)) {
    throw new Error("Supabase team persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseTeamMemberRow[]>(
    "user_memberships",
    new URLSearchParams({
      order: "created_at.asc",
      organization_id: `eq.${organizationId}`,
      select: "id,user_id,role,member_name,member_email,created_at",
    }),
  );

  return rows.map(mapSupabaseTeamMember);
}

export async function fetchTeamInvitationsFromSupabase(
  organizationId = getActiveOrganizationId(),
): Promise<TeamInvitation[]> {
  if (!isTeamPersistenceConfigured(organizationId)) {
    throw new Error("Supabase team invitations are not configured.");
  }

  const rows = await supabaseRequest<SupabaseTeamInvitationRow[]>(
    "team_invitations",
    new URLSearchParams({
      order: "created_at.desc",
      organization_id: `eq.${organizationId}`,
      select: "id,email,role,status,invited_by,expires_at,created_at",
    }),
  );

  return rows.map(mapSupabaseTeamInvitation);
}

export async function createTeamInvitationInSupabase(
  input: { email: string; invitedBy?: string; role: TeamMember["role"] },
  organizationId = getActiveOrganizationId(),
): Promise<TeamInvitation> {
  if (!isTeamPersistenceConfigured(organizationId)) {
    throw new Error("Supabase team invitations are not configured.");
  }

  const role = normalizeTeamRole(input.role);
  const email = normalizeInviteEmail(input.email);
  const rows = await supabaseRequest<SupabaseTeamInvitationRow[]>(
    "team_invitations",
    new URLSearchParams(),
    {
      body: {
        email,
        invited_by: input.invitedBy,
        organization_id: organizationId,
        role,
        status: "pending",
      },
      headers: { Prefer: "return=representation" },
      method: "POST",
    },
  );

  if (!rows?.[0]) throw new Error("Supabase did not return the created invitation.");
  return mapSupabaseTeamInvitation(rows[0]);
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
      select:
        "id,source_call_id,customer_name,customer_phone,status,total_cents,eta_minutes,payment_mode,destination,notes,created_at",
    }),
  );

  const orderIds = orders.map((order) => order.id);
  const [orderItems, deliveryAttempts]: [SupabaseOrderItemRow[], SupabaseOrderDeliveryAttemptRow[]] = orderIds.length
    ? await Promise.all([
        supabaseRequest<SupabaseOrderItemRow[]>(
          "order_items",
          new URLSearchParams({
            order_id: `in.(${orderIds.join(",")})`,
            select: "order_id,name,quantity,price_cents,modifiers,notes",
          }),
        ),
        supabaseRequest<SupabaseOrderDeliveryAttemptRow[]>(
          "order_delivery_attempts",
          new URLSearchParams({
            order: "created_at.desc",
            order_id: `in.(${orderIds.join(",")})`,
            select: "id,order_id,destination,status,error_message,created_at,delivered_at",
          }),
        ).catch(() => []),
      ])
    : [[], []];

  return mapSupabaseOrders(orders, orderItems, deliveryAttempts);
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

export async function createOrderDeliveryAttemptInSupabase(input: CreateOrderDeliveryAttemptInput) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const rows = await supabaseRequest<SupabaseOrderDeliveryAttemptRow[]>(
    "order_delivery_attempts",
    new URLSearchParams({
      select: "id,order_id,destination,status,error_message,created_at,delivered_at",
    }),
    {
      body: buildOrderDeliveryAttemptPayload(input),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );

  return rows?.[0]
    ? {
        createdAt: rows[0].created_at ?? undefined,
        deliveredAt: rows[0].delivered_at ?? undefined,
        destination: rows[0].destination ?? input.destination,
        errorMessage: rows[0].error_message ?? undefined,
        id: rows[0].id,
        status: normalizeEnum(rows[0].status, orderDeliveryStatuses, input.status ?? "pending"),
      }
    : undefined;
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

export async function fetchAlertRoutingConfigFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<AlertRoutingConfig | null> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase alert-routing persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseAlertRoutingConfigRow[]>(
    "alert_routing_configs",
    new URLSearchParams({
      limit: "1",
      location_id: `eq.${locationId}`,
      select: "id,config,updated_at",
    }),
  );

  if (!rows[0]) return null;

  return normalizeAlertRoutingConfig({
    ...(typeof rows[0].config === "object" && rows[0].config ? rows[0].config : defaultAlertRoutingConfig),
    updatedAt: rows[0].updated_at ?? undefined,
  });
}

export async function saveAlertRoutingConfigToSupabase(
  config: AlertRoutingConfig,
  locationId = supabaseDemoLocationId,
) {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase alert-routing persistence is not configured.");
  }

  const payload = buildAlertRoutingConfigPayload(config, locationId);
  const rows = await supabaseRequest<SupabaseAlertRoutingConfigRow[]>(
    "alert_routing_configs",
    new URLSearchParams({
      on_conflict: "location_id",
      select: "id,config,updated_at",
    }),
    {
      body: payload,
      headers: {
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      method: "POST",
    },
  );

  const savedConfig = rows?.[0]?.config;
  return rows?.[0]
    ? normalizeAlertRoutingConfig({
        ...(isObjectRecord(savedConfig) ? savedConfig : {}),
        updatedAt: rows[0].updated_at ?? undefined,
      })
    : config;
}

export async function fetchStaffAlertEventsFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<StaffAlertEvent[]> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase alert event persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseStaffAlertEventRow[]>(
    "staff_alert_events",
    new URLSearchParams({
      limit: "100",
      location_id: `eq.${locationId}`,
      order: "created_at.desc",
      select: staffAlertEventSelectColumns,
    }),
  );

  return rows.map(mapSupabaseStaffAlertEvent);
}

export async function fetchStaffTasksFromSupabase(
  locationId = supabaseDemoLocationId,
): Promise<StaffTask[]> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase staff task persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseStaffTaskRow[]>(
    "staff_tasks",
    new URLSearchParams({
      limit: "100",
      location_id: `eq.${locationId}`,
      order: "created_at.desc",
      select: staffTaskSelectColumns,
    }),
  );

  return rows.map(mapSupabaseStaffTask);
}

export async function createStaffTaskInSupabase(
  input: CreateStaffTaskInput,
  locationId = supabaseDemoLocationId,
): Promise<StaffTask | undefined> {
  if (!isSupabaseConfigured() || !locationId) {
    throw new Error("Supabase staff task persistence is not configured.");
  }

  const rows = await supabaseRequest<SupabaseStaffTaskRow[]>(
    "staff_tasks",
    new URLSearchParams({
      select: staffTaskSelectColumns,
    }),
    {
      body: buildStaffTaskInsertPayload(input, locationId),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
    },
  );

  return rows?.[0] ? mapSupabaseStaffTask(rows[0]) : undefined;
}

export async function updateStaffTaskStatusInSupabase(taskId: string, status: StaffTaskStatus) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase staff task persistence is not configured.");
  }

  await supabaseRequest("staff_tasks", new URLSearchParams({ id: `eq.${taskId}` }), {
    body: {
      completed_at: status === "done" || status === "dismissed" ? new Date().toISOString() : null,
      status,
    },
    method: "PATCH",
  });
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
        "id,phone_number,provider,provider_sid,restaurant_main_line,forwarding_mode,forwarding_status,status,voice_webhook_url,verification_results,last_verified_at,updated_at",
    }),
  );

  return rows.map(mapSupabasePhoneNumber);
}

export async function savePhoneNumberVerificationToSupabase(
  phoneNumberId: string,
  verification: ForwardingVerification,
): Promise<PhoneNumberRecord | undefined> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase phone-number persistence is not configured.");
  }

  const forwardingStatus = calculateForwardingStatus(verification);
  const rows = await supabaseRequest<SupabasePhoneNumberRow[]>(
    "phone_numbers",
    new URLSearchParams({
      id: `eq.${phoneNumberId}`,
      select:
        "id,phone_number,provider,provider_sid,restaurant_main_line,forwarding_mode,forwarding_status,status,voice_webhook_url,verification_results,last_verified_at,updated_at",
    }),
    {
      body: {
        forwarding_status: forwardingStatus,
        last_verified_at: forwardingStatus === "verified" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        verification_results: verification,
      },
      headers: {
        Prefer: "return=representation",
      },
      method: "PATCH",
    },
  );

  return rows?.[0] ? mapSupabasePhoneNumber(rows[0]) : undefined;
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
    forwardingVerification: normalizeForwardingVerification(row.verification_results),
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

export function calculateForwardingStatus(verification: ForwardingVerification) {
  const requiredStatuses = [
    verification.directCall,
    verification.noAnswerForwarding,
    verification.busyForwarding,
  ];

  if (requiredStatuses.every((status) => status === "passed" || status === "not_applicable")) {
    return "verified";
  }

  if (requiredStatuses.some((status) => status === "failed")) {
    return "needs_attention";
  }

  if (requiredStatuses.some((status) => status === "passed")) {
    return "partial";
  }

  return "not_verified";
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

export function buildAlertRoutingConfigPayload(config: AlertRoutingConfig, locationId: string) {
  const updatedAt = new Date().toISOString();
  const normalized = normalizeAlertRoutingConfig(config);

  return {
    config: {
      ...normalized,
      updatedAt,
    },
    location_id: locationId,
    updated_at: updatedAt,
  };
}

export function buildOrderDeliveryAttemptPayload(input: CreateOrderDeliveryAttemptInput) {
  const status = input.status ?? "pending";

  return {
    delivered_at: status === "sent" ? new Date().toISOString() : null,
    destination: input.destination,
    error_message: input.errorMessage?.trim() || null,
    order_id: input.orderId,
    payload: input.payload ?? {},
    status,
  };
}

export function buildStaffTaskInsertPayload(input: CreateStaffTaskInput, locationId: string) {
  const status = normalizeStaffTaskStatus(input.status);

  return {
    assigned_to: input.assignedTo?.trim() || null,
    body: input.body?.trim() || null,
    call_id: input.callId ?? null,
    completed_at: status === "done" || status === "dismissed" ? new Date().toISOString() : null,
    due_at: input.dueAt ?? null,
    location_id: locationId,
    order_id: input.orderId ?? null,
    priority: normalizeStaffTaskPriority(input.priority),
    reservation_id: input.reservationId ?? null,
    status,
    task_type: normalizeStaffTaskType(input.type),
    title: input.title.trim(),
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

export function mapSupabaseStaffAlertEvent(row: SupabaseStaffAlertEventRow): StaffAlertEvent {
  const recipients = normalizeAlertRecipients(row.recipients);
  const routeSnapshot = isObjectRecord(row.route_snapshot) ? row.route_snapshot : {};
  const smsRecipientCount = readNumber(routeSnapshot.smsRecipientCount) ?? countRecipientsByChannel(recipients, "sms");
  const emailRecipientCount =
    readNumber(routeSnapshot.emailRecipientCount) ?? countRecipientsByChannel(recipients, "email");

  return {
    callId: row.call_id ?? undefined,
    callerPhone: row.caller_phone ?? undefined,
    channels: normalizeStringArray(row.channels) ?? channelsForRecipients({ emailRecipientCount, smsRecipientCount }),
    createdAt: row.created_at ?? "",
    emailRecipientCount,
    errorMessage: row.error_message ?? undefined,
    fallbackUsed: readBoolean(routeSnapshot.fallbackUsed) ?? false,
    id: row.id,
    kind: normalizeAlertRouteKind(row.kind),
    message: row.message ?? "",
    recipients,
    sentAt: row.sent_at ?? undefined,
    severity: normalizeAlertSeverity(row.severity),
    smsRecipientCount,
    status: normalizeStaffAlertEventStatus(row.status),
    summary: row.summary ?? "",
  };
}

export function mapSupabaseStaffTask(row: SupabaseStaffTaskRow): StaffTask {
  return {
    assignedTo: row.assigned_to?.trim() || undefined,
    body: row.body?.trim() || undefined,
    callId: row.call_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at ?? "",
    dueAt: row.due_at ?? undefined,
    id: row.id,
    orderId: row.order_id ?? undefined,
    priority: normalizeStaffTaskPriority(row.priority),
    reservationId: row.reservation_id ?? undefined,
    status: normalizeStaffTaskStatus(row.status),
    title: row.title?.trim() || "Staff follow-up",
    type: normalizeStaffTaskType(row.task_type),
  };
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
  deliveryAttempts: SupabaseOrderDeliveryAttemptRow[] = [],
): Order[] {
  const itemsByOrderId = new Map<string, SupabaseOrderItemRow[]>();
  const deliveryAttemptsByOrderId = new Map<string, SupabaseOrderDeliveryAttemptRow[]>();

  for (const item of orderItems) {
    const currentItems = itemsByOrderId.get(item.order_id) ?? [];
    currentItems.push(item);
    itemsByOrderId.set(item.order_id, currentItems);
  }

  for (const attempt of deliveryAttempts) {
    const currentAttempts = deliveryAttemptsByOrderId.get(attempt.order_id) ?? [];
    currentAttempts.push(attempt);
    deliveryAttemptsByOrderId.set(attempt.order_id, currentAttempts);
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
      deliveryAttempts: (deliveryAttemptsByOrderId.get(order.id) ?? []).map((attempt) => ({
        createdAt: attempt.created_at ?? undefined,
        deliveredAt: attempt.delivered_at ?? undefined,
        destination: attempt.destination ?? "staff_review",
        errorMessage: attempt.error_message ?? undefined,
        id: attempt.id,
        status: normalizeEnum(attempt.status, orderDeliveryStatuses, "pending"),
      })),
      destination: order.destination ?? "staff_review",
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

function normalizeAlertRecipients(value: unknown): AlertRecipient[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isObjectRecord)
    .map((recipient) => ({
      channel: recipient.channel === "email" || recipient.channel === "both" ? recipient.channel : "sms",
      email: typeof recipient.email === "string" ? recipient.email : "",
      id: typeof recipient.id === "string" ? recipient.id : "recipient",
      name: typeof recipient.name === "string" ? recipient.name : "",
      phone: typeof recipient.phone === "string" ? recipient.phone : "",
    }));
}

function normalizeAlertRouteKind(value: string | null | undefined): AlertRouteKind {
  if (
    value === "complaint" ||
    value === "delivery_failure" ||
    value === "handoff" ||
    value === "low_confidence" ||
    value === "order" ||
    value === "reservation" ||
    value === "sales"
  ) {
    return value;
  }

  return "handoff";
}

function normalizeAlertSeverity(value: string | null | undefined): AlertSeverity {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function countRecipientsByChannel(recipients: AlertRecipient[], channel: "email" | "sms") {
  return recipients.filter((recipient) =>
    channel === "sms"
      ? Boolean(recipient.phone && (recipient.channel === "sms" || recipient.channel === "both"))
      : Boolean(recipient.email && (recipient.channel === "email" || recipient.channel === "both")),
  ).length;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeStringArrayWithFallback<T extends string>(value: unknown, fallback: T[]): T[] {
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter((item): item is T => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings : fallback;
}

function normalizeStringField<T extends string>(value: string | null | undefined, fallback: T): T {
  return value?.trim() ? (value.trim() as T) : fallback;
}

function normalizeForwardingVerification(value: unknown): ForwardingVerification {
  if (!isObjectRecord(value)) return {};

  return {
    busyForwarding: normalizeForwardingTestStatus(value.busyForwarding),
    directCall: normalizeForwardingTestStatus(value.directCall),
    noAnswerForwarding: normalizeForwardingTestStatus(value.noAnswerForwarding),
    notes: typeof value.notes === "string" ? value.notes : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

function normalizeForwardingTestStatus(value: unknown): ForwardingTestStatus | undefined {
  if (value === "pending" || value === "passed" || value === "failed" || value === "not_applicable") {
    return value;
  }

  return undefined;
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

function mapSupabaseTeamMember(row: SupabaseTeamMemberRow): TeamMember {
  const email = row.member_email?.trim() || `${row.user_id?.slice(0, 8) ?? "member"}@membership.local`;
  return {
    email,
    id: row.id,
    lastActive: row.created_at ? `Added ${formatShortDate(row.created_at)}` : "Active",
    name: row.member_name?.trim() || email.split("@")[0],
    role: normalizeTeamRole(row.role),
  };
}

function mapSupabaseTeamInvitation(row: SupabaseTeamInvitationRow): TeamInvitation {
  return {
    createdAt: row.created_at ?? new Date(0).toISOString(),
    email: normalizeInviteEmail(row.email),
    expiresAt: row.expires_at ?? new Date(0).toISOString(),
    id: row.id,
    invitedBy: row.invited_by ?? undefined,
    role: normalizeTeamRole(row.role),
    status: normalizeInviteStatus(row.status),
  };
}

function normalizeInviteStatus(status: string | null): TeamInviteStatus {
  if (status === "accepted" || status === "revoked" || status === "expired") return status;
  return "pending";
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "recently";
  }
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
      Authorization: `Bearer ${getSupabaseAccessToken() ?? supabasePublishableKey}`,
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

const staffAlertEventSelectColumns =
  "id,call_id,kind,severity,status,summary,message,caller_phone,recipients,channels,route_snapshot,error_message,sent_at,created_at";

const staffTaskSelectColumns =
  "id,call_id,order_id,reservation_id,title,body,status,task_type,priority,assigned_to,due_at,completed_at,created_at";
