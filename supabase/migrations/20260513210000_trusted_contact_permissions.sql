alter table public.business_contacts
  add column if not exists can_add_live_updates boolean not null default false,
  add column if not exists can_approve_permanent_knowledge boolean not null default false,
  add column if not exists can_resolve_customer_requests boolean not null default true,
  add column if not exists can_manage_alert_preferences boolean not null default false,
  add column if not exists requires_owner_approval boolean not null default true,
  add column if not exists trusted_identity_enabled boolean not null default true;

update public.business_contacts
set
  can_add_live_updates = true,
  can_approve_permanent_knowledge = true,
  can_resolve_customer_requests = true,
  can_manage_alert_preferences = true,
  can_use_owner_assistant = true,
  requires_owner_approval = false,
  trusted_identity_enabled = true
where contact_type = 'owner';

update public.business_contacts
set
  can_add_live_updates = true,
  can_approve_permanent_knowledge = false,
  can_resolve_customer_requests = true,
  can_manage_alert_preferences = false,
  can_use_owner_assistant = true,
  requires_owner_approval = true,
  trusted_identity_enabled = true
where contact_type = 'manager';

create index if not exists business_contacts_trusted_phone_idx
on public.business_contacts (location_id, phone)
where phone is not null and trusted_identity_enabled = true;

create index if not exists business_contacts_trusted_email_idx
on public.business_contacts (location_id, lower(email))
where email is not null and trusted_identity_enabled = true;
