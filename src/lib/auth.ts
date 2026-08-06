import { useEffect, useState } from "react";
import {
  canManageRestaurantSettings,
  canManageRestaurantTeam,
  compareRestaurantRoles,
  getRestaurantRoleLabel,
  isRestaurantMembershipRole,
  type RestaurantMembershipRole,
  type UserRole,
} from "@/domain/access-control";
import {
  comparePartnerRoles,
  getPartnerRoleLabel,
  isPartnerRole,
  type PartnerRole,
} from "@/domain/commercial-hierarchy";
import { getVerticalDemoProfile, type VerticalDemoProfile } from "@/domain/demo-verticals";
import { createOnboardingDraftForBusiness } from "@/domain/onboarding";
import { saveOnboardingDraft } from "@/lib/onboarding-draft";

export type { RestaurantMembershipRole, UserRole } from "@/domain/access-control";
export type { PartnerRole } from "@/domain/commercial-hierarchy";

export type AuthMode = "demo" | "supabase";
export type WorkspaceKind = "demo" | "partner" | "restaurant" | "platform";

export interface RestaurantMembership {
  createdAt?: string;
  id?: string;
  organizationId: string;
  role: RestaurantMembershipRole;
}

export interface PartnerMembership {
  createdAt?: string;
  id?: string;
  partnerId: string;
  role: PartnerRole;
}

export interface CurrentUser {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  activeDepartmentId?: string;
  activeLocationId?: string;
  activeOrganizationId?: string;
  activePartnerId?: string;
  authProvider: AuthMode;
  email: string;
  isPlatformAdmin?: boolean;
  memberships?: RestaurantMembership[];
  name: string;
  refreshToken?: string;
  partnerMembershipRole?: PartnerRole;
  partnerMemberships?: PartnerMembership[];
  restaurantId?: string;
  restaurantMembershipRole?: RestaurantMembershipRole;
  role: UserRole;
  supabaseUserId?: string;
  workspaceKind?: WorkspaceKind;
}

export interface AuthRuntimeConfig {
  mode: AuthMode;
  supabasePublishableKey: string;
  supabaseUrl: string;
}

export interface AuthReadiness {
  badge: string;
  detail: string;
  mode: AuthMode;
  ready: boolean;
}

interface SupabaseAuthUser {
  app_metadata?: Record<string, unknown>;
  email?: string;
  id?: string;
  user_metadata?: Record<string, unknown>;
}

interface SupabaseAuthResponse {
  access_token?: string;
  expires_at?: number;
  expires_in?: number;
  refresh_token?: string;
  user?: SupabaseAuthUser;
}

interface SupabaseMembershipRow {
  created_at?: string | null;
  id?: string;
  organization_id?: string;
  role?: string;
}

interface SupabasePartnerMembershipRow {
  created_at?: string | null;
  id?: string;
  partner_id?: string;
  role?: string;
}

interface SupabaseOrganizationAccessRow {
  channel_partner_id?: string | null;
  id?: string;
}

interface SupabaseLocationRow {
  id?: string;
  organization_id?: string | null;
}

const STORAGE_KEY = "signalhost.currentUser";
const EVENT = "signalhost.auth.changed";
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export function getAuthRuntimeConfig(): AuthRuntimeConfig {
  return {
    mode: normalizeAuthMode(import.meta.env.VITE_AUTH_MODE),
    supabasePublishableKey,
    supabaseUrl,
  };
}

export function getAuthReadiness(config = getAuthRuntimeConfig()): AuthReadiness {
  if (config.mode === "demo") {
    return {
      badge: "Demo auth",
      detail: "Local demo auth is active. Use VITE_AUTH_MODE=supabase before production.",
      mode: "demo",
      ready: false,
    };
  }

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    return {
      badge: "Auth not configured",
      detail: "Supabase Auth needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
      mode: "supabase",
      ready: false,
    };
  }

  return {
    badge: "Supabase Auth",
    detail: "Dashboard auth will use Supabase email/password sessions and RLS bearer tokens.",
    mode: "supabase",
    ready: true,
  };
}

