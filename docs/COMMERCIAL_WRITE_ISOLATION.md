# Commercial Production Write-Isolation Gate

Status: passing customer-to-customer production gate; partner-role coverage remains pending

## Purpose

`npm run check:commercial-write-isolation` verifies that one authenticated customer cannot update another customer's commercial hierarchy, routing, number, or telephony-account rows.

The verifier authenticates as each of the six production demo customers, rotates each identity against the next customer, and sends representation-returning `PATCH` requests for:

- the shared channel partner, which a customer may read but must not administer;
- the target organization and location;
- the target default department and queue;
- a target phone number and primary observed route; and
- the telephony account referenced by the target phone number.

Each request reuses the row's current value. Correct RLS either rejects the request or returns an empty row array. A returned row means the attacker could write the target and fails the gate. The script does not insert or delete data.

## Passing production evidence

On 2026-08-06 all six demo identities passed all eight boundaries, for 48 denied write probes. No probe returned a writable row, so no business data changed.

This complements the read-only `npm run check:commercial-telephony` gate. It does not replace migration contract tests or prove every role path.

Repository verification after this slice is green at 99 test files / 599 tests, TypeScript, lint with zero errors and eight pre-existing warnings, the read-only six-tenant production gate, and whitespace validation.

## Remaining authorization coverage

- Provision a controlled channel-partner owner/admin identity with at least two customer organizations.
- Prove allowed partner administration inside that partner and denied writes outside it.
- Add organization-role and department-role positive/negative write matrices.
- Add controlled insert and delete coverage using disposable fixtures or rollback-capable database tests.
- Add immutable, attributable platform support-session audit before cross-tenant support access is exposed.

Run this gate after commercial RLS, hierarchy, routing, telephony, or workspace-scope changes. A failure is a production stop condition.
