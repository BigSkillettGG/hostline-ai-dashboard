import { afterEach, describe, expect, it, vi } from "vitest";
import { createTenantProvisioningService } from "./tenant-provisioning";
import type { VoiceServiceEnv } from "./env";

const baseEnv = {
  NODE_ENV: "test",
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SECRET_KEY: "service-role",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
} as VoiceServiceEnv;

describe("tenant provisioning", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an organization, owner membership, location, onboarding profile, and agent config", async () => {
    const requests: Array<{ body?: unknown; method?: string; url: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        method: init?.method,
        url,
      });

      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ email: "owner@summitair.test", id: "user_1", user_metadata: { name: "Owner" } });
      }
      if (url.includes("/user_memberships?") && init?.method === "GET") {
        return jsonResponse([]);
      }
      if (url.includes("/organizations?") && init?.method === "POST") {
        return jsonResponse([{ id: "org_1", name: "Summit Air" }]);
      }
      if (url.includes("/user_memberships?") && init?.method === "POST") {
        return jsonResponse([{ created_at: "2026-05-12T12:00:00.000Z", id: "mem_1", organization_id: "org_1", role: "owner" }]);
      }
      if (url.includes("/locations?") && init?.method === "GET") {
        return jsonResponse([]);
      }
      if (url.includes("/locations?") && init?.method === "POST") {
        return jsonResponse([{ id: "loc_1", name: "Summit Air", organization_id: "org_1" }]);
      }
      if (url.includes("/onboarding_profiles?") && init?.method === "POST") {
        return jsonResponse([{
          completed_required: 12,
          location_id: "loc_1",
          progress_percent: 50,
          status: "in_progress",
          total_required: 24,
        }]);
      }
      if (url.includes("/agent_configs?") && init?.method === "POST") {
        return jsonResponse([{ id: "agent_1", location_id: "loc_1" }]);
      }

      return jsonResponse({});
    }));

    const service = createTenantProvisioningService(baseEnv);
    const result = await service.bootstrap({
      businessName: "Summit Air",
      businessType: "hvac",
      draft: {
        businessType: "hvac",
        restaurantName: "Summit Air",
        regularHours: "Mon-Fri 8-6",
        timezone: "America/New_York",
      },
      ownerName: "Owner",
    }, "Bearer user-token");

    expect(result).toMatchObject({
      businessType: "hvac",
      createdLocation: true,
      createdOrganization: true,
      locationId: "loc_1",
      organizationId: "org_1",
    });
    expect(requests.find((request) => request.url.includes("/locations?") && request.method === "POST")?.body).toMatchObject({
      cuisine: "HVAC",
      name: "Summit Air",
      organization_id: "org_1",
      timezone: "America/New_York",
    });
    expect(requests.find((request) => request.url.includes("/onboarding_profiles?"))?.body).toMatchObject({
      draft: expect.objectContaining({
        businessType: "hvac",
        restaurantName: "Summit Air",
      }),
      location_id: "loc_1",
    });
    expect(requests.find((request) => request.url.includes("/agent_configs?"))?.body).toMatchObject({
      location_id: "loc_1",
      orders_enabled: true,
      reservations_enabled: true,
      reservation_mode: "booking_link",
    });
  });

  it("reuses an existing membership and location without creating duplicates", async () => {
    const requests: Array<{ method?: string; url: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ method: init?.method, url });

      if (url.endsWith("/auth/v1/user")) {
        return jsonResponse({ email: "owner@example.test", id: "user_1" });
      }
      if (url.includes("/user_memberships?") && init?.method === "GET") {
        return jsonResponse([{ id: "mem_1", organization_id: "org_1", role: "owner" }]);
      }
      if (url.includes("/locations?") && init?.method === "GET") {
        return jsonResponse([{ id: "loc_existing", name: "Harbor Plumbing", organization_id: "org_1" }]);
      }
      if (url.includes("/locations?") && init?.method === "PATCH") {
        return emptyResponse();
      }
      if (url.includes("/onboarding_profiles?") && init?.method === "POST") {
        return jsonResponse([{ location_id: "loc_existing", progress_percent: 42, status: "in_progress" }]);
      }
      if (url.includes("/agent_configs?") && init?.method === "POST") {
        return jsonResponse([{ id: "agent_1", location_id: "loc_existing" }]);
      }

      return jsonResponse([]);
    }));

    const result = await createTenantProvisioningService(baseEnv).bootstrap({
      businessName: "Harbor Plumbing",
      businessType: "plumbing",
      draft: { restaurantName: "Harbor Plumbing" },
    }, "Bearer user-token");

    expect(result).toMatchObject({
      createdLocation: false,
      createdOrganization: false,
      locationId: "loc_existing",
      organizationId: "org_1",
    });
    expect(requests.some((request) => request.url.includes("/organizations?") && request.method === "POST")).toBe(false);
    expect(requests.some((request) => request.url.includes("/locations?") && request.method === "POST")).toBe(false);
  });

  it("requires a Supabase bearer token", async () => {
    await expect(
      createTenantProvisioningService(baseEnv).bootstrap({ businessType: "restaurant" }, undefined),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function emptyResponse() {
  return new Response(null, { status: 204 });
}
