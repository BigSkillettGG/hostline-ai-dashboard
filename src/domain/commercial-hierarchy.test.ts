import { describe, expect, it } from "vitest";
import {
  canDepartmentRoleAccess,
  canDepartmentRoleManageMemberships,
  canDepartmentRoleOperate,
  canPartnerRoleAccessOrganizations,
  canPartnerRoleManageMemberships,
  canPartnerRoleManageOrganizations,
  canPartnerRoleOperateOrganizations,
  departmentInheritsLocationAccess,
  isPartnerRole,
  SIGNALHOST_DIRECT_PARTNER_ID,
} from "./commercial-hierarchy";

describe("commercial hierarchy access contract", () => {
  it("uses a stable direct-sales partner identity", () => {
    expect(SIGNALHOST_DIRECT_PARTNER_ID).toBe("a0000000-0000-4000-8000-000000000001");
  });

  it("keeps partner role capabilities least-privileged", () => {
    expect(canPartnerRoleAccessOrganizations("viewer")).toBe(true);
    expect(canPartnerRoleOperateOrganizations("viewer")).toBe(false);
    expect(canPartnerRoleOperateOrganizations("operator")).toBe(true);
    expect(canPartnerRoleManageOrganizations("operator")).toBe(false);
    expect(canPartnerRoleManageOrganizations("admin")).toBe(true);
    expect(canPartnerRoleManageMemberships("owner")).toBe(true);
    expect(canPartnerRoleAccessOrganizations(undefined)).toBe(false);
  });

  it("distinguishes inherited and restricted department access", () => {
    expect(departmentInheritsLocationAccess("inherit_location")).toBe(true);
    expect(departmentInheritsLocationAccess("restricted")).toBe(false);
    expect(canDepartmentRoleAccess("viewer")).toBe(true);
    expect(canDepartmentRoleOperate("viewer")).toBe(false);
    expect(canDepartmentRoleOperate("agent")).toBe(true);
    expect(canDepartmentRoleManageMemberships("agent")).toBe(false);
    expect(canDepartmentRoleManageMemberships("manager")).toBe(true);
  });

  it("rejects unknown partner roles", () => {
    expect(isPartnerRole("owner")).toBe(true);
    expect(isPartnerRole("staff")).toBe(false);
    expect(isPartnerRole(undefined)).toBe(false);
  });
});
