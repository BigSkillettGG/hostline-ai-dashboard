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

create table if not exists public.business_live_settings (
  location_id uuid primary key references public.locations(id) on delete cascade,
  active_mode text not null default 'normal' check (active_mode in ('normal', 'busy', 'after_hours', 'emergency', 'holiday', 'promo', 'staffing_shortage')),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_live_updates (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
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
on public.business_live_updates (location_id, created_at desc)
where cleared_at is null;

create index if not exists business_live_updates_expiration_idx
on public.business_live_updates (expires_at)
where cleared_at is null and expires_at is not null;

alter table public.business_live_settings enable row level security;
alter table public.business_live_updates enable row level security;

drop policy if exists business_live_settings_read on public.business_live_settings;
create policy business_live_settings_read on public.business_live_settings
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_live_settings_manage on public.business_live_settings;
create policy business_live_settings_manage on public.business_live_settings
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

drop policy if exists business_live_updates_read on public.business_live_updates;
create policy business_live_updates_read on public.business_live_updates
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_live_updates_manage on public.business_live_updates;
create policy business_live_updates_manage on public.business_live_updates
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create table if not exists public.owner_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
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
on public.owner_reports (location_id, generated_at desc);

alter table public.owner_reports enable row level security;

drop policy if exists owner_reports_read on public.owner_reports;
create policy owner_reports_read on public.owner_reports
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists owner_reports_manage on public.owner_reports;
create policy owner_reports_manage on public.owner_reports
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create table if not exists public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
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
on public.business_contacts (location_id, contact_type);

alter table public.business_contacts enable row level security;

drop policy if exists business_contacts_read on public.business_contacts;
create policy business_contacts_read on public.business_contacts
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists business_contacts_manage on public.business_contacts;
create policy business_contacts_manage on public.business_contacts
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

create table if not exists public.knowledge_suggestions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  call_id uuid references public.calls(id) on delete set null,
  feedback_id uuid references public.call_feedback(id) on delete set null,
  title text not null,
  body text not null,
  source text not null default 'manual' check (source in ('call_feedback', 'owner_assistant', 'staff_task', 'manual')),
  source_question text,
  suggested_answer text,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  applied_knowledge_section_id uuid references public.knowledge_sections(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_suggestions_location_status_idx
on public.knowledge_suggestions (location_id, status, created_at desc);

alter table public.knowledge_suggestions enable row level security;

drop policy if exists knowledge_suggestions_read on public.knowledge_suggestions;
create policy knowledge_suggestions_read on public.knowledge_suggestions
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists knowledge_suggestions_manage on public.knowledge_suggestions;
create policy knowledge_suggestions_manage on public.knowledge_suggestions
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));

alter table public.customer_requests
  add column if not exists response_text text,
  add column if not exists response_status text not null default 'not_needed',
  add column if not exists response_channel text,
  add column if not exists responded_at timestamptz,
  add column if not exists knowledge_suggestion_id uuid references public.knowledge_suggestions(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_requests_response_status_check'
  ) then
    alter table public.customer_requests
      add constraint customer_requests_response_status_check
      check (response_status in ('not_needed', 'drafted', 'sent', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists customer_requests_location_response_idx
on public.customer_requests (location_id, response_status, updated_at desc);

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

alter table public.message_events
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists message_events_location_created_idx
on public.message_events (location_id, created_at desc);

drop policy if exists message_events_read on public.message_events;
create policy message_events_read on public.message_events
for select to authenticated
using (
  (
    thread_id is not null
    and public.can_access_location(public.message_thread_location_id(thread_id))
  )
  or (
    location_id is not null
    and public.can_access_location(location_id)
  )
);

drop policy if exists message_events_manage on public.message_events;
create policy message_events_manage on public.message_events
for all to authenticated
using (
  (
    thread_id is not null
    and public.can_manage_location(public.message_thread_location_id(thread_id))
  )
  or (
    location_id is not null
    and public.can_manage_location(location_id)
  )
)
with check (
  (
    thread_id is not null
    and public.can_manage_location(public.message_thread_location_id(thread_id))
  )
  or (
    location_id is not null
    and public.can_manage_location(location_id)
  )
);

create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
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
  unique(organization_id)
);

create unique index if not exists billing_accounts_stripe_customer_uidx
on public.billing_accounts (stripe_customer_id)
where stripe_customer_id is not null;

create unique index if not exists billing_accounts_stripe_subscription_uidx
on public.billing_accounts (stripe_subscription_id)
where stripe_subscription_id is not null;

create index if not exists billing_accounts_location_idx
on public.billing_accounts (location_id);

alter table public.billing_accounts enable row level security;

drop policy if exists billing_accounts_read on public.billing_accounts;
create policy billing_accounts_read on public.billing_accounts
for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists billing_accounts_manage on public.billing_accounts;
create policy billing_accounts_manage on public.billing_accounts
for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

-- Seed organizations
insert into public.organizations (id, name) values
  ('0125aaa8-d9cf-41c6-814b-488bac63249e', 'Olive & Ember'),
  ('11111111-1111-4111-9111-111111111111', 'Summit Air'),
  ('22222222-2222-4222-9222-222222222222', 'Harbor Plumbing'),
  ('33333333-3333-4333-9333-333333333333', 'RidgeLine Roofing'),
  ('44444444-4444-4444-9444-444444444444', 'BrightWire Electric'),
  ('55555555-5555-4555-9555-555555555555', 'Luna Studio')
on conflict (id) do update set name = excluded.name;

-- Seed demo auth users + memberships
do $$
declare
  demo record;
  v_user_id uuid;
begin
  for demo in
    select * from (values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'demo.restaurant@signalhost.ai', 'Maria Lombardi', '0125aaa8-d9cf-41c6-814b-488bac63249e'::uuid),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid, 'demo.hvac@signalhost.ai', 'Jamie O''Neill', '11111111-1111-4111-9111-111111111111'::uuid),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid, 'demo.plumbing@signalhost.ai', 'Nora Hayes', '22222222-2222-4222-9222-222222222222'::uuid),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid, 'demo.roofing@signalhost.ai', 'Carla Benton', '33333333-3333-4333-9333-333333333333'::uuid),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'::uuid, 'demo.electrical@signalhost.ai', 'Derek Lin', '44444444-4444-4444-9444-444444444444'::uuid),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6'::uuid, 'demo.salon@signalhost.ai', 'Tessa Ward', '55555555-5555-4555-9555-555555555555'::uuid)
    ) as d(user_id, email, name, organization_id)
  loop
    select id into v_user_id from auth.users where lower(email) = lower(demo.email) limit 1;

    if v_user_id is null then
      v_user_id := demo.user_id;
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        demo.email, crypt('SignalHostDemo!2026', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', demo.name),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_user_id, v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', demo.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    else
      update auth.users
        set encrypted_password = crypt('SignalHostDemo!2026', gen_salt('bf')),
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', demo.name),
            updated_at = now()
        where id = v_user_id;
    end if;

    insert into public.user_memberships (user_id, organization_id, role, member_name, member_email)
    values (v_user_id, demo.organization_id, 'owner', demo.name, demo.email)
    on conflict (user_id, organization_id) do update
      set role = excluded.role,
          member_name = excluded.member_name,
          member_email = excluded.member_email;
  end loop;
end $$;

insert into public.locations (id, organization_id, name, cuisine, timezone, phone, ai_host_phone, address) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', '0125aaa8-d9cf-41c6-814b-488bac63249e', 'Olive & Ember', 'restaurant', 'America/Los_Angeles', '+1 (415) 555-0148', '+1 (415) 555-0142', '118 Valencia St, San Francisco, CA'),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-9111-111111111111', 'Summit Air', 'hvac', 'America/New_York', '+1 (617) 555-0100', '+1 (617) 555-0181', '42 Atlantic Ave, Boston, MA'),
  ('22222222-2222-4222-8222-222222222222', '22222222-2222-4222-9222-222222222222', 'Harbor Plumbing', 'plumbing', 'America/New_York', '+1 (781) 555-0108', '+1 (781) 555-0166', '88 Hancock St, Quincy, MA'),
  ('33333333-3333-4333-8333-333333333333', '33333333-3333-4333-9333-333333333333', 'RidgeLine Roofing', 'roofing', 'America/New_York', '+1 (508) 555-0102', '+1 (508) 555-0137', '214 Highland St, Worcester, MA'),
  ('44444444-4444-4444-8444-444444444444', '44444444-4444-4444-9444-444444444444', 'BrightWire Electric', 'electrical', 'America/New_York', '+1 (978) 555-0120', '+1 (978) 555-0198', '73 Merrimack St, Lowell, MA'),
  ('55555555-5555-4555-8555-555555555555', '55555555-5555-4555-9555-555555555555', 'Luna Studio', 'salon_barber', 'America/New_York', '+1 (339) 555-0122', '+1 (339) 555-0155', '19 Brattle St, Cambridge, MA')
