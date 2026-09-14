create or replace function public.delete_message_for_everyone(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.messages
  where id = p_message_id
    and user_id = auth.uid()
    and expires_at > now();

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.delete_message_for_everyone(uuid) from public;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
