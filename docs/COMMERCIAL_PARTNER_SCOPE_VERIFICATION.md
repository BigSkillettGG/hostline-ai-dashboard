# Commercial Partner Scope Verification

Status: production identity and RLS gate passing; authenticated empty-scope UI fix awaiting publication

## Purpose

`npm run check:commercial-partner-scope` proves that a channel-partner user can operate across multiple customer organizations inside its own partner while an unrelated partner remains unable to read or write those resources.

The gate uses two confirmed Supabase Auth identities that have no customer, department, or platform-admin memberships:

- `demo.partner@signalhost.ai`: owner of deterministic partner `SignalHost Direct` (`a0000000-0000-4000-8000-000000000001`);
- `demo.partner-control@signalhost.ai`: owner of inactive internal fixture `SignalHost Partner Isolation Control` (`a0000000-0000-4000-8000-000000000099`).

Passwords remain only in ignored local environment configuration. Do not add them to tracked files or project memory.

The control partner has no customer organizations. It exists only to supply a stable cross-partner boundary and must not be assigned live phone, provider, billing, or customer resources.

## Verification contract

The direct-partner identity must:

- receive its scope only from one `partner_memberships` owner row;
- see at least two customer organizations and locations under its own partner;
- see only departments, queues, phone numbers, number routes, telephony accounts, and SIP trunks that resolve through its visible scope;
- receive `true` from the partner and organization access/manage/operate predicates inside its partner; and
- receive no role or access to the control partner.

The control identity must:

- see only the control partner and its own membership;
- see zero organizations, locations, departments, queues, phone numbers, number routes, telephony accounts, or SIP trunks;
- receive no role or access to `SignalHost Direct`; and
- receive no writable row from current-value PATCH probes against the direct partner's established commercial boundaries.

The direct identity also sends a current-value PATCH probe against the control partner. No probe inserts, deletes, changes routing, or returns a writable cross-partner row.

Some legacy boolean helpers return SQL `NULL` when every authorization branch is absent. PostgreSQL RLS treats that as denied, so the verifier requires denied predicates to be anything other than `true`. Normalizing all authorization helpers to explicit `false` remains technical debt and is not required to prove the current boundary.

## Production evidence

On 2026-08-06 the gate passed with:

- 6 customer organizations and 6 locations;
- 6 default departments and 6 callback-only queues;
- 21 phone numbers and 21 observed/non-enforced routes;
- 2 partner-visible telephony accounts and 0 SIP trunks;
- 0 customer resources visible to the isolation partner; and
- 9 denied cross-partner current-value PATCH boundaries.

Browser verification confirmed the direct partner login displayed all six partner workspaces, exposed the default department, and successfully switched from Olive & Ember to Summit Air with the correct vertical-specific live data.

The same browser check exposed an authenticated empty-scope fallback: a valid partner with zero locations was shown the local Olive & Ember demo. The repository fix uses `requiresWorkspaceAssignment` to replace the entire app shell with an explicit `No customer workspaces assigned` state for non-platform Supabase users without an active location. Demo auth and valid customer/partner workspaces remain unchanged. Production publication and retest of that fix are required before this slice is complete.

Pre-publication repository verification passed at 100 test files / 609 tests, TypeScript, lint with zero errors and eight pre-existing warnings, the dashboard production build, whitespace validation, and all three production commercial gates.
