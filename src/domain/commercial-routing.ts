export const queueRoutingModes = ["callback_only", "live_transfer", "hybrid", "external"] as const;
export type QueueRoutingMode = (typeof queueRoutingModes)[number];

export const queueMemberRoles = ["supervisor", "member"] as const;
export type QueueMemberRole = (typeof queueMemberRoles)[number];

export const transferTargetKinds = [
  "queue",
  "staff",
  "pstn",
  "sip_uri",
  "pbx_extension",
  "voicemail",
  "callback",
] as const;
export type TransferTargetKind = (typeof transferTargetKinds)[number];

export const transferTargetStatuses = ["draft", "verified", "active", "disabled", "failed"] as const;
export type TransferTargetStatus = (typeof transferTargetStatuses)[number];

export interface TransferTargetActivationInput {
  status: TransferTargetStatus;
  verifiedAt?: string;
}

export function queueRoutingModeAllowsLiveTransfer(mode: QueueRoutingMode) {
  return mode === "live_transfer" || mode === "hybrid" || mode === "external";
}

export function queueRoutingModeRequiresCallbackOwnership(mode: QueueRoutingMode) {
  return mode === "callback_only" || mode === "hybrid";
}

export function isTransferTargetActivationStateValid(input: TransferTargetActivationInput) {
  return input.status !== "active" || Boolean(input.verifiedAt?.trim());
}

export function transferTargetKindRequiresDestination(kind: TransferTargetKind) {
  return kind === "pstn" || kind === "sip_uri" || kind === "pbx_extension" || kind === "voicemail";
}

export function transferTargetKindRequiresQueue(kind: TransferTargetKind) {
  return kind === "queue";
}

export function transferTargetKindRequiresStaff(kind: TransferTargetKind) {
  return kind === "staff";
}
