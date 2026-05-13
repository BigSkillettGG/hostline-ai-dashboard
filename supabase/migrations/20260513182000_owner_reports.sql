create table if not exists owner_reports (
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

create index if not exists owner_reports_location_generated_idx
on owner_reports (location_id, generated_at desc);

alter table owner_reports enable row level security;

create policy owner_reports_read on owner_reports
for select to authenticated
using (public.can_access_location(location_id));

create policy owner_reports_manage on owner_reports
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));
