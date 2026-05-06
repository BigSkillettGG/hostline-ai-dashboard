export type UserRole = "admin" | "superadmin";
export type RestaurantMembershipRole = "owner" | "admin" | "manager" | "staff";

export const restaurantMembershipRoles: RestaurantMembershipRole[] = ["owner", "admin", "manager", "staff"];

const restaurantRoleLabels: Record<RestaurantMembershipRole, string> = {
  admin: "Admin",
  manager: "Manager",
  owner: "Owner",
  staff: "Staff",
};

const rolePriority: Record<RestaurantMembershipRole, number> = {
  owner: 1,
  admin: 2,
  manager: 3,
  staff: 4,
};

export function isRestaurantMembershipRole(value: unknown): value is RestaurantMembershipRole {
  return typeof value === "string" && restaurantMembershipRoles.includes(value as RestaurantMembershipRole);
}

export function normalizeRestaurantRole(value: unknown, fallback: RestaurantMembershipRole = "staff") {
  return isRestaurantMembershipRole(value) ? value : fallback;
}

export function getRestaurantRoleLabel(role: RestaurantMembershipRole | undefined) {
  return role ? restaurantRoleLabels[role] : "Restaurant user";
}

export function compareRestaurantRoles(a: RestaurantMembershipRole, b: RestaurantMembershipRole) {
  return rolePriority[a] - rolePriority[b];
}

export function canManageRestaurantTeam(role: RestaurantMembershipRole | undefined) {
  return role === "owner" || role === "admin";
}

export function canManageRestaurantSettings(role: RestaurantMembershipRole | undefined) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canOperateRestaurant(role: RestaurantMembershipRole | undefined) {
  return Boolean(role);
}
