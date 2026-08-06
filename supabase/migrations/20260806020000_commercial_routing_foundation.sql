-- SignalHost Phase 1 commercial routing identity foundation.
-- Dormant by design: creates no live number, provider, assistant, or call route.

create table if not exists public.staff_directory_entries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  primary_department_id uuid references public.departments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  business_contact_id uuid references public.business_contacts(id) on delete set null,
  name text not null,
  title text,
  email text,
  phone text,
  extension text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  can_receive_live_transfers boolean not null default false,
  can_receive_callbacks boolean not null default true,
  external_refs jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_directory_entries_location_id_idx
  on public.staff_directory_entries(location_id);

create index if not exists staff_directory_entries_primary_department_id_idx
  on public.staff_directory_entries(primary_department_id)
  where primary_department_id is not null;

create unique index if not exists staff_directory_entries_location_user_unique
  on public.staff_directory_entries(location_id, user_id)
  where user_id is not null;

create unique index if not exists staff_directory_entries_location_contact_unique
  on public.staff_directory_entries(location_id, business_contact_id)
  where business_contact_id is not null;

create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  slug text not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  purpose text not null default 'general',
  status text not null default 'active' check (status in ('active', 'inactive')),
  routing_mode text not null default 'callback_only' check (
    routing_mode in ('callback_only', 'live_transfer', 'hybrid', 'external')
  ),
  is_default boolean not null default false,
  sla_policy jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, slug)
);

create unique index if not exists queues_one_default_per_department
  on public.queues(department_id)
  where is_default;

create index if not exists queues_department_id_idx
  on public.queues(department_id);

create table if not exists public.queue_members (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queues(id) on delete cascade,
  staff_directory_entry_id uuid not null references public.staff_directory_entries(id) on delete cascade,
  role text not null default 'member' check (role in ('supervisor', 'member')),
  priority integer not null default 100 check (priority >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_id, staff_directory_entry_id)
);

create index if not exists queue_members_staff_directory_entry_id_idx
  on public.queue_members(staff_directory_entry_id);

create table if not exists public.transfer_targets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  slug text not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  target_kind text not null check (
    target_kind in ('queue', 'staff', 'pstn', 'sip_uri', 'pbx_extension', 'voicemail', 'callback')
  ),
  queue_id uuid references public.queues(id) on delete cascade,
  staff_directory_entry_id uuid references public.staff_directory_entries(id) on delete cascade,
  destination text,
  provider_key text,
  external_id text,
  status text not null default 'draft' check (
    status in ('draft', 'verified', 'active', 'disabled', 'failed')
  ),
  supports_live_transfer boolean not null default false,
  supports_callback boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, slug),
  check (status <> 'active' or verified_at is not null),
  check (
    (
      target_kind = 'queue'
      and queue_id is not null
      and staff_directory_entry_id is null
      and destination is null
    )
    or (
      target_kind = 'staff'
      and queue_id is null
      and staff_directory_entry_id is not null
      and destination is null
    )
    or (
      target_kind in ('pstn', 'sip_uri', 'pbx_extension', 'voicemail')
      and queue_id is null
      and staff_directory_entry_id is null
      and nullif(btrim(destination), '') is not null
    )
    or (
      target_kind = 'callback'
      and queue_id is null
      and staff_directory_entry_id is null
      and destination is null
    )
  )
);

create index if not exists transfer_targets_department_id_idx
  on public.transfer_targets(department_id);

create index if not exists transfer_targets_queue_id_idx
  on public.transfer_targets(queue_id)
  where queue_id is not null;

create index if not exists transfer_targets_staff_directory_entry_id_idx
  on public.transfer_targets(staff_directory_entry_id)
  where staff_directory_entry_id is not null;

drop trigger if exists staff_directory_entries_set_updated_at on public.staff_directory_entries;
create trigger staff_directory_entries_set_updated_at
before update on public.staff_directory_entries
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists queues_set_updated_at on public.queues;
create trigger queues_set_updated_at
before update on public.queues
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists queue_members_set_updated_at on public.queue_members;
create trigger queue_members_set_updated_at
before update on public.queue_members
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists transfer_targets_set_updated_at on public.transfer_targets;
create trigger transfer_targets_set_updated_at
before update on public.transfer_targets
for each row execute function public.set_commercial_hierarchy_updated_at();

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

