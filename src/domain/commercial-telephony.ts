export const telephonyAccountKinds = ["carrier", "voice_runtime", "pbx"] as const;
export type TelephonyAccountKind = (typeof telephonyAccountKinds)[number];

export const telephonyResourceOwners = ["signalhost", "partner", "customer"] as const;
export type TelephonyResourceOwner = (typeof telephonyResourceOwners)[number];

export const telephonyBillingOwners = ["signalhost", "partner", "customer"] as const;
export type TelephonyBillingOwner = (typeof telephonyBillingOwners)[number];

export const customerRelationshipOwners = ["signalhost", "partner"] as const;
export type CustomerRelationshipOwner = (typeof customerRelationshipOwners)[number];

export const sipTrunkDirections = ["inbound", "outbound", "bidirectional"] as const;
export type SipTrunkDirection = (typeof sipTrunkDirections)[number];

export const telephonyRuntimeStatuses = ["draft", "verified", "active", "disabled", "failed"] as const;
export type TelephonyRuntimeStatus = (typeof telephonyRuntimeStatuses)[number];

export const numberRouteDestinationKinds = ["department", "queue", "sip_trunk", "external"] as const;
export type NumberRouteDestinationKind = (typeof numberRouteDestinationKinds)[number];

export const numberRouteStatuses = ["observed", ...telephonyRuntimeStatuses] as const;
export type NumberRouteStatus = (typeof numberRouteStatuses)[number];

export interface RuntimeActivationState {
  runtimeEnforced: boolean;
  status: TelephonyRuntimeStatus | NumberRouteStatus;
  verifiedAt?: string;
}

export function isTelephonyRuntimeActivationStateValid(input: RuntimeActivationState) {
  if (input.runtimeEnforced && input.status !== "active") return false;
  if (input.status === "active") {
    return input.runtimeEnforced && Boolean(input.verifiedAt?.trim());
  }
  return true;
}

export function isObservedCompatibilityRoute(input: Pick<RuntimeActivationState, "runtimeEnforced" | "status">) {
  return input.status === "observed" && !input.runtimeEnforced;
}

export function numberRouteDestinationRequiresQueue(kind: NumberRouteDestinationKind) {
  return kind === "queue";
}

export function numberRouteDestinationRequiresSipTrunk(kind: NumberRouteDestinationKind) {
  return kind === "sip_trunk";
}

export function numberRouteDestinationRequiresExternalValue(kind: NumberRouteDestinationKind) {
  return kind === "external";
}
