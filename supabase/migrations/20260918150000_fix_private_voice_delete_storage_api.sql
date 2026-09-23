-- Fix private voice deletion: storage objects must be deleted through the
-- Supabase Storage API from the client, not by writing to storage.objects.
create or replace function public.delete_private_voice(p_voice_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.private_voice_messages;
begin
  select *
  into v
  from public.private_voice_messages
  where id=p_voice_id;

  if v.id is null then
    raise exception 'Private voice message not found';
  end if;

  if not public.is_private_room_member(v.room_id) then
    raise exception 'Not a member';
  end if;

  if v.user_id<>auth.uid() then
    raise exception 'Only the sender can delete for everyone';
  end if;

  -- Audio is removed with supabase.storage.from(...).remove(...) in the client.
  delete from public.private_voice_messages
  where id=p_voice_id;

  return true;
end;
$$;

grant execute on function public.delete_private_voice(uuid) to authenticated;

