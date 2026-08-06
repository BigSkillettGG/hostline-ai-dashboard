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

create table business_contacts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  contact_type text not null default 'owner' check (contact_type in ('owner', 'manager', 'front_desk', 'billing')),
  name text not null,
  phone text,
  email text,
  preferred_channel text not null default 'sms' check (preferred_channel in ('sms', 'email', 'both')),
  can_receive_alerts boolean not null default true,
  can_use_owner_assistant boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table business_live_settings (
  location_id uuid primary key references locations(id) on delete cascade,
  active_mode text not null default 'normal' check (active_mode in ('normal', 'busy', 'after_hours', 'emergency', 'holiday', 'promo', 'staffing_shortage')),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table business_live_updates (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  update_type text not null check (update_type in ('closure', 'event', 'hours', 'policy', 'promotion', 'service_status', 'special', 'staffing')),
  title text not null,
  body text not null,
  mode text check (mode in ('normal', 'busy', 'after_hours', 'emergency', 'holiday', 'promo', 'staffing_shortage')),
  expiration text not null default 'today_close' check (expiration in ('today_close', 'tomorrow_close', 'custom', 'until_cleared')),
  expires_at timestamptz,
  source text not null default 'dashboard' check (source in ('dashboard', 'owner_text', 'staff')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

create table owner_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  report_type text not null default 'daily' check (report_type in ('daily', 'weekly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  title text not null,
  owner_message text not null,
  copy_text text not null,
  totals jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '[]'::jsonb,
  follow_ups jsonb not null default '[]'::jsonb,
  suggested_updates jsonb not null default '[]'::jsonb,
  delivery_channels jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('draft', 'ready', 'sent', 'failed')),
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique(location_id, report_type, period_start)
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

create table billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  status text not null default 'not_started',
  plan_id text,
  plan_name text,
  monthly_cents integer,
  included_interactions integer,
  overage_label text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id),
  unique(stripe_customer_id),
  unique(stripe_subscription_id)
);

create table business_links (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  link_type text not null,
  label text not null,
  url text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  workflow_status text not null default 'new' check (workflow_status in ('new', 'resolved', 'needs_follow_up', 'needs_review', 'waiting_on_customer', 'booking_link_sent', 'quote_requested', 'escalated', 'spam_vendor')),
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'urgent')),
  value_tier text not null default 'low' check (value_tier in ('low', 'medium', 'high', 'very_high', 'risk')),
  follow_up_needed boolean not null default false,
  knowledge_gap boolean not null default false,
  owner_report_bucket text not null default 'handled' check (owner_report_bucket in ('handled', 'knowledge_gap', 'low_value', 'open_follow_up', 'revenue_opportunity', 'risk_or_complaint')),
  recommended_action text,
  tags jsonb not null default '[]'::jsonb,
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

create table knowledge_suggestions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  feedback_id uuid references call_feedback(id) on delete set null,
  title text not null,
  body text not null,
  source text not null default 'manual' check (source in ('call_feedback', 'owner_assistant', 'staff_task', 'manual')),
  source_question text,
  suggested_answer text,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  applied_knowledge_section_id uuid references knowledge_sections(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index knowledge_suggestions_location_status_idx
on knowledge_suggestions (location_id, status, created_at desc);

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

create table customer_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  source_call_id uuid references calls(id) on delete set null,
  request_type text not null default 'general',
  title text not null,
  summary text not null,
  customer_name text,
  customer_phone text,
  status text not null default 'new',
  priority text not null default 'normal',
  source text not null default 'ai_host',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

-- Commercial hierarchy foundation. Existing and new organizations default to
-- SignalHost Direct until an authorized provisioning flow assigns a partner.
create table channel_partners (
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

insert into channel_partners (
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
);

create table partner_memberships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references channel_partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

alter table organizations
  add column channel_partner_id uuid
  not null
  default 'a0000000-0000-4000-8000-000000000001'::uuid
  references channel_partners(id) on delete restrict;

create index organizations_channel_partner_id_idx
  on organizations(channel_partner_id);

create table departments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
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

create unique index departments_one_default_per_location
  on departments(location_id)
  where is_default;

create index departments_location_id_idx
  on departments(location_id);

create table department_memberships (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager', 'agent', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, user_id)
);

create index department_memberships_user_id_idx
  on department_memberships(user_id);

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

create trigger channel_partners_set_updated_at
before update on channel_partners
for each row execute function public.set_commercial_hierarchy_updated_at();

create trigger partner_memberships_set_updated_at
before update on partner_memberships
for each row execute function public.set_commercial_hierarchy_updated_at();

create trigger departments_set_updated_at
before update on departments
for each row execute function public.set_commercial_hierarchy_updated_at();

create trigger department_memberships_set_updated_at
before update on department_memberships
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
  );

  return new;
end;
$$;

create trigger locations_create_default_department
after insert on locations
for each row execute function public.ensure_default_department_for_location();

-- Dormant commercial routing identities. These records do not enable or alter
-- a live voice route until a verified runtime adapter explicitly consumes them.
create table staff_directory_entries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  primary_department_id uuid references departments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  business_contact_id uuid references business_contacts(id) on delete set null,
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

create index staff_directory_entries_location_id_idx
  on staff_directory_entries(location_id);

create index staff_directory_entries_primary_department_id_idx
  on staff_directory_entries(primary_department_id)
  where primary_department_id is not null;

create unique index staff_directory_entries_location_user_unique
  on staff_directory_entries(location_id, user_id)
  where user_id is not null;

create unique index staff_directory_entries_location_contact_unique
  on staff_directory_entries(location_id, business_contact_id)
  where business_contact_id is not null;

create table queues (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
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

create unique index queues_one_default_per_department
  on queues(department_id)
  where is_default;

create index queues_department_id_idx
  on queues(department_id);

create table queue_members (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references queues(id) on delete cascade,
  staff_directory_entry_id uuid not null references staff_directory_entries(id) on delete cascade,
  role text not null default 'member' check (role in ('supervisor', 'member')),
  priority integer not null default 100 check (priority >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_id, staff_directory_entry_id)
);

create index queue_members_staff_directory_entry_id_idx
  on queue_members(staff_directory_entry_id);

create table transfer_targets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  slug text not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  target_kind text not null check (
    target_kind in ('queue', 'staff', 'pstn', 'sip_uri', 'pbx_extension', 'voicemail', 'callback')
  ),
  queue_id uuid references queues(id) on delete cascade,
  staff_directory_entry_id uuid references staff_directory_entries(id) on delete cascade,
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

create index transfer_targets_department_id_idx
  on transfer_targets(department_id);

create index transfer_targets_queue_id_idx
  on transfer_targets(queue_id)
  where queue_id is not null;

create index transfer_targets_staff_directory_entry_id_idx
  on transfer_targets(staff_directory_entry_id)
  where staff_directory_entry_id is not null;

create trigger staff_directory_entries_set_updated_at
before update on staff_directory_entries
for each row execute function public.set_commercial_hierarchy_updated_at();

create trigger queues_set_updated_at
before update on queues
for each row execute function public.set_commercial_hierarchy_updated_at();

create trigger queue_members_set_updated_at
before update on queue_members
for each row execute function public.set_commercial_hierarchy_updated_at();

create trigger transfer_targets_set_updated_at
before update on transfer_targets
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

create trigger staff_directory_entries_validate_scope
before insert or update of location_id, primary_department_id, user_id, business_contact_id
on staff_directory_entries
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

create trigger queue_members_validate_scope
before insert or update of queue_id, staff_directory_entry_id
on queue_members
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

create trigger transfer_targets_validate_scope
before insert or update of department_id, queue_id, staff_directory_entry_id
on transfer_targets
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
  );

  return new;
end;
$$;

create trigger departments_create_default_queue
after insert on departments
for each row execute function public.ensure_default_queue_for_department();

-- Dashboard read access should be protected with Supabase Auth + RLS before production launch.
-- The browser should use VITE_SUPABASE_PUBLISHABLE_KEY or the legacy anon key.
-- The voice service must use SUPABASE_SECRET_KEY or a legacy service_role key only on the backend.
