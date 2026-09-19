create or replace function public.delete_voice_message_for_everyone(
  p_user_id uuid,
  p_voice_id uuid
)
returns public.voice_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.voice_messages;
begin
  if p_user_id is null then
    raise exception 'unauthorized';
  end if;

  delete from public.voice_messages
  where id = p_voice_id
    and user_id = p_user_id
    and expires_at > now()
  returning * into v;

  if v.id is null then
    raise exception 'not_found';
  end if;

  return v;
end;
$$;

revoke all on function public.delete_voice_message_for_everyone(uuid) from public;
revoke all on function public.delete_voice_message_for_everyone(uuid,uuid) from public;
grant execute on function public.delete_voice_message_for_everyone(uuid,uuid) to service_role;
