import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceServiceEnv } from "./env";
import { createOwnerCommandRuntime } from "./owner-command-runtime";
import { demoRestaurantContext } from "./restaurant-context";

const baseEnv = {
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
  SUPABASE_SECRET_KEY: "service-role",
  SUPABASE_URL: "https://supabase.test",
} satisfies Partial<VoiceServiceEnv>;

const owner = demoRestaurantContext.trustedContacts[0];

describe("owner command runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists trusted owner live updates to Supabase", async () => {
    const requests: Array<{ body: unknown; method: string; url: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        method: init?.method ?? "GET",
        url,
      });
      return new Response(JSON.stringify([{ id: "update_123" }]), { status: 200 });
    });

    const runtime = createOwnerCommandRuntime(baseEnv as VoiceServiceEnv);
    const result = await runtime.runCommand({
      actor: owner,
      channel: "phone",
      locationId: baseEnv.SUPABASE_DEMO_LOCATION_ID,
      message: "Tonight's special is lobster ravioli",
    });

    expect(result).toMatchObject({
      applied: true,
      kind: "live_command",
      ok: true,
      title: "Live update saved",
    });
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: expect.stringContaining("/business_live_updates?select=id"),
      body: {
        location_id: baseEnv.SUPABASE_DEMO_LOCATION_ID,
        source: "owner_text",
        title: "Tonight's special",
        update_type: "special",
      },
    });
  });

  it("uses the owner report service for phone report questions", async () => {
    const runtime = createOwnerCommandRuntime(baseEnv as VoiceServiceEnv, {
      configured: true,
      deliveryConfigured: false,
      async deliverDailyReport() {
        throw new Error("not used");
      },
      async generateDailyReport() {
        return {
          configured: true,
          locationId: baseEnv.SUPABASE_DEMO_LOCATION_ID,
          periodEnd: "2026-05-13T23:59:59.000Z",
          periodStart: "2026-05-13T00:00:00.000Z",
          report: {
            copyText: "Daily report",
            dateLabel: "Wednesday, May 13",
            followUps: [],
            headline: "3 calls handled",
            metrics: [],
            ownerMessage: "I handled 3 calls and found 1 open follow-up.",
            suggestedUpdates: [],
            totals: {
              calls: 3,
              chats: 0,
              complaints: 0,
              highValue: 1,
              knowledgeGaps: 0,
              openFollowUps: 1,
              orders: 0,
              reservations: 0,
              revenueCents: 0,
              urgent: 0,
            },
          },
          timezone: "America/New_York",
        };
      },
    });

    const result = await runtime.runCommand({
      actor: owner,
      channel: "phone",
      locationId: baseEnv.SUPABASE_DEMO_LOCATION_ID,
      message: "What happened today?",
    });

    expect(result).toMatchObject({
      kind: "report_query",
      ok: true,
      spokenResponse: "I handled 3 calls and found 1 open follow-up.",
      title: "3 calls handled",
    });
  });
});
