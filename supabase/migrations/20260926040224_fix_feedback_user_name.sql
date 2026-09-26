alter table public.feedback_reports
add column if not exists user_name text not null default 'Anonymous';
