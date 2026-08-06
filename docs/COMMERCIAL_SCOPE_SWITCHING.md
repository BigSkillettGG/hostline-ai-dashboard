# Commercial Scope Switching

## Purpose

This Phase 1 slice turns the existing header location placeholder into an authenticated workspace selector without creating a second tenant model or changing voice routing.

The selector follows the commercial hierarchy already enforced by Supabase:

`SignalHost platform -> channel partner -> customer organization -> location/rooftop -> department`

## Source of truth

- Supabase Auth supplies the signed-in identity and bearer token.
- `platform_admins`, `partner_memberships`, and `user_memberships` establish platform, partner, and customer roles.
- The live tenant directory reads `channel_partners`, `organizations`, and `locations` under that bearer token. The department directory reads active `departments` for the selected location under the same token.
- RLS decides which organizations, locations, and departments appear. The client does not synthesize access or send a privileged key.
- The selected `activePartnerId`, `activeOrganizationId`, `activeLocationId`, and `activeDepartmentId` are local navigation context only. Changing them does not grant database access.

## Role behavior

- SignalHost platform admins can enter any RLS-visible customer location from the existing super console and switch among visible customer workspaces.
- Partner users hydrate their partner memberships at sign-in, enter the first RLS-visible customer location, and can switch among locations visible through their partner role.
- Customer users can switch among locations and organizations already visible through their organization memberships.
- For each selected location, the selector keeps a still-visible active department or chooses the RLS-visible default department, then the first active department. A stale department ID is cleared whenever the location changes.
- The displayed customer and partner role is recalculated for the selected scope so a role from one organization/partner is never carried into another.

## Compatibility and safety

- Existing single-location customer sessions continue to select their current location.
- Demo workspaces continue to use the existing seeded demo model.
- Switching invalidates dashboard queries so active views refetch under the new scope.
- Existing calls, requests, workflows, knowledge, and reporting remain location-scoped until their department ownership contracts are added. Selecting a department does not silently filter resources that do not yet carry a department ID.
- Voice assistants, phone numbers, webhooks, prompts, models, tools, Vapi assignments, `number_routes`, and runtime routing are unchanged.
- The selector shows only live RLS-visible directory rows. It does not silently add sample tenants to authenticated production results.
- Repository verification after the department-context slice is green at 99 test files / 602 tests, TypeScript, lint with zero errors and eight pre-existing warnings, the production dashboard build, and whitespace validation.
- The dashboard through commit `d6c9dc179e70ba6259820dc452d34a951c5c3628` was published to `signalhost.ai` on 2026-08-06. The live bundle contains the partner and department workspace controls and no longer contains the obsolete `second location (soon)` placeholder. Both commercial production isolation gates passed after publication.

## Deliberately unfinished

- Partner creation, branding, invitations, and billing administration.
- Department membership-role display and department-scoped resource binding.
- A dedicated partner landing page and aggregate partner reporting.
- Support impersonation audit records and time-limited support sessions.
- Executable write-denial coverage for every partner/customer role.
