import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const verifier = readFileSync(
  resolve(process.cwd(), "scripts/verify-commercial-role-matrix-production.mjs"),
  "utf8",
).toLowerCase();

describe("commercial production role-matrix verifier", () => {
  it("uses an isolated deterministic QA hierarchy", () => {
    expect(verifier).toContain("a0000000-0000-4000-8000-000000000100");
    expect(verifier).toContain("b0000000-0000-4000-8000-000000000100");
    expect(verifier).toContain("c0000000-0000-4000-8000-000000000100");
    expect(verifier).toContain("d0000000-0000-4000-8000-000000000100");
    expect(verifier).toContain("f0000000-0000-4000-8000-000000000100");
    expect(verifier).toContain("signalhost_role_matrix_password");
  });

  it("covers every organization and department membership role", () => {
    for (const email of [
      "qa.org-owner@signalhost.ai",
      "qa.org-admin@signalhost.ai",
      "qa.org-manager@signalhost.ai",
      "qa.org-staff@signalhost.ai",
      "qa.department-manager@signalhost.ai",
      "qa.department-agent@signalhost.ai",
      "qa.department-viewer@signalhost.ai",
    ]) {
      expect(verifier).toContain(email);
    }
    for (const role of ['organizationrole: "owner"', 'organizationrole: "admin"', 'organizationrole: "manager"', 'organizationrole: "staff"', 'departmentrole: "manager"', 'departmentrole: "agent"', 'departmentrole: "viewer"']) {
      expect(verifier).toContain(role);
    }
  });

  it("checks access, management, and operation at organization, location, department, and queue scope", () => {
    for (const predicate of [
      "organization_role",
      "can_access_organization",
      "can_manage_organization",
      "can_operate_organization",
      "can_access_location",
      "can_manage_location",
      "can_operate_location",
      "can_access_department",
      "can_manage_department",
      "can_operate_department",
      "can_access_queue",
      "can_manage_queue",
      "can_operate_queue",
    ]) {
      expect(verifier).toContain(`"${predicate}"`);
    }
    expect(verifier).toContain("restricted department visibility mismatch");
    expect(verifier).toContain("cross-partner organization write was allowed");
    expect(verifier).toContain("expected ? value === true : value !== true");
  });

  it("uses only current-value PATCH probes against the isolated fixture", () => {
    for (const boundary of [
      "customer_requests",
      "default_department",
      "department_memberships",
      "locations",
      "organizations",
      "restricted_department",
      "restricted_queue",
    ]) {
      expect(verifier).toContain(`${boundary}:`);
    }
    expect(verifier).toContain('method: "patch"');
    expect(verifier).toContain('prefer: "return=representation"');
    expect(verifier).not.toContain('method: "delete"');
    expect(verifier).not.toContain('method: "put"');
  });
});
