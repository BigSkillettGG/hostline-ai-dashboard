import { describe, expect, it } from "vitest";
import { buildGuardrailReply, classifyCallerUtterance, normalizeCallerUtterance } from "./call-guardrails";

describe("call guardrails", () => {
  it("normalizes caller utterances", () => {
    expect(normalizeCallerUtterance("  hello    there ")).toBe("hello there");
  });

  it("classifies empty, connection, abusive, and normal turns", () => {
    expect(classifyCallerUtterance("")).toBe("empty");
    expect(classifyCallerUtterance("hello")).toBe("normal");
    expect(classifyCallerUtterance("hello are you there?")).toBe("connection_issue");
    expect(classifyCallerUtterance("this stupid bot is useless")).toBe("abusive");
    expect(classifyCallerUtterance("can I order a pizza")).toBe("normal");
  });

  it("escalates repeated unclear audio politely", () => {
    expect(buildGuardrailReply({ classification: "empty", repeatCount: 2, restaurantName: "Olive & Ember" })).toContain("staff follow-up");
  });
});
