create table if not exists knowledge_suggestions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  feedback_id uuid references call_feedback(id) on delete set null,
  title text not null,
  body text not null,
  source text not null default 'manual' check (source in ('call_feedback', 'owner_assistant', 'staff_task', 'manual')),
  source_question text,
  suggested_answer text,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  applied_knowledge_section_id uuid references knowledge_sections(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_suggestions_location_status_idx
on knowledge_suggestions (location_id, status, created_at desc);

alter table knowledge_suggestions enable row level security;

drop policy if exists knowledge_suggestions_read on knowledge_suggestions;
create policy knowledge_suggestions_read on knowledge_suggestions
for select to authenticated
using (public.can_access_location(location_id));

drop policy if exists knowledge_suggestions_manage on knowledge_suggestions;
create policy knowledge_suggestions_manage on knowledge_suggestions
for all to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_location(location_id));
