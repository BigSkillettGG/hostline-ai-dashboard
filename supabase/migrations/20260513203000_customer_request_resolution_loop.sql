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