on conflict (id) do update set
  name = excluded.name,
  cuisine = excluded.cuisine,
  timezone = excluded.timezone,
  phone = excluded.phone,
  ai_host_phone = excluded.ai_host_phone,
  address = excluded.address;

insert into public.agent_configs (
  location_id, host_name, tone, greeting_template, disclosure_enabled, call_handling_mode,
  answer_after_rings, after_hours_behavior, escalation_phone_number, answer_faqs_enabled,
  orders_enabled, reservations_enabled, sms_confirmations_enabled, staff_escalation_enabled,
  order_destinations, payment_mode, reservation_mode, reservation_provider
) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', 'Ava', 'upbeat', 'Thank you for calling {restaurant_name}. How can I help you?', false, 'answer_after_rings', 3, 'answer_faqs', '+1 (415) 555-0184', true, true, true, false, true, '["staff_review"]', 'pay_at_pickup', 'manual_request', 'none'),
  ('11111111-1111-4111-8111-111111111111', 'Miles', 'calm', 'Thank you for calling {restaurant_name}. How can I help you?', false, 'answer_after_rings', 3, 'capture_leads', '+1 (617) 555-0114', true, false, true, false, true, '["staff_review"]', 'pay_later', 'manual_request', 'none'),
  ('22222222-2222-4222-8222-222222222222', 'Aiden', 'reassuring', 'Thank you for calling {restaurant_name}. How can I help you?', false, 'answer_after_rings', 3, 'capture_leads', '+1 (781) 555-0195', true, false, true, false, true, '["staff_review"]', 'pay_later', 'manual_request', 'none'),
  ('33333333-3333-4333-8333-333333333333', 'Maya', 'confident', 'Thank you for calling {restaurant_name}. How can I help you?', false, 'answer_after_rings', 3, 'capture_leads', '+1 (508) 555-0151', true, false, true, false, true, '["staff_review"]', 'pay_later', 'manual_request', 'none'),
  ('44444444-4444-4444-8444-444444444444', 'Aiden', 'professional', 'Thank you for calling {restaurant_name}. How can I help you?', false, 'answer_after_rings', 3, 'capture_leads', '+1 (978) 555-0128', true, false, true, false, true, '["staff_review"]', 'pay_later', 'manual_request', 'none'),
  ('55555555-5555-4555-8555-555555555555', 'Maya', 'bright', 'Thank you for calling {restaurant_name}. How can I help you?', false, 'answer_after_rings', 3, 'capture_leads', '+1 (339) 555-0173', true, false, true, false, true, '["front_desk"]', 'pay_later', 'manual_request', 'none')