create or replace function public.validate_staff_directory_entry_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_location_id uuid;
begin
  if new.primary_department_id is not null then
    select location_id
    into linked_location_id
    from public.departments
    where id = new.primary_department_id;

    if linked_location_id is distinct from new.location_id then
      raise exception 'A staff directory primary department must belong to the same location.';
    end if;
  end if;

  if new.business_contact_id is not null then
    select location_id
    into linked_location_id
    from public.business_contacts
    where id = new.business_contact_id;

    if linked_location_id is distinct from new.location_id then
      raise exception 'A linked business contact must belong to the same location.';
    end if;
  end if;

  if new.user_id is not null
    and not public.user_has_location_affiliation(new.user_id, new.location_id)
  then
    raise exception 'A linked Auth user must already have platform, partner, organization, or department access to the location.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_directory_entries_validate_scope on public.staff_directory_entries;
create trigger staff_directory_entries_validate_scope
before insert or update of location_id, primary_department_id, user_id, business_contact_id
on public.staff_directory_entries
for each row execute function public.validate_staff_directory_entry_scope();

create or replace function public.validate_queue_member_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  queue_location_id uuid;
  staff_location_id uuid;
begin
  select departments.location_id
  into queue_location_id
  from public.queues
  join public.departments on departments.id = queues.department_id
  where queues.id = new.queue_id;

  select location_id
  into staff_location_id
  from public.staff_directory_entries
  where id = new.staff_directory_entry_id;

  if queue_location_id is distinct from staff_location_id then
    raise exception 'Queue members must belong to the same location as the queue department.';
  end if;

  return new;
end;
$$;

drop trigger if exists queue_members_validate_scope on public.queue_members;
create trigger queue_members_validate_scope
before insert or update of queue_id, staff_directory_entry_id
on public.queue_members
for each row execute function public.validate_queue_member_scope();

create or replace function public.validate_transfer_target_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_department_location_id uuid;
  linked_department_id uuid;
  linked_staff_location_id uuid;
begin
  select location_id
  into target_department_location_id
  from public.departments
  where id = new.department_id;

  if new.queue_id is not null then
    select department_id
    into linked_department_id
    from public.queues
    where id = new.queue_id;

    if linked_department_id is distinct from new.department_id then
      raise exception 'A queue transfer target must reference a queue in the same department.';
    end if;
  end if;

  if new.staff_directory_entry_id is not null then
    select location_id
    into linked_staff_location_id
    from public.staff_directory_entries
    where id = new.staff_directory_entry_id;

    if linked_staff_location_id is distinct from target_department_location_id then
      raise exception 'A staff transfer target must reference a staff entry at the same location.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists transfer_targets_validate_scope on public.transfer_targets;
create trigger transfer_targets_validate_scope
before insert or update of department_id, queue_id, staff_directory_entry_id
on public.transfer_targets
for each row execute function public.validate_transfer_target_scope();

create or replace function public.ensure_default_queue_for_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.queues (
    department_id,
    name,
    slug,
    purpose,
    status,
    routing_mode,
    is_default
  )
  values (
    new.id,
    'Primary Queue',
    'primary',
    'general',
    'active',
    'callback_only',
    true
  )
  on conflict (department_id, slug) do nothing;

  return new;
end;
$$;

insert into public.queues (
  department_id,
  name,
  slug,
  purpose,
  status,
  routing_mode,
  is_default
)
select
  departments.id,
  'Primary Queue',
  'primary',
  'general',
  'active',
  'callback_only',
  true
from public.departments
where not exists (
  select 1
  from public.queues
  where queues.department_id = departments.id
    and queues.is_default
);

drop trigger if exists departments_create_default_queue on public.departments;
create trigger departments_create_default_queue
after insert on public.departments
for each row execute function public.ensure_default_queue_for_department();

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

drop trigger if exists queues_protect_default_contract on public.queues;
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

drop trigger if exists transfer_targets_protect_verification on public.transfer_targets;
create trigger transfer_targets_protect_verification
before insert or update on public.transfer_targets
for each row execute function public.protect_transfer_target_verification();

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

