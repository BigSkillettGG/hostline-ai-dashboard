import { describe, expect, it } from "vitest";
import { classifyRealtimeToolError } from "./openai-realtime-tool-errors";

describe("classifyRealtimeToolError", () => {
  it("maps tool failures into caller-safe operational categories", () => {
    expect(classifyRealtimeToolError(new Error("Supabase PGRST relation missing"))).toBe("persistence_error");
    expect(classifyRealtimeToolError(new Error("Twilio SMS failed"))).toBe("messaging_error");
    expect(classifyRealtimeToolError(new Error("OpenTable reservation provider failed"))).toBe("reservation_provider_error");
    expect(classifyRealtimeToolError(new Error("Missing required callback phone"))).toBe("validation_error");
    expect(classifyRealtimeToolError(new Error("unexpected"))).toBe("tool_error");
  });
});
