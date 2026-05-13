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

create table business_live_updates (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  update_type text not null check (update_type in ('closure', 'event', 'hours', 'policy', 'promotion', 'service_status', 'special', 'staffing')),
  title text not null,
  body text not null,
  mode text check (mode in ('normal', 'busy', 'after_hours', 'emergency', 'holiday', 'promo', 'staffing_shortage')),
  expiration text not null default 'today_close' check (expiration in ('today_close', 'tomorrow_close', 'custom', 'until_cleared')),
  expires_at timestamptz,
  source text not null default 'dashboard',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  cleared_at timestamptz
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

-- Dashboard read access should be protected with Supabase Auth + RLS before production launch.
-- The browser should use VITE_SUPABASE_PUBLISHABLE_KEY or the legacy anon key.
-- The voice service must use SUPABASE_SECRET_KEY or a legacy service_role key only on the backend.