alter table public.staff_directory_entries enable row level security;
alter table public.queues enable row level security;
alter table public.queue_members enable row level security;
alter table public.transfer_targets enable row level security;

drop policy if exists staff_directory_entries_select_accessible on public.staff_directory_entries;
create policy staff_directory_entries_select_accessible on public.staff_directory_entries
for select to authenticated
using (public.can_access_staff_directory_entry(id));

drop policy if exists staff_directory_entries_insert_managers on public.staff_directory_entries;
create policy staff_directory_entries_insert_managers on public.staff_directory_entries
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

drop policy if exists staff_directory_entries_update_managers on public.staff_directory_entries;
create policy staff_directory_entries_update_managers on public.staff_directory_entries
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

drop policy if exists staff_directory_entries_delete_managers on public.staff_directory_entries;
create policy staff_directory_entries_delete_managers on public.staff_directory_entries
for delete to authenticated
using (public.can_manage_staff_directory_entry(id));

drop policy if exists queues_select_accessible on public.queues;
create policy queues_select_accessible on public.queues
for select to authenticated
using (public.can_access_queue(id));

drop policy if exists queues_insert_department_managers on public.queues;
create policy queues_insert_department_managers on public.queues
for insert to authenticated
with check (public.can_manage_department(department_id));

drop policy if exists queues_update_department_managers on public.queues;
create policy queues_update_department_managers on public.queues
for update to authenticated
using (public.can_manage_queue(id))
with check (public.can_manage_department(department_id));

drop policy if exists queues_delete_department_managers on public.queues;
create policy queues_delete_department_managers on public.queues
for delete to authenticated
using (public.can_manage_queue(id) and not is_default);

drop policy if exists queue_members_select_accessible on public.queue_members;
create policy queue_members_select_accessible on public.queue_members
for select to authenticated
using (public.can_access_queue(queue_id));

drop policy if exists queue_members_insert_managers on public.queue_members;
create policy queue_members_insert_managers on public.queue_members
for insert to authenticated
with check (public.can_manage_queue(queue_id));

drop policy if exists queue_members_update_managers on public.queue_members;
create policy queue_members_update_managers on public.queue_members
for update to authenticated
using (public.can_manage_queue(queue_id))
with check (public.can_manage_queue(queue_id));

drop policy if exists queue_members_delete_managers on public.queue_members;
create policy queue_members_delete_managers on public.queue_members
for delete to authenticated
using (public.can_manage_queue(queue_id));

drop policy if exists transfer_targets_select_accessible on public.transfer_targets;
create policy transfer_targets_select_accessible on public.transfer_targets
for select to authenticated
using (
  public.can_access_department(department_id)
  or (queue_id is not null and public.can_access_queue(queue_id))
);

drop policy if exists transfer_targets_insert_managers on public.transfer_targets;
create policy transfer_targets_insert_managers on public.transfer_targets
for insert to authenticated
with check (public.can_manage_department(department_id));

drop policy if exists transfer_targets_update_managers on public.transfer_targets;
create policy transfer_targets_update_managers on public.transfer_targets
for update to authenticated
using (public.can_manage_department(department_id))
with check (public.can_manage_department(department_id));

drop policy if exists transfer_targets_delete_managers on public.transfer_targets;
create policy transfer_targets_delete_managers on public.transfer_targets
for delete to authenticated
using (public.can_manage_department(department_id));

grant select, insert, update, delete on public.staff_directory_entries to authenticated;
grant select, insert, update, delete on public.queues to authenticated;
grant select, insert, update, delete on public.queue_members to authenticated;
grant select, insert, update, delete on public.transfer_targets to authenticated;

grant all on public.staff_directory_entries to service_role;
grant all on public.queues to service_role;
grant all on public.queue_members to service_role;
grant all on public.transfer_targets to service_role;

comment on table public.staff_directory_entries is
  'Human employee/contractor directory for queue membership and future transfer/callback routing; distinct from AI agent_configs.';
comment on table public.queues is
  'Department-owned operational queue identity. callback_only is the compatibility default and does not enable live call routing.';
comment on table public.transfer_targets is
  'Dormant provider-neutral destination registry. Runtime use requires separate verified adapter support.';
comment on column public.transfer_targets.settings is
  'Non-secret configuration only. Provider credentials belong in a separate encrypted credential store.';
