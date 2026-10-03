create or replace function public.transfer_private_room_ownership(
  p_room_id uuid,
  p_new_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_new_owner_id is null or p_new_owner_id = auth.uid() then
    raise exception 'Choose another active room member';
  end if;

  select owner_id into current_owner_id
  from public.private_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Private room not found';
  end if;
  if current_owner_id <> auth.uid() then
    raise exception 'Only the current room owner can transfer ownership';
  end if;
  if not exists (
    select 1
    from public.private_room_members
    where room_id = p_room_id and user_id = p_new_owner_id
  ) then
    raise exception 'The new owner must be an active room member';
  end if;

  update public.private_rooms
  set owner_id = p_new_owner_id
  where id = p_room_id;

  return true;
end;
$$;

revoke all on function public.transfer_private_room_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_private_room_ownership(uuid, uuid) to authenticated;
