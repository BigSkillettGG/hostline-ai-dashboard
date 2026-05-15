import {
  calculateOnboardingProgress,
  createOnboardingDraftForBusiness,
  type OnboardingDraft,
} from "../../../src/domain/onboarding";
import {
  getBusinessTemplate,
  normalizeBusinessType,
  type BusinessType,
} from "../../../src/domain/business-templates";
import { HttpRequestError } from "./http-safety";
import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

interface SupabaseAuthUser {
  email?: string;
  id?: string;
  user_metadata?: Record<string, unknown>;
}

interface SupabaseOrganizationRow {
  id: string;
  name: string;
}

interface SupabaseMembershipRow {
  created_at?: string | null;
  id?: string;
  organization_id?: string | null;
  role?: string | null;
}

interface SupabaseLocationRow {
  id: string;
  name?: string | null;
  organization_id?: string | null;
}

interface SupabaseOnboardingProfileRow {
  completed_required?: number | null;
  location_id?: string | null;
  progress_percent?: number | null;
  status?: string | null;
  total_required?: number | null;
  updated_at?: string | null;
}

interface SupabaseAgentConfigRow {
  id?: string;
  location_id?: string | null;
}

export interface TenantBootstrapInput {
  businessName?: string;
  businessType?: string;
  draft?: unknown;
  ownerName?: string;
}

export interface TenantBootstrapResult {
  businessType: BusinessType;
  createdLocation: boolean;
  createdOrganization: boolean;
  locationId: string;
  membership: {
    createdAt?: string;
    id?: string;
    organizationId: string;
    role: "owner";
  };
  onboarding: {
    completedRequired: number;
    progressPercent: number;
    status: string;
    totalRequired: number;
  };
  organizationId: string;
}

export interface TenantProvisioningService {
  bootstrap(input: TenantBootstrapInput, authorizationHeader: string | string[] | undefined): Promise<TenantBootstrapResult>;
  configured: boolean;
}

export function createTenantProvisioningService(env: VoiceServiceEnv): TenantProvisioningService {
  return new SupabaseTenantProvisioningService(env);
}

class SupabaseTenantProvisioningService implements TenantProvisioningService {
  readonly configured: boolean;
  private readonly authApiKey: string;
  private readonly env: VoiceServiceEnv;
  private readonly restUrl: string;

