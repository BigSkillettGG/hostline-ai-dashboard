-- SignalHost Phase 1 commercial hierarchy foundation.
-- Additive only: preserves all current organization/location IDs and access.

create extension if not exists pgcrypto;

create table if not exists public.channel_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  partner_type text not null default 'channel' check (
    partner_type in ('direct', 'telecom', 'msp', 'agency', 'other')
  ),
  status text not null default 'active' check (status in ('active', 'suspended', 'inactive')),
  is_internal boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.channel_partners (
  id,
  name,
  slug,
  partner_type,
  status,
  is_internal
)
values (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'SignalHost Direct',
  'signalhost-direct',
  'direct',
  'active',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  partner_type = excluded.partner_type,
  status = excluded.status,
  is_internal = excluded.is_internal,
  updated_at = now();

create table if not exists public.partner_memberships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.channel_partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

alter table public.organizations
  add column if not exists channel_partner_id uuid
  not null
  default 'a0000000-0000-4000-8000-000000000001'::uuid
  references public.channel_partners(id) on delete restrict;

create index if not exists organizations_channel_partner_id_idx
  on public.organizations(channel_partner_id);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  slug text not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  department_type text not null default 'general_reception',
  status text not null default 'active' check (status in ('active', 'inactive')),
  access_mode text not null default 'inherit_location' check (
    access_mode in ('inherit_location', 'restricted')
  ),
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, slug)
);

create unique index if not exists departments_one_default_per_location
  on public.departments(location_id)
  where is_default;

create index if not exists departments_location_id_idx
  on public.departments(location_id);

create table if not exists public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager', 'agent', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, user_id)
);

create index if not exists department_memberships_user_id_idx
  on public.department_memberships(user_id);

create or replace function public.set_commercial_hierarchy_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists channel_partners_set_updated_at on public.channel_partners;
create trigger channel_partners_set_updated_at
before update on public.channel_partners
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists partner_memberships_set_updated_at on public.partner_memberships;
create trigger partner_memberships_set_updated_at
before update on public.partner_memberships
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists department_memberships_set_updated_at on public.department_memberships;
create trigger department_memberships_set_updated_at
before update on public.department_memberships
for each row execute function public.set_commercial_hierarchy_updated_at();

create or replace function public.ensure_default_department_for_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.departments (
    location_id,
    name,
    slug,
    department_type,
    status,
    access_mode,
    is_default
  )
  values (
    new.id,
    'General Reception',
    'general',
    'general_reception',
    'active',
    'inherit_location',
    true
  )
  on conflict (location_id, slug) do nothing;

  return new;
end;
$$;

insert into public.departments (
  location_id,
  name,
  slug,
  department_type,
  status,
  access_mode,
  is_default
)
select
  locations.id,
  'General Reception',
  'general',
  'general_reception',
  'active',
  'inherit_location',
  true
from public.locations
where not exists (
  select 1
  from public.departments
  where departments.location_id = locations.id
    and departments.is_default
);

drop trigger if exists locations_create_default_department on public.locations;
create trigger locations_create_default_department
after insert on public.locations
for each row execute function public.ensure_default_department_for_location();

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

drop trigger if exists organizations_protect_partner_assignment on public.organizations;
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

drop trigger if exists departments_protect_default_contract on public.departments;
create trigger departments_protect_default_contract
before update of is_default, location_id, access_mode on public.departments
for each row execute function public.protect_default_department_contract();

alter table public.channel_partners enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.departments enable row level security;
alter table public.department_memberships enable row level security;

drop policy if exists channel_partners_select_accessible on public.channel_partners;
create policy channel_partners_select_accessible on public.channel_partners
for select to authenticated
using (public.can_access_partner(id));

drop policy if exists channel_partners_insert_platform on public.channel_partners;
create policy channel_partners_insert_platform on public.channel_partners
for insert to authenticated
with check (public.is_platform_admin());

drop policy if exists channel_partners_update_managers on public.channel_partners;
create policy channel_partners_update_managers on public.channel_partners
for update to authenticated
using (public.can_manage_partner(id))
with check (public.can_manage_partner(id));

drop policy if exists channel_partners_delete_platform on public.channel_partners;
create policy channel_partners_delete_platform on public.channel_partners
for delete to authenticated
using (public.is_platform_admin() and not is_internal);

drop policy if exists partner_memberships_select_accessible on public.partner_memberships;
create policy partner_memberships_select_accessible on public.partner_memberships
for select to authenticated
using (user_id = auth.uid() or public.can_manage_partner(partner_id));

drop policy if exists partner_memberships_insert_managers on public.partner_memberships;
create policy partner_memberships_insert_managers on public.partner_memberships
for insert to authenticated
with check (public.can_manage_partner(partner_id));

drop policy if exists partner_memberships_update_managers on public.partner_memberships;
create policy partner_memberships_update_managers on public.partner_memberships
for update to authenticated
using (public.can_manage_partner(partner_id))
with check (public.can_manage_partner(partner_id));

drop policy if exists partner_memberships_delete_managers on public.partner_memberships;
create policy partner_memberships_delete_managers on public.partner_memberships
for delete to authenticated
using (public.can_manage_partner(partner_id));

drop policy if exists departments_select_accessible on public.departments;
create policy departments_select_accessible on public.departments
for select to authenticated
using (public.can_access_department(id));

drop policy if exists departments_insert_location_managers on public.departments;
create policy departments_insert_location_managers on public.departments
for insert to authenticated
with check (public.can_manage_location(location_id));

drop policy if exists departments_update_location_managers on public.departments;
create policy departments_update_location_managers on public.departments
for update to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

drop policy if exists departments_delete_location_managers on public.departments;
create policy departments_delete_location_managers on public.departments
for delete to authenticated
using (public.can_manage_location(location_id) and not is_default);

drop policy if exists department_memberships_select_accessible on public.department_memberships;
create policy department_memberships_select_accessible on public.department_memberships
for select to authenticated
using (user_id = auth.uid() or public.can_manage_department(department_id));

drop policy if exists department_memberships_insert_managers on public.department_memberships;
create policy department_memberships_insert_managers on public.department_memberships
for insert to authenticated
with check (public.can_manage_department(department_id));

drop policy if exists department_memberships_update_managers on public.department_memberships;
create policy department_memberships_update_managers on public.department_memberships
for update to authenticated
using (public.can_manage_department(department_id))
with check (public.can_manage_department(department_id));

drop policy if exists department_memberships_delete_managers on public.department_memberships;
create policy department_memberships_delete_managers on public.department_memberships
for delete to authenticated
using (public.can_manage_department(department_id));

grant select, insert, update, delete on public.channel_partners to authenticated;
grant select, insert, update, delete on public.partner_memberships to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.department_memberships to authenticated;

comment on table public.channel_partners is
  'SignalHost direct-sales or white-label channel partner parent for customer organizations.';
comment on column public.organizations.channel_partner_id is
  'Owning channel partner. Defaults to SignalHost Direct for backward-compatible tenant creation.';
comment on table public.departments is
  'Operational department within a location or dealership rooftop.';
comment on column public.departments.access_mode is
  'inherit_location preserves current access; restricted requires explicit department membership outside managers.';
