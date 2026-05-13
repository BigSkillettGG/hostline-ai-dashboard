import { describe, expect, it } from "vitest";
import {
  createTrustedContactDraft,
  defaultTrustedContactPermissions,
  normalizeOptionalPhone,
  normalizeTrustedContactType,
  trustedContactTypeFromRole,
} from "./trusted-contacts";

describe("trusted contacts", () => {
  it("sets sensible default permissions by trusted contact type", () => {
    expect(defaultTrustedContactPermissions("owner")).toMatchObject({
      canApprovePermanentKnowledge: true,
      canManageAlertPreferences: true,
      requiresOwnerApproval: false,
    });

    expect(defaultTrustedContactPermissions("manager")).toMatchObject({
      canAddLiveUpdates: true,
      canApprovePermanentKnowledge: false,
      canResolveCustomerRequests: true,
      requiresOwnerApproval: true,
    });

    expect(defaultTrustedContactPermissions("billing")).toMatchObject({
      canReceiveAlerts: false,
      canUseOwnerAssistant: false,
    });
  });

  it("normalizes roles and creates trusted contact drafts", () => {
    expect(trustedContactTypeFromRole("admin")).toBe("manager");
    expect(normalizeTrustedContactType("staff")).toBe("front_desk");
    expect(normalizeOptionalPhone("(781) 307-2672")).toBe("+17813072672");

    expect(
      createTrustedContactDraft({
        contactType: "manager",
        email: " Jill@Example.com ",
        name: " Jill Smith ",
        phone: "(781) 307-2672",
      }),
    ).toMatchObject({
      canAddLiveUpdates: true,
      canApprovePermanentKnowledge: false,
      contactType: "manager",
      email: "jill@example.com",
      name: "Jill Smith",
      phone: "+17813072672",
    });
  });
});
