-- SignalHost Phase 1 commercial telephony ownership foundation.
-- Dormant by design: records ownership and observed routes without changing live routing.

create or replace function public.normalize_telephony_provider_key(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'unknown'
  );
$$;

create table if not exists public.telephony_accounts (
  id uuid primary key default gen_random_uuid(),
  channel_partner_id uuid not null references public.channel_partners(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  name text not null,
  provider_key text not null check (
    provider_key = lower(provider_key)
    and provider_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  account_kind text not null check (
    account_kind in ('carrier', 'voice_runtime', 'pbx')
  ),
  resource_owner text not null check (
    resource_owner in ('signalhost', 'partner', 'customer')
  ),
  billing_owner text not null check (
    billing_owner in ('signalhost', 'partner', 'customer')
  ),
  customer_relationship_owner text not null check (
    customer_relationship_owner in ('signalhost', 'partner')
  ),
  external_account_id text,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'suspended', 'closed')
  ),
  capabilities jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (location_id is null or organization_id is not null),
  check (resource_owner <> 'customer' or organization_id is not null)
);

create unique index if not exists telephony_accounts_external_account_unique
  on public.telephony_accounts(provider_key, external_account_id)
  where external_account_id is not null;

create unique index if not exists telephony_accounts_partner_provider_unique
  on public.telephony_accounts(channel_partner_id, provider_key, account_kind)
  where organization_id is null and location_id is null;

create index if not exists telephony_accounts_channel_partner_id_idx
  on public.telephony_accounts(channel_partner_id);

create index if not exists telephony_accounts_organization_id_idx
  on public.telephony_accounts(organization_id)
  where organization_id is not null;

create index if not exists telephony_accounts_location_id_idx
  on public.telephony_accounts(location_id)
  where location_id is not null;

create table if not exists public.sip_trunks (
  id uuid primary key default gen_random_uuid(),
  telephony_account_id uuid not null references public.telephony_accounts(id) on delete cascade,
  name text not null,
  provider_key text not null check (
    provider_key = lower(provider_key)
    and provider_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  external_trunk_id text,
  direction text not null default 'inbound' check (
    direction in ('inbound', 'outbound', 'bidirectional')
  ),
  signaling_endpoint text,
  status text not null default 'draft' check (
    status in ('draft', 'verified', 'active', 'disabled', 'failed')
  ),
  runtime_enforced boolean not null default false,
  capabilities jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (verified_at is not null and runtime_enforced)),
  check (not runtime_enforced or status = 'active')
);

create unique index if not exists sip_trunks_external_trunk_unique
  on public.sip_trunks(provider_key, external_trunk_id)
  where external_trunk_id is not null;

create index if not exists sip_trunks_telephony_account_id_idx
  on public.sip_trunks(telephony_account_id);

alter table public.phone_numbers
  add column if not exists telephony_account_id uuid
    references public.telephony_accounts(id) on delete restrict;

create index if not exists phone_numbers_telephony_account_id_idx
  on public.phone_numbers(telephony_account_id);

create or replace function public.validate_telephony_account_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scoped_organization_id uuid;
  scoped_partner_id uuid;
begin
  new.provider_key := public.normalize_telephony_provider_key(new.provider_key);

  if new.resource_owner = 'signalhost' and (
    new.channel_partner_id <> 'a0000000-0000-4000-8000-000000000001'::uuid
    or new.organization_id is not null
    or new.location_id is not null
  ) then
    raise exception 'SignalHost-owned telephony accounts must remain on the SignalHost Direct partner scope.';
  end if;

  if new.location_id is not null then
    select organization_id
    into scoped_organization_id
    from public.locations
    where id = new.location_id;

    if scoped_organization_id is distinct from new.organization_id then
      raise exception 'A telephony account location must belong to its organization scope.';
    end if;
  end if;

  if new.organization_id is not null then
    select channel_partner_id
    into scoped_partner_id
    from public.organizations
    where id = new.organization_id;

    if scoped_partner_id is distinct from new.channel_partner_id then
      raise exception 'A telephony account organization must belong to its channel partner.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists telephony_accounts_validate_scope on public.telephony_accounts;
