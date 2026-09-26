create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null default 'Anonymous',
  report_type text not null check (report_type in ('bug', 'feedback', 'not-working')),
  description text not null check (char_length(trim(description)) >= 5),
  page text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.feedback_reports enable row level security;

drop policy if exists "Users can create their own feedback reports"
on public.feedback_reports;

create policy "Users can create their own feedback reports"
on public.feedback_reports
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can view their own feedback reports"
on public.feedback_reports;

create policy "Users can view their own feedback reports"
on public.feedback_reports
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists feedback_reports_created_at_idx
on public.feedback_reports (created_at desc);

create index if not exists feedback_reports_user_id_idx
on public.feedback_reports (user_id);

