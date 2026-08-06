import { describe, expect, it } from "vitest";

import {
  isObservedCompatibilityRoute,
  isTelephonyRuntimeActivationStateValid,
  numberRouteDestinationRequiresExternalValue,
  numberRouteDestinationRequiresQueue,
  numberRouteDestinationRequiresSipTrunk,
} from "./commercial-telephony";

describe("commercial telephony contract", () => {
  it("keeps observed compatibility routes explicitly non-enforced", () => {
    expect(isObservedCompatibilityRoute({ status: "observed", runtimeEnforced: false })).toBe(true);
    expect(isObservedCompatibilityRoute({ status: "observed", runtimeEnforced: true })).toBe(false);
    expect(isObservedCompatibilityRoute({ status: "active", runtimeEnforced: true })).toBe(false);
  });

  it("requires both verification and enforcement for active runtime state", () => {
    expect(isTelephonyRuntimeActivationStateValid({ status: "draft", runtimeEnforced: false })).toBe(true);
    expect(isTelephonyRuntimeActivationStateValid({ status: "verified", runtimeEnforced: false })).toBe(true);
    expect(isTelephonyRuntimeActivationStateValid({ status: "active", runtimeEnforced: false })).toBe(false);
    expect(isTelephonyRuntimeActivationStateValid({ status: "active", runtimeEnforced: true })).toBe(false);
    expect(isTelephonyRuntimeActivationStateValid({
      status: "active",
      runtimeEnforced: true,
      verifiedAt: "2026-08-06T00:00:00Z",
    })).toBe(true);
    expect(isTelephonyRuntimeActivationStateValid({ status: "disabled", runtimeEnforced: true })).toBe(false);
  });

  it("keeps queue, trunk, and external destinations structurally distinct", () => {
    expect(numberRouteDestinationRequiresQueue("queue")).toBe(true);
    expect(numberRouteDestinationRequiresSipTrunk("sip_trunk")).toBe(true);
    expect(numberRouteDestinationRequiresExternalValue("external")).toBe(true);
    expect(numberRouteDestinationRequiresQueue("department")).toBe(false);
  });
});