create trigger telephony_accounts_validate_scope
before insert or update of channel_partner_id, organization_id, location_id, provider_key, resource_owner
on public.telephony_accounts
for each row execute function public.validate_telephony_account_scope();

drop trigger if exists telephony_accounts_set_updated_at on public.telephony_accounts;
create trigger telephony_accounts_set_updated_at
before update on public.telephony_accounts
for each row execute function public.set_commercial_hierarchy_updated_at();

drop trigger if exists sip_trunks_set_updated_at on public.sip_trunks;
create trigger sip_trunks_set_updated_at
before update on public.sip_trunks
for each row execute function public.set_commercial_hierarchy_updated_at();

create or replace function public.telephony_account_can_serve_location(
  target_telephony_account_id uuid,
  target_location_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.telephony_accounts
    join public.locations
      on locations.id = target_location_id
    join public.organizations
      on organizations.id = locations.organization_id
    where telephony_accounts.id = target_telephony_account_id
      and telephony_accounts.status in ('draft', 'active')
      and (
        telephony_accounts.resource_owner = 'signalhost'
        or (
          telephony_accounts.channel_partner_id = organizations.channel_partner_id
          and (
            telephony_accounts.organization_id is null
            or telephony_accounts.organization_id = organizations.id
          )
          and (
            telephony_accounts.location_id is null
            or telephony_accounts.location_id = locations.id
          )
        )
      )
  );
$$;

create or replace function public.ensure_default_telephony_account(target_provider text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_provider text := public.normalize_telephony_provider_key(target_provider);
  normalized_account_kind text;
  resolved_account_id uuid;
begin
  normalized_account_kind := case
    when normalized_provider = 'vapi' then 'voice_runtime'
    else 'carrier'
  end;

  select id
  into resolved_account_id
  from public.telephony_accounts
  where channel_partner_id = 'a0000000-0000-4000-8000-000000000001'::uuid
    and organization_id is null
    and location_id is null
    and provider_key = normalized_provider
    and account_kind = normalized_account_kind
  limit 1;

  if resolved_account_id is null then
    insert into public.telephony_accounts (
      channel_partner_id,
      name,
      provider_key,
      account_kind,
      resource_owner,
      billing_owner,
      customer_relationship_owner,
      status,
      settings
    )
    values (
      'a0000000-0000-4000-8000-000000000001'::uuid,
      'SignalHost ' || initcap(replace(normalized_provider, '-', ' ')) || ' managed account',
      normalized_provider,
      normalized_account_kind,
      'signalhost',
      'signalhost',
      'signalhost',
      'active',
      jsonb_build_object('compatibility_default', true)
    )
    on conflict do nothing;

    select id
    into resolved_account_id
    from public.telephony_accounts
    where channel_partner_id = 'a0000000-0000-4000-8000-000000000001'::uuid
      and organization_id is null
      and location_id is null
      and provider_key = normalized_provider
      and account_kind = normalized_account_kind
    limit 1;
  end if;

  if resolved_account_id is null then
    raise exception 'SignalHost could not resolve a default telephony account for provider %.', normalized_provider;
  end if;

  return resolved_account_id;
end;
$$;

create or replace function public.telephony_account_provider_key(target_telephony_account_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select provider_key
  from public.telephony_accounts
  where id = target_telephony_account_id;
$$;

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
          or (
            organization_id is not null
            and public.can_access_organization(organization_id)
          )
          or (
            location_id is not null
            and public.can_access_location(location_id)
          )
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
          or (
            location_id is not null
            and public.can_manage_location(location_id)
          )
          or (
            location_id is null
            and organization_id is not null
            and public.can_manage_organization(organization_id)
          )
        )
    );
