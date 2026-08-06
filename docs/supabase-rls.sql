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

create or replace function public.partner_role(target_partner_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.partner_memberships
  where user_id = auth.uid()
    and partner_id = target_partner_id
  order by case role
    when 'owner' then 1
    when 'admin' then 2
    when 'operator' then 3
    else 4
  end
  limit 1;
$$;

create or replace function public.organization_partner_id(target_organization_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select channel_partner_id
  from public.organizations
  where id = target_organization_id;
$$;

create or replace function public.can_access_partner(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.partner_role(target_partner_id) is not null
    or exists (
      select 1
      from public.user_memberships
      join public.organizations
        on organizations.id = user_memberships.organization_id
      where user_memberships.user_id = auth.uid()
        and organizations.channel_partner_id = target_partner_id
    );
$$;

create or replace function public.can_manage_partner(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.partner_role(target_partner_id) in ('owner', 'admin');
$$;

create or replace function public.can_operate_partner(target_partner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.partner_role(target_partner_id) in ('owner', 'admin', 'operator');
$$;

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.organization_role(target_organization_id) is not null
    or public.partner_role(public.organization_partner_id(target_organization_id)) is not null;
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.organization_role(target_organization_id) in ('owner', 'admin')
    or public.partner_role(public.organization_partner_id(target_organization_id)) in ('owner', 'admin');
$$;

create or replace function public.can_operate_organization(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.organization_role(target_organization_id) in ('owner', 'admin', 'manager', 'staff')
    or public.partner_role(public.organization_partner_id(target_organization_id)) in ('owner', 'admin', 'operator');
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

create or replace function public.department_location_id(target_department_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id
  from public.departments
  where id = target_department_id;
$$;

create or replace function public.department_access_mode(target_department_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select access_mode
  from public.departments
  where id = target_department_id;
$$;

create or replace function public.department_role(target_department_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.department_memberships
  where user_id = auth.uid()
    and department_id = target_department_id
  order by case role
    when 'manager' then 1
    when 'agent' then 2
    else 3
  end
  limit 1;
$$;

create or replace function public.can_access_department(target_department_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.can_manage_location(public.department_location_id(target_department_id))
    or public.department_role(target_department_id) is not null
    or (
      public.department_access_mode(target_department_id) = 'inherit_location'
      and public.can_access_location(public.department_location_id(target_department_id))
    );
$$;

create or replace function public.can_manage_department(target_department_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.can_manage_location(public.department_location_id(target_department_id))
    or public.department_role(target_department_id) = 'manager';
$$;

create or replace function public.can_operate_department(target_department_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.can_manage_location(public.department_location_id(target_department_id))
    or public.department_role(target_department_id) in ('manager', 'agent')
    or (
      public.department_access_mode(target_department_id) = 'inherit_location'
      and public.can_operate_location(public.department_location_id(target_department_id))
    );
$$;

create or replace function public.queue_department_id(target_queue_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select department_id
  from public.queues
  where id = target_queue_id;
$$;

create or replace function public.user_has_location_affiliation(target_user_id uuid, target_location_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = target_user_id
  )
  or exists (
    select 1
    from public.locations
    join public.user_memberships
      on user_memberships.organization_id = locations.organization_id
    where locations.id = target_location_id
      and user_memberships.user_id = target_user_id
  )
  or exists (
    select 1
    from public.departments
    join public.department_memberships
      on department_memberships.department_id = departments.id
    where departments.location_id = target_location_id
      and department_memberships.user_id = target_user_id
  )
  or exists (
    select 1
    from public.locations
    join public.organizations
      on organizations.id = locations.organization_id
    join public.partner_memberships
      on partner_memberships.partner_id = organizations.channel_partner_id
    where locations.id = target_location_id
      and partner_memberships.user_id = target_user_id
  );
$$;

create or replace function public.can_access_queue(target_queue_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.can_access_department(public.queue_department_id(target_queue_id))
    or exists (
      select 1
      from public.queue_members
      join public.staff_directory_entries
        on staff_directory_entries.id = queue_members.staff_directory_entry_id
      where queue_members.queue_id = target_queue_id
        and queue_members.status = 'active'
        and staff_directory_entries.status = 'active'
        and staff_directory_entries.user_id = auth.uid()
        and public.user_has_location_affiliation(auth.uid(), staff_directory_entries.location_id)
    );
$$;

create or replace function public.can_manage_queue(target_queue_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.can_manage_department(public.queue_department_id(target_queue_id));
$$;

create or replace function public.can_operate_queue(target_queue_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or public.can_operate_department(public.queue_department_id(target_queue_id))
    or exists (
      select 1
      from public.queue_members
      join public.staff_directory_entries
        on staff_directory_entries.id = queue_members.staff_directory_entry_id
      where queue_members.queue_id = target_queue_id
        and queue_members.status = 'active'
        and staff_directory_entries.status = 'active'
        and staff_directory_entries.user_id = auth.uid()
        and public.user_has_location_affiliation(auth.uid(), staff_directory_entries.location_id)
    );
$$;

create or replace function public.can_access_staff_directory_entry(target_staff_directory_entry_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.staff_directory_entries
      where id = target_staff_directory_entry_id
        and (
          user_id = auth.uid()
          and public.user_has_location_affiliation(auth.uid(), location_id)
          or (
            primary_department_id is null
            and public.can_access_location(location_id)
          )
          or (
            primary_department_id is not null
            and public.can_access_department(primary_department_id)
          )
        )
    )
    or exists (
      select 1
      from public.queue_members
      where staff_directory_entry_id = target_staff_directory_entry_id
        and status = 'active'
        and public.can_access_queue(queue_id)
    );
$$;

create or replace function public.can_manage_staff_directory_entry(target_staff_directory_entry_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.staff_directory_entries
      where id = target_staff_directory_entry_id
        and (
          (
            primary_department_id is null
            and public.can_manage_location(location_id)
          )
          or (
            primary_department_id is not null
            and public.can_manage_department(primary_department_id)
          )
        )
    );
$$;

create or replace function public.protect_organization_partner_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel_partner_id is distinct from old.channel_partner_id
    and auth.uid() is not null
    and not public.is_platform_admin()
  then
    raise exception 'Only SignalHost platform operations can reassign an organization to a channel partner.';
  end if;

  return new;
end;
$$;

create trigger organizations_protect_partner_assignment
before update of channel_partner_id on public.organizations
for each row execute function public.protect_organization_partner_assignment();

create or replace function public.protect_default_department_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default
    and auth.uid() is not null
    and not public.is_platform_admin()
    and (
      not new.is_default
      or new.location_id is distinct from old.location_id
      or new.access_mode <> 'inherit_location'
    )
  then
    raise exception 'The default department must remain assigned to its location with inherited access.';
  end if;

  return new;
end;
$$;

create trigger departments_protect_default_contract
before update of is_default, location_id, access_mode on public.departments
for each row execute function public.protect_default_department_contract();

create or replace function public.protect_default_queue_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default
    and auth.uid() is not null
    and not public.is_platform_admin()
    and (
      not new.is_default
      or new.department_id is distinct from old.department_id
    )
  then
    raise exception 'The default queue must remain assigned to its department.';
  end if;

  return new;
end;
$$;

create trigger queues_protect_default_contract
before update of is_default, department_id on public.queues
for each row execute function public.protect_default_queue_contract();

create or replace function public.protect_transfer_target_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('verified', 'active')
      or new.verified_at is not null
      or new.verified_by is not null
    then
      raise exception 'Transfer target verification must be recorded by a SignalHost verification service.';
    end if;

    return new;
  end if;

  if new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or (
      new.status in ('verified', 'active')
      and old.status not in ('verified', 'active')
    )
    or (
      old.status in ('verified', 'active')
      and new.status in ('verified', 'active')
      and (
        new.department_id is distinct from old.department_id
        or new.target_kind is distinct from old.target_kind
        or new.queue_id is distinct from old.queue_id
        or new.staff_directory_entry_id is distinct from old.staff_directory_entry_id
        or new.destination is distinct from old.destination
        or new.provider_key is distinct from old.provider_key
        or new.external_id is distinct from old.external_id
        or new.supports_live_transfer is distinct from old.supports_live_transfer
        or new.supports_callback is distinct from old.supports_callback
        or new.settings is distinct from old.settings
      )
    )
  then
    raise exception 'Transfer target verification must be recorded by a SignalHost verification service.';
  end if;

  return new;
end;
$$;

create trigger transfer_targets_protect_verification
before insert or update on public.transfer_targets
for each row execute function public.protect_transfer_target_verification();

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
alter table knowledge_suggestions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_delivery_attempts enable row level security;
alter table reservations enable row level security;
alter table customer_requests enable row level security;
alter table integration_connections enable row level security;
alter table staff_tasks enable row level security;
alter table channel_partners enable row level security;
alter table partner_memberships enable row level security;
alter table departments enable row level security;
alter table department_memberships enable row level security;
alter table staff_directory_entries enable row level security;
alter table queues enable row level security;
alter table queue_members enable row level security;
alter table transfer_targets enable row level security;

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

create policy channel_partners_select_accessible on channel_partners
for select to authenticated
using (public.can_access_partner(id));

create policy channel_partners_insert_platform on channel_partners
for insert to authenticated
with check (public.is_platform_admin());

create policy channel_partners_update_managers on channel_partners
for update to authenticated
using (public.can_manage_partner(id))
with check (public.can_manage_partner(id));

create policy channel_partners_delete_platform on channel_partners
for delete to authenticated
using (public.is_platform_admin() and not is_internal);

create policy partner_memberships_select_accessible on partner_memberships
for select to authenticated
using (user_id = auth.uid() or public.can_manage_partner(partner_id));

create policy partner_memberships_insert_managers on partner_memberships
for insert to authenticated
with check (public.can_manage_partner(partner_id));

create policy partner_memberships_update_managers on partner_memberships
for update to authenticated
using (public.can_manage_partner(partner_id))
with check (public.can_manage_partner(partner_id));

create policy partner_memberships_delete_managers on partner_memberships
for delete to authenticated
using (public.can_manage_partner(partner_id));

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

create policy departments_select_accessible on departments
for select to authenticated
using (public.can_access_department(id));

create policy departments_insert_location_managers on departments
for insert to authenticated
with check (public.can_manage_location(location_id));

create policy departments_update_location_managers on departments
for update to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create policy departments_delete_location_managers on departments
for delete to authenticated
using (public.can_manage_location(location_id) and not is_default);

create policy department_memberships_select_accessible on department_memberships
for select to authenticated
using (user_id = auth.uid() or public.can_manage_department(department_id));

create policy department_memberships_insert_managers on department_memberships
for insert to authenticated
with check (public.can_manage_department(department_id));

create policy department_memberships_update_managers on department_memberships
for update to authenticated
using (public.can_manage_department(department_id))
with check (public.can_manage_department(department_id));

create policy department_memberships_delete_managers on department_memberships
for delete to authenticated
using (public.can_manage_department(department_id));

create policy staff_directory_entries_select_accessible on staff_directory_entries
for select to authenticated
using (public.can_access_staff_directory_entry(id));

create policy staff_directory_entries_insert_managers on staff_directory_entries
for insert to authenticated
with check (
  (
    primary_department_id is null
    and public.can_manage_location(location_id)
  )
  or (
    primary_department_id is not null
    and public.can_manage_department(primary_department_id)
  )
);

create policy staff_directory_entries_update_managers on staff_directory_entries
for update to authenticated
using (public.can_manage_staff_directory_entry(id))
with check (
  (
    primary_department_id is null
    and public.can_manage_location(location_id)
  )
  or (
    primary_department_id is not null
    and public.can_manage_department(primary_department_id)
  )
);

create policy staff_directory_entries_delete_managers on staff_directory_entries
for delete to authenticated
using (public.can_manage_staff_directory_entry(id));

create policy queues_select_accessible on queues
for select to authenticated
using (public.can_access_queue(id));

create policy queues_insert_department_managers on queues
for insert to authenticated
with check (public.can_manage_department(department_id));

create policy queues_update_department_managers on queues
for update to authenticated
using (public.can_manage_queue(id))
with check (public.can_manage_department(department_id));

create policy queues_delete_department_managers on queues
for delete to authenticated
using (public.can_manage_queue(id) and not is_default);

create policy queue_members_select_accessible on queue_members
for select to authenticated
using (public.can_access_queue(queue_id));

create policy queue_members_insert_managers on queue_members
for insert to authenticated
with check (public.can_manage_queue(queue_id));

create policy queue_members_update_managers on queue_members
for update to authenticated
using (public.can_manage_queue(queue_id))
with check (public.can_manage_queue(queue_id));

create policy queue_members_delete_managers on queue_members
for delete to authenticated
using (public.can_manage_queue(queue_id));

create policy transfer_targets_select_accessible on transfer_targets
for select to authenticated
using (
  public.can_access_department(department_id)
  or (queue_id is not null and public.can_access_queue(queue_id))
);

create policy transfer_targets_insert_managers on transfer_targets
for insert to authenticated
with check (public.can_manage_department(department_id));

create policy transfer_targets_update_managers on transfer_targets
for update to authenticated
using (public.can_manage_department(department_id))
with check (public.can_manage_department(department_id));

create policy transfer_targets_delete_managers on transfer_targets
for delete to authenticated
using (public.can_manage_department(department_id));

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

create policy knowledge_suggestions_read on knowledge_suggestions
for select to authenticated
using (public.can_access_location(location_id));

create policy knowledge_suggestions_manage on knowledge_suggestions
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

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

grant select, insert, update, delete on channel_partners to authenticated;
grant select, insert, update, delete on partner_memberships to authenticated;
grant select, insert, update, delete on departments to authenticated;
grant select, insert, update, delete on department_memberships to authenticated;
grant select, insert, update, delete on staff_directory_entries to authenticated;
grant select, insert, update, delete on queues to authenticated;
grant select, insert, update, delete on queue_members to authenticated;
grant select, insert, update, delete on transfer_targets to authenticated;

grant all on channel_partners to service_role;
grant all on partner_memberships to service_role;
grant all on departments to service_role;
grant all on department_memberships to service_role;
grant all on staff_directory_entries to service_role;
grant all on queues to service_role;
grant all on queue_members to service_role;
grant all on transfer_targets to service_role;

create or replace function public.can_access_telephony_account(target_telephony_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.telephony_accounts
      where id = target_telephony_account_id
        and (
          public.partner_role(channel_partner_id) is not null
          or (organization_id is not null and public.can_access_organization(organization_id))
          or (location_id is not null and public.can_access_location(location_id))
        )
    );
$$;

create or replace function public.can_manage_telephony_account(target_telephony_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.telephony_accounts
      where id = target_telephony_account_id
        and resource_owner = 'partner'
        and public.partner_role(channel_partner_id) in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.telephony_accounts
      where id = target_telephony_account_id
        and resource_owner = 'customer'
        and (
          public.partner_role(channel_partner_id) in ('owner', 'admin')
          or (location_id is not null and public.can_manage_location(location_id))
          or (
            location_id is null
            and organization_id is not null
            and public.can_manage_organization(organization_id)
          )
        )
    );
$$;

create or replace function public.phone_number_location_id(target_phone_number_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id from public.phone_numbers where id = target_phone_number_id;
$$;

create or replace function public.number_route_department_id(target_number_route_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select department_id from public.number_routes where id = target_number_route_id;
$$;

create or replace function public.number_route_phone_number_id(target_number_route_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select phone_number_id from public.number_routes where id = target_number_route_id;
$$;

create or replace function public.can_access_number_route(target_number_route_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.can_access_location(
        public.phone_number_location_id(
          public.number_route_phone_number_id(target_number_route_id)
        )
      )
      and public.can_access_department(public.number_route_department_id(target_number_route_id))
    );
$$;

create or replace function public.can_manage_number_route(target_number_route_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_platform_admin()
    or (
      public.can_manage_location(
        public.phone_number_location_id(
          public.number_route_phone_number_id(target_number_route_id)
        )
      )
      and public.can_manage_department(public.number_route_department_id(target_number_route_id))
    );
$$;

alter table telephony_accounts enable row level security;
alter table sip_trunks enable row level security;
alter table number_routes enable row level security;

create policy telephony_accounts_select_accessible on telephony_accounts
for select to authenticated
using (public.can_access_telephony_account(id));

create policy telephony_accounts_insert_owners on telephony_accounts
for insert to authenticated
with check (
  public.is_platform_admin()
  or (
    resource_owner = 'partner'
    and public.partner_role(channel_partner_id) in ('owner', 'admin')
  )
  or (
    resource_owner = 'customer'
    and (
      public.partner_role(channel_partner_id) in ('owner', 'admin')
      or (location_id is not null and public.can_manage_location(location_id))
      or (
        location_id is null
        and organization_id is not null
        and public.can_manage_organization(organization_id)
      )
    )
  )
);

create policy telephony_accounts_update_owners on telephony_accounts
for update to authenticated
using (public.can_manage_telephony_account(id))
with check (
  public.is_platform_admin()
  or (
    resource_owner = 'partner'
    and public.partner_role(channel_partner_id) in ('owner', 'admin')
  )
  or (
    resource_owner = 'customer'
    and (
      public.partner_role(channel_partner_id) in ('owner', 'admin')
      or (location_id is not null and public.can_manage_location(location_id))
      or (
        location_id is null
        and organization_id is not null
        and public.can_manage_organization(organization_id)
      )
    )
  )
);

create policy telephony_accounts_delete_owners on telephony_accounts
for delete to authenticated
using (public.can_manage_telephony_account(id));

create policy sip_trunks_select_accessible on sip_trunks
for select to authenticated
using (public.can_access_telephony_account(telephony_account_id));

create policy sip_trunks_insert_owners on sip_trunks
for insert to authenticated
with check (public.can_manage_telephony_account(telephony_account_id));

create policy sip_trunks_update_owners on sip_trunks
for update to authenticated
using (public.can_manage_telephony_account(telephony_account_id))
with check (public.can_manage_telephony_account(telephony_account_id));

create policy sip_trunks_delete_owners on sip_trunks
for delete to authenticated
using (public.can_manage_telephony_account(telephony_account_id) and not runtime_enforced);

create policy number_routes_select_accessible on number_routes
for select to authenticated
using (public.can_access_number_route(id));

create policy number_routes_insert_managers on number_routes
for insert to authenticated
with check (
  public.can_manage_location(public.phone_number_location_id(phone_number_id))
  and public.can_manage_department(department_id)
);

create policy number_routes_update_managers on number_routes
for update to authenticated
using (public.can_manage_number_route(id))
with check (
  public.can_manage_location(public.phone_number_location_id(phone_number_id))
  and public.can_manage_department(department_id)
);

create policy number_routes_delete_managers on number_routes
for delete to authenticated
using (public.can_manage_number_route(id) and status <> 'observed' and not runtime_enforced);

grant select, insert, update, delete on telephony_accounts to authenticated;
grant select, insert, update, delete on sip_trunks to authenticated;
grant select, insert, update, delete on number_routes to authenticated;

grant all on telephony_accounts to service_role;
grant all on sip_trunks to service_role;
grant all on number_routes to service_role;

-- Commercial SECURITY DEFINER privilege hardening. PostgreSQL grants function
-- execution to PUBLIC by default; internal/trigger helpers must not become
-- PostgREST RPC endpoints merely because they live in the public schema.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.set_commercial_hierarchy_updated_at()',
    'public.ensure_default_department_for_location()',
    'public.partner_role(uuid)',
    'public.organization_partner_id(uuid)',
    'public.can_access_partner(uuid)',
    'public.can_manage_partner(uuid)',
    'public.can_operate_partner(uuid)',
    'public.can_access_organization(uuid)',
    'public.can_manage_organization(uuid)',
    'public.can_operate_organization(uuid)',
    'public.department_location_id(uuid)',
    'public.department_access_mode(uuid)',
    'public.department_role(uuid)',
    'public.can_access_department(uuid)',
    'public.can_manage_department(uuid)',
    'public.can_operate_department(uuid)',
    'public.protect_organization_partner_assignment()',
    'public.protect_default_department_contract()',
    'public.user_has_location_affiliation(uuid,uuid)',
    'public.validate_staff_directory_entry_scope()',
    'public.validate_queue_member_scope()',
    'public.validate_transfer_target_scope()',
    'public.ensure_default_queue_for_department()',
    'public.protect_default_queue_contract()',
    'public.protect_transfer_target_verification()',
    'public.queue_department_id(uuid)',
    'public.can_access_queue(uuid)',
    'public.can_manage_queue(uuid)',
    'public.can_operate_queue(uuid)',
    'public.can_access_staff_directory_entry(uuid)',
    'public.can_manage_staff_directory_entry(uuid)',
    'public.normalize_telephony_provider_key(text)',
    'public.validate_telephony_account_scope()',
    'public.telephony_account_can_serve_location(uuid,uuid)',
    'public.ensure_default_telephony_account(text)',
    'public.telephony_account_provider_key(uuid)',
    'public.can_access_telephony_account(uuid)',
    'public.can_manage_telephony_account(uuid)',
    'public.validate_phone_number_telephony_account()',
    'public.validate_sip_trunk_verification()',
    'public.validate_number_route_scope()',
    'public.protect_number_route_runtime_state()',
    'public.ensure_observed_number_route()',
    'public.phone_number_location_id(uuid)',
    'public.number_route_department_id(uuid)',
    'public.number_route_phone_number_id(uuid)',
    'public.can_access_number_route(uuid)',
    'public.can_manage_number_route(uuid)'
  ]
  loop
    execute format('revoke all privileges on function %s from public, anon, authenticated', function_signature);
    execute format('grant execute on function %s to service_role', function_signature);
  end loop;
end;
$$;

grant execute on function public.partner_role(uuid) to authenticated;
grant execute on function public.can_access_partner(uuid) to authenticated;
grant execute on function public.can_manage_partner(uuid) to authenticated;
grant execute on function public.can_operate_partner(uuid) to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_operate_organization(uuid) to authenticated;
grant execute on function public.can_access_department(uuid) to authenticated;
grant execute on function public.can_manage_department(uuid) to authenticated;
grant execute on function public.can_operate_department(uuid) to authenticated;
grant execute on function public.can_access_queue(uuid) to authenticated;
grant execute on function public.can_manage_queue(uuid) to authenticated;
grant execute on function public.can_operate_queue(uuid) to authenticated;
grant execute on function public.can_access_staff_directory_entry(uuid) to authenticated;
grant execute on function public.can_manage_staff_directory_entry(uuid) to authenticated;
grant execute on function public.can_access_telephony_account(uuid) to authenticated;
grant execute on function public.can_manage_telephony_account(uuid) to authenticated;
grant execute on function public.phone_number_location_id(uuid) to authenticated;
grant execute on function public.can_access_number_route(uuid) to authenticated;
grant execute on function public.can_manage_number_route(uuid) to authenticated;