on conflict (location_id) do update set
  host_name = excluded.host_name,
  tone = excluded.tone,
  greeting_template = excluded.greeting_template,
  disclosure_enabled = excluded.disclosure_enabled,
  escalation_phone_number = excluded.escalation_phone_number,
  orders_enabled = excluded.orders_enabled,
  reservations_enabled = excluded.reservations_enabled,
  sms_confirmations_enabled = excluded.sms_confirmations_enabled,
  staff_escalation_enabled = excluded.staff_escalation_enabled,
  order_destinations = excluded.order_destinations,
  payment_mode = excluded.payment_mode,
  reservation_mode = excluded.reservation_mode,
  updated_at = now();

insert into public.onboarding_profiles (location_id, draft, progress_percent, completed_required, total_required, status) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', '{"businessType":"restaurant","restaurantName":"Olive & Ember","ownerName":"Maria Lombardi","ownerEmail":"maria@oliveandember.com","ownerPhone":"+1 (415) 555-0184","mainPhone":"+1 (415) 555-0148","assignedSignalHostNumber":"+1 (415) 555-0142","voiceProfileId":"ava","timezone":"America/Los_Angeles","takeOrders":true,"takeReservations":true}'::jsonb, 100, 12, 12, 'ready_for_test_call'),
  ('11111111-1111-4111-8111-111111111111', '{"businessType":"hvac","restaurantName":"Summit Air","ownerName":"Jamie O''Neill","ownerEmail":"jamie@summitair.example","ownerPhone":"+1 (617) 555-0114","mainPhone":"+1 (617) 555-0100","assignedSignalHostNumber":"+1 (617) 555-0181","voiceProfileId":"miles","timezone":"America/New_York","takeOrders":false,"takeReservations":true}'::jsonb, 100, 12, 12, 'ready_for_test_call'),
  ('22222222-2222-4222-8222-222222222222', '{"businessType":"plumbing","restaurantName":"Harbor Plumbing","ownerName":"Nora Hayes","ownerEmail":"nora@harborplumbing.example","ownerPhone":"+1 (781) 555-0195","mainPhone":"+1 (781) 555-0108","assignedSignalHostNumber":"+1 (781) 555-0166","voiceProfileId":"aiden","timezone":"America/New_York","takeOrders":false,"takeReservations":true}'::jsonb, 100, 12, 12, 'ready_for_test_call'),
  ('33333333-3333-4333-8333-333333333333', '{"businessType":"roofing","restaurantName":"RidgeLine Roofing","ownerName":"Carla Benton","ownerEmail":"carla@ridgelineroofing.example","ownerPhone":"+1 (508) 555-0151","mainPhone":"+1 (508) 555-0102","assignedSignalHostNumber":"+1 (508) 555-0137","voiceProfileId":"maya","timezone":"America/New_York","takeOrders":false,"takeReservations":true}'::jsonb, 100, 12, 12, 'ready_for_test_call'),
  ('44444444-4444-4444-8444-444444444444', '{"businessType":"electrical","restaurantName":"BrightWire Electric","ownerName":"Derek Lin","ownerEmail":"derek@brightwire.example","ownerPhone":"+1 (978) 555-0128","mainPhone":"+1 (978) 555-0120","assignedSignalHostNumber":"+1 (978) 555-0198","voiceProfileId":"aiden","timezone":"America/New_York","takeOrders":false,"takeReservations":true}'::jsonb, 100, 12, 12, 'ready_for_test_call'),
  ('55555555-5555-4555-8555-555555555555', '{"businessType":"salon_barber","restaurantName":"Luna Studio","ownerName":"Tessa Ward","ownerEmail":"tessa@lunastudio.example","ownerPhone":"+1 (339) 555-0173","mainPhone":"+1 (339) 555-0122","assignedSignalHostNumber":"+1 (339) 555-0155","voiceProfileId":"maya","timezone":"America/New_York","takeOrders":false,"takeReservations":true}'::jsonb, 100, 12, 12, 'ready_for_test_call')