$$;

create or replace function public.validate_phone_number_telephony_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_was_defaulted boolean := new.telephony_account_id is null;
  normalized_provider text := public.normalize_telephony_provider_key(new.provider);
  linked_provider text;
begin
  if tg_op = 'UPDATE' then
    if new.location_id is distinct from old.location_id
      and auth.uid() is not null
      and not public.is_platform_admin()
    then
      raise exception 'Phone-number location reassignment must be performed by SignalHost operations.';
    end if;
  end if;

  if new.telephony_account_id is null then
    new.telephony_account_id := public.ensure_default_telephony_account(new.provider);
  end if;

  linked_provider := public.telephony_account_provider_key(new.telephony_account_id);
  if linked_provider is distinct from normalized_provider then
    raise exception 'A phone number provider must match its telephony account provider.';
  end if;

  if not public.telephony_account_can_serve_location(new.telephony_account_id, new.location_id) then
    raise exception 'A phone number telephony account cannot serve this location scope.';
  end if;

  if auth.uid() is not null
    and not public.is_platform_admin()
    and not account_was_defaulted
  then
    if tg_op = 'INSERT'
      and not public.can_manage_telephony_account(new.telephony_account_id)
    then
      raise exception 'The current user cannot assign this telephony account.';
    end if;

    if tg_op = 'UPDATE'
      and new.telephony_account_id is distinct from old.telephony_account_id
      and not public.can_manage_telephony_account(new.telephony_account_id)
    then
      raise exception 'The current user cannot assign this telephony account.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists phone_numbers_validate_telephony_account on public.phone_numbers;
create trigger phone_numbers_validate_telephony_account
before insert or update of location_id, provider, telephony_account_id
on public.phone_numbers
for each row execute function public.validate_phone_number_telephony_account();

update public.phone_numbers
set telephony_account_id = public.ensure_default_telephony_account(provider)
where telephony_account_id is null;

alter table public.phone_numbers
  alter column telephony_account_id set not null;

