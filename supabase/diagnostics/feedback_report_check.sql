-- Read-only: run as postgres in the Supabase SQL Editor.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'feedback_reports'
order by ordinal_position;

select
  has_table_privilege('service_role', 'public.feedback_reports', 'INSERT') as service_role_can_insert,
  has_table_privilege('authenticated', 'public.feedback_reports', 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', 'public.feedback_reports', 'SELECT') as authenticated_can_select;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'feedback_reports'
order by policyname;
