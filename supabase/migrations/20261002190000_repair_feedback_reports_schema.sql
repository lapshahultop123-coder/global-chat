-- Ensure feedback storage exists and has the columns expected by submit-feedback.
create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null default 'Anonymous',
  report_type text not null default 'bug',
  description text not null,
  page text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.feedback_reports
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists user_name text not null default 'Anonymous',
  add column if not exists report_type text not null default 'bug',
  add column if not exists description text,
  add column if not exists page text,
  add column if not exists status text not null default 'new',
  add column if not exists created_at timestamptz not null default now();

alter table public.feedback_reports
  alter column id set default gen_random_uuid(),
  alter column created_at set default now();

alter table public.feedback_reports enable row level security;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.feedback_reports'::regclass and conname='feedback_reports_report_type_check') then
    alter table public.feedback_reports
      add constraint feedback_reports_report_type_check
      check (report_type in ('bug', 'feedback', 'not-working')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.feedback_reports'::regclass and conname='feedback_reports_description_check') then
    alter table public.feedback_reports
      add constraint feedback_reports_description_check
      check (char_length(trim(description)) >= 5) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.feedback_reports'::regclass and conname='feedback_reports_status_check') then
    alter table public.feedback_reports
      add constraint feedback_reports_status_check
      check (status in ('new', 'reviewed', 'resolved')) not valid;
  end if;
end;
$$;

drop policy if exists "Users can create their own feedback reports" on public.feedback_reports;
create policy "Users can create their own feedback reports"
  on public.feedback_reports for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own feedback reports" on public.feedback_reports;
create policy "Users can view their own feedback reports"
  on public.feedback_reports for select to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.feedback_reports to authenticated;
grant all privileges on public.feedback_reports to service_role;

create index if not exists feedback_reports_created_at_idx
  on public.feedback_reports (created_at desc);
create index if not exists feedback_reports_user_id_idx
  on public.feedback_reports (user_id);

notify pgrst, 'reload schema';