create table if not exists public.number_routes (
  id uuid primary key default gen_random_uuid(),
  phone_number_id uuid not null references public.phone_numbers(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  queue_id uuid references public.queues(id) on delete restrict,
  sip_trunk_id uuid references public.sip_trunks(id) on delete restrict,
  destination_kind text not null default 'department' check (
    destination_kind in ('department', 'queue', 'sip_trunk', 'external')
  ),
  destination text,
  runtime_provider_key text check (
    runtime_provider_key is null
    or (
      runtime_provider_key = lower(runtime_provider_key)
      and runtime_provider_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  ),
  status text not null default 'draft' check (
    status in ('observed', 'draft', 'verified', 'active', 'disabled', 'failed')
  ),
  is_primary boolean not null default false,
  priority integer not null default 100 check (priority >= 0),
  runtime_enforced boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (verified_at is not null and runtime_enforced)),
  check (not runtime_enforced or status = 'active'),
  check (
    (
      destination_kind = 'department'
      and queue_id is null
      and sip_trunk_id is null
      and destination is null
    )
    or (
      destination_kind = 'queue'
      and queue_id is not null
      and sip_trunk_id is null
      and destination is null
    )
    or (
      destination_kind = 'sip_trunk'
      and queue_id is null
      and sip_trunk_id is not null
      and destination is null
    )
    or (
      destination_kind = 'external'
      and queue_id is null
      and sip_trunk_id is null
      and nullif(btrim(destination), '') is not null
    )
  )
);

create unique index if not exists number_routes_one_primary_per_number
  on public.number_routes(phone_number_id)
  where is_primary;

create index if not exists number_routes_department_id_idx
  on public.number_routes(department_id);

create index if not exists number_routes_queue_id_idx
  on public.number_routes(queue_id)
  where queue_id is not null;

create index if not exists number_routes_sip_trunk_id_idx
  on public.number_routes(sip_trunk_id)
  where sip_trunk_id is not null;

drop trigger if exists number_routes_set_updated_at on public.number_routes;
create trigger number_routes_set_updated_at
before update on public.number_routes
for each row execute function public.set_commercial_hierarchy_updated_at();

create or replace function public.validate_sip_trunk_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.provider_key := public.normalize_telephony_provider_key(new.provider_key);

  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft'
      or new.runtime_enforced
      or new.verified_at is not null
      or new.verified_by is not null
    then
      raise exception 'SIP trunk verification and runtime activation must be recorded by SignalHost operations.';
    end if;

    return new;
  end if;

  if new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.runtime_enforced is distinct from old.runtime_enforced
    or (
      new.status in ('verified', 'active')
      and old.status not in ('verified', 'active')
    )
    or (
      old.status in ('verified', 'active')
      and (
        new.telephony_account_id is distinct from old.telephony_account_id
        or new.provider_key is distinct from old.provider_key
        or new.external_trunk_id is distinct from old.external_trunk_id
        or new.direction is distinct from old.direction
        or new.signaling_endpoint is distinct from old.signaling_endpoint
        or new.capabilities is distinct from old.capabilities
        or new.settings is distinct from old.settings
      )
    )
  then
    raise exception 'SIP trunk verification and runtime activation must be recorded by SignalHost operations.';
  end if;

  return new;
end;
$$;

drop trigger if exists sip_trunks_protect_verification on public.sip_trunks;
create trigger sip_trunks_protect_verification
before insert or update on public.sip_trunks
for each row execute function public.validate_sip_trunk_verification();

create or replace function public.validate_number_route_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  route_location_id uuid;
  route_department_location_id uuid;
  linked_queue_department_id uuid;
  linked_trunk_account_id uuid;
begin
  select location_id
  into route_location_id
  from public.phone_numbers
  where id = new.phone_number_id;

  select location_id
  into route_department_location_id
  from public.departments
  where id = new.department_id;

  if route_location_id is distinct from route_department_location_id then
    raise exception 'A number route department must belong to the phone number location.';
  end if;

  if new.queue_id is not null then
    select department_id
    into linked_queue_department_id
    from public.queues
    where id = new.queue_id;

    if linked_queue_department_id is distinct from new.department_id then
      raise exception 'A number route queue must belong to the route department.';
    end if;
  end if;

  if new.sip_trunk_id is not null then
    select telephony_account_id
    into linked_trunk_account_id
    from public.sip_trunks
    where id = new.sip_trunk_id;

    if not public.telephony_account_can_serve_location(linked_trunk_account_id, route_location_id) then
      raise exception 'A number route SIP trunk cannot serve the phone number location.';
    end if;
  end if;

  if new.runtime_provider_key is not null then
    new.runtime_provider_key := public.normalize_telephony_provider_key(new.runtime_provider_key);
  end if;

  return new;
end;
$$;

drop trigger if exists number_routes_validate_scope on public.number_routes;
create trigger number_routes_validate_scope
before insert or update of phone_number_id, department_id, queue_id, sip_trunk_id, runtime_provider_key
on public.number_routes
for each row execute function public.validate_number_route_scope();

create or replace function public.protect_number_route_runtime_state()
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
    if pg_trigger_depth() > 1
      and new.status = 'observed'
      and not new.runtime_enforced
      and new.verified_at is null
      and new.verified_by is null
    then
      return new;
    end if;

    if new.status <> 'draft'
      or new.runtime_enforced
      or new.verified_at is not null
      or new.verified_by is not null
    then
      raise exception 'Number-route verification and runtime activation must be recorded by SignalHost operations.';
    end if;

    return new;
  end if;

  if old.status = 'observed' then
    raise exception 'Observed compatibility routes can only be changed by SignalHost operations.';
  end if;

  if new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.runtime_enforced is distinct from old.runtime_enforced
    or (
      new.status in ('verified', 'active')
      and old.status not in ('verified', 'active')
    )
    or (
      old.status in ('verified', 'active')
      and (
        new.phone_number_id is distinct from old.phone_number_id
        or new.department_id is distinct from old.department_id
        or new.queue_id is distinct from old.queue_id
        or new.sip_trunk_id is distinct from old.sip_trunk_id
        or new.destination_kind is distinct from old.destination_kind
        or new.destination is distinct from old.destination
        or new.runtime_provider_key is distinct from old.runtime_provider_key
        or new.settings is distinct from old.settings
      )
    )
  then
    raise exception 'Number-route verification and runtime activation must be recorded by SignalHost operations.';
  end if;

  return new;
end;
$$;

drop trigger if exists number_routes_protect_runtime_state on public.number_routes;
create trigger number_routes_protect_runtime_state
before insert or update on public.number_routes
for each row execute function public.protect_number_route_runtime_state();

create or replace function public.ensure_observed_number_route()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_department_id uuid;
begin
  select id
  into default_department_id
  from public.departments
  where location_id = new.location_id
    and is_default
  limit 1;

  if default_department_id is null then
    raise exception 'A phone number location must have a default department before route ownership can be recorded.';
  end if;

  if tg_op = 'UPDATE' then
    update public.number_routes
    set
      department_id = default_department_id,
      updated_at = now()
    where phone_number_id = new.id
      and status = 'observed';
  end if;

  if not exists (
    select 1
    from public.number_routes
    where phone_number_id = new.id
      and is_primary
  ) then
    insert into public.number_routes (
      phone_number_id,
      department_id,
      destination_kind,
      status,
      is_primary,
      runtime_enforced,
      settings
    )
    values (
      new.id,
      default_department_id,
      'department',
      'observed',
      true,
      false,
      jsonb_build_object('source', 'legacy_phone_number', 'provider', new.provider)
    );
  end if;

  return new;
end;
$$;

insert into public.number_routes (
  phone_number_id,
  department_id,
  destination_kind,
  status,
  is_primary,
  runtime_enforced,
  settings
)
select
  phone_numbers.id,
  departments.id,
  'department',
  'observed',
  true,
  false,
  jsonb_build_object('source', 'legacy_phone_number', 'provider', phone_numbers.provider)
from public.phone_numbers
join public.departments
  on departments.location_id = phone_numbers.location_id
 and departments.is_default
where not exists (
  select 1
  from public.number_routes
  where number_routes.phone_number_id = phone_numbers.id
    and number_routes.is_primary
);

drop trigger if exists phone_numbers_create_observed_route on public.phone_numbers;
create trigger phone_numbers_create_observed_route
after insert on public.phone_numbers
for each row execute function public.ensure_observed_number_route();

drop trigger if exists phone_numbers_move_observed_route on public.phone_numbers;
create trigger phone_numbers_move_observed_route
after update of location_id on public.phone_numbers
for each row execute function public.ensure_observed_number_route();

create or replace function public.phone_number_location_id(target_phone_number_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id
  from public.phone_numbers
  where id = target_phone_number_id;
$$;

create or replace function public.number_route_department_id(target_number_route_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select department_id
  from public.number_routes
  where id = target_number_route_id;
$$;

create or replace function public.number_route_phone_number_id(target_number_route_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select phone_number_id
  from public.number_routes
  where id = target_number_route_id;
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
      and public.can_access_department(
        public.number_route_department_id(target_number_route_id)
      )
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
      and public.can_manage_department(
        public.number_route_department_id(target_number_route_id)
      )
    );
$$;

alter table public.telephony_accounts enable row level security;
alter table public.sip_trunks enable row level security;
alter table public.number_routes enable row level security;

drop policy if exists telephony_accounts_select_accessible on public.telephony_accounts;
create policy telephony_accounts_select_accessible on public.telephony_accounts
for select to authenticated
using (public.can_access_telephony_account(id));

drop policy if exists telephony_accounts_insert_owners on public.telephony_accounts;
create policy telephony_accounts_insert_owners on public.telephony_accounts
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
      or (
        location_id is not null
        and public.can_manage_location(location_id)
      )
      or (
        location_id is null
        and organization_id is not null
        and public.can_manage_organization(organization_id)
      )
    )
  )
);

