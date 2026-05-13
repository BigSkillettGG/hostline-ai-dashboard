-- SignalHost production RLS policies.
-- Run after docs/supabase-schema.sql.
-- Browser clients should use a Supabase Auth JWT; the voice service should keep using SUPABASE_SECRET_KEY.

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.organization_role(target_organization_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.user_memberships
  where user_id = auth.uid()
    and organization_id = target_organization_id
  order by case role
    when 'owner' then 1
    when 'admin' then 2
    when 'manager' then 3
    else 4
  end
  limit 1;
$$;

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.organization_role(target_organization_id) is not null;
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.organization_role(target_organization_id) in ('owner', 'admin');
$$;

create or replace function public.can_operate_organization(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.organization_role(target_organization_id) in ('owner', 'admin', 'manager', 'staff');
$$;

create or replace function public.location_organization_id(target_location_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.locations
  where id = target_location_id;
$$;

create or replace function public.can_access_location(target_location_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_access_organization(public.location_organization_id(target_location_id));
$$;

create or replace function public.can_manage_location(target_location_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_manage_organization(public.location_organization_id(target_location_id));
$$;

create or replace function public.can_operate_location(target_location_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_operate_organization(public.location_organization_id(target_location_id));
$$;

create or replace function public.call_location_id(target_call_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id
  from public.calls
  where id = target_call_id;
$$;

create or replace function public.order_location_id(target_order_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id
  from public.orders
  where id = target_order_id;
$$;

create or replace function public.menu_category_location_id(target_category_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id
  from public.menu_categories
  where id = target_category_id;
$$;

alter table organizations enable row level security;
alter table user_memberships enable row level security;
alter table team_invitations enable row level security;
alter table platform_admins enable row level security;
alter table locations enable row level security;
alter table business_contacts enable row level security;
alter table agent_configs enable row level security;
alter table alert_routing_configs enable row level security;
alter table staff_alert_events enable row level security;
alter table knowledge_sections enable row level security;
alter table business_live_settings enable row level security;
alter table business_live_updates enable row level security;
alter table owner_reports enable row level security;
alter table faqs enable row level security;
alter table onboarding_profiles enable row level security;
alter table billing_accounts enable row level security;
alter table business_links enable row level security;
alter table phone_numbers enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_sources enable row level security;
alter table ingestion_jobs enable row level security;
alter table calls enable row level security;
alter table transcript_turns enable row level security;
alter table call_feedback enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_delivery_attempts enable row level security;
alter table reservations enable row level security;
alter table customer_requests enable row level security;
alter table integration_connections enable row level security;
alter table staff_tasks enable row level security;

create policy organizations_select_members on organizations
for select to authenticated
using (public.can_access_organization(id));

create policy organizations_update_admins on organizations
for update to authenticated
using (public.can_manage_organization(id))
with check (public.can_manage_organization(id));

create policy organizations_delete_admins on organizations
for delete to authenticated
using (public.can_manage_organization(id));

create policy user_memberships_select_org on user_memberships
for select to authenticated
using (user_id = auth.uid() or public.can_manage_organization(organization_id) or public.is_platform_admin());

create policy user_memberships_insert_admins on user_memberships
for insert to authenticated
with check (public.can_manage_organization(organization_id));

create policy user_memberships_update_admins on user_memberships
for update to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create policy user_memberships_delete_admins on user_memberships
for delete to authenticated
using (public.can_manage_organization(organization_id));

create policy team_invitations_select_admins on team_invitations
for select to authenticated
using (public.can_manage_organization(organization_id) or public.is_platform_admin());

create policy team_invitations_insert_admins on team_invitations
for insert to authenticated
with check (public.can_manage_organization(organization_id));

create policy team_invitations_update_admins on team_invitations
for update to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create policy team_invitations_delete_admins on team_invitations
for delete to authenticated
using (public.can_manage_organization(organization_id));

create policy platform_admins_select_self on platform_admins
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy platform_admins_manage_platform on platform_admins
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy locations_select_members on locations
for select to authenticated
using (public.can_access_location(id));

create policy locations_insert_admins on locations
for insert to authenticated
with check (public.can_manage_organization(organization_id));

create policy locations_update_admins on locations
for update to authenticated
using (public.can_manage_location(id))
with check (public.can_manage_organization(organization_id));

create policy locations_delete_admins on locations
for delete to authenticated
using (public.can_manage_location(id));

create policy business_contacts_read on business_contacts
for select to authenticated
using (public.can_access_location(location_id));

create policy business_contacts_manage on business_contacts
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy direct_location_read on agent_configs
for select to authenticated
using (public.can_access_location(location_id));

create policy direct_location_manage on agent_configs
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy alert_routing_read on alert_routing_configs
for select to authenticated
using (public.can_access_location(location_id));

create policy alert_routing_manage on alert_routing_configs
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy knowledge_read on knowledge_sections
for select to authenticated
using (public.can_access_location(location_id));

create policy knowledge_manage on knowledge_sections
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy business_live_settings_read on business_live_settings
for select to authenticated
using (public.can_access_location(location_id));

create policy business_live_settings_manage on business_live_settings
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy business_live_updates_read on business_live_updates
for select to authenticated
using (public.can_access_location(location_id));

create policy business_live_updates_manage on business_live_updates
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy owner_reports_read on owner_reports
for select to authenticated
using (public.can_access_location(location_id));

create policy owner_reports_manage on owner_reports
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy faqs_read on faqs
for select to authenticated
using (public.can_access_location(location_id));

create policy faqs_manage on faqs
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy onboarding_read on onboarding_profiles
for select to authenticated
using (public.can_access_location(location_id));

create policy onboarding_manage on onboarding_profiles
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy billing_accounts_read on billing_accounts
for select to authenticated
using (public.can_access_organization(organization_id));

create policy billing_accounts_manage on billing_accounts
for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create policy business_links_read on business_links
for select to authenticated
using (public.can_access_location(location_id));

create policy business_links_manage on business_links
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy phone_numbers_read on phone_numbers
for select to authenticated
using (public.can_access_location(location_id));

create policy phone_numbers_manage on phone_numbers
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy menu_categories_read on menu_categories
for select to authenticated
using (public.can_access_location(location_id));

create policy menu_categories_manage on menu_categories
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy menu_items_read on menu_items
for select to authenticated
using (public.can_access_location(public.menu_category_location_id(category_id)));

create policy menu_items_manage on menu_items
for all to authenticated
using (public.can_manage_location(public.menu_category_location_id(category_id)))
with check (public.can_manage_location(public.menu_category_location_id(category_id)));

create policy menu_sources_read on menu_sources
for select to authenticated
using (public.can_access_location(location_id));

create policy menu_sources_manage on menu_sources
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy ingestion_jobs_read on ingestion_jobs
for select to authenticated
using (public.can_access_location(location_id));

create policy ingestion_jobs_manage on ingestion_jobs
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy calls_read on calls
for select to authenticated
using (public.can_access_location(location_id));

create policy calls_update_operators on calls
for update to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));

create policy transcript_turns_read on transcript_turns
for select to authenticated
using (public.can_access_location(public.call_location_id(call_id)));

create policy call_feedback_read on call_feedback
for select to authenticated
using (public.can_access_location(location_id));

create policy call_feedback_operate on call_feedback
for all to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));

create policy orders_read on orders
for select to authenticated
using (public.can_access_location(location_id));

create policy orders_operate on orders
for all to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));

create policy order_items_read on order_items
for select to authenticated
using (public.can_access_location(public.order_location_id(order_id)));

create policy order_items_operate on order_items
for all to authenticated
using (public.can_operate_location(public.order_location_id(order_id)))
with check (public.can_operate_location(public.order_location_id(order_id)));

create policy order_delivery_attempts_read on order_delivery_attempts
for select to authenticated
using (public.can_access_location(public.order_location_id(order_id)));

create policy order_delivery_attempts_operate on order_delivery_attempts
for all to authenticated
using (public.can_operate_location(public.order_location_id(order_id)))
with check (public.can_operate_location(public.order_location_id(order_id)));

create policy reservations_read on reservations
for select to authenticated
using (public.can_access_location(location_id));

create policy reservations_operate on reservations
for all to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));

create policy customer_requests_read on customer_requests
for select to authenticated
using (public.can_access_location(location_id));

create policy customer_requests_operate on customer_requests
for all to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));

create policy integration_connections_read on integration_connections
for select to authenticated
using (public.can_access_location(location_id));

create policy integration_connections_manage on integration_connections
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy staff_tasks_read on staff_tasks
for select to authenticated
using (public.can_access_location(location_id));

create policy staff_tasks_operate on staff_tasks
for all to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));

create policy staff_alert_events_read on staff_alert_events
for select to authenticated
using (public.can_access_location(location_id));