on conflict (location_id) do update set
  draft = onboarding_profiles.draft || excluded.draft,
  progress_percent = excluded.progress_percent,
  completed_required = excluded.completed_required,
  total_required = excluded.total_required,
  status = excluded.status,
  updated_at = now();

delete from public.knowledge_sections
where location_id in (
  '78d8053b-631d-4811-939f-61f0efe1d82a', '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'
) and title like 'Demo - %';

insert into public.knowledge_sections (location_id, title, body) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', 'Demo - Restaurant operations', 'Olive & Ember answers questions about specials, parking, reservations, takeout, allergies, private events, lost items, vendor calls, and complaints. Severe allergies and complaints require staff follow-up.'),
  ('11111111-1111-4111-8111-111111111111', 'Demo - HVAC dispatch', 'Summit Air handles heating repair, AC repair, tune-ups, emergency no-heat and no-cooling calls, heat pumps, indoor air quality, and replacement estimates. Urgent safety calls should route to dispatch.'),
  ('22222222-2222-4222-8222-222222222222', 'Demo - Plumbing triage', 'Harbor Plumbing handles emergency leaks, burst pipes, water heaters, drain clearing, sewer backups, fixtures, toilets, faucets, and small remodel plumbing. Active water calls are urgent.'),
  ('33333333-3333-4333-8333-333333333333', 'Demo - Roofing intake', 'RidgeLine Roofing handles repairs, replacements, inspections, emergency tarping, storm damage, gutters, skylights, and insurance claim support. Active leaks and storm damage are high-value leads.'),
  ('44444444-4444-4444-8444-444444444444', 'Demo - Electrical safety', 'BrightWire Electric handles troubleshooting, panel upgrades, EV chargers, generators, lighting, outlets, switches, service upgrades, and urgent safety calls. Avoid DIY electrical instructions.'),
  ('55555555-5555-4555-8555-555555555555', 'Demo - Salon booking', 'Luna Studio handles haircuts, barber cuts, beard trims, blowouts, color, highlights, balayage, gloss, treatments, kids cuts, bridal styling, and consultations. Major color changes require consultation.');

delete from public.faqs
where location_id in (
  '78d8053b-631d-4811-939f-61f0efe1d82a', '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'
) and question like '[Demo] %';

insert into public.faqs (location_id, question, answer) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', '[Demo] Do you have specials tonight?', 'Tonight''s specials are saffron risotto with scallops, grilled artichokes with lemon aioli, and a blood orange spritz.'),
  ('78d8053b-631d-4811-939f-61f0efe1d82a', '[Demo] Do you have parking?', 'There is a small lot behind the restaurant and two-hour street parking on Valencia.'),
  ('11111111-1111-4111-8111-111111111111', '[Demo] Do you offer emergency HVAC service?', 'Yes. No-heat, no-cooling, leaking equipment, and unsafe equipment calls are treated as urgent.'),
  ('11111111-1111-4111-8111-111111111111', '[Demo] Do you install heat pumps?', 'Yes. Summit Air installs ducted and ductless heat pumps and can schedule a comfort consultation.'),
  ('22222222-2222-4222-8222-222222222222', '[Demo] Do you handle emergency leaks?', 'Yes. Active leaks, burst pipes, sewer backups, and no-water calls are urgent and routed to the on-call plumber.'),
  ('22222222-2222-4222-8222-222222222222', '[Demo] What should I do if water is actively leaking?', 'If it is safe, turn off the nearest shutoff or the main water valve and wait for the team to call back.'),
  ('33333333-3333-4333-8333-333333333333', '[Demo] Do you handle storm damage?', 'Yes. Storm damage, active leaks, missing shingles, and emergency tarping requests are high priority.'),
  ('33333333-3333-4333-8333-333333333333', '[Demo] Do you work with insurance claims?', 'Yes. RidgeLine can document roof damage and explain the inspection process, but insurers make final coverage decisions.'),
  ('44444444-4444-4444-8444-444444444444', '[Demo] Do you install EV chargers?', 'Yes. Capture vehicle type, charger type, panel location, parking location, and whether panel photos are available.'),
  ('44444444-4444-4444-8444-444444444444', '[Demo] What if I smell burning?', 'Burning smells, sparking, smoke, exposed wires, and hot panels are urgent safety calls. Avoid the area and wait for a licensed electrician.'),
  ('55555555-5555-4555-8555-555555555555', '[Demo] Can I book a color consultation?', 'Yes. Color corrections, major blonding changes, and first-time vivid color should start with a consultation.'),
  ('55555555-5555-4555-8555-555555555555', '[Demo] Do you take walk-ins?', 'Walk-ins are accepted when there is room, but booking ahead is strongly recommended.');

delete from public.business_links
where location_id in (
  '78d8053b-631d-4811-939f-61f0efe1d82a', '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'
) and url like 'https://%.example/%';

insert into public.business_links (location_id, link_type, label, url, description, sort_order) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', 'ordering', 'Order takeout', 'https://oliveandember.example/order', 'Online ordering link for takeout.', 1),
  ('78d8053b-631d-4811-939f-61f0efe1d82a', 'reservation', 'Book a table', 'https://oliveandember.example/reservations', 'Reservation link for standard parties.', 2),
  ('11111111-1111-4111-8111-111111111111', 'appointment', 'Schedule service', 'https://summitair.example/schedule', 'Main appointment request page.', 1),
  ('11111111-1111-4111-8111-111111111111', 'quote', 'Heat pump estimate', 'https://summitair.example/heat-pumps', 'Heat pump consultation form.', 2),
  ('22222222-2222-4222-8222-222222222222', 'appointment', 'Request service', 'https://harborplumbing.example/service', 'General plumbing service request.', 1),
  ('22222222-2222-4222-8222-222222222222', 'urgent', 'Emergency callback', 'https://harborplumbing.example/emergency', 'Emergency callback request.', 2),
  ('33333333-3333-4333-8333-333333333333', 'appointment', 'Request inspection', 'https://ridgelineroofing.example/inspection', 'Roof inspection request.', 1),
  ('33333333-3333-4333-8333-333333333333', 'photo_upload', 'Upload roof photos', 'https://ridgelineroofing.example/photos', 'Photo upload for roof damage.', 2),
  ('44444444-4444-4444-8444-444444444444', 'appointment', 'Schedule electrical service', 'https://brightwire.example/service', 'Electrical service request.', 1),
  ('44444444-4444-4444-8444-444444444444', 'quote', 'EV charger estimate', 'https://brightwire.example/ev-chargers', 'EV charger estimate form.', 2),
  ('55555555-5555-4555-8555-555555555555', 'booking', 'Book online', 'https://lunastudio.example/book', 'Main booking link.', 1),
  ('55555555-5555-4555-8555-555555555555', 'consultation', 'Color consultation', 'https://lunastudio.example/color-consult', 'Color consultation booking.', 2);

delete from public.business_contacts
where email in (
  'maria@oliveandember.com', 'jamie@summitair.example', 'nora@harborplumbing.example',
  'carla@ridgelineroofing.example', 'derek@brightwire.example', 'tessa@lunastudio.example'
);

insert into public.business_contacts (
  location_id, contact_type, name, phone, email, preferred_channel, can_receive_alerts,
  can_use_owner_assistant, can_add_live_updates, can_approve_permanent_knowledge,
  can_resolve_customer_requests, can_manage_alert_preferences, requires_owner_approval,
  trusted_identity_enabled
) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', 'owner', 'Maria Lombardi', '+1 (415) 555-0184', 'maria@oliveandember.com', 'both', true, true, true, true, true, true, false, true),
  ('11111111-1111-4111-8111-111111111111', 'owner', 'Jamie O''Neill', '+1 (617) 555-0114', 'jamie@summitair.example', 'both', true, true, true, true, true, true, false, true),
  ('22222222-2222-4222-8222-222222222222', 'owner', 'Nora Hayes', '+1 (781) 555-0195', 'nora@harborplumbing.example', 'both', true, true, true, true, true, true, false, true),
  ('33333333-3333-4333-8333-333333333333', 'owner', 'Carla Benton', '+1 (508) 555-0151', 'carla@ridgelineroofing.example', 'both', true, true, true, true, true, true, false, true),
  ('44444444-4444-4444-8444-444444444444', 'owner', 'Derek Lin', '+1 (978) 555-0128', 'derek@brightwire.example', 'both', true, true, true, true, true, true, false, true),
  ('55555555-5555-4555-8555-555555555555', 'owner', 'Tessa Ward', '+1 (339) 555-0173', 'tessa@lunastudio.example', 'both', true, true, true, true, true, true, false, true);