export function isDemoAuthMode(config = getAuthRuntimeConfig()) {
  return config.mode === "demo";
}

export function getCurrentUser() {
  return readUser();
}

export function getActiveOrganizationId() {
  return readUser()?.activeOrganizationId;
}

export function getActiveDepartmentId() {
  return readUser()?.activeDepartmentId;
}

export function getActivePartnerId() {
  return readUser()?.activePartnerId;
}

export function getActiveLocationId() {
  return readUser()?.activeLocationId;
}

export function getSupabaseAccessToken() {
  const user = readUser();
  return user?.authProvider === "supabase" ? user.accessToken : undefined;
}

// Refresh the access token this many seconds before it actually expires, so an
// in-flight request never goes out with a token that lapses mid-request.
const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 60;

// Module-level in-flight refresh promise. Concurrent callers share one network
// round-trip instead of each firing their own refresh (which would race and
// invalidate each other's refresh tokens).
let inFlightRefresh: Promise<string | undefined> | null = null;

/**
 * Returns a Supabase access token that is valid right now, proactively
 * refreshing it if it is missing, expired, or within the refresh buffer of
 * expiring. Falls back to the current token if the session is not a Supabase
 * session or cannot be refreshed. Callers in the data layer should use this
 * instead of the synchronous getSupabaseAccessToken() when about to make a
 * request.
 */
export async function getValidSupabaseAccessToken(): Promise<string | undefined> {
  const user = readUser();
  if (user?.authProvider !== "supabase") return undefined;
  if (!user.accessToken) return undefined;

  if (!isAccessTokenExpiring(user)) {
    return user.accessToken;
  }

  const refreshed = await refreshSupabaseSession();
  return refreshed ?? undefined;
}

/**
 * Forces a refresh of the Supabase session using the stored refresh token.
 * Deduplicates concurrent calls. On success, updates the stored user and
 * returns the new access token. On failure, signs the user out and returns
 * undefined so callers can surface a re-authentication prompt.
 */
export async function refreshSupabaseSession(): Promise<string | undefined> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const user = readUser();
    const config = getAuthRuntimeConfig();

    if (
      user?.authProvider !== "supabase" ||
      !user.refreshToken ||
      !config.supabaseUrl ||
      !config.supabasePublishableKey
    ) {
      return undefined;
    }

    try {
      const data = await supabaseAuthRequest<SupabaseAuthResponse>(
        "token?grant_type=refresh_token",
        { refresh_token: user.refreshToken },
        config,
      );

      if (!data.access_token) {
        throw new Error("Supabase refresh did not return an access token.");
      }

      const next: CurrentUser = normalizeStoredUser({
        ...user,
        accessToken: data.access_token,
        accessTokenExpiresAt: resolveAccessTokenExpiry(data),
        refreshToken: data.refresh_token ?? user.refreshToken,
      });
      writeUser(next);
      return next.accessToken;
    } catch (error) {
      // A failed refresh means the session is no longer valid. Sign out so the
      // user is routed back to login rather than left in a broken state where
      // every request 401s silently.
      console.error("[auth] Supabase session refresh failed", error);
      signOut();
      return undefined;
    }
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

function isAccessTokenExpiring(user: CurrentUser): boolean {
  const expiresAt = user.accessTokenExpiresAt ?? decodeJwtExpiry(user.accessToken);
  // If we genuinely cannot determine expiry, treat the token as still valid so
  // we do not refresh on every single request. A reactive 401 retry in the data
  // layer is the safety net for this case.
  if (!expiresAt) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_SECONDS;
}

function resolveAccessTokenExpiry(data: SupabaseAuthResponse): number | undefined {
  if (typeof data.expires_at === "number" && Number.isFinite(data.expires_at)) {
    return data.expires_at;
  }
  if (typeof data.expires_in === "number" && Number.isFinite(data.expires_in)) {
    return Math.floor(Date.now() / 1000) + data.expires_in;
  }
  return decodeJwtExpiry(data.access_token);
}

