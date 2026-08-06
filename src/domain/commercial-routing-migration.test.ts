import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
}

const migration = readProjectFile(
  "supabase/migrations/20260806020000_commercial_routing_foundation.sql",
);
const schemaSnapshot = readProjectFile("docs/supabase-schema.sql");
const rlsSnapshot = readProjectFile("docs/supabase-rls.sql");
const generatedTypes = readProjectFile("src/integrations/supabase/types.ts");

describe("commercial routing migration contract", () => {
  it("is additive and does not rewrite existing routing records", () => {
    expect(migration).not.toMatch(/\bdrop\s+table\b/);
    expect(migration).not.toMatch(/\bdrop\s+column\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
    expect(migration).not.toContain("alter table public.phone_numbers");
    expect(migration).not.toContain("alter table public.agent_configs");
    expect(migration).not.toContain("alter table public.alert_routing_configs");
    expect(migration).not.toContain("update public.business_contacts");
  });

  it("backfills callback-only primary queues without enabling live routing", () => {
    expect(migration).toContain("'primary queue'");
    expect(migration).toContain("'callback_only'");
    expect(migration).toContain("from public.departments");
    expect(migration).toContain("departments_create_default_queue");
    expect(migration).toContain("queues_one_default_per_department");
    expect(migration).toContain("queues_protect_default_contract");
  });

  it("enforces staff, member, and target ownership boundaries", () => {
    expect(migration).toContain("staff_directory_entries_validate_scope");
    expect(migration).toContain("a linked auth user must already have platform, partner, organization, or department access");
    expect(migration).toContain("public.user_has_location_affiliation(auth.uid(), staff_directory_entries.location_id)");
    expect(migration).toContain("queue_members_validate_scope");
    expect(migration).toContain("transfer_targets_validate_scope");
    expect(migration).toContain("queue members must belong to the same location");
    expect(migration).toContain("a queue transfer target must reference a queue in the same department");
    expect(migration).toContain("a staff transfer target must reference a staff entry at the same location");
  });

  it("requires service verification before browser-managed activation", () => {
    expect(migration).toContain("check (status <> 'active' or verified_at is not null)");
    expect(migration).toContain("transfer_targets_protect_verification");
    expect(migration).toContain("before insert or update on public.transfer_targets");
    expect(migration).toContain("transfer target verification must be recorded by a signalhost verification service");
    expect(migration).toContain("supports_live_transfer boolean not null default false");
  });

  it("enables RLS before granting browser access to every new table", () => {
    for (const table of ["staff_directory_entries", "queues", "queue_members", "transfer_targets"]) {
      const rlsPosition = migration.indexOf(`alter table public.${table} enable row level security`);
      const grantPosition = migration.indexOf(`grant select, insert, update, delete on public.${table}`);
      const serviceGrantPosition = migration.indexOf(`grant all on public.${table} to service_role`);

      expect(rlsPosition, `${table} should enable RLS`).toBeGreaterThan(-1);
      expect(grantPosition, `${table} should grant authenticated access`).toBeGreaterThan(rlsPosition);
      expect(serviceGrantPosition, `${table} should grant service access`).toBeGreaterThan(grantPosition);
    }
  });

  it("keeps clean-install snapshots and checked-in types aligned", () => {
    for (const table of ["staff_directory_entries", "queues", "queue_members", "transfer_targets"]) {
      expect(schemaSnapshot, `schema should contain ${table}`).toContain(`create table ${table}`);
      expect(rlsSnapshot, `RLS should protect ${table}`).toContain(
        `alter table ${table} enable row level security`,
      );
      expect(generatedTypes, `types should contain ${table}`).toContain(`${table}: {`);
    }

    expect(rlsSnapshot).toContain("create or replace function public.can_access_queue");
    expect(rlsSnapshot).toContain("create or replace function public.can_access_staff_directory_entry");
    expect(generatedTypes).toContain("can_operate_queue: {");
  });
});
