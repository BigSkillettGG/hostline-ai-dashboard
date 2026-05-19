import { describe, expect, it } from "vitest";
import { demoRestaurantContext } from "../../voice/src/restaurant-context";
import { buildLiveKitRealtimeInstructions, finishLiveKitCall, isLiveKitCallerDoneUtterance } from "./realtime-runtime";

describe("LiveKit realtime call closing", () => {
  it("keeps incomplete caller speech from being guessed into a full request", () => {
    const instructions = buildLiveKitRealtimeInstructions(demoRestaurantContext);

    expect(instructions).toContain("Incomplete speech guardrail");
    expect(instructions).toContain("do not infer the missing words");
    expect(instructions).toContain("I have a leak in my...");
    expect(instructions).toContain("instead of assuming kitchen");
  });

  it("recognizes natural done phrases after loop-closing questions", () => {
    expect(isLiveKitCallerDoneUtterance("No, that was it.")).toBe(true);
    expect(isLiveKitCallerDoneUtterance("Nope, that's all.")).toBe(true);
    expect(isLiveKitCallerDoneUtterance("I'm all good, thank you.")).toBe(true);
    expect(isLiveKitCallerDoneUtterance("No thanks, we're good.")).toBe(true);
  });

  it("allows finish_call for no-that-was-it phrasing", () => {
    expect(finishLiveKitCall({
      lastCallerText: "No, that was it.",
      rawArguments: {
        closing_line: "Thanks for calling. Goodbye.",
        reason: "caller_done",
      },
    })).toMatchObject({
      action: "finish_call",
      ok: true,
    });
  });
});
