import { describe, expect, it } from "vitest";
import { mapSupabaseCalls } from "./supabase-rest";

describe("Supabase call mapping", () => {
  it("maps persisted calls and transcript turns into dashboard call records", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: null,
          caller_phone: "+15551234567",
          confidence: null,
          duration_seconds: 42,
          id: "call_1",
          intent: "faq",
          outcome: "unknown",
          started_at: "2026-05-04T20:00:00.000Z",
          status: "new",
          summary: null,
        },
      ],
      [
        {
          call_id: "call_1",
          offset_seconds: 2.4,
          speaker: "caller",
          text: "What time do you close?",
        },
        {
          call_id: "call_1",
          offset_seconds: 4.1,
          speaker: "agent",
          text: "We close at 10 tonight.",
        },
      ],
    );

    expect(calls[0]).toMatchObject({
      caller: "Unknown",
      confidence: 0,
      duration: 42,
      intent: "faq",
      outcome: "unknown",
      phone: "+15551234567",
      status: "new",
    });
    expect(calls[0].transcript).toEqual([
      { speaker: "caller", t: "00:02", text: "What time do you close?" },
      { speaker: "agent", t: "00:04", text: "We close at 10 tonight." },
    ]);
  });

  it("normalizes unexpected enum values", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: "Sam",
          caller_phone: null,
          confidence: 12,
          duration_seconds: null,
          id: "call_2",
          intent: "weird",
          outcome: "also_weird",
          started_at: "2026-05-04T20:00:00.000Z",
          status: "strange",
          summary: "Imported from provider",
        },
      ],
      [],
    );

    expect(calls[0].intent).toBe("other");
    expect(calls[0].outcome).toBe("unknown");
    expect(calls[0].status).toBe("new");
  });
});
