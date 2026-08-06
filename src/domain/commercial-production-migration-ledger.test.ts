import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ledgerMarkers = [
  {
    canonicalMigration: "20260806010000_commercial_hierarchy_foundation.sql",
    deployedVersion: "20260806043652_f47027b0-7aff-4392-9d11-d6e27b3aee6f.sql",
  },
  {
    canonicalMigration: "20260806020000_commercial_routing_foundation.sql",
    deployedVersion: "20260806043823_1e06a948-7388-4c3f-b3c6-d5e8dabf0f27.sql",
  },
  {
    canonicalMigration: "20260806070000_commercial_telephony_ownership_foundation.sql",
    deployedVersion: "20260806144125_74a0a231-4b3d-43d3-97b1-0f491eca4c5b.sql",
  },
];

describe("commercial production migration ledger markers", () => {
  for (const marker of ledgerMarkers) {
    it(`keeps ${marker.deployedVersion} as a documented no-op`, () => {
      const sql = readFileSync(
        resolve(process.cwd(), "supabase/migrations", marker.deployedVersion),
        "utf8",
      ).toLowerCase();

      expect(sql).toContain(marker.canonicalMigration.toLowerCase());
      expect(sql).toContain("production migration ledger compatibility marker");
      expect(sql).toContain("select 1;");
      expect(sql).not.toMatch(/\b(create|alter|drop|truncate|insert|update|delete)\b/);
    });
  }
});
