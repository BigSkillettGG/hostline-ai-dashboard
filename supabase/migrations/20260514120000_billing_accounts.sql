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