function decodeJwtExpiry(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const segments = token.split(".");
  if (segments.length < 2) return undefined;
  try {
    const payloadSegment = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadSegment.padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");
    const json = typeof atob === "function" ? atob(padded) : "";
    if (!json) return undefined;
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

export function isDemoWorkspace(user: CurrentUser | null | undefined) {
  return user?.authProvider === "demo" || user?.workspaceKind === "demo";
}

export function isPlatformAdminUser(user: CurrentUser | null | undefined) {
  return Boolean(user?.role === "superadmin" || user?.isPlatformAdmin);
}

export function canUserAccessRole(user: CurrentUser | null | undefined, role: UserRole) {
  if (!user) return false;
  if (user.role === role) return true;
  return role === "admin" && isPlatformAdminUser(user);
}

export function canCurrentUserManageTeam(user: CurrentUser | null | undefined) {
  return Boolean(user && user.role === "admin" && canManageRestaurantTeam(user.restaurantMembershipRole));
}

export function canCurrentUserManageSettings(user: CurrentUser | null | undefined) {
  return Boolean(user && user.role === "admin" && canManageRestaurantSettings(user.restaurantMembershipRole));
}

export { getPartnerRoleLabel, getRestaurantRoleLabel };

export async function signIn(email: string, password: string): Promise<CurrentUser> {
  const config = getAuthRuntimeConfig();
  const user = config.mode === "supabase"
    ? await signInWithSupabase(email, password, config)
    : buildDemoUser(email);
  writeUser(user);
  return user;
}

export async function signUp(input: {
  email: string;
  name?: string;
  password: string;
  restaurant?: string;
}): Promise<CurrentUser> {
  const config = getAuthRuntimeConfig();
  const user = config.mode === "supabase"
    ? await signUpWithSupabase(input, config)
    : buildDemoUser(input.email, input.name);
  writeUser(user);
  return user;
}

export function startDemoSession(role: UserRole = "admin", demoProfileValue?: string) {
  const profile = getVerticalDemoProfile(demoProfileValue);
  const user = role === "superadmin" ? buildDemoSuperAdmin() : buildDemoUser(profile.accountEmail, profile.ownerName, profile);
  if (role !== "superadmin") {
    saveOnboardingDraft(createOnboardingDraftForBusiness(profile.businessType, {
      assignedSignalHostNumber: profile.aiNumber,
      escalationPhone: profile.ownerPhone,
      mainPhone: profile.mainPhone,
      ownerEmail: profile.ownerEmail,
      ownerName: profile.ownerName,
      ownerPhone: profile.ownerPhone,
      restaurantName: profile.businessName,
      timezone: profile.timezone,
      voiceProfileId: profile.voiceProfileId,
    }));
  }
  writeUser(user);
  return user;
}

export function signOut() {
  writeUser(null);
}

export function updateCurrentUserAccess(input: {
  activeDepartmentId?: string | null;
  activeLocationId?: string;
  activeOrganizationId?: string;
  activePartnerId?: string;
  memberships?: RestaurantMembership[];
  partnerMemberships?: PartnerMembership[];
}) {
  const current = readUser();
  if (!current) return null;

  const next = applyAccessModel({
    ...current,
    activeDepartmentId:
      input.activeDepartmentId === null
        ? undefined
        : input.activeDepartmentId ?? current.activeDepartmentId,
    activeLocationId: input.activeLocationId ?? current.activeLocationId,
    activeOrganizationId: input.activeOrganizationId ?? current.activeOrganizationId,
    activePartnerId: input.activePartnerId ?? current.activePartnerId,
    memberships: input.memberships ?? current.memberships,
    partnerMemberships: input.partnerMemberships ?? current.partnerMemberships,
    restaurantId: input.activeOrganizationId ?? current.restaurantId,
  });
  writeUser(next);
  return next;
}

export function setRole(role: UserRole) {
  if (!isDemoAuthMode()) return;
  writeUser(role === "superadmin" ? buildDemoSuperAdmin() : buildDemoUser("demo.restaurant@signalhost.ai", "Maria Lombardi", getVerticalDemoProfile("restaurant")));
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(() => readUser());
  useEffect(() => {
    const handler = () => setUser(readUser());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return user;
}

export function buildDemoUser(email: string, name?: string, profileValue?: string | VerticalDemoProfile): CurrentUser {
  if (isSignalHostStaffEmail(email)) return buildDemoSuperAdmin(email, name);
  const profile = typeof profileValue === "object" ? profileValue : getVerticalDemoProfile(profileValue);

  const memberships: RestaurantMembership[] = [
    {
      createdAt: new Date(0).toISOString(),
      id: `demo-membership-${profile.demoSiteSlug}`,
      organizationId: profile.organizationId,
      role: "owner",
    },
  ];

  return applyAccessModel({
    activeLocationId: profile.locationId,
    activeOrganizationId: profile.organizationId,
    authProvider: "demo",
    email,
    memberships,
    name: name?.trim() || defaultNameFor(email, "admin"),
    restaurantId: profile.demoSiteSlug,
    role: "admin",
    workspaceKind: "demo",
  });
}

export function buildDemoSuperAdmin(email = "staff@signalhost.ai", name = "SignalHost Staff"): CurrentUser {
  return applyAccessModel({
    authProvider: "demo",
    email,
    isPlatformAdmin: true,
    memberships: [],
    name,
    role: "superadmin",
    workspaceKind: "platform",
  });
}

export function mapSupabaseAuthResponse(
  data: SupabaseAuthResponse,
  access: {
    activeLocationId?: string;
    activeOrganizationId?: string;
    activePartnerId?: string;
    isPlatformAdmin?: boolean;
    memberships?: RestaurantMembership[];
    partnerMemberships?: PartnerMembership[];
  } = {},
): CurrentUser {
  if (!data.access_token || !data.user?.email || !data.user.id) {
    throw new Error("Supabase Auth did not return an active session. Confirm the email address before signing in.");
  }

  const memberships = sortMemberships(access.memberships ?? []);
  const partnerMemberships = sortPartnerMemberships(access.partnerMemberships ?? []);
  const role = roleFromEmailAndMetadata(data.user.email, data.user.app_metadata, data.user.user_metadata, {
    isPlatformAdmin: access.isPlatformAdmin,
    memberships,
    partnerMemberships,
  });
  const name =
    stringMetadataValue(data.user.user_metadata, "name") ??
    stringMetadataValue(data.user.user_metadata, "full_name") ??
    defaultNameFor(data.user.email, role);

  return applyAccessModel({
    accessToken: data.access_token,
    accessTokenExpiresAt: resolveAccessTokenExpiry(data),
    activeLocationId:
      access.activeLocationId ??
      stringMetadataValue(data.user.app_metadata, "location_id") ??
      stringMetadataValue(data.user.user_metadata, "location_id"),
    activeOrganizationId: access.activeOrganizationId,
    activePartnerId: access.activePartnerId,
    authProvider: "supabase",
    email: data.user.email,
    isPlatformAdmin: Boolean(access.isPlatformAdmin),
    memberships,
    name,
    refreshToken: data.refresh_token,
    partnerMemberships,
    restaurantId: stringMetadataValue(data.user.app_metadata, "restaurant_id") ?? memberships[0]?.organizationId,
    role,
    supabaseUserId: data.user.id,
  });
}

export function roleFromEmailAndMetadata(
  email: string,
  appMetadata: Record<string, unknown> = {},
  userMetadata: Record<string, unknown> = {},
  access: {
    inferSignalHostEmail?: boolean;
    isPlatformAdmin?: boolean;
    memberships?: RestaurantMembership[];
    partnerMemberships?: PartnerMembership[];
  } = {},
): UserRole {
  const role = stringMetadataValue(appMetadata, "role") ?? stringMetadataValue(userMetadata, "role");
  const platformFlag = booleanMetadataValue(appMetadata, "platform_admin") ?? booleanMetadataValue(appMetadata, "is_platform_admin");

  if (access.isPlatformAdmin || platformFlag || role === "superadmin") return "superadmin";
  if (access.memberships?.length || access.partnerMemberships?.length || role === "admin") return "admin";
  return access.inferSignalHostEmail && isSignalHostStaffEmail(email) ? "superadmin" : "admin";
}

function readUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const user = raw ? (JSON.parse(raw) as CurrentUser) : null;
    return user?.email ? normalizeStoredUser(user) : null;
  } catch {
    return null;
  }
}

function writeUser(user: CurrentUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStoredUser(user)));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

async function signInWithSupabase(email: string, password: string, config: AuthRuntimeConfig) {
  const response = await supabaseAuthRequest<SupabaseAuthResponse>(
    "token?grant_type=password",
    { email, password },
    config,
  );
  return hydrateSupabaseUser(response, config);
}

async function signUpWithSupabase(
  input: { email: string; name?: string; password: string; restaurant?: string },
  config: AuthRuntimeConfig,
) {
  const response = await supabaseAuthRequest<SupabaseAuthResponse>(
    "signup",
    {
      data: {
        name: input.name?.trim() || undefined,
        restaurant: input.restaurant?.trim() || undefined,
      },
      email: input.email,
      password: input.password,
    },
    config,
  );
  return hydrateSupabaseUser(response, config);
}

async function hydrateSupabaseUser(data: SupabaseAuthResponse, config: AuthRuntimeConfig) {
  const base = mapSupabaseAuthResponse(data);
  const [memberships, partnerMemberships, isPlatformAdmin] = await Promise.all([
    fetchSupabaseMemberships(base, config),
    fetchSupabasePartnerMemberships(base, config),
    fetchSupabasePlatformAdmin(base, config),
  ]);
  const membershipOrganizationId = memberships[0]?.organizationId;
  const partnerOrganization = !membershipOrganizationId && partnerMemberships[0]?.partnerId
    ? await fetchSupabasePrimaryPartnerOrganization(base, config, partnerMemberships[0].partnerId)
    : undefined;
  const activeOrganizationId = membershipOrganizationId ?? partnerOrganization?.id;
  const organizationScope = activeOrganizationId
    ? partnerOrganization ?? await fetchSupabaseOrganizationScope(base, config, activeOrganizationId)
    : undefined;
  const activePartnerId = organizationScope?.channel_partner_id ?? partnerMemberships[0]?.partnerId;
  const activeLocationId = activeOrganizationId
    ? await fetchSupabasePrimaryLocation(base, config, activeOrganizationId)
    : undefined;

  return mapSupabaseAuthResponse(data, {
    activeLocationId,
    activeOrganizationId,
    activePartnerId,
    isPlatformAdmin,
    memberships,
    partnerMemberships,
  });
}

async function fetchSupabaseMemberships(user: CurrentUser, config: AuthRuntimeConfig): Promise<RestaurantMembership[]> {
  if (!user.accessToken || !user.supabaseUserId) return [];

  const params = new URLSearchParams({
    order: "created_at.asc",
    select: "id,organization_id,role,created_at",
    user_id: `eq.${user.supabaseUserId}`,
  });
  const rows = await supabaseRestRequest<SupabaseMembershipRow[]>("user_memberships", params, user.accessToken, config);
  return sortMemberships(rows.map(mapSupabaseMembershipRow).filter(Boolean) as RestaurantMembership[]);
}

async function fetchSupabasePartnerMemberships(user: CurrentUser, config: AuthRuntimeConfig): Promise<PartnerMembership[]> {
  if (!user.accessToken || !user.supabaseUserId) return [];

  const params = new URLSearchParams({
    order: "created_at.asc",
    select: "id,partner_id,role,created_at",
    user_id: `eq.${user.supabaseUserId}`,
  });
  const rows = await supabaseRestRequest<SupabasePartnerMembershipRow[]>("partner_memberships", params, user.accessToken, config);
  return sortPartnerMemberships(rows.map(mapSupabasePartnerMembershipRow).filter(Boolean) as PartnerMembership[]);
}

async function fetchSupabasePlatformAdmin(user: CurrentUser, config: AuthRuntimeConfig) {
  if (!user.accessToken || !user.supabaseUserId) return false;

  const params = new URLSearchParams({
    limit: "1",
    select: "id",
    user_id: `eq.${user.supabaseUserId}`,
  });
  const rows = await supabaseRestRequest<Array<{ id?: string }>>("platform_admins", params, user.accessToken, config);
  return rows.length > 0;
}

async function fetchSupabasePrimaryPartnerOrganization(
  user: CurrentUser,
  config: AuthRuntimeConfig,
  partnerId: string,
) {
  if (!user.accessToken) return undefined;

  const params = new URLSearchParams({
    channel_partner_id: `eq.${partnerId}`,
    limit: "1",
    order: "created_at.asc",
    select: "id,channel_partner_id",
  });
  const rows = await supabaseRestRequest<SupabaseOrganizationAccessRow[]>("organizations", params, user.accessToken, config);
  return rows[0];
}

async function fetchSupabaseOrganizationScope(
  user: CurrentUser,
  config: AuthRuntimeConfig,
  organizationId: string,
) {
  if (!user.accessToken) return undefined;

  const params = new URLSearchParams({
    id: `eq.${organizationId}`,
    limit: "1",
    select: "id,channel_partner_id",
  });
  const rows = await supabaseRestRequest<SupabaseOrganizationAccessRow[]>("organizations", params, user.accessToken, config);
  return rows[0];
}

async function fetchSupabasePrimaryLocation(
  user: CurrentUser,
  config: AuthRuntimeConfig,
  organizationId: string,
) {
  if (!user.accessToken) return undefined;

  const params = new URLSearchParams({
    limit: "1",
    order: "created_at.asc",
    organization_id: `eq.${organizationId}`,
    select: "id,organization_id",
  });
  const rows = await supabaseRestRequest<SupabaseLocationRow[]>("locations", params, user.accessToken, config);
  return rows[0]?.id;
}

async function supabaseAuthRequest<T>(path: string, body: unknown, config: AuthRuntimeConfig): Promise<T> {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error("Supabase Auth is not configured.");
  }

  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Auth failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

async function supabaseRestRequest<T>(
  table: string,
  params: URLSearchParams,
  accessToken: string,
  config: AuthRuntimeConfig,
): Promise<T> {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error("Supabase Auth is not configured.");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "GET",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${table} request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

function normalizeStoredUser(user: CurrentUser): CurrentUser {
  const memberships = sortMemberships((user.memberships ?? []).map(normalizeMembership).filter(Boolean) as RestaurantMembership[]);
  const partnerMemberships = sortPartnerMemberships(
    (user.partnerMemberships ?? []).map(normalizePartnerMembership).filter(Boolean) as PartnerMembership[],
  );
  return applyAccessModel({
    ...user,
    authProvider: user.authProvider ?? "demo",
    isPlatformAdmin: Boolean(user.isPlatformAdmin || user.role === "superadmin"),
    memberships,
    partnerMemberships,
    role: user.role ?? "admin",
  });
}

function applyAccessModel(user: CurrentUser): CurrentUser {
  const memberships = sortMemberships((user.memberships ?? []).map(normalizeMembership).filter(Boolean) as RestaurantMembership[]);
  const partnerMemberships = sortPartnerMemberships(
    (user.partnerMemberships ?? []).map(normalizePartnerMembership).filter(Boolean) as PartnerMembership[],
  );
  const primaryMembership = memberships[0];
  const primaryPartnerMembership = partnerMemberships[0];
  const activeOrganizationId = user.activeOrganizationId ?? primaryMembership?.organizationId;
  const activePartnerId = user.activePartnerId ?? primaryPartnerMembership?.partnerId;
  const selectedMembership = activeOrganizationId
    ? memberships.find((membership) => membership.organizationId === activeOrganizationId)
    : primaryMembership;
  const selectedPartnerMembership = activePartnerId
    ? partnerMemberships.find((membership) => membership.partnerId === activePartnerId)
    : primaryPartnerMembership;
  const restaurantMembershipRole = selectedMembership?.role ?? (
    memberships.length === 0 && user.restaurantMembershipRole && isRestaurantMembershipRole(user.restaurantMembershipRole)
      ? user.restaurantMembershipRole
      : undefined
  );
  const partnerMembershipRole = selectedPartnerMembership?.role ?? (
    partnerMemberships.length === 0 && user.partnerMembershipRole && isPartnerRole(user.partnerMembershipRole)
      ? user.partnerMembershipRole
      : undefined
  );
  const role: UserRole = user.isPlatformAdmin || user.role === "superadmin" ? "superadmin" : "admin";
  const workspaceKind = resolveWorkspaceKind(user.authProvider, role, partnerMemberships);

  return {
    ...user,
    activeDepartmentId: user.activeDepartmentId,
    activeOrganizationId,
    activeLocationId: user.activeLocationId,
    activePartnerId,
    isPlatformAdmin: Boolean(user.isPlatformAdmin || role === "superadmin"),
    memberships,
    partnerMembershipRole,
    partnerMemberships,
    restaurantId: activeOrganizationId ?? user.restaurantId,
    restaurantMembershipRole,
    role,
    workspaceKind,
  };
}

function mapSupabaseMembershipRow(row: SupabaseMembershipRow): RestaurantMembership | null {
  if (!row.organization_id || !isRestaurantMembershipRole(row.role)) return null;
  return {
    createdAt: row.created_at ?? undefined,
    id: row.id,
    organizationId: row.organization_id,
    role: row.role,
  };
}

function normalizeMembership(value: RestaurantMembership): RestaurantMembership | null {
  if (!value.organizationId || !isRestaurantMembershipRole(value.role)) return null;
  return {
    createdAt: value.createdAt,
    id: value.id,
    organizationId: value.organizationId,
    role: value.role,
  };
}

function mapSupabasePartnerMembershipRow(row: SupabasePartnerMembershipRow): PartnerMembership | null {
  if (!row.partner_id || !isPartnerRole(row.role)) return null;
  return {
    createdAt: row.created_at ?? undefined,
    id: row.id,
    partnerId: row.partner_id,
    role: row.role,
  };
}

function normalizePartnerMembership(value: PartnerMembership): PartnerMembership | null {
  if (!value.partnerId || !isPartnerRole(value.role)) return null;
  return {
    createdAt: value.createdAt,
    id: value.id,
    partnerId: value.partnerId,
    role: value.role,
  };
}

function sortMemberships(memberships: RestaurantMembership[]) {
  return [...memberships].sort((a, b) => compareRestaurantRoles(a.role, b.role));
}

function sortPartnerMemberships(memberships: PartnerMembership[]) {
  return [...memberships].sort((a, b) => comparePartnerRoles(a.role, b.role));
}

function normalizeAuthMode(value: unknown): AuthMode {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "supabase") return "supabase";
    if (normalized === "demo") return "demo";
  }
  // Default to supabase when Lovable Cloud / Supabase is configured.
  return supabaseUrl && supabasePublishableKey ? "supabase" : "demo";
}

function resolveWorkspaceKind(
  authProvider: AuthMode,
  role: UserRole,
  partnerMemberships: PartnerMembership[],
): WorkspaceKind {
  if (authProvider === "demo") return role === "superadmin" ? "platform" : "demo";
  if (role === "superadmin") return "platform";
  return partnerMemberships.length ? "partner" : "restaurant";
}

function defaultNameFor(email: string, role: UserRole) {
  if (role === "superadmin") return "SignalHost Staff";
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Restaurant Owner";
}

function stringMetadataValue(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanMetadataValue(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function isSignalHostStaffEmail(email: string) {
  return /@(?:signalhost|hostline)\.[a-z0-9.-]+$/i.test(email);
}