drop policy if exists telephony_accounts_update_owners on public.telephony_accounts;
create policy telephony_accounts_update_owners on public.telephony_accounts
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
      or (
        location_id is not null
        and public.can_manage_location(location_id)
      )
      or (
        location_id is null
        and organization_id is not null
        and public.can_manage_organization(organization_id)
      )
    )
  )
);

drop policy if exists telephony_accounts_delete_owners on public.telephony_accounts;
create policy telephony_accounts_delete_owners on public.telephony_accounts
for delete to authenticated
using (public.can_manage_telephony_account(id));

drop policy if exists sip_trunks_select_accessible on public.sip_trunks;
create policy sip_trunks_select_accessible on public.sip_trunks
for select to authenticated
using (public.can_access_telephony_account(telephony_account_id));

drop policy if exists sip_trunks_insert_owners on public.sip_trunks;
create policy sip_trunks_insert_owners on public.sip_trunks
for insert to authenticated
with check (public.can_manage_telephony_account(telephony_account_id));

drop policy if exists sip_trunks_update_owners on public.sip_trunks;
create policy sip_trunks_update_owners on public.sip_trunks
for update to authenticated
using (public.can_manage_telephony_account(telephony_account_id))
with check (public.can_manage_telephony_account(telephony_account_id));

drop policy if exists sip_trunks_delete_owners on public.sip_trunks;
create policy sip_trunks_delete_owners on public.sip_trunks
for delete to authenticated
using (public.can_manage_telephony_account(telephony_account_id) and not runtime_enforced);

