import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const verifier = readFileSync(
  resolve(process.cwd(), "scripts/verify-commercial-write-isolation-production.mjs"),
  "utf8",
).toLowerCase();

describe("commercial production write-isolation verifier", () => {
  it("covers the hierarchy, routing, number, and account boundaries", () => {
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
      expect(verifier).toContain(`${table}: { id:`);
    }
  });

  it("rotates every authenticated tenant against a different target tenant", () => {
    expect(verifier).toContain("snapshots[(index + 1) % snapshots.length]");
    expect(verifier).toContain("verifydeniednoopupdates(attacker, target)");
  });

  it("uses representation-returning PATCH probes and fails if a target row is writable", () => {
    expect(verifier).toContain('method: "patch"');
    expect(verifier).toContain('prefer: "return=representation"');
    expect(verifier).toContain("result.length === 0");
    expect(verifier).toContain("exposed a writable row belonging to");
  });

  it("uses POST only for authentication and PATCH as its only REST mutation", () => {
    expect(verifier.match(/method: "[a-z]+"/g)).toEqual([
      'method: "post"',
      'method: "patch"',
    ]);
    expect(verifier).not.toContain('method: "delete"');
  });
});
