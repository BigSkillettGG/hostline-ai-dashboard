import { describe, expect, it } from "vitest";
import {
  canCurrentUserManageTeam,
  canUserAccessRole,
  buildDemoUser,
  buildDemoSuperAdmin,
  getAuthReadiness,
  getActiveDepartmentId,
  getActiveLocationId,
  getActivePartnerId,
  mapSupabaseAuthResponse,
  requiresWorkspaceAssignment,
  roleFromEmailAndMetadata,
  signOut,
  updateCurrentUserAccess,
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
    expect(buildDemoUser("staff@signalhost.ai").role).toBe("superadmin");
    expect(buildDemoUser("stafford@gmail.com").role).toBe("admin");
    expect(buildDemoSuperAdmin().isPlatformAdmin).toBe(true);
    expect(roleFromEmailAndMetadata("owner@example.com", { role: "superadmin" })).toBe("superadmin");
    expect(roleFromEmailAndMetadata("staff@signalhost.ai")).toBe("admin");
  });

  it("lets platform admins enter tenant app routes without becoming restaurant users", () => {
    const platformAdmin = buildDemoSuperAdmin();
    const restaurantAdmin = buildDemoUser("maria@oliveandember.com");

    expect(canUserAccessRole(platformAdmin, "superadmin")).toBe(true);
    expect(canUserAccessRole(platformAdmin, "admin")).toBe(true);
    expect(canUserAccessRole(restaurantAdmin, "admin")).toBe(true);
    expect(canUserAccessRole(restaurantAdmin, "superadmin")).toBe(false);
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
      activeLocationId: "loc_1",
      memberships: [{ organizationId: "org_1", role: "owner" }],
    });

    expect(user).toMatchObject({
      accessToken: "access_token",
      activeOrganizationId: "org_1",
      activeLocationId: "loc_1",
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

  it("updates the stored user with provisioned organization and location access", () => {
    signOut();
    localStorage.setItem("signalhost.currentUser", JSON.stringify({
      accessToken: "access_token",
      authProvider: "supabase",
      email: "owner@example.com",
      name: "Owner",
      role: "admin",
      supabaseUserId: "user_1",
    }));

    const user = updateCurrentUserAccess({
      activeLocationId: "loc_1",
      activeOrganizationId: "org_1",
      memberships: [{ organizationId: "org_1", role: "owner" }],
    });

    expect(user).toMatchObject({
      activeLocationId: "loc_1",
      activeOrganizationId: "org_1",
      restaurantMembershipRole: "owner",
    });
    expect(getActiveLocationId()).toBe("loc_1");
    signOut();
  });

  it("maps platform admins separately from restaurant memberships", () => {
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      user: {
        email: "ops@signalhost.ai",
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

  it("maps partner memberships into a partner workspace", () => {
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      user: {
        email: "operator@partner.example",
        id: "partner_user_1",
      },
    }, {
      activeLocationId: "loc_2",
      activeOrganizationId: "org_2",
      activePartnerId: "partner_1",
      partnerMemberships: [{ partnerId: "partner_1", role: "operator" }],
    });

    expect(user).toMatchObject({
      activeLocationId: "loc_2",
      activeOrganizationId: "org_2",
      activePartnerId: "partner_1",
      partnerMembershipRole: "operator",
      role: "admin",
      workspaceKind: "partner",
    });
  });

  it("requires a real workspace assignment instead of falling back to demo data", () => {
    const unassignedPartner = mapSupabaseAuthResponse({
      access_token: "access_token",
      user: {
        email: "owner@unassigned-partner.example",
        id: "partner_user_unassigned",
      },
    }, {
      activePartnerId: "partner_without_customers",
      partnerMemberships: [{ partnerId: "partner_without_customers", role: "owner" }],
    });

    const assignedPartner = {
      ...unassignedPartner,
      activeLocationId: "loc_1",
      activeOrganizationId: "org_1",
    };

    expect(unassignedPartner.workspaceKind).toBe("partner");
    expect(requiresWorkspaceAssignment(unassignedPartner)).toBe(true);
    expect(requiresWorkspaceAssignment(assignedPartner)).toBe(false);
    expect(requiresWorkspaceAssignment(buildDemoUser("demo@example.com"))).toBe(false);
    expect(requiresWorkspaceAssignment(buildDemoSuperAdmin())).toBe(false);
  });

  it("recalculates customer and partner roles for the selected scope", () => {
    signOut();
    localStorage.setItem("signalhost.currentUser", JSON.stringify({
      accessToken: "access_token",
      activeOrganizationId: "org_1",
      activePartnerId: "partner_1",
      authProvider: "supabase",
      email: "multi-scope@example.com",
      memberships: [
        { organizationId: "org_1", role: "owner" },
        { organizationId: "org_2", role: "staff" },
      ],
      name: "Multi Scope",
      partnerMemberships: [
        { partnerId: "partner_1", role: "admin" },
        { partnerId: "partner_2", role: "viewer" },
      ],
      role: "admin",
      supabaseUserId: "user_5",
    }));

    const user = updateCurrentUserAccess({
      activeLocationId: "loc_2",
      activeOrganizationId: "org_2",
      activePartnerId: "partner_2",
    });

    expect(user).toMatchObject({
      partnerMembershipRole: "viewer",
      restaurantMembershipRole: "staff",
      workspaceKind: "partner",
    });
    expect(getActivePartnerId()).toBe("partner_2");
    signOut();
  });

  it("persists department context and clears it when the location workspace changes", () => {
    signOut();
    localStorage.setItem("signalhost.currentUser", JSON.stringify({
      accessToken: "access_token",
      activeDepartmentId: "department_1",
      activeLocationId: "loc_1",
      activeOrganizationId: "org_1",
      authProvider: "supabase",
      email: "owner@example.com",
      memberships: [{ organizationId: "org_1", role: "owner" }],
      name: "Owner",
      role: "admin",
      supabaseUserId: "user_1",
    }));

    expect(getActiveDepartmentId()).toBe("department_1");

    const user = updateCurrentUserAccess({
      activeDepartmentId: null,
      activeLocationId: "loc_2",
    });

    expect(user?.activeDepartmentId).toBeUndefined();
    expect(getActiveDepartmentId()).toBeUndefined();
    signOut();
  });

  it("captures access token expiry from expires_at", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      expires_at: expiresAt,
      refresh_token: "refresh_token",
      user: {
        email: "owner@example.com",
        id: "user_3",
      },
    });

    expect(user.accessTokenExpiresAt).toBe(expiresAt);
    expect(user.refreshToken).toBe("refresh_token");
    signOut();
  });

  it("derives access token expiry from expires_in when expires_at is absent", () => {
    const before = Math.floor(Date.now() / 1000);
    const user = mapSupabaseAuthResponse({
      access_token: "access_token",
      expires_in: 3600,
      user: {
        email: "owner@example.com",
        id: "user_4",
      },
    });

    expect(user.accessTokenExpiresAt).toBeGreaterThanOrEqual(before + 3600);
    signOut();
  });
});
