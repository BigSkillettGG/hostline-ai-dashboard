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

export type { RestaurantMembershipRole, UserRole } from "@/domain/access-control";

export type AuthMode = "demo" | "supabase";
export type WorkspaceKind = "demo" | "restaurant" | "platform";

export interface RestaurantMembership {
  createdAt?: string;
  id?: string;
  organizationId: string;
  role: RestaurantMembershipRole;
}

export interface CurrentUser {
  accessToken?: string;
  activeLocationId?: string;
  activeOrganizationId?: string;
  authProvider: AuthMode;
  email: string;
  isPlatformAdmin?: boolean;
  memberships?: RestaurantMembership[];
  name: string;
  refreshToken?: string;
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
  refresh_token?: string;
  user?: SupabaseAuthUser;
}

interface SupabaseMembershipRow {
  created_at?: string | null;
  id?: string;
  organization_id?: string;
  role?: string;
}

interface SupabaseLocationRow {
  id?: string;
  organization_id?: string | null;
}

const STORAGE_KEY = "signalhost.currentUser";
const EVENT = "signalhost.auth.changed";
const DEMO_ORGANIZATION_ID = "demo-olive-ember";
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

export function getActiveLocationId() {
  return readUser()?.activeLocationId;
}

export function getSupabaseAccessToken() {
  const user = readUser();
  return user?.authProvider === "supabase" ? user.accessToken : undefined;
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

export { getRestaurantRoleLabel };

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

export function startDemoSession(role: UserRole = "admin") {
  const user = role === "superadmin" ? buildDemoSuperAdmin() : buildDemoUser("maria@oliveandember.com", "Maria Lombardi");
  writeUser(user);
  return user;
}

export function signOut() {
  writeUser(null);
}

export function updateCurrentUserAccess(input: {
  activeLocationId?: string;
  activeOrganizationId?: string;
  memberships?: RestaurantMembership[];
}) {
  const current = readUser();
  if (!current) return null;

  const next = applyAccessModel({
    ...current,
    activeLocationId: input.activeLocationId ?? current.activeLocationId,
    activeOrganizationId: input.activeOrganizationId ?? current.activeOrganizationId,
    memberships: input.memberships ?? current.memberships,
    restaurantId: input.activeOrganizationId ?? current.restaurantId,
  });
  writeUser(next);
  return next;
}

export function setRole(role: UserRole) {
  if (!isDemoAuthMode()) return;
  writeUser(role === "superadmin" ? buildDemoSuperAdmin() : buildDemoUser("maria@oliveandember.com", "Maria Lombardi"));
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

export function buildDemoUser(email: string, name?: string): CurrentUser {
  if (isSignalHostStaffEmail(email)) return buildDemoSuperAdmin(email, name);

  const memberships: RestaurantMembership[] = [
    {
      createdAt: new Date(0).toISOString(),
      id: "demo-membership-owner",
      organizationId: DEMO_ORGANIZATION_ID,
      role: "owner",
    },
  ];

  return applyAccessModel({
    authProvider: "demo",
    email,
    memberships,
    name: name?.trim() || defaultNameFor(email, "admin"),
    restaurantId: "olive-ember",
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
  access: { activeLocationId?: string; isPlatformAdmin?: boolean; memberships?: RestaurantMembership[] } = {},
): CurrentUser {
  if (!data.access_token || !data.user?.email || !data.user.id) {
    throw new Error("Supabase Auth did not return an active session. Confirm the email address before signing in.");
  }

  const memberships = sortMemberships(access.memberships ?? []);
  const role = roleFromEmailAndMetadata(data.user.email, data.user.app_metadata, data.user.user_metadata, {
    isPlatformAdmin: access.isPlatformAdmin,
    memberships,
  });
  const name =
    stringMetadataValue(data.user.user_metadata, "name") ??
    stringMetadataValue(data.user.user_metadata, "full_name") ??
    defaultNameFor(data.user.email, role);

  return applyAccessModel({
    accessToken: data.access_token,
    activeLocationId:
      access.activeLocationId ??
      stringMetadataValue(data.user.app_metadata, "location_id") ??
      stringMetadataValue(data.user.user_metadata, "location_id"),
    authProvider: "supabase",
    email: data.user.email,
    isPlatformAdmin: Boolean(access.isPlatformAdmin),
    memberships,
    name,
    refreshToken: data.refresh_token,
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
  } = {},
): UserRole {
  const role = stringMetadataValue(appMetadata, "role") ?? stringMetadataValue(userMetadata, "role");
  const platformFlag = booleanMetadataValue(appMetadata, "platform_admin") ?? booleanMetadataValue(appMetadata, "is_platform_admin");

  if (access.isPlatformAdmin || platformFlag || role === "superadmin") return "superadmin";
  if (access.memberships?.length || role === "admin") return "admin";
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
  const [memberships, isPlatformAdmin] = await Promise.all([
    fetchSupabaseMemberships(base, config),
    fetchSupabasePlatformAdmin(base, config),
  ]);
  const activeLocationId = memberships[0]?.organizationId
    ? await fetchSupabasePrimaryLocation(base, config, memberships[0].organizationId)
    : undefined;

  return mapSupabaseAuthResponse(data, { activeLocationId, isPlatformAdmin, memberships });
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
  return applyAccessModel({
    ...user,
    authProvider: user.authProvider ?? "demo",
    isPlatformAdmin: Boolean(user.isPlatformAdmin || user.role === "superadmin"),
    memberships,
    role: user.role ?? "admin",
  });
}

function applyAccessModel(user: CurrentUser): CurrentUser {
  const memberships = sortMemberships((user.memberships ?? []).map(normalizeMembership).filter(Boolean) as RestaurantMembership[]);
  const primaryMembership = memberships[0];
  const restaurantMembershipRole = user.restaurantMembershipRole && isRestaurantMembershipRole(user.restaurantMembershipRole)
    ? user.restaurantMembershipRole
    : primaryMembership?.role;
  const role: UserRole = user.isPlatformAdmin || user.role === "superadmin" ? "superadmin" : "admin";
  const workspaceKind = user.workspaceKind ?? defaultWorkspaceKind(user.authProvider, role);

  return {
    ...user,
    activeOrganizationId: user.activeOrganizationId ?? primaryMembership?.organizationId,
    activeLocationId: user.activeLocationId,
    isPlatformAdmin: Boolean(user.isPlatformAdmin || role === "superadmin"),
    memberships,
    restaurantId: user.restaurantId ?? primaryMembership?.organizationId,
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

function sortMemberships(memberships: RestaurantMembership[]) {
  return [...memberships].sort((a, b) => compareRestaurantRoles(a.role, b.role));
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

function defaultWorkspaceKind(authProvider: AuthMode, role: UserRole): WorkspaceKind {
  if (authProvider === "demo") return role === "superadmin" ? "platform" : "demo";
  return role === "superadmin" ? "platform" : "restaurant";
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
  return /staff|@signalhost|admin@signalhost|@hostline|admin@hostline/i.test(email);
}