  constructor(env: VoiceServiceEnv) {
    this.env = env;
    this.authApiKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_SECRET_KEY || "";
    this.configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && this.authApiKey);
    this.restUrl = `${env.SUPABASE_URL?.replace(/\/$/, "") ?? ""}/rest/v1`;
  }

  async bootstrap(
    input: TenantBootstrapInput,
    authorizationHeader: string | string[] | undefined,
  ): Promise<TenantBootstrapResult> {
    if (!this.configured) {
      throw new HttpRequestError(503, "Supabase tenant provisioning is not configured.");
    }

    const token = getBearerToken(authorizationHeader);
    if (!token) {
      throw new HttpRequestError(401, "Missing Supabase bearer token.");
    }

    const user = await this.fetchUser(token);
    if (!user.id) {
      throw new HttpRequestError(401, "Invalid Supabase bearer token.");
    }

    const draftInput = isObjectRecord(input.draft) ? input.draft : {};
    const businessType = normalizeBusinessType(input.businessType ?? draftInput.businessType);
    const template = getBusinessTemplate(businessType);
    const businessName = stringValue(input.businessName) ?? stringValue(draftInput.restaurantName) ?? template.defaultName;
    const draft = buildProvisionedDraft({
      businessName,
      businessType,
      draftInput,
      templateDefaultName: template.defaultName,
    });

    let createdOrganization = false;
    let createdLocation = false;
    let organizationId = "";
    let membership = await this.fetchFirstMembership(user.id);

    if (membership?.organization_id) {
      organizationId = membership.organization_id;
    } else {
      const organization = await this.createOrganization(businessName);
      organizationId = organization.id;
      createdOrganization = true;
      membership = await this.createOwnerMembership({
        email: user.email,
        name: stringValue(input.ownerName) ?? stringValue(user.user_metadata?.name),
        organizationId,
        userId: user.id,
      });
    }

    let location = await this.fetchFirstLocation(organizationId);
    if (!location?.id) {
      location = await this.createLocation({ businessName, businessType, draft, organizationId });
      createdLocation = true;
    } else {
      await this.patchLocation(location.id, { businessName, businessType, draft });
    }

    const onboarding = await this.upsertOnboardingProfile(draft, location.id);
    await this.upsertAgentConfig(draft, location.id, businessType);
    await this.upsertOwnerBusinessContact({ draft, locationId: location.id, user }).catch((error) => {
      console.warn("[tenant-provisioning] owner trusted contact was not saved", error);
    });

    return {
      businessType,
      createdLocation,
      createdOrganization,
      locationId: location.id,
      membership: {
        createdAt: membership?.created_at ?? undefined,
        id: membership?.id,
        organizationId,
        role: "owner" as const,
      },
      onboarding: {
        completedRequired: onboarding.completed_required ?? 0,
        progressPercent: onboarding.progress_percent ?? 0,
        status: onboarding.status ?? "in_progress",
        totalRequired: onboarding.total_required ?? 0,
      },
      organizationId,
    };
  }

  private async fetchUser(token: string) {
    const response = await fetch(`${this.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: this.authApiKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new HttpRequestError(401, "Invalid Supabase bearer token.");
    }

    return (await response.json()) as SupabaseAuthUser;
  }

  private async fetchFirstMembership(userId: string) {
    const rows = await this.request<SupabaseMembershipRow[]>("user_memberships", {
      method: "GET",
      query: new URLSearchParams({
        limit: "1",
        order: "created_at.asc",
        select: "id,organization_id,role,created_at",
        user_id: `eq.${userId}`,
      }),
    });

    return rows.find((row) => row.organization_id && row.role === "owner") ?? rows[0] ?? null;
  }

  private async fetchFirstLocation(organizationId: string) {
    const rows = await this.request<SupabaseLocationRow[]>("locations", {
      method: "GET",
      query: new URLSearchParams({
        limit: "1",
        order: "created_at.asc",
        organization_id: `eq.${organizationId}`,
        select: "id,organization_id,name",
      }),
    });

    return rows[0] ?? null;
  }

  private async createOrganization(name: string) {
    const rows = await this.request<SupabaseOrganizationRow[]>("organizations", {
      body: { name },
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: new URLSearchParams({ select: "id,name" }),
    });
    const organization = rows[0];
    if (!organization?.id) throw new Error("Supabase did not return the created organization.");
    return organization;
  }

  private async createOwnerMembership(input: {
    email?: string;
    name?: string;
    organizationId: string;
    userId: string;
  }) {
    const rows = await this.request<SupabaseMembershipRow[]>("user_memberships", {
      body: {
        member_email: input.email ?? null,
        member_name: input.name ?? null,
        organization_id: input.organizationId,
        role: "owner",
        user_id: input.userId,
      },
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: new URLSearchParams({ select: "id,organization_id,role,created_at" }),
    });
    const membership = rows[0];
    if (!membership?.organization_id) throw new Error("Supabase did not return the created membership.");
    return membership;
  }

  private async createLocation(input: {
    businessName: string;
    businessType: BusinessType;
    draft: OnboardingDraft;
    organizationId: string;
  }) {
    const rows = await this.request<SupabaseLocationRow[]>("locations", {
      body: buildLocationPayload(input),
      headers: { Prefer: "return=representation" },
      method: "POST",
      query: new URLSearchParams({ select: "id,organization_id,name" }),
    });
    const location = rows[0];
    if (!location?.id) throw new Error("Supabase did not return the created location.");
    return location;
  }

  private async patchLocation(locationId: string, input: {
    businessName: string;
    businessType: BusinessType;
    draft: OnboardingDraft;
  }) {
    await this.request("locations", {
      body: buildLocationPatchPayload(input),
      method: "PATCH",
      query: new URLSearchParams({ id: `eq.${locationId}` }),
    });
  }

  private async upsertOnboardingProfile(draft: OnboardingDraft, locationId: string) {
    const progress = calculateOnboardingProgress(draft);
    const rows = await this.request<SupabaseOnboardingProfileRow[]>("onboarding_profiles", {
      body: {
        completed_required: progress.completedRequired,
        draft,
        location_id: locationId,
        progress_percent: progress.percent,
        status: progress.percent === 100 ? "ready_for_test_call" : "in_progress",
        total_required: progress.totalRequired,
        updated_at: new Date().toISOString(),
      },
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      method: "POST",
      query: new URLSearchParams({
        on_conflict: "location_id",
        select: "location_id,progress_percent,completed_required,total_required,status,updated_at",
      }),
    });

    return rows[0] ?? {
      completed_required: progress.completedRequired,
      location_id: locationId,
      progress_percent: progress.percent,
      status: progress.percent === 100 ? "ready_for_test_call" : "in_progress",
      total_required: progress.totalRequired,
    };
  }

  private async upsertAgentConfig(draft: OnboardingDraft, locationId: string, businessType: BusinessType) {
    await this.request<SupabaseAgentConfigRow[]>("agent_configs", {
      body: buildAgentConfigPayload({ businessType, draft, locationId }),
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      method: "POST",
      query: new URLSearchParams({
        on_conflict: "location_id",
        select: "id,location_id",
      }),
    });
  }

  private async upsertOwnerBusinessContact(input: {
    draft: OnboardingDraft;
    locationId: string;
    user: SupabaseAuthUser;
  }) {
    const draftRecord = input.draft as Record<string, unknown>;
    const email = stringValue(draftRecord.ownerEmail) ?? input.user.email ?? null;
    const phone = stringValue(draftRecord.ownerPhone) ?? null;
    if (!email && !phone) return;

    const existing = await this.request<Array<{ id: string }>>("business_contacts", {
      method: "GET",
      query: new URLSearchParams({
        contact_type: "eq.owner",
        limit: "1",
        location_id: `eq.${input.locationId}`,
        select: "id",
      }),
    });
    const payload = {
      can_add_live_updates: true,
      can_approve_permanent_knowledge: true,
      can_manage_alert_preferences: true,
      can_receive_alerts: true,
      can_resolve_customer_requests: true,
      can_use_owner_assistant: true,
      contact_type: "owner",
      email,
      location_id: input.locationId,
      name: stringValue(draftRecord.ownerName) ?? stringValue(input.user.user_metadata?.name) ?? "Owner",
      phone,
      preferred_channel: phone && email ? "both" : phone ? "sms" : "email",
      requires_owner_approval: false,
      trusted_identity_enabled: true,
      updated_at: new Date().toISOString(),
    };

    if (existing[0]?.id) {
      await this.request("business_contacts", {
        body: payload,
        method: "PATCH",
        query: new URLSearchParams({ id: `eq.${existing[0].id}` }),
      });
      return;
    }

    await this.request("business_contacts", {
      body: payload,
      method: "POST",
      query: new URLSearchParams(),
    });
  }

  private async request<T>(
    table: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      method: "GET" | "PATCH" | "POST";
      query?: URLSearchParams;
    },
  ): Promise<T> {
    const query = options.query?.toString();
    const response = await fetch(`${this.restUrl}/${table}${query ? `?${query}` : ""}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: buildSupabaseServiceHeaders(this.env.SUPABASE_SECRET_KEY ?? "", options.headers),
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

function buildProvisionedDraft({
  businessName,
  businessType,
  draftInput,
  templateDefaultName,
}: {
  businessName: string;
  businessType: BusinessType;
  draftInput: Record<string, unknown>;
  templateDefaultName: string;
}): OnboardingDraft {
  return {
    ...createOnboardingDraftForBusiness(businessType, normalizeDraft(draftInput)),
    businessType,
    restaurantName: businessName || templateDefaultName,
  };
}

function buildLocationPayload(input: {
  businessName: string;
  businessType: BusinessType;
  draft: OnboardingDraft;
  organizationId: string;
}) {
  return {
    ...buildLocationPatchPayload(input),
    organization_id: input.organizationId,
  };
}

function buildLocationPatchPayload(input: {
  businessName: string;
  businessType: BusinessType;
  draft: OnboardingDraft;
}) {
  return {
    address: stringValue(input.draft.primaryLocation) ?? null,
    cuisine: input.businessType === "restaurant" ? stringValue(input.draft.concept) ?? null : getBusinessTemplate(input.businessType).label,
    name: input.businessName,
    phone: stringValue(input.draft.mainPhone) ?? null,
    timezone: stringValue(input.draft.timezone) ?? "America/New_York",
  };
}

function buildAgentConfigPayload({
  businessType,
  draft,
  locationId,
}: {
  businessType: BusinessType;
  draft: OnboardingDraft;
  locationId: string;
}) {
  const isRestaurant = businessType === "restaurant";
  const businessName = stringValue(draft.restaurantName) ?? getBusinessTemplate(businessType).defaultName;
  const greeting = `Thank you for calling ${businessName}. How can I help you?`;
  const reservationMode = normalizeReservationMode(draft.reservationHandlingMode);
  const orderMode = normalizeOrderMode(draft.orderHandlingMode);

  return {
    after_hours_behavior: "answer_faqs",
    answer_after_rings: 3,
    answer_faqs_enabled: true,
    call_handling_mode: "answer_after_rings",
    disclosure_enabled: false,
    escalation_phone_number: stringValue(draft.escalationPhone) ?? null,
    greeting_template: greeting,
    host_name: stringValue(draft.hostName) ?? "Ava",
    location_id: locationId,
    order_destinations: ["staff_review"],
    orders_enabled: booleanValue(draft.takeOrders) ?? Boolean(orderMode !== "disabled"),
    payment_mode: isRestaurant ? "pay_at_pickup" : "invoice_or_staff_confirmed",
    reservations_enabled: booleanValue(draft.takeReservations) ?? Boolean(reservationMode !== "disabled"),
    reservation_mode: reservationMode,
    reservation_provider: normalizeProvider(draft.reservationProvider),
    sms_confirmations_enabled: booleanValue(draft.smsConfirmations) ?? true,
    staff_escalation_enabled: true,
    tone: normalizeTone(draft.tone),
    updated_at: new Date().toISOString(),
  };
}

function normalizeDraft(value: Record<string, unknown>): OnboardingDraft {
  const draft: OnboardingDraft = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "boolean") draft[key] = entry;
  }
  return draft;
}

function normalizeReservationMode(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("disabled") || normalized.includes("do not")) return "disabled";
  if (normalized.includes("link") || normalized.includes("send")) return "booking_link";
  if (normalized.includes("integration") || normalized.includes("book through")) return "integration";
  return "manual_request";
}

function normalizeOrderMode(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("disabled") || normalized.includes("do not")) return "disabled";
  if (normalized.includes("link") && !normalized.includes("capture")) return "online_link";
  if (normalized.includes("link")) return "staff_review_and_link";
  return "staff_review";
}

function normalizeProvider(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("open")) return "opentable";
  if (normalized.includes("resy")) return "resy";
  if (normalized.includes("tock")) return "tock";
  if (normalized.includes("seven")) return "sevenrooms";
  if (normalized.includes("yelp")) return "yelp_guest_manager";
  return "none";
}

function normalizeTone(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("professional")) return "professional";
  if (normalized.includes("playful")) return "playful";
  return "warm";
}

function getBearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