drop policy if exists number_routes_select_accessible on public.number_routes;
create policy number_routes_select_accessible on public.number_routes
for select to authenticated
using (public.can_access_number_route(id));

drop policy if exists number_routes_insert_managers on public.number_routes;
create policy number_routes_insert_managers on public.number_routes
for insert to authenticated
with check (
  public.can_manage_location(public.phone_number_location_id(phone_number_id))
  and public.can_manage_department(department_id)
);

drop policy if exists number_routes_update_managers on public.number_routes;
create policy number_routes_update_managers on public.number_routes
for update to authenticated
using (public.can_manage_number_route(id))
with check (
  public.can_manage_location(public.phone_number_location_id(phone_number_id))
  and public.can_manage_department(department_id)
);

drop policy if exists number_routes_delete_managers on public.number_routes;
create policy number_routes_delete_managers on public.number_routes
for delete to authenticated
using (public.can_manage_number_route(id) and status <> 'observed' and not runtime_enforced);

grant select, insert, update, delete on public.telephony_accounts to authenticated;
grant select, insert, update, delete on public.sip_trunks to authenticated;
grant select, insert, update, delete on public.number_routes to authenticated;

grant all on public.telephony_accounts to service_role;
grant all on public.sip_trunks to service_role;
grant all on public.number_routes to service_role;

comment on table public.telephony_accounts is
  'Non-secret carrier, voice-runtime, or PBX ownership/account identity scoped to a SignalHost channel partner and optional customer scope.';
comment on column public.telephony_accounts.settings is
  'Non-secret configuration only. Credentials, signing secrets, tokens, and private keys require a separate encrypted credential store.';
comment on table public.sip_trunks is
  'Dormant SIP trunk identity. A row is not a live route and runtime enforcement requires service-recorded verification.';
comment on table public.number_routes is
  'Provider-neutral number-to-department destination registry. Observed routes document compatibility behavior but are not runtime authoritative.';
comment on column public.number_routes.runtime_enforced is
  'False unless a separately verified runtime adapter actively enforces this route.';