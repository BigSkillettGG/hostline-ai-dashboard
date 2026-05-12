import type { IncomingMessage } from "node:http";
import type { VoiceServiceEnv } from "./env";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

export interface VoiceAdminAuthorization {
  authorized: boolean;
  reason?: string;
  status: number;
  userId?: string;
}

type RestaurantAdminRole = "admin" | "manager" | "owner" | "staff";

interface SupabaseAuthUserResponse {
  id?: string;
}

interface MembershipRow {
  organization_id?: string | null;
  role?: string | null;
}

interface LocationRow {
  organization_id?: string | null;
}

export async function authorizeVoiceAdminRequest({
  currentEnv,
  locationId,
  req,
}: {
  currentEnv: VoiceServiceEnv;
  locationId?: string;
  req: IncomingMessage;
}): Promise<VoiceAdminAuthorization> {
  if (isAuthorizedLegacyInternalRequest(req, currentEnv)) {
    return { authorized: true, status: 200 };
  }

  if (!currentEnv.SUPABASE_URL || !currentEnv.SUPABASE_SECRET_KEY) {
    return currentEnv.NODE_ENV === "production"
      ? { authorized: false, reason: "Supabase auth is not configured.", status: 503 }
      : { authorized: true, status: 200 };
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return { authorized: false, reason: "Missing Supabase bearer token.", status: 401 };
  }

  try {
    const userId = await fetchSupabaseUserId(token, currentEnv);
    if (!userId) {
      return { authorized: false, reason: "Invalid Supabase bearer token.", status: 401 };
    }

    if (await isPlatformAdmin(userId, currentEnv)) {
      return { authorized: true, status: 200, userId };
    }

    const membership = locationId
      ? await fetchMembershipForLocation(userId, locationId, currentEnv)
      : await fetchFirstAdminMembership(userId, currentEnv);

    if (!membership) {
      return { authorized: false, reason: "User does not have access to this restaurant.", status: 403, userId };
    }

    if (!isVoiceAdminRole(membership.role)) {
      return { authorized: false, reason: "User cannot manage voice settings.", status: 403, userId };
    }

    return { authorized: true, status: 200, userId };
  } catch (error) {
    console.error("[voice-admin-auth] authorization failed", error);
    return { authorized: false, reason: "Voice admin authorization failed.", status: 503 };
  }
}

function isAuthorizedLegacyInternalRequest(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  const internalApiKey = currentEnv.SIGNALHOST_INTERNAL_API_KEY ?? currentEnv.HOSTLINE_INTERNAL_API_KEY;
  const headerValue = req.headers["x-signalhost-api-key"] ?? req.headers["x-hostline-api-key"];
  return Boolean(
    internalApiKey &&
      headerValue === internalApiKey,
  );
}

function getBearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function fetchSupabaseUserId(token: string, currentEnv: VoiceServiceEnv) {
  const apiKey = currentEnv.SUPABASE_PUBLISHABLE_KEY ?? currentEnv.SUPABASE_SECRET_KEY;
  if (!apiKey) return null;

  const response = await fetch(`${currentEnv.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseAuthUserResponse;
  return user.id ?? null;
}

async function isPlatformAdmin(userId: string, currentEnv: VoiceServiceEnv) {
  const params = new URLSearchParams({
    limit: "1",
    select: "id",
    user_id: `eq.${userId}`,
  });
  const rows = await supabaseServiceRequest<Array<{ id?: string }>>("platform_admins", params, currentEnv);
  return rows.length > 0;
}

async function fetchMembershipForLocation(userId: string, locationId: string, currentEnv: VoiceServiceEnv) {
  const locationParams = new URLSearchParams({
    id: `eq.${locationId}`,
    limit: "1",
    select: "organization_id",
  });
  const locations = await supabaseServiceRequest<LocationRow[]>("locations", locationParams, currentEnv);
  const organizationId = locations[0]?.organization_id;
  if (!organizationId) return null;

  const membershipParams = new URLSearchParams({
    limit: "1",
    organization_id: `eq.${organizationId}`,
    select: "organization_id,role",
    user_id: `eq.${userId}`,
  });
  const memberships = await supabaseServiceRequest<MembershipRow[]>("user_memberships", membershipParams, currentEnv);
  return memberships[0] ?? null;
}

async function fetchFirstAdminMembership(userId: string, currentEnv: VoiceServiceEnv) {
  const membershipParams = new URLSearchParams({
    limit: "1",
    select: "organization_id,role",
    user_id: `eq.${userId}`,
  });
  const memberships = await supabaseServiceRequest<MembershipRow[]>("user_memberships", membershipParams, currentEnv);
  return memberships.find((membership) => isVoiceAdminRole(membership.role)) ?? null;
}

async function supabaseServiceRequest<T>(table: string, params: URLSearchParams, currentEnv: VoiceServiceEnv) {
  const response = await fetch(`${currentEnv.SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    headers: buildSupabaseServiceHeaders(currentEnv.SUPABASE_SECRET_KEY ?? ""),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase admin auth ${table} failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

function isVoiceAdminRole(role: string | null | undefined): role is RestaurantAdminRole {
  return role === "owner" || role === "admin";
}
