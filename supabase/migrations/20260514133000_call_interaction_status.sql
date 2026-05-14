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
