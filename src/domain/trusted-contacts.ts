import {
  getRestaurantRoleLabel,
  normalizeRestaurantRole,
  type RestaurantMembershipRole,
} from "./access-control";

export type TrustedContactType = "owner" | "manager" | "front_desk" | "billing";
export type TrustedContactPreferredChannel = "sms" | "email" | "both";
export type TrustedContactPermissionKey =
  | "canAddLiveUpdates"
  | "canApprovePermanentKnowledge"
  | "canManageAlertPreferences"
  | "canReceiveAlerts"
  | "canResolveCustomerRequests"
  | "canUseOwnerAssistant";

export interface TrustedContactPermissions {
  canAddLiveUpdates: boolean;
  canApprovePermanentKnowledge: boolean;
  canManageAlertPreferences: boolean;
  canReceiveAlerts: boolean;
  canResolveCustomerRequests: boolean;
  canUseOwnerAssistant: boolean;
  requiresOwnerApproval: boolean;
}

export interface TrustedContact extends TrustedContactPermissions {
  contactType: TrustedContactType;
  createdAt?: string;
  email?: string;
  id: string;
  locationId?: string;
  name: string;
  phone?: string;
  preferredChannel: TrustedContactPreferredChannel;
  updatedAt?: string;
}

export interface CreateTrustedContactInput {
  contactType: TrustedContactType;
  email?: string;
  name: string;
  phone?: string;
  preferredChannel?: TrustedContactPreferredChannel;
}

export interface UpdateTrustedContactPermissionsInput extends Partial<TrustedContactPermissions> {
  contactType?: TrustedContactType;
  email?: string;
  name?: string;
  phone?: string;
  preferredChannel?: TrustedContactPreferredChannel;
}

export const trustedContactTypes: TrustedContactType[] = ["owner", "manager", "front_desk", "billing"];
export const trustedContactPreferredChannels: TrustedContactPreferredChannel[] = ["sms", "email", "both"];

export const trustedContactTypeLabels: Record<TrustedContactType, string> = {
  billing: "Billing",
  front_desk: "Front desk",
  manager: "Manager",
  owner: "Owner",
};

export const trustedContactPermissionLabels: Record<TrustedContactPermissionKey, string> = {
  canAddLiveUpdates: "Add live updates",
  canApprovePermanentKnowledge: "Approve knowledge",
  canManageAlertPreferences: "Manage alert rules",
  canReceiveAlerts: "Receive alerts",
  canResolveCustomerRequests: "Resolve requests",
  canUseOwnerAssistant: "Use owner assistant",
};

export const trustedContactPermissionDescriptions: Record<TrustedContactPermissionKey, string> = {
  canAddLiveUpdates: "Can say things like closed tomorrow, running behind, tonight's special, or busy mode.",
  canApprovePermanentKnowledge: "Can make permanent answers available to future callers without owner approval.",
  canManageAlertPreferences: "Can change who gets notified and how urgent routing behaves.",
  canReceiveAlerts: "Can receive operational alerts, report delivery, and follow-up notifications.",
  canResolveCustomerRequests: "Can answer open customer requests and close action-center items.",
  canUseOwnerAssistant: "Can ask SignalHost what happened today and issue trusted commands.",
};

const permissionKeys: TrustedContactPermissionKey[] = [
  "canUseOwnerAssistant",
  "canAddLiveUpdates",
  "canResolveCustomerRequests",
  "canApprovePermanentKnowledge",
  "canManageAlertPreferences",
  "canReceiveAlerts",
];

export function trustedContactPermissionKeys() {
  return permissionKeys;
}

export function normalizeTrustedContactType(value: unknown): TrustedContactType {
  if (trustedContactTypes.includes(value as TrustedContactType)) return value as TrustedContactType;
  const role = normalizeRestaurantRole(value, "staff");
  if (role === "owner") return "owner";
  if (role === "admin" || role === "manager") return "manager";
  return "front_desk";
}

export function normalizeTrustedContactPreferredChannel(value: unknown): TrustedContactPreferredChannel {
  return trustedContactPreferredChannels.includes(value as TrustedContactPreferredChannel)
    ? (value as TrustedContactPreferredChannel)
    : "sms";
}

export function trustedContactTypeFromRole(role: RestaurantMembershipRole): TrustedContactType {
  if (role === "owner") return "owner";
  if (role === "admin" || role === "manager") return "manager";
  return "front_desk";
}

export function defaultTrustedContactPermissions(type: TrustedContactType): TrustedContactPermissions {
  if (type === "owner") {
    return {
      canAddLiveUpdates: true,
      canApprovePermanentKnowledge: true,
      canManageAlertPreferences: true,
      canReceiveAlerts: true,
      canResolveCustomerRequests: true,
      canUseOwnerAssistant: true,
      requiresOwnerApproval: false,
    };
  }

  if (type === "manager") {
    return {
      canAddLiveUpdates: true,
      canApprovePermanentKnowledge: false,
      canManageAlertPreferences: false,
      canReceiveAlerts: true,
      canResolveCustomerRequests: true,
      canUseOwnerAssistant: true,
      requiresOwnerApproval: true,
    };
  }

  if (type === "front_desk") {
    return {
      canAddLiveUpdates: false,
      canApprovePermanentKnowledge: false,
      canManageAlertPreferences: false,
      canReceiveAlerts: true,
      canResolveCustomerRequests: true,
      canUseOwnerAssistant: false,
      requiresOwnerApproval: true,
    };
  }

  return {
    canAddLiveUpdates: false,
    canApprovePermanentKnowledge: false,
    canManageAlertPreferences: false,
    canReceiveAlerts: false,
    canResolveCustomerRequests: false,
    canUseOwnerAssistant: false,
    requiresOwnerApproval: true,
  };
}

export function createTrustedContactDraft(input: CreateTrustedContactInput, now = new Date()): TrustedContact {
  const contactType = normalizeTrustedContactType(input.contactType);

  return {
    ...defaultTrustedContactPermissions(contactType),
    contactType,
    createdAt: now.toISOString(),
    email: normalizeOptionalEmail(input.email),
    id: `trusted_${input.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}_${now.getTime()}`,
    name: normalizeContactName(input.name),
    phone: normalizeOptionalPhone(input.phone),
    preferredChannel: normalizeTrustedContactPreferredChannel(input.preferredChannel),
    updatedAt: now.toISOString(),
  };
}

export function normalizeContactName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("Enter a contact name.");
  return normalized;
}

export function normalizeOptionalEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function normalizeOptionalPhone(value: string | undefined) {
  const phone = value?.trim().replace(/[^\d+]/g, "");
  if (!phone) return undefined;
  if (phone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid phone number.");
  return phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`;
}

export function contactTypeLabelForRole(role: RestaurantMembershipRole) {
  return trustedContactTypeLabels[trustedContactTypeFromRole(role)] ?? getRestaurantRoleLabel(role);
}
