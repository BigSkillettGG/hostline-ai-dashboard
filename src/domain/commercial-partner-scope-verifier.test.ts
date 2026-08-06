import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const verifier = readFileSync(
  resolve(process.cwd(), "scripts/verify-commercial-partner-scope-production.mjs"),
  "utf8",
).toLowerCase();

describe("commercial production partner-scope verifier", () => {
  it("uses dedicated direct and isolation partner identities", () => {
    expect(verifier).toContain("signalhost_partner_test_email");
    expect(verifier).toContain("signalhost_partner_control_email");
    expect(verifier).toContain("demo.partner@signalhost.ai");
    expect(verifier).toContain("demo.partner-control@signalhost.ai");
    expect(verifier).toContain("a0000000-0000-4000-8000-000000000099");
  });

  it("requires multi-customer positive scope without customer memberships", () => {
    expect(verifier).toContain("data.organizations.length >= 2");
    expect(verifier).toContain("data.customerMemberships.length === 0".toLowerCase());
    expect(verifier).toContain('data.partnermemberships[0]?.role === "owner"');
    expect(verifier.match(/user_id=eq\.\$\{encodeuricomponent\(userid\)\}/g)).toHaveLength(2);
  });

  it("checks positive and negative partner predicates", () => {
    for (const predicate of [
      "partner_role",
      "can_access_partner",
      "can_manage_partner",
      "can_operate_partner",
      "can_access_organization",
      "can_manage_organization",
      "can_operate_organization",
    ]) {
      expect(verifier).toContain(`rpc("${predicate}"`);
    }
    expect(verifier).toContain("acquired a role in the control partner");
    expect(verifier).toContain("can access signalhost direct");
    expect(verifier).toContain("!== true");
  });

  it("probes all established cross-partner write boundaries without inserts or deletes", () => {
    for (const table of [
      "channel_partners",
      "organizations",
      "locations",
      "departments",
      "queues",
      "phone_numbers",
      "number_routes",
      "telephony_accounts",
    ]) {
      expect(verifier).toContain(`rows.${table} = { id:`);
    }
    expect(verifier).toContain('method: "patch"');
    expect(verifier).toContain('prefer: "return=representation"');
    expect(verifier).not.toContain('method: "delete"');
    expect(verifier).not.toContain('method: "put"');
  });
});
