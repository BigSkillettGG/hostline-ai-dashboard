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
