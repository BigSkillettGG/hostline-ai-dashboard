# SignalHost Commercial Hierarchy Foundation

Status: Phase 1 data and authorization contract; production migration applied and verified 2026-08-06

Evidence baseline: `d34e498`

## Purpose

This contract introduces the first two missing hierarchy levels without changing current tenant behavior:

```text
SignalHost platform
  Channel partner
    Customer organization
      Location / rooftop
        Department
```

Queues, agents, number routes, workflow scopes, knowledge scopes, and reporting scopes build on these stable identities in later slices. They are intentionally not combined into this first migration.

## Compatibility rules

1. Every existing organization is assigned to the deterministic `SignalHost Direct` partner.
2. New organizations default to `SignalHost Direct` until an authorized provisioning flow assigns a different partner.
3. Every existing location receives one active `General Reception` department.
4. Every new location receives the same default department through a database trigger, so current tenant bootstrap code remains valid.
5. Default departments use `inherit_location` access. Existing organization membership therefore keeps exactly the access it has today.
6. Customer and partner users cannot unset, move, or restrict the default department. A future controlled service operation can replace a default transactionally if needed.
7. Department restrictions are opt-in. A non-default department can move to `restricted` only when department membership and downstream department-scoped data are ready.
8. Existing organization and location IDs are unchanged.
9. Existing calls, phone numbers, agent configurations, knowledge, tasks, requests, billing, and demo records are not rewritten by this slice.
10. Customer organization users cannot reassign their organization to another partner. Initial partner assignment and reassignment remain platform/service operations.
11. No live number, Vapi assistant, prompt, runtime, webhook, or call route changes.

## Deterministic direct-sales partner

The default partner identity is:

```text
id: a0000000-0000-4000-8000-000000000001
slug: signalhost-direct
name: SignalHost Direct
partner_type: direct
```

Using a deterministic ID makes clean installs, backfills, tenant bootstrap, tests, and future partner reassignment agree on the same direct-sales parent.

## Partner roles

| Role | Read assigned customers | Operate customer work | Manage customer configuration and membership | Manage partner membership |
| --- | --- | --- | --- | --- |
| `owner` | Yes | Yes | Yes | Yes |
| `admin` | Yes | Yes | Yes | Yes |
| `operator` | Yes | Yes | No | No |
| `viewer` | Yes | No | No | No |

Platform admins retain global access. Existing customer organization roles continue to work through the existing organization membership rules.

## Department access modes

### `inherit_location`

This is the migration and compatibility default. Anyone who can access or operate the parent location receives the corresponding department access. Explicit department membership can also be recorded, but it does not reduce inherited access.

### `restricted`

Location/organization administrators and partner administrators retain management access. Other users need explicit `department_memberships` access. Downstream data must not be marked department-restricted until its own RLS policy uses the department boundary.

Department membership roles:

- `manager`: department access plus membership administration;
- `agent`: department access and future department-scoped operational work;
- `viewer`: read-only department access.

## RLS behavior

- Partner membership extends the existing organization access functions; downstream location policies inherit the same partner boundary automatically.
- Customer organization membership does not grant access to other organizations under the same partner.
- Customer users can read the partner record that owns their organization, but cannot read partner membership records unless they are themselves a partner member or partner administrator.
- Partner viewers receive the same read paths as organization viewers, but no operational writes.
- Partner operators can use existing operational policies but cannot manage organization settings or membership.
- Partner owners/admins can manage assigned organizations through the existing management policies.
- New partner and department tables have RLS enabled before browser access is granted.

## Backfill and rollback posture

The migration is forward-only and additive:

- creates `channel_partners`, `partner_memberships`, `departments`, and `department_memberships`;
- adds `organizations.channel_partner_id` with a safe default and foreign key;
- seeds/backfills the direct partner and default departments;
- replaces existing organization access helpers so partner roles flow into current RLS policies;
- adds no destructive table, column, or row operation.

If application rollout must pause, the new records and column can remain unused without changing the current dashboard or voice runtime. A destructive schema rollback is neither required nor recommended.

## Explicit non-goals for this slice

These were intentionally excluded from this first slice. The later routing-identity contract is tracked separately in `docs/COMMERCIAL_ROUTING_FOUNDATION.md`.

- Partner branding, custom domains, rate cards, or wholesale billing.
- Partner-facing UI and support impersonation.
- Location or department switching in the dashboard.
- Queues, transfer targets, employee directory, or agent assignments.
- Department-scoping existing phone numbers, calls, tasks, requests, knowledge, or reports.
- Applying the migration to production without a database-capable verification/deployment path.

## Acceptance criteria

- Migration contains no table/column drops, truncation, or row deletion.
- Existing organizations receive the direct partner and retain their IDs.
- Existing and new locations have exactly one default General Reception department.
- Non-platform users cannot unset, move, or restrict that default department.
- Existing organization owners/admins/managers/staff retain their current inherited access.
- Partner role capabilities match the matrix above.
- A customer organization user cannot change `channel_partner_id`.
- New tables and helper functions are represented in the checked-in Supabase types and schema/RLS snapshots.
- Current tenant bootstrap tests, auth tests, all application tests, typecheck, lint, and builds remain green.

The follow-on production role evidence is now executable through `npm run check:commercial-role-matrix`. Its isolated fixture and the passing organization/department capability matrix are documented in `docs/COMMERCIAL_ROLE_MATRIX_VERIFICATION.md`.
