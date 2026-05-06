import { describe, expect, it } from "vitest";
import {
  buildDemoUser,
  getAuthReadiness,
  mapSupabaseAuthResponse,
  roleFromEmailAndMetadata,
} from "./auth";

describe("auth helpers", () => {
  it("marks demo auth as not production-ready", () => {
    expect(
      getAuthReadiness({
        mode: "demo",
        supabasePublishableKey: "",
        supabaseUrl: "",
      }),
    ).toMatchObject({
      badge: "Demo auth",
      ready: false,
    });
  });

  it("requires Supabase URL and publishable key for Supabase Auth mode", () => {
    expect(
      getAuthReadiness({
        mode: "supabase",
        supabasePublishableKey: "",
        supabaseUrl: "https://example.supabase.co",
      }),
    ).toMatchObject({
      badge: "Auth not configured",
      ready: false,
    });
  });

  it("recognizes configured Supabase Auth mode", () => {
    expect(
      getAuthReadiness({
        mode: "supabase",
        supabasePublishableKey: "sb_publishable",
        supabaseUrl: "https://example.supabase.co",
      }),
    ).toMatchObject({
      badge: "Supabase Auth",
      ready: true,
    });
  });

  it("derives demo and Supabase roles consistently", () => {
    expect(buildDemoUser("maria@oliveandember.com").role).toBe("admin");
    expect(buildDemoUser("staff@hostline.ai").role).toBe("superadmin");
    expect(roleFromEmailAndMetadata("owner@example.com", { role: "superadmin" })).toBe("superadmin");
  });

  it("maps Supabase auth responses into stored dashboard users", () => {
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      refresh_token: "refresh_token",
      user: {
        app_metadata: { restaurant_id: "restaurant_1", role: "admin" },
        email: "owner@example.com",
        id: "user_1",
        user_metadata: { name: "Owner Example" },
      },
    });

    expect(user).toMatchObject({
      accessToken: "access_token",
      authProvider: "supabase",
      email: "owner@example.com",
      name: "Owner Example",
      restaurantId: "restaurant_1",
      role: "admin",
      supabaseUserId: "user_1",
    });
  });
});
