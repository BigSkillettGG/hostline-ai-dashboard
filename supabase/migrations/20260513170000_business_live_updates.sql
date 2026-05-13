create table if not exists business_live_settings (
  location_id uuid primary key references locations(id) on delete cascade,
  active_mode text not null default 'normal' check (active_mode in ('normal', 'busy', 'after_hours', 'emergency', 'holiday', 'promo', 'staffing_shortage')),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists business_live_updates (
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

create index if not exists business_live_updates_location_active_idx
on business_live_updates (location_id, created_at desc)
where cleared_at is null;

create index if not exists business_live_updates_expiration_idx
on business_live_updates (expires_at)
where cleared_at is null and expires_at is not null;

alter table business_live_settings enable row level security;
alter table business_live_updates enable row level security;

drop policy if exists business_live_settings_read on business_live_settings;
create policy business_live_settings_read on business_live_settings
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_live_settings_manage on business_live_settings;
create policy business_live_settings_manage on business_live_settings
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

drop policy if exists business_live_updates_read on business_live_updates;
create policy business_live_updates_read on business_live_updates
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_live_updates_manage on business_live_updates;
create policy business_live_updates_manage on business_live_updates
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));
