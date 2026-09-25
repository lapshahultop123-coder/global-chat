-- Private voice calls: per-user call blocks and secure target checks.
create table if not exists public.private_call_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists private_call_blocks_blocked_idx on public.private_call_blocks(blocked_id);
alter table public.private_call_blocks enable row level security;
drop policy if exists private_call_blocks_own_select on public.private_call_blocks;
create policy private_call_blocks_own_select on public.private_call_blocks
  for select to authenticated using (blocker_id = auth.uid() or blocked_id = auth.uid());
grant select on public.private_call_blocks to authenticated;

create or replace function public.get_private_call_members(p_room_id uuid)
returns table(user_id uuid,name text,avatar_id integer,is_blocked_by_me boolean,has_blocked_me boolean)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_private_room_member(p_room_id) then
    raise exception 'Not a member of this private room';
  end if;
  return query
  select
    u.id,
    coalesce(p.name, 'User'),
    coalesce(p.avatar_id, 1),
    exists(select 1 from public.private_call_blocks b where b.blocker_id=auth.uid() and b.blocked_id=u.id),
    exists(select 1 from public.private_call_blocks b where b.blocker_id=u.id and b.blocked_id=auth.uid())
  from public.private_room_members m
  join auth.users u on u.id=m.user_id
  left join public.profiles p on p.user_id=u.id
  where m.room_id=p_room_id and u.id<>auth.uid();
end; $$;
revoke all on function public.get_private_call_members(uuid) from public,anon;
grant execute on function public.get_private_call_members(uuid) to authenticated;

create or replace function public.set_private_call_block(p_room_id uuid,p_user_id uuid,p_blocked boolean)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_private_room_member(p_room_id) then
    raise exception 'Not a member of this private room';
  end if;
  if p_user_id=auth.uid() then raise exception 'You cannot block yourself'; end if;
  if not exists(select 1 from public.private_room_members where room_id=p_room_id and user_id=p_user_id) then
    raise exception 'User is not a member of this private room';
  end if;
  if p_blocked then
    insert into public.private_call_blocks(blocker_id,blocked_id)
    values(auth.uid(),p_user_id)
    on conflict(blocker_id,blocked_id) do nothing;
  else
    delete from public.private_call_blocks where blocker_id=auth.uid() and blocked_id=p_user_id;
  end if;
  return p_blocked;
end; $$;
revoke all on function public.set_private_call_block(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_private_call_block(uuid,uuid,boolean) to authenticated;

create or replace function public.check_private_call_targets(p_room_id uuid,p_target_ids uuid[])
returns table(user_id uuid,allowed boolean)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_private_room_member(p_room_id) then
    raise exception 'Not a member of this private room';
  end if;
  return query
  select t.user_id,
    exists(select 1 from public.private_room_members m where m.room_id=p_room_id and m.user_id=t.user_id)
    and not exists(select 1 from public.private_call_blocks b where b.blocker_id=auth.uid() and b.blocked_id=t.user_id)
    and not exists(select 1 from public.private_call_blocks b where b.blocker_id=t.user_id and b.blocked_id=auth.uid())
  from unnest(coalesce(p_target_ids,'{}'::uuid[])) as t(user_id)
  where t.user_id<>auth.uid();
end; $$;
revoke all on function public.check_private_call_targets(uuid,uuid[]) from public,anon;
grant execute on function public.check_private_call_targets(uuid,uuid[]) to authenticated;
