create extension if not exists pgcrypto;

create type call_handling_mode as enum (
  'answer_immediately',
  'answer_after_rings',
  'after_hours_only',
  'manually_enabled'
);

create type call_status as enum ('new', 'reviewed', 'needs_review', 'resolved');
create type call_intent as enum ('order', 'reservation', 'faq', 'hours', 'other');
create type order_status as enum ('new', 'accepted', 'in_progress', 'completed', 'canceled');
create type reservation_status as enum ('pending', 'confirmed', 'declined', 'seated', 'canceled');
create type integration_status as enum ('not_connected', 'connected', 'needs_attention');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff')),
  member_name text,
  member_email text,
  created_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

create table team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  token_hash text,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index team_invitations_one_pending_email
on team_invitations (organization_id, lower(email))
where status = 'pending';

create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  cuisine text,
  timezone text not null default 'America/New_York',
  phone text,
  ai_host_phone text,
  address text,
  created_at timestamptz not null default now()
);

create table agent_configs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  host_name text not null,
  tone text not null default 'warm',
  greeting_template text not null,
  disclosure_enabled boolean not null default true,
  call_handling_mode call_handling_mode not null default 'answer_after_rings',
  answer_after_rings integer not null default 3,
  after_hours_behavior text not null default 'answer_faqs',
  escalation_phone_number text,
  answer_faqs_enabled boolean not null default true,
  orders_enabled boolean not null default true,
  reservations_enabled boolean not null default true,
  sms_confirmations_enabled boolean not null default true,
  staff_escalation_enabled boolean not null default true,
  order_destinations jsonb not null default '["staff_review"]'::jsonb,
  payment_mode text not null default 'pay_at_pickup',
  reservation_mode text not null default 'manual_request',
  reservation_provider text not null default 'none',
  updated_at timestamptz not null default now(),
  unique(location_id)
);

create table alert_routing_configs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(location_id)
);

create table knowledge_sections (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completed_required integer not null default 0,
  total_required integer not null default 0,
  status text not null default 'in_progress',
  updated_at timestamptz not null default now(),
  unique(location_id)
);

create table phone_numbers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  provider text not null default 'twilio',
  provider_sid text,
  phone_number text not null,
  restaurant_main_line text,
  forwarding_mode text not null default 'forward_unanswered',
  forwarding_status text not null default 'not_verified',
  status text not null default 'provisioned',
  voice_webhook_url text,
  capabilities jsonb not null default '{}'::jsonb,
  verification_results jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, phone_number)
);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  prep_minutes integer not null default 10,
  available boolean not null default true,
  modifiers jsonb not null default '[]'::jsonb,
  upsell_suggestions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table menu_sources (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  source_type text not null default 'url',
  label text,
  url text,
  file_name text,
  sync_frequency text not null default 'daily',
  status text not null default 'pending',
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  source_id uuid references menu_sources(id) on delete set null,
  job_type text not null default 'menu_source_sync',
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  external_call_sid text unique,
  external_session_id text,
  caller_name text,
  caller_phone text,
  started_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  intent call_intent not null default 'other',
  outcome text not null default 'unknown',
  confidence integer not null default 0 check (confidence between 0 and 100),
  status call_status not null default 'new',
  summary text,
  recording_url text,
  twilio_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table staff_alert_events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  kind text not null,
  severity text not null default 'medium',
  status text not null default 'sent',
  summary text not null,
  message text not null,
  caller_phone text,
  recipients jsonb not null default '[]'::jsonb,
  channels jsonb not null default '[]'::jsonb,
  route_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table transcript_turns (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  speaker text not null check (speaker in ('agent', 'caller', 'staff')),
  text text not null,
  offset_seconds numeric not null default 0,
  created_at timestamptz not null default now()
);

create table call_feedback (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  call_id uuid not null references calls(id) on delete cascade,
  category text not null check (category in ('good_answer', 'wrong_answer', 'awkward', 'missing_knowledge', 'should_have_escalated', 'other')),
  note text,
  suggested_answer text,
  add_to_knowledge boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  source_call_id uuid references calls(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  status order_status not null default 'new',
  total_cents integer not null default 0,
  eta_minutes integer not null default 25,
  payment_mode text not null default 'pay_at_pickup',
  destination text not null default 'staff_review',
  notes text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  quantity integer not null default 1,
  price_cents integer not null,
  modifiers jsonb not null default '[]'::jsonb,
  notes text
);

create table order_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  destination text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  source_call_id uuid references calls(id) on delete set null,
  guest_name text not null,
  guest_phone text,
  party_size integer not null,
  reservation_date date not null,
  reservation_time time not null,
  status reservation_status not null default 'pending',
  source text not null default 'ai_host',
  provider text,
  provider_reservation_id text,
  manual_request boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  provider text not null,
  category text not null,
  status integration_status not null default 'not_connected',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(location_id, provider)
);

create table staff_tasks (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  reservation_id uuid references reservations(id) on delete set null,
  title text not null,
  body text,
  status text not null default 'open',
  task_type text not null default 'general',
  priority text not null default 'normal',
  assigned_to text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

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
alter table agent_configs enable row level security;
alter table alert_routing_configs enable row level security;
alter table staff_alert_events enable row level security;
alter table knowledge_sections enable row level security;
alter table faqs enable row level security;
alter table onboarding_profiles enable row level security;
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

create policy agent_configs_read on agent_configs
for select to authenticated
using (public.can_access_location(location_id));

create policy agent_configs_manage on agent_configs
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

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower('tim@hostline.ai') limit 1;
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'tim@hostline.ai', crypt('HostLinePilot!2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Tim"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'tim@hostline.ai', 'email_verified', true),
      'email', now(), now(), now());
  else
    update auth.users
      set encrypted_password = crypt('HostLinePilot!2026', gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_user_id;
  end if;

  insert into public.platform_admins (user_id) values (v_user_id)
    on conflict (user_id) do nothing;
end $$;