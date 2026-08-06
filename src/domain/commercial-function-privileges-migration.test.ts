import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260806170000_commercial_function_privilege_hardening.sql"),
  "utf8",
).toLowerCase();
const rlsSnapshot = readFileSync(resolve(process.cwd(), "docs/supabase-rls.sql"), "utf8").toLowerCase();
const commercialFoundationSql = [
  "20260806010000_commercial_hierarchy_foundation.sql",
  "20260806020000_commercial_routing_foundation.sql",
  "20260806070000_commercial_telephony_ownership_foundation.sql",
].map((file) => readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8").toLowerCase()).join("\n");

describe("commercial function privilege hardening migration", () => {
  it("revokes default RPC access from every commercial helper", () => {
    expect(migration).toContain("revoke all privileges on function %s from public, anon, authenticated");
    expect(migration).toContain("grant execute on function %s to service_role");

    const functionNames = [...commercialFoundationSql.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(/g)]
      .map((match) => match[1]);
    for (const functionName of functionNames) {
      expect(migration).toContain(`'public.${functionName}(`);
    }
  });

  it("keeps the write-capable default-account helper service-only", () => {
    expect(migration).toContain("'public.ensure_default_telephony_account(text)'");
    expect(migration).not.toContain(
      "grant execute on function public.ensure_default_telephony_account(text) to authenticated",
    );
  });

  it("preserves authenticated execution for direct RLS predicates", () => {
    for (const signature of [
      "public.partner_role(uuid)",
      "public.can_access_partner(uuid)",
      "public.can_manage_organization(uuid)",
      "public.can_access_department(uuid)",
      "public.can_manage_queue(uuid)",
      "public.can_access_telephony_account(uuid)",
      "public.phone_number_location_id(uuid)",
      "public.can_access_number_route(uuid)",
    ]) {
      expect(migration).toContain(`grant execute on function ${signature} to authenticated`);
    }

    const hardenedFunctionNames = new Set(
      [...migration.matchAll(/'public\.([a-z0-9_]+)\(/g)].map((match) => match[1]),
    );
    const authenticatedFunctionNames = new Set(
      [...migration.matchAll(/grant execute on function public\.([a-z0-9_]+)\([^;]*\) to authenticated/g)]
        .map((match) => match[1]),
    );
    const policyFunctionNames = new Set(
      [...commercialFoundationSql.matchAll(/create policy[\s\S]*?;/g)]
        .flatMap((policy) => [...policy[0].matchAll(/public\.([a-z0-9_]+)\s*\(/g)].map((match) => match[1])),
    );

    for (const functionName of policyFunctionNames) {
      if (hardenedFunctionNames.has(functionName)) {
        expect(authenticatedFunctionNames).toContain(functionName);
      }
    }
  });

  it("does not grant anonymous execution back to any helper", () => {
    expect(migration).not.toMatch(/grant\s+execute[\s\S]*\s+to\s+(public|anon)\b/);
  });

  it("keeps the clean-install RLS snapshot aligned", () => {
    expect(rlsSnapshot).toContain("revoke all privileges on function %s from public, anon, authenticated");
    expect(rlsSnapshot).toContain("'public.ensure_default_telephony_account(text)'");
    expect(rlsSnapshot).toContain(
      "grant execute on function public.can_access_number_route(uuid) to authenticated",
    );
    expect(rlsSnapshot).not.toContain(
      "grant execute on function public.ensure_default_telephony_account(text) to authenticated",
    );
  });
});
