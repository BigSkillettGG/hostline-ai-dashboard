import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260806010000_commercial_hierarchy_foundation.sql"),
  "utf8",
).toLowerCase();
const schemaSnapshot = readFileSync(resolve(process.cwd(), "docs/supabase-schema.sql"), "utf8").toLowerCase();
const rlsSnapshot = readFileSync(resolve(process.cwd(), "docs/supabase-rls.sql"), "utf8").toLowerCase();
const generatedTypes = readFileSync(
  resolve(process.cwd(), "src/integrations/supabase/types.ts"),
  "utf8",
).toLowerCase();

describe("commercial hierarchy migration contract", () => {
  it("is additive and preserves current tenant records", () => {
    expect(migration).not.toMatch(/\bdrop\s+table\b/);
    expect(migration).not.toMatch(/\bdrop\s+column\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
  });

  it("anchors all organizations to the deterministic direct partner", () => {
    expect(migration).toContain("create table if not exists public.channel_partners");
    expect(migration).toContain("a0000000-0000-4000-8000-000000000001");
    expect(migration).toContain("'signalhost-direct'");
    expect(migration).toMatch(
      /add column if not exists channel_partner_id uuid\s+not null\s+default 'a0000000-0000-4000-8000-000000000001'::uuid/,
    );
    expect(migration).toContain("organizations_protect_partner_assignment");
  });

  it("backfills and maintains the compatible default department", () => {
    expect(migration).toContain("create table if not exists public.departments");
    expect(migration).toContain("'general reception'");
    expect(migration).toContain("'inherit_location'");
    expect(migration).toContain("from public.locations");
    expect(migration).toContain("locations_create_default_department");
    expect(migration).toContain("departments_one_default_per_location");
    expect(migration).toContain("departments_protect_default_contract");
  });

  it("extends organization access through explicit partner roles", () => {
    expect(migration).toContain("create or replace function public.partner_role");
    expect(migration).toContain("create or replace function public.can_access_organization");
    expect(migration).toContain("create or replace function public.can_manage_organization");
    expect(migration).toContain("create or replace function public.can_operate_organization");
    expect(migration).toContain("in ('owner', 'admin', 'operator')");
  });

  it("enables RLS before granting browser access to every new table", () => {
    for (const table of [
      "channel_partners",
      "partner_memberships",
      "departments",
      "department_memberships",
    ]) {
      const rlsPosition = migration.indexOf(`alter table public.${table} enable row level security`);
      const grantPosition = migration.indexOf(`grant select, insert, update, delete on public.${table}`);

      expect(rlsPosition, `${table} should enable RLS`).toBeGreaterThan(-1);
      expect(grantPosition, `${table} should grant authenticated access`).toBeGreaterThan(rlsPosition);
    }
  });

  it("keeps clean-install snapshots and checked-in types aligned", () => {
    for (const table of [
      "channel_partners",
      "partner_memberships",
      "departments",
      "department_memberships",
    ]) {
      expect(schemaSnapshot, `schema should contain ${table}`).toContain(`create table ${table}`);
      expect(rlsSnapshot, `RLS should protect ${table}`).toContain(
        `alter table ${table} enable row level security`,
      );
      expect(generatedTypes, `types should contain ${table}`).toContain(`${table}: {`);
    }

    expect(schemaSnapshot).toContain("add column channel_partner_id uuid");
    expect(generatedTypes).toContain("channel_partner_id: string");
    expect(rlsSnapshot).toContain("create or replace function public.can_access_department");
    expect(rlsSnapshot).toContain("create or replace function public.can_access_partner");
  });
});