insert into public.phone_numbers (
  location_id, provider, provider_sid, phone_number, restaurant_main_line, forwarding_mode,
  forwarding_status, status, voice_webhook_url, sms_webhook_url, capabilities,
  verification_results, provisioning_source, trial_started_at, trial_ends_at, trial_grace_ends_at
) values
  ('78d8053b-631d-4811-939f-61f0efe1d82a', 'twilio', null, '+1 (415) 555-0142', '+1 (415) 555-0148', 'forward_unanswered', 'verified', 'demo', 'https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=78d8053b-631d-4811-939f-61f0efe1d82a', 'https://hostline-voice.onrender.com/twilio/sms', '{"voice":true,"sms":false}'::jsonb, '{"directCall":"passed","noAnswerForwarding":"passed"}'::jsonb, 'demo_seed', now(), now() + interval '7 days', now() + interval '21 days'),
  ('11111111-1111-4111-8111-111111111111', 'twilio', null, '+1 (617) 555-0181', '+1 (617) 555-0100', 'forward_unanswered', 'not_verified', 'demo', 'https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=11111111-1111-4111-8111-111111111111', 'https://hostline-voice.onrender.com/twilio/sms', '{"voice":true,"sms":false}'::jsonb, '{"directCall":"pending"}'::jsonb, 'demo_seed', now(), now() + interval '7 days', now() + interval '21 days'),
  ('22222222-2222-4222-8222-222222222222', 'twilio', null, '+1 (781) 555-0166', '+1 (781) 555-0108', 'forward_unanswered', 'not_verified', 'demo', 'https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=22222222-2222-4222-8222-222222222222', 'https://hostline-voice.onrender.com/twilio/sms', '{"voice":true,"sms":false}'::jsonb, '{"directCall":"pending"}'::jsonb, 'demo_seed', now(), now() + interval '7 days', now() + interval '21 days'),
  ('33333333-3333-4333-8333-333333333333', 'twilio', null, '+1 (508) 555-0137', '+1 (508) 555-0102', 'forward_unanswered', 'not_verified', 'demo', 'https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=33333333-3333-4333-8333-333333333333', 'https://hostline-voice.onrender.com/twilio/sms', '{"voice":true,"sms":false}'::jsonb, '{"directCall":"pending"}'::jsonb, 'demo_seed', now(), now() + interval '7 days', now() + interval '21 days'),
  ('44444444-4444-4444-8444-444444444444', 'twilio', null, '+1 (978) 555-0198', '+1 (978) 555-0120', 'forward_unanswered', 'not_verified', 'demo', 'https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=44444444-4444-4444-8444-444444444444', 'https://hostline-voice.onrender.com/twilio/sms', '{"voice":true,"sms":false}'::jsonb, '{"directCall":"pending"}'::jsonb, 'demo_seed', now(), now() + interval '7 days', now() + interval '21 days'),
  ('55555555-5555-4555-8555-555555555555', 'twilio', null, '+1 (339) 555-0155', '+1 (339) 555-0122', 'forward_unanswered', 'not_verified', 'demo', 'https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=55555555-5555-4555-8555-555555555555', 'https://hostline-voice.onrender.com/twilio/sms', '{"voice":true,"sms":false}'::jsonb, '{"directCall":"pending"}'::jsonb, 'demo_seed', now(), now() + interval '7 days', now() + interval '21 days')
on conflict (provider, phone_number) do update set
  location_id = excluded.location_id,
  restaurant_main_line = excluded.restaurant_main_line,
  forwarding_mode = excluded.forwarding_mode,
  forwarding_status = excluded.forwarding_status,
  status = excluded.status,
  voice_webhook_url = excluded.voice_webhook_url,
  sms_webhook_url = excluded.sms_webhook_url,
  capabilities = excluded.capabilities,
  verification_results = excluded.verification_results,
  provisioning_source = excluded.provisioning_source,
  updated_at = now();

delete from public.transcript_turns
where call_id in (select id from public.calls where external_call_sid like 'demo-seed-%');

delete from public.calls where external_call_sid like 'demo-seed-%';

