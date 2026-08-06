export const SIGNALHOST_DIRECT_PARTNER_ID = "a0000000-0000-4000-8000-000000000001" as const;
export const SIGNALHOST_DIRECT_PARTNER_SLUG = "signalhost-direct" as const;

export const partnerRoles = ["owner", "admin", "operator", "viewer"] as const;
export type PartnerRole = (typeof partnerRoles)[number];

const partnerRoleLabels: Record<PartnerRole, string> = {
  admin: "Partner admin",
  operator: "Partner operator",
  owner: "Partner owner",
  viewer: "Partner viewer",
};

const partnerRolePriority: Record<PartnerRole, number> = {
  owner: 1,
  admin: 2,
  operator: 3,
  viewer: 4,
};

export const departmentAccessModes = ["inherit_location", "restricted"] as const;
export type DepartmentAccessMode = (typeof departmentAccessModes)[number];

export const departmentMembershipRoles = ["manager", "agent", "viewer"] as const;
export type DepartmentMembershipRole = (typeof departmentMembershipRoles)[number];

export function isPartnerRole(value: unknown): value is PartnerRole {
  return typeof value === "string" && partnerRoles.includes(value as PartnerRole);
}

export function getPartnerRoleLabel(role: PartnerRole | undefined) {
  return role ? partnerRoleLabels[role] : "Partner user";
}

export function comparePartnerRoles(a: PartnerRole, b: PartnerRole) {
  return partnerRolePriority[a] - partnerRolePriority[b];
}

export function canPartnerRoleAccessOrganizations(role: PartnerRole | undefined) {
  return role !== undefined;
}

export function canPartnerRoleOperateOrganizations(role: PartnerRole | undefined) {
  return role === "owner" || role === "admin" || role === "operator";
}

export function canPartnerRoleManageOrganizations(role: PartnerRole | undefined) {
  return role === "owner" || role === "admin";
}

export function canPartnerRoleManageMemberships(role: PartnerRole | undefined) {
  return role === "owner" || role === "admin";
}

export function departmentInheritsLocationAccess(mode: DepartmentAccessMode) {
  return mode === "inherit_location";
}

export function canDepartmentRoleAccess(role: DepartmentMembershipRole | undefined) {
  return role !== undefined;
}

export function canDepartmentRoleOperate(role: DepartmentMembershipRole | undefined) {
  return role === "manager" || role === "agent";
}

export function canDepartmentRoleManageMemberships(role: DepartmentMembershipRole | undefined) {
  return role === "manager";
}
