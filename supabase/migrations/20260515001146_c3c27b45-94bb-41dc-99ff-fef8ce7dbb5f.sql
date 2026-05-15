-- Migration 1: phone number lifecycle and SMS threads
alter table phone_numbers
add column if not exists provisioning_source text not null default 'trial',
add column if not exists trial_started_at timestamptz,
add column if not exists trial_ends_at timestamptz,
add column if not exists trial_grace_ends_at timestamptz,
add column if not exists released_at timestamptz,
add column if not exists release_reason text,
add column if not exists sms_webhook_url text;

create index if not exists phone_numbers_trial_release_idx
on phone_numbers (trial_grace_ends_at)
where released_at is null;

create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  customer_phone text not null,
  signalhost_phone text not null,
  restaurant_name_snapshot text,
  thread_type text not null default 'general',
  status text not null default 'open',
  related_call_id uuid references calls(id) on delete set null,
  related_order_id uuid references orders(id) on delete set null,
  related_reservation_id uuid references reservations(id) on delete set null,
  disambiguation_state jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists message_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references message_threads(id) on delete set null,
  provider text not null default 'twilio',
  provider_message_sid text,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_phone text not null,
  to_phone text not null,
  body text not null,
  status text not null default 'received',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists message_threads_customer_open_idx
on message_threads (customer_phone, last_message_at desc)
where status in ('open', 'pending_disambiguation');

create index if not exists message_threads_location_idx
on message_threads (location_id, last_message_at desc);

create index if not exists message_events_thread_idx
on message_events (thread_id, created_at desc);

create index if not exists message_events_phone_idx
on message_events (from_phone, created_at desc);

alter table message_threads enable row level security;
alter table message_events enable row level security;

drop policy if exists message_threads_read on message_threads;
create policy message_threads_read on message_threads
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists message_threads_manage on message_threads;
create policy message_threads_manage on message_threads
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create or replace function public.message_thread_location_id(target_thread_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id
  from public.message_threads
  where id = target_thread_id;
$$;

drop policy if exists message_events_read on message_events;
create policy message_events_read on message_events
for select to authenticated
using (
  thread_id is not null
  and public.can_access_location(public.message_thread_location_id(thread_id))
);

drop policy if exists message_events_manage on message_events;
create policy message_events_manage on message_events
for all to authenticated
using (
  thread_id is not null
  and public.can_manage_location(public.message_thread_location_id(thread_id))
)
with check (
  thread_id is not null
  and public.can_manage_location(public.message_thread_location_id(thread_id))
);

-- Migration 2: call interaction status
alter table public.calls
  add column if not exists workflow_status text not null default 'new',
  add column if not exists urgency text not null default 'normal',
  add column if not exists value_tier text not null default 'low',
  add column if not exists follow_up_needed boolean not null default false,
  add column if not exists knowledge_gap boolean not null default false,
  add column if not exists owner_report_bucket text not null default 'handled',
  add column if not exists recommended_action text,
  add column if not exists tags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'calls_workflow_status_check'
      and conrelid = 'public.calls'::regclass
  ) then
    alter table public.calls add constraint calls_workflow_status_check
      check (workflow_status in (
        'new',
        'resolved',
        'needs_follow_up',
        'needs_review',
        'waiting_on_customer',
        'booking_link_sent',
        'quote_requested',
        'escalated',
        'spam_vendor'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calls_urgency_check'
      and conrelid = 'public.calls'::regclass
  ) then
    alter table public.calls add constraint calls_urgency_check
      check (urgency in ('low', 'normal', 'high', 'urgent'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calls_value_tier_check'
      and conrelid = 'public.calls'::regclass
  ) then
    alter table public.calls add constraint calls_value_tier_check
      check (value_tier in ('low', 'medium', 'high', 'very_high', 'risk'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calls_owner_report_bucket_check'
      and conrelid = 'public.calls'::regclass
  ) then
    alter table public.calls add constraint calls_owner_report_bucket_check
      check (owner_report_bucket in (
        'handled',
        'knowledge_gap',
        'low_value',
        'open_follow_up',
        'revenue_opportunity',
        'risk_or_complaint'
      ));
  end if;
end $$;

create index if not exists calls_workflow_status_idx
  on public.calls(location_id, workflow_status, started_at desc);

create index if not exists calls_owner_report_bucket_idx
  on public.calls(location_id, owner_report_bucket, started_at desc);

create index if not exists calls_follow_up_needed_idx
  on public.calls(location_id, started_at desc)
  where follow_up_needed;