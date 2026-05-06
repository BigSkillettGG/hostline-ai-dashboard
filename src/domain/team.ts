import {
  getRestaurantRoleLabel,
  isRestaurantMembershipRole,
  type RestaurantMembershipRole,
} from "@/domain/access-control";

export type TeamInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface TeamMember {
  email: string;
  id: string;
  lastActive?: string;
  name: string;
  role: RestaurantMembershipRole;
}

export interface TeamInvitation {
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  invitedBy?: string;
  role: RestaurantMembershipRole;
  status: TeamInviteStatus;
}

export interface CreateTeamInvitationInput {
  email: string;
  invitedBy?: string;
  role: RestaurantMembershipRole;
}

export const teamRoleDescriptions: Record<RestaurantMembershipRole, string> = {
  admin: "Can manage settings, menus, integrations, and team members.",
  manager: "Can operate calls, orders, reservations, tasks, and most restaurant content.",
  owner: "Full restaurant workspace access, including billing and team ownership.",
  staff: "Can work calls, orders, reservations, and assigned follow-ups.",
};

export function createPendingTeamInvitation(input: CreateTeamInvitationInput, now = new Date()): TeamInvitation {
  const email = normalizeInviteEmail(input.email);
  const role = normalizeTeamRole(input.role);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    createdAt: now.toISOString(),
    email,
    expiresAt: expiresAt.toISOString(),
    id: `invite_${email.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}_${now.getTime()}`,
    invitedBy: input.invitedBy,
    role,
    status: "pending",
  };
}

export function normalizeInviteEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
}

export function normalizeTeamRole(role: unknown): RestaurantMembershipRole {
  if (!isRestaurantMembershipRole(role)) {
    throw new Error("Choose a valid team role.");
  }
  return role;
}

export function getTeamRoleLabel(role: RestaurantMembershipRole) {
  return getRestaurantRoleLabel(role);
}

export function getInitials(value: string) {
  return value
    .split(/[ @._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}
