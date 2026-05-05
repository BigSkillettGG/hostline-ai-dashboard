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
  updated_at timestamptz not null default now()
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

create table transcript_turns (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  speaker text not null check (speaker in ('agent', 'caller', 'staff')),
  text text not null,
  offset_seconds numeric not null default 0,
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
  created_at timestamptz not null default now()
);

-- Dashboard read access should be protected with Supabase Auth + RLS before production launch.
-- The browser should use VITE_SUPABASE_PUBLISHABLE_KEY or the legacy anon key.
-- The voice service must use SUPABASE_SECRET_KEY or a legacy service_role key only on the backend.
