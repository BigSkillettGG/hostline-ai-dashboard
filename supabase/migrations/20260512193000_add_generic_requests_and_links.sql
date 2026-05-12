create table if not exists public.business_links (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  link_type text not null,
  label text not null,
  url text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_links_location_type_idx
on public.business_links (location_id, link_type)
where is_active = true;

create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  source_call_id uuid references public.calls(id) on delete set null,
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

create index if not exists customer_requests_location_created_idx
on public.customer_requests (location_id, created_at desc);

alter table public.business_links enable row level security;
alter table public.customer_requests enable row level security;

drop policy if exists business_links_read on public.business_links;
create policy business_links_read on public.business_links
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_links_manage on public.business_links;
create policy business_links_manage on public.business_links
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

drop policy if exists customer_requests_read on public.customer_requests;
create policy customer_requests_read on public.customer_requests
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists customer_requests_operate on public.customer_requests;
create policy customer_requests_operate on public.customer_requests
for all to authenticated
using (public.can_operate_location(location_id))
with check (public.can_operate_location(location_id));
