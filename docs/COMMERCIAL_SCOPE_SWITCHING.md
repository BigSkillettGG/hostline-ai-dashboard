# Commercial Scope Switching

## Purpose

This Phase 1 slice turns the existing header location placeholder into an authenticated workspace selector without creating a second tenant model or changing voice routing.

The selector follows the commercial hierarchy already enforced by Supabase:

`SignalHost platform -> channel partner -> customer organization -> location/rooftop`

Department switching remains a later slice.

## Source of truth

- Supabase Auth supplies the signed-in identity and bearer token.
- `platform_admins`, `partner_memberships`, and `user_memberships` establish platform, partner, and customer roles.
- The live tenant directory reads `channel_partners`, `organizations`, and `locations` under that bearer token.
- RLS decides which organizations and locations appear. The client does not synthesize access or send a privileged key.
- The selected `activePartnerId`, `activeOrganizationId`, and `activeLocationId` are local navigation context only. Changing them does not grant database access.

## Role behavior

- SignalHost platform admins can enter any RLS-visible customer location from the existing super console and switch among visible customer workspaces.
- Partner users hydrate their partner memberships at sign-in, enter the first RLS-visible customer location, and can switch among locations visible through their partner role.
- Customer users can switch among locations and organizations already visible through their organization memberships.
- The displayed customer and partner role is recalculated for the selected scope so a role from one organization/partner is never carried into another.

## Compatibility and safety

- Existing single-location customer sessions continue to select their current location.
- Demo workspaces continue to use the existing seeded demo model.
- Switching invalidates dashboard queries so active views refetch under the new scope.
- Voice assistants, phone numbers, webhooks, prompts, models, tools, Vapi assignments, `number_routes`, and runtime routing are unchanged.
- The selector shows only live RLS-visible directory rows. It does not silently add sample tenants to authenticated production results.

## Deliberately unfinished

- Partner creation, branding, invitations, and billing administration.
- Department-level context switching.
- A dedicated partner landing page and aggregate partner reporting.
- Support impersonation audit records and time-limited support sessions.
- Executable write-denial coverage for every partner/customer role.
