alter table public.private_rooms
  add column if not exists member_limit integer;

alter table public.private_rooms
  drop constraint if exists private_rooms_member_limit_check;

alter table public.private_rooms
  add constraint private_rooms_member_limit_check
  check (member_limit is null or member_limit between 1 and 1000);

create or replace function public.set_private_room_member_limit(
  p_room_id uuid,
  p_member_limit integer
)
returns integer
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
  if p_member_limit is not null and (p_member_limit < 1 or p_member_limit > 1000) then
    raise exception 'Member limit must be between 1 and 1000';
  end if;

  select owner_id into current_owner_id
  from public.private_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Private room not found';
  end if;
  if current_owner_id <> auth.uid() then
    raise exception 'Only the room admin can change the member limit';
  end if;

  update public.private_rooms
  set member_limit = p_member_limit
  where id = p_room_id;

  return p_member_limit;
end;
$$;

revoke all on function public.set_private_room_member_limit(uuid, integer) from public, anon;
grant execute on function public.set_private_room_member_limit(uuid, integer) to authenticated;

drop function if exists public.join_private_room(text);
create or replace function public.join_private_room(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.private_rooms;
  code text := upper(trim(p_join_code));
  already_member boolean;
  active_member_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into r
  from public.private_rooms
  where join_code = code
  for update;

  if not found then
    raise exception 'Private room not found';
  end if;
  if exists (
    select 1 from public.private_room_blocks
    where room_id = r.id and user_id = auth.uid()
  ) then
    raise exception 'You are blocked from this private chat';
  end if;

  select exists (
    select 1 from public.private_room_members
    where room_id = r.id and user_id = auth.uid()
  ) into already_member;

  if not already_member then
    if r.member_limit is not null then
      select count(*) into active_member_count
      from public.private_room_members
      where room_id = r.id;
      if active_member_count >= r.member_limit then
        raise exception 'This private chat has reached its member limit';
      end if;
    end if;
    insert into public.private_room_members(room_id, user_id)
    values (r.id, auth.uid());
  end if;

  return jsonb_build_object(
    'room_id', r.id,
    'room_name', r.name,
    'join_code', r.join_code,
    'owner', r.owner_id = auth.uid(),
    'owner_id', r.owner_id,
    'member_limit', r.member_limit
  );
end;
$$;

revoke all on function public.join_private_room(text) from public, anon;
grant execute on function public.join_private_room(text) to authenticated;
