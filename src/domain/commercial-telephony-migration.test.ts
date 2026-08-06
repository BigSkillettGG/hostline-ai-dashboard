import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
}

const migration = readProjectFile(
  "supabase/migrations/20260806070000_commercial_telephony_ownership_foundation.sql",
);
const schemaSnapshot = readProjectFile("docs/supabase-schema.sql");
const rlsSnapshot = readProjectFile("docs/supabase-rls.sql");
const generatedTypes = readProjectFile("src/integrations/supabase/types.ts");

describe("commercial telephony ownership migration contract", () => {
  it("is additive and leaves live provider bindings untouched", () => {
    expect(migration).not.toMatch(/\bdrop\s+table\b/);
    expect(migration).not.toMatch(/\bdrop\s+column\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
    expect(migration).not.toContain("set provider =");
    expect(migration).not.toContain("set provider_sid =");
    expect(migration).not.toContain("set voice_webhook_url =");
    expect(migration).not.toContain("set ai_host_phone =");
    expect(migration).not.toContain("alter table public.agent_configs");
  });

  it("models account, billing, and customer-relationship ownership separately", () => {
    expect(migration).toContain("create table if not exists public.telephony_accounts");
    expect(migration).toContain("resource_owner in ('signalhost', 'partner', 'customer')");
    expect(migration).toContain("billing_owner in ('signalhost', 'partner', 'customer')");
    expect(migration).toContain("customer_relationship_owner in ('signalhost', 'partner')");
    expect(migration).toContain("account_kind in ('carrier', 'voice_runtime', 'pbx')");
    expect(migration).toContain("credentials, signing secrets, tokens, and private keys");
  });

  it("backfills a compatible account without changing existing number identity", () => {
    expect(migration).toContain("add column if not exists telephony_account_id uuid");
    expect(migration).toContain("ensure_default_telephony_account");
    expect(migration).toContain("phone_numbers_validate_telephony_account");
    expect(migration).toContain("update public.phone_numbers");
    expect(migration).toContain("set telephony_account_id = public.ensure_default_telephony_account(provider)");
    expect(migration).toContain("alter column telephony_account_id set not null");
  });

  it("keeps trunks and number routes dormant until service verification", () => {
    expect(migration).toContain("create table if not exists public.sip_trunks");
    expect(migration).toContain("create table if not exists public.number_routes");
    expect(migration).toContain("status in ('observed', 'draft', 'verified', 'active', 'disabled', 'failed')");
    expect(migration).toContain("check (status <> 'active' or (verified_at is not null and runtime_enforced))");
    expect(migration).toContain("number_routes_protect_runtime_state");
    expect(migration).toContain("sip_trunks_protect_verification");
    expect(migration).toContain("'observed'");
    expect(migration).toContain("jsonb_build_object('source', 'legacy_phone_number'");
  });

  it("rejects cross-scope account, department, queue, and trunk references", () => {
    expect(migration).toContain("telephony_accounts_validate_scope");
    expect(migration).toContain("telephony_account_can_serve_location");
    expect(migration).toContain("number_routes_validate_scope");
    expect(migration).toContain("a phone number telephony account cannot serve this location scope");
    expect(migration).toContain("a number route department must belong to the phone number location");
    expect(migration).toContain("a number route queue must belong to the route department");
    expect(migration).toContain("a number route sip trunk cannot serve the phone number location");
  });

  it("enables RLS and grants browser/service access after protection", () => {
    for (const table of ["telephony_accounts", "sip_trunks", "number_routes"]) {
      const rlsPosition = migration.indexOf(`alter table public.${table} enable row level security`);
      const browserGrantPosition = migration.indexOf(`grant select, insert, update, delete on public.${table}`);
      const serviceGrantPosition = migration.indexOf(`grant all on public.${table} to service_role`);

      expect(rlsPosition, `${table} should enable RLS`).toBeGreaterThan(-1);
      expect(browserGrantPosition, `${table} should grant authenticated access`).toBeGreaterThan(rlsPosition);
      expect(serviceGrantPosition, `${table} should grant service access`).toBeGreaterThan(browserGrantPosition);
    }
  });

  it("keeps schema, RLS, and generated types aligned", () => {
    for (const table of ["telephony_accounts", "sip_trunks", "number_routes"]) {
      expect(schemaSnapshot, `schema should contain ${table}`).toContain(`create table ${table}`);
      expect(rlsSnapshot, `RLS should protect ${table}`).toContain(
        `alter table ${table} enable row level security`,
      );
      expect(generatedTypes, `types should contain ${table}`).toContain(`${table}: {`);
    }

    expect(schemaSnapshot).toContain("telephony_account_id uuid not null references telephony_accounts");
    expect(rlsSnapshot).toContain("create or replace function public.can_access_telephony_account");
    expect(generatedTypes).toContain("can_access_telephony_account: {");
    expect(generatedTypes).toContain("telephony_account_id: string");
  });
});
