import { describe, expect, it } from "vitest";
import {
  canCurrentUserManageTeam,
  buildDemoUser,
  buildDemoSuperAdmin,
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
    expect(buildDemoUser("maria@oliveandember.com").restaurantMembershipRole).toBe("owner");
    expect(buildDemoUser("staff@hostline.ai").role).toBe("superadmin");
    expect(buildDemoSuperAdmin().isPlatformAdmin).toBe(true);
    expect(roleFromEmailAndMetadata("owner@example.com", { role: "superadmin" })).toBe("superadmin");
    expect(roleFromEmailAndMetadata("staff@hostline.ai")).toBe("admin");
  });

  it("maps Supabase auth responses into membership-backed dashboard users", () => {
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      refresh_token: "refresh_token",
      user: {
        app_metadata: {},
        email: "owner@example.com",
        id: "user_1",
        user_metadata: { name: "Owner Example" },
      },
    }, {
      memberships: [{ organizationId: "org_1", role: "owner" }],
    });

    expect(user).toMatchObject({
      accessToken: "access_token",
      activeOrganizationId: "org_1",
      authProvider: "supabase",
      email: "owner@example.com",
      name: "Owner Example",
      restaurantId: "org_1",
      restaurantMembershipRole: "owner",
      role: "admin",
      supabaseUserId: "user_1",
      workspaceKind: "restaurant",
    });
    expect(canCurrentUserManageTeam(user)).toBe(true);
  });

  it("maps platform admins separately from restaurant memberships", () => {
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      user: {
        email: "ops@hostline.ai",
        id: "user_2",
        user_metadata: { name: "Ops User" },
      },
    }, {
      isPlatformAdmin: true,
    });

    expect(user).toMatchObject({
      isPlatformAdmin: true,
      role: "superadmin",
      workspaceKind: "platform",
    });
  });
});
