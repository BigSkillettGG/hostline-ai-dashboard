# Auth and RLS Setup

HostLine supports two dashboard auth modes:

- `VITE_AUTH_MODE=demo`: local demo auth in `localStorage`. This is the Lovable-friendly mode.
- `VITE_AUTH_MODE=supabase`: Supabase email/password auth. Dashboard REST calls send the user's Supabase access token as the `Authorization` bearer token so RLS policies apply.

## Production Setup

1. Run `docs/supabase-schema.sql`.
2. Run `docs/supabase-rls.sql`.
3. Create Supabase Auth users.
4. Insert organization memberships:

```sql
insert into user_memberships (user_id, organization_id, role)
values ('<auth-user-id>', '<organization-id>', 'owner');
```

Include `member_name` and `member_email` when creating memberships if you want the dashboard team page to show readable names without querying Supabase Auth admin APIs:

```sql
insert into user_memberships (user_id, organization_id, role, member_name, member_email)
values ('<auth-user-id>', '<organization-id>', 'admin', 'Maria Lombardi', 'maria@example.com');
```

5. Team invitations are stored in `team_invitations`. The dashboard can create pending invitations when the signed-in user is an `owner` or `admin`; a backend worker should send the email invite and create the final Supabase Auth user plus membership after acceptance.

6. Insert HostLine internal staff as platform admins only when needed:

```sql
insert into platform_admins (user_id)
values ('<hostline-staff-auth-user-id>');
```

7. Set frontend environment variables:

```bash
VITE_AUTH_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_DEMO_LOCATION_ID=<location-id-for-current-single-location-ui>
```

The voice service should continue to use `SUPABASE_SECRET_KEY` from the backend only. Do not expose the service-role key to the browser.

## Role Model

- `owner` and `admin`: manage organization settings, locations, onboarding, phone numbers, menu, integrations, and routing.
- `manager`: operate the restaurant workflow and manage most location content.
- `staff`: operate calls, orders, reservations, and tasks.
- `platform_admins`: HostLine internal support access across tenants.
- Demo access is not a database role. It is a local seeded workspace for sales walkthroughs and Lovable/local development.

The current UI still has a single active location selector driven by `VITE_SUPABASE_DEMO_LOCATION_ID`; the RLS policies are multi-tenant-ready while the location switcher becomes production-backed in a later slice.
