import { useEffect, useState } from "react";

export type AuthMode = "demo" | "supabase";
export type UserRole = "admin" | "superadmin";

export interface CurrentUser {
  accessToken?: string;
  authProvider: AuthMode;
  email: string;
  name: string;
  refreshToken?: string;
  restaurantId?: string;
  role: UserRole;
  supabaseUserId?: string;
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

const STORAGE_KEY = "hostline.currentUser";
const EVENT = "hostline.auth.changed";
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

export function getSupabaseAccessToken() {
  const user = readUser();
  return user?.authProvider === "supabase" ? user.accessToken : undefined;
}

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

export function signOut() {
  writeUser(null);
}

export function setRole(role: UserRole) {
  if (!isDemoAuthMode()) return;

  const u = readUser();
  if (!u) {
    writeUser({
      authProvider: "demo",
      email: role === "superadmin" ? "staff@hostline.ai" : "maria@oliveandember.com",
      name: role === "superadmin" ? "HostLine Staff" : "Maria Lombardi",
      restaurantId: "olive-ember",
      role,
    });
  } else {
    writeUser({ ...u, authProvider: "demo", role });
  }
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
  const role = roleFromEmailAndMetadata(email);
  return {
    authProvider: "demo",
    email,
    name: name?.trim() || defaultNameFor(email, role),
    restaurantId: "olive-ember",
    role,
  };
}

export function mapSupabaseAuthResponse(data: SupabaseAuthResponse): CurrentUser {
  if (!data.access_token || !data.user?.email || !data.user.id) {
    throw new Error("Supabase Auth did not return an active session. Confirm the email address before signing in.");
  }

  const role = roleFromEmailAndMetadata(data.user.email, data.user.app_metadata, data.user.user_metadata);
  const name =
    stringMetadataValue(data.user.user_metadata, "name") ??
    stringMetadataValue(data.user.user_metadata, "full_name") ??
    defaultNameFor(data.user.email, role);

  return {
    accessToken: data.access_token,
    authProvider: "supabase",
    email: data.user.email,
    name,
    refreshToken: data.refresh_token,
    restaurantId: stringMetadataValue(data.user.app_metadata, "restaurant_id"),
    role,
    supabaseUserId: data.user.id,
  };
}

export function roleFromEmailAndMetadata(
  email: string,
  appMetadata: Record<string, unknown> = {},
  userMetadata: Record<string, unknown> = {},
): UserRole {
  const role = stringMetadataValue(appMetadata, "role") ?? stringMetadataValue(userMetadata, "role");
  if (role === "superadmin" || role === "admin") return role;
  return /staff|@hostline|admin@hostline/i.test(email) ? "superadmin" : "admin";
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
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

async function signInWithSupabase(email: string, password: string, config: AuthRuntimeConfig) {
  const response = await supabaseAuthRequest<SupabaseAuthResponse>(
    "token?grant_type=password",
    { email, password },
    config,
  );
  return mapSupabaseAuthResponse(response);
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
  return mapSupabaseAuthResponse(response);
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

function normalizeStoredUser(user: CurrentUser): CurrentUser {
  return {
    ...user,
    authProvider: user.authProvider ?? "demo",
    role: user.role ?? "admin",
  };
}

function normalizeAuthMode(value: unknown): AuthMode {
  return typeof value === "string" && value.toLowerCase() === "supabase" ? "supabase" : "demo";
}

function defaultNameFor(email: string, role: UserRole) {
  if (role === "superadmin") return "HostLine Staff";
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Restaurant Owner";
}

function stringMetadataValue(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
