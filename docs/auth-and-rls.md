# Auth and RLS Setup

SignalHost supports two dashboard auth modes:

- `VITE_AUTH_MODE=demo`: local demo auth in `localStorage`. This is the Lovable-friendly mode.
- `VITE_AUTH_MODE=supabase`: Supabase email/password auth. Dashboard REST calls send the user's Supabase access token as the `Authorization` bearer token so RLS policies apply.

## Production Setup

For a clean database, run `docs/supabase-schema.sql` and then `docs/supabase-rls.sql`. For an existing SignalHost database, apply the ordered files in `supabase/migrations/`; do not rerun the clean-install schema over live tables.

The current commercial foundation migrations are, in order:

1. `20260806010000_commercial_hierarchy_foundation.sql`;
2. `20260806020000_commercial_routing_foundation.sql`.

Applying them is a separate production database operation and must be verified through a database-capable deployment path.

After the schema is current:

1. Create Supabase Auth users.
2. Insert customer organization memberships:

```sql
insert into user_memberships (user_id, organization_id, role)
values ('<auth-user-id>', '<organization-id>', 'owner');
```

Include `member_name` and `member_email` when creating memberships if you want the dashboard team page to show readable names without querying Supabase Auth admin APIs:

```sql
insert into user_memberships (user_id, organization_id, role, member_name, member_email)
values ('<auth-user-id>', '<organization-id>', 'admin', 'Maria Lombardi', 'maria@example.com');
```

3. Team invitations are stored in `team_invitations`. The dashboard can create pending invitations when the signed-in user is an `owner` or `admin`; a backend worker should send the email invite and create the final Supabase Auth user plus membership after acceptance.

4. Insert SignalHost internal staff as platform admins only when needed:

```sql
insert into platform_admins (user_id)
values ('<signalhost-staff-auth-user-id>');
```

5. Set frontend environment variables:

```bash
VITE_AUTH_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_DEMO_LOCATION_ID=<location-id-for-current-single-location-ui>
```

The voice service should continue to use `SUPABASE_SECRET_KEY` from the backend only. Do not expose the service-role key to the browser.

## Role Model

- Platform: `platform_admins` is reserved for SignalHost internal support and platform operations across tenants.
- Partner `owner` / `admin`: manage their partner and assigned customer organizations; `operator` can operate customer work; `viewer` is read-only.
- Customer `owner` and `admin`: manage organization settings, locations, onboarding, phone numbers, integrations, and routing.
- Customer `manager`: operate customer workflows and manage most location content.
- `staff`: operate calls, orders, reservations, and tasks.
- Department `manager` / `agent` / `viewer`: explicit roles used when a department is restricted. The default `General Reception` department uses `inherit_location`, so current organization access remains unchanged.
- Queue `supervisor` / `member`: operational membership can grant access to its queue while the linked user retains base platform/partner/customer/department affiliation, but it does not grant department administration. Transfer targets remain manager-controlled and service-verified.
- Demo access is not a database role. It is a local seeded workspace for sales walkthroughs and Lovable/local development.

Every organization defaults to the deterministic `SignalHost Direct` partner and every location gets a default `General Reception` department. Customer users cannot reassign their organization to a different partner. See `docs/COMMERCIAL_HIERARCHY_FOUNDATION.md` for the complete compatibility and role contract.

The current UI still has a single active location selector driven by `VITE_SUPABASE_DEMO_LOCATION_ID`; production-backed location and department switching remains a later Phase 1 slice.
