import { describe, expect, it } from "vitest";
import {
  queueRoutingModeAllowsLiveTransfer,
  queueRoutingModeRequiresCallbackOwnership,
  isTransferTargetActivationStateValid,
  transferTargetKindRequiresDestination,
  transferTargetKindRequiresQueue,
  transferTargetKindRequiresStaff,
} from "./commercial-routing";

describe("commercial routing contract", () => {
  it("keeps callback ownership explicit for non-live and hybrid queues", () => {
    expect(queueRoutingModeRequiresCallbackOwnership("callback_only")).toBe(true);
    expect(queueRoutingModeRequiresCallbackOwnership("hybrid")).toBe(true);
    expect(queueRoutingModeRequiresCallbackOwnership("live_transfer")).toBe(false);
    expect(queueRoutingModeRequiresCallbackOwnership("external")).toBe(false);
  });

  it("does not imply callback-only queues can transfer live calls", () => {
    expect(queueRoutingModeAllowsLiveTransfer("callback_only")).toBe(false);
    expect(queueRoutingModeAllowsLiveTransfer("live_transfer")).toBe(true);
    expect(queueRoutingModeAllowsLiveTransfer("hybrid")).toBe(true);
    expect(queueRoutingModeAllowsLiveTransfer("external")).toBe(true);
  });

  it("requires verification before a target can be active", () => {
    expect(isTransferTargetActivationStateValid({ status: "draft" })).toBe(true);
    expect(isTransferTargetActivationStateValid({ status: "verified", verifiedAt: "2026-08-05T00:00:00Z" })).toBe(true);
    expect(isTransferTargetActivationStateValid({ status: "active" })).toBe(false);
    expect(isTransferTargetActivationStateValid({ status: "active", verifiedAt: "2026-08-05T00:00:00Z" })).toBe(true);
  });

  it("uses structurally distinct queue, staff, and endpoint targets", () => {
    expect(transferTargetKindRequiresQueue("queue")).toBe(true);
    expect(transferTargetKindRequiresStaff("staff")).toBe(true);
    expect(transferTargetKindRequiresDestination("pstn")).toBe(true);
    expect(transferTargetKindRequiresDestination("sip_uri")).toBe(true);
    expect(transferTargetKindRequiresDestination("callback")).toBe(false);
  });
});
