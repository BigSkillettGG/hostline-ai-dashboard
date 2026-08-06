# Commercial Role-Matrix Verification

Status: passing against the isolated production authorization fixture on 2026-08-06

## Purpose

`npm run check:commercial-role-matrix` verifies the positive and negative authorization contract for customer organization roles and restricted department roles. It complements the customer-to-customer and partner-to-partner isolation gates by proving what each role can do inside an organization it legitimately belongs to.

The verifier uses only the dedicated `SignalHost Authorization QA` hierarchy. It never targets a demo or customer business, creates or deletes rows, changes a route, or touches a voice configuration. Positive `PATCH` probes reuse current values; successful probes can therefore refresh only the QA fixture's `updated_at` timestamps.

## Expected capability matrix

| Persona | Organization role | Restricted department role | Organization/location access | Organization/location manage | Inherited department operate | Restricted department access | Restricted department manage | Restricted department operate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Organization owner | `owner` | none | yes | yes | yes | yes | yes | yes |
| Organization admin | `admin` | none | yes | yes | yes | yes | yes | yes |
| Organization manager | `manager` | none | yes | no | yes | no | no | no |
| Organization staff | `staff` | none | yes | no | yes | no | no | no |
| Department manager | `staff` | `manager` | yes | no | yes | yes | yes | yes |
| Department agent | `staff` | `agent` | yes | no | yes | yes | no | yes |
| Department viewer | `staff` | `viewer` | yes | no | yes | yes | no | no |

Owner and admin may manage organization, location, inherited-department, restricted-department, queue, and department-membership configuration. A restricted department manager may manage that department's queue and memberships, but not the department record or its parent location/organization. Manager, staff, department agent, and department viewer may not write configuration outside those explicit boundaries.

All seven personas may update an already-visible customer request in the QA organization. Every persona is denied reads and writes against the separate `SignalHost Direct` customer target used as the cross-partner control.

## Deterministic production fixture

- Partner: `a0000000-0000-4000-8000-000000000100`
- Organization: `b0000000-0000-4000-8000-000000000100`
- Location: `c0000000-0000-4000-8000-000000000100`
- Restricted department: `d0000000-0000-4000-8000-000000000100`
- Resolved authorization request: `f0000000-0000-4000-8000-000000000100`
- Cross-partner organization control: `0125aaa8-d9cf-41c6-814b-488bac63249e`

The default `General Reception` department and both callback-only `Primary Queue` rows are discovered through their ownership and default flags rather than relying on generated IDs.

Controlled identities:

- `qa.org-owner@signalhost.ai`
- `qa.org-admin@signalhost.ai`
- `qa.org-manager@signalhost.ai`
- `qa.org-staff@signalhost.ai`
- `qa.department-manager@signalhost.ai`
- `qa.department-agent@signalhost.ai`
- `qa.department-viewer@signalhost.ai`

The three department-role users retain an organization-level `staff` affiliation, which establishes tenant membership without granting access to a `restricted` department. They receive restricted-department capabilities only through their explicit department membership. Credentials stay in ignored local/deployment secrets and must not be committed or printed.

The fixture is intentionally inactive/internal and has no phone numbers, number routes, agent configurations, transfer targets, calls, telephony accounts, or SIP trunks. It must remain isolated from live business and voice behavior.

The command reads Supabase URL/publishable-key configuration from the standard dashboard environment and requires `SIGNALHOST_ROLE_MATRIX_PASSWORD` in ignored local configuration. Per-identity password overrides use the corresponding email-variable prefix with `_PASSWORD` in place of `_EMAIL`. Do not add any credential value to this document, source control, command output, or a browser-visible environment.

## What the gate proves

For every persona, the gate verifies:

- its own exact organization and optional department membership through RLS;
- visibility of the QA partner, organization, location, inherited department, restricted department, queues, and resolved request;
- denial of the cross-partner organization;
- public `can_access_*`, `can_manage_*`, and `can_operate_*` predicates for organization, location, department, and queue;
- current-value positive and negative `PATCH` behavior for the organization, location, inherited department, restricted department, restricted queue, department membership, and customer request; and
- cross-partner write denial.

The internal `department_role` helper is deliberately service-only after function-privilege hardening. The verifier does not weaken that boundary or call it as an authenticated user; it reads the caller's own RLS-visible membership and exercises only public policy predicates.

Some legacy SQL predicates return `NULL` when no granting branch exists. PostgreSQL RLS treats both `NULL` and `false` as denial, so the verifier requires exact `true` for allowed capabilities and treats every value other than `true` as denied. Normalizing helper return values is optional contract cleanup, not an authorization gap.

## Passing production evidence

On 2026-08-06 all seven personas passed. Owners/admins saw two departments and two queues and passed all intended configuration writes. Organization manager/staff saw only the inherited department and queue and could write only the operational request. Department manager/agent/viewer saw both departments and queues, while their manage/operate predicates and write probes matched the matrix above. Every cross-partner read and write remained denied.

Run this gate after any commercial membership, hierarchy, queue, RLS, policy-function, or workspace-scope change. A failure is a production stop condition.