insert into public.calls (
  id, location_id, external_call_sid, caller_name, caller_phone, started_at,
  duration_seconds, intent, outcome, confidence, status, summary, workflow_status,
  urgency, value_tier, follow_up_needed, knowledge_gap, owner_report_bucket,
  recommended_action, tags
) values
  ('90000000-0000-4000-8000-000000000001', '78d8053b-631d-4811-939f-61f0efe1d82a', 'demo-seed-restaurant-specials', 'Marco P.', '+1 (917) 555-0142', now() - interval '2 hours', 64, 'faq', 'resolved', 96, 'resolved', 'Caller asked about tonight''s specials and parking. SignalHost answered and offered the reservation link.', 'resolved', 'normal', 'medium', false, false, 'handled', null, '["specials","parking"]'::jsonb),
  ('90000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'demo-seed-hvac-no-heat', 'Dana R.', '+1 (617) 555-0191', now() - interval '3 hours', 112, 'reservation', 'message_taken', 94, 'new', 'Caller reported no heat and requested urgent service. SignalHost captured address, system type, and callback number.', 'needs_follow_up', 'urgent', 'high', true, false, 'revenue_opportunity', 'Dispatcher should call back for no-heat service.', '["no heat","urgent","service lead"]'::jsonb),
  ('90000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'demo-seed-plumbing-leak', 'Ken M.', '+1 (781) 555-0130', now() - interval '4 hours', 98, 'other', 'escalated', 95, 'new', 'Caller had water coming through the ceiling. SignalHost advised safe shutoff if possible and created an urgent callback task.', 'escalated', 'urgent', 'high', true, false, 'revenue_opportunity', 'On-call plumber should call back immediately.', '["active leak","emergency"]'::jsonb),
  ('90000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333', 'demo-seed-roofing-storm', 'Lisa C.', '+1 (508) 555-0177', now() - interval '5 hours', 141, 'other', 'message_taken', 92, 'new', 'Caller asked for storm damage help after shingles blew off. SignalHost collected address and sent the photo upload link.', 'quote_requested', 'high', 'very_high', true, false, 'revenue_opportunity', 'Follow up on storm damage inspection request.', '["storm damage","photos","inspection"]'::jsonb),
  ('90000000-0000-4000-8000-000000000005', '44444444-4444-4444-8444-444444444444', 'demo-seed-electrical-ev', 'Priya S.', '+1 (978) 555-0164', now() - interval '6 hours', 118, 'reservation', 'message_taken', 91, 'new', 'Caller requested an EV charger estimate. SignalHost captured garage setup, charger type, and panel photo availability.', 'quote_requested', 'normal', 'high', true, false, 'revenue_opportunity', 'Send EV charger estimate intake to the owner.', '["ev charger","estimate"]'::jsonb),
  ('90000000-0000-4000-8000-000000000006', '55555555-5555-4555-8555-555555555555', 'demo-seed-salon-color', 'Alicia W.', '+1 (339) 555-0119', now() - interval '7 hours', 72, 'reservation', 'booking_link_sent', 93, 'resolved', 'Caller wanted to go blonde. SignalHost explained that a consultation is required and sent the color consultation link.', 'booking_link_sent', 'normal', 'medium', false, false, 'handled', null, '["color consultation","booking link"]'::jsonb);

insert into public.transcript_turns (call_id, speaker, text, offset_seconds) values
  ('90000000-0000-4000-8000-000000000001', 'agent', 'Thank you for calling Olive & Ember. How can I help you?', 0),
  ('90000000-0000-4000-8000-000000000001', 'caller', 'Do you have any specials tonight, and is there parking?', 4),
  ('90000000-0000-4000-8000-000000000001', 'agent', 'Yes. Tonight''s specials include saffron risotto with scallops and grilled artichokes. There is a small lot behind the restaurant and street parking nearby. Can I help with anything else?', 10),
  ('90000000-0000-4000-8000-000000000002', 'caller', 'My heat is out and it is getting cold in the house.', 3),
  ('90000000-0000-4000-8000-000000000002', 'agent', 'I can get that to dispatch as urgent. What is the service address and the best number for the callback?', 8),
  ('90000000-0000-4000-8000-000000000003', 'caller', 'There is water coming through my ceiling.', 2),
  ('90000000-0000-4000-8000-000000000003', 'agent', 'If it is safe, turn off the nearest water shutoff or the main valve. I am sending this to the on-call plumber now.', 8),
  ('90000000-0000-4000-8000-000000000004', 'caller', 'The storm ripped shingles off my roof. Can I upload photos?', 5),
  ('90000000-0000-4000-8000-000000000004', 'agent', 'Yes. I can send the photo upload link and collect the address so RidgeLine can prioritize the inspection.', 12),
  ('90000000-0000-4000-8000-000000000005', 'caller', 'Can you install an EV charger in my garage?', 3),
  ('90000000-0000-4000-8000-000000000005', 'agent', 'Yes. I will collect the charger type, panel location, and whether you can upload panel photos for the estimate.', 9),
  ('90000000-0000-4000-8000-000000000006', 'caller', 'I want to go blonde. What should I book?', 3),
  ('90000000-0000-4000-8000-000000000006', 'agent', 'For a major blonding change, start with a color consultation. I can send you that booking link.', 8);