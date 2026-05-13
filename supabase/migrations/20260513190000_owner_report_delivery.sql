create table if not exists business_contacts (
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

create index if not exists business_contacts_location_type_idx
on business_contacts (location_id, contact_type);

alter table business_contacts enable row level security;

drop policy if exists business_contacts_read on business_contacts;
create policy business_contacts_read on business_contacts
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_contacts_manage on business_contacts;
create policy business_contacts_manage on business_contacts
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));
