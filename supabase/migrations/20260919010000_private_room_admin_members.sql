-- Private room members: profile directory plus owner-only remove/block/unblock.
create table if not exists public.private_room_blocks(room_id uuid not null references public.private_rooms(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,blocked_by uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(room_id,user_id));
alter table public.private_room_blocks enable row level security;
drop policy if exists private_room_blocks_owner_select on public.private_room_blocks;
create policy private_room_blocks_owner_select on public.private_room_blocks for select to authenticated using(exists(select 1 from public.private_rooms r where r.id=room_id and r.owner_id=auth.uid()));
grant select on public.private_room_blocks to authenticated;

drop function if exists public.get_private_room_members(uuid);
create or replace function public.get_private_room_members(p_room_id uuid) returns table(user_id uuid,name text,country text,subdivision text,avatar_id integer,joined_at timestamptz,is_owner boolean,is_blocked boolean) language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 return query select u.id,coalesce(p.name,lm.name,lv.name,'User'),coalesce(p.country,lm.country,lv.country,''),coalesce(p.subdivision,lm.subdivision,lv.subdivision,''),coalesce(p.avatar_id,lm.avatar_id,lv.avatar_id,1),m.joined_at,r.owner_id=u.id,(b.user_id is not null) from public.private_room_members m join public.private_rooms r on r.id=m.room_id join auth.users u on u.id=m.user_id left join public.profiles p on p.user_id=u.id left join lateral(select pm.name,pm.country,pm.subdivision,pm.avatar_id from public.private_messages pm where pm.room_id=p_room_id and pm.user_id=u.id order by pm.created_at desc limit 1) lm on true left join lateral(select pv.name,pv.country,pv.subdivision,pv.avatar_id from public.private_voice_messages pv where pv.room_id=p_room_id and pv.user_id=u.id order by pv.created_at desc limit 1) lv on true left join public.private_room_blocks b on b.room_id=p_room_id and b.user_id=u.id where m.room_id=p_room_id;
 return query select u.id,coalesce(p.name,'User'),coalesce(p.country,''),coalesce(p.subdivision,''),coalesce(p.avatar_id,1),null::timestamptz,r.owner_id=u.id,true from public.private_room_blocks b join public.private_rooms r on r.id=b.room_id join auth.users u on u.id=b.user_id left join public.profiles p on p.user_id=u.id where b.room_id=p_room_id and not exists(select 1 from public.private_room_members m where m.room_id=p_room_id and m.user_id=b.user_id);
end; $$;
revoke all on function public.get_private_room_members(uuid) from public,anon; grant execute on function public.get_private_room_members(uuid) to authenticated;

drop function if exists public.join_private_room(text);
create or replace function public.join_private_room(p_join_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.private_rooms; code text:=upper(trim(p_join_code));
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into r from public.private_rooms where join_code=code;
 if not found then raise exception 'Private room not found'; end if;
 if exists(select 1 from public.private_room_blocks b where b.room_id=r.id and b.user_id=auth.uid()) then raise exception 'You are blocked from this private chat'; end if;
 insert into public.private_room_members(room_id,user_id) values(r.id,auth.uid()) on conflict do nothing;
 return jsonb_build_object('room_id',r.id,'room_name',r.name,'join_code',r.join_code,'owner',r.owner_id=auth.uid(),'owner_id',r.owner_id);
end; $$;
revoke all on function public.join_private_room(text) from public,anon; grant execute on function public.join_private_room(text) to authenticated;

drop function if exists public.remove_private_room_member(uuid,uuid);
create or replace function public.remove_private_room_member(p_room_id uuid,p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.private_rooms where id=p_room_id and owner_id=auth.uid()) then raise exception 'Only the room admin can remove members'; end if; if p_user_id=auth.uid() then raise exception 'The room admin cannot remove themselves'; end if; if exists(select 1 from public.private_rooms where id=p_room_id and owner_id=p_user_id) then raise exception 'The room admin cannot be removed'; end if; delete from public.private_room_members where room_id=p_room_id and user_id=p_user_id; return found; end; $$;
grant execute on function public.remove_private_room_member(uuid,uuid) to authenticated;

drop function if exists public.block_private_room_member(uuid,uuid);
create or replace function public.block_private_room_member(p_room_id uuid,p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.private_rooms where id=p_room_id and owner_id=auth.uid()) then raise exception 'Only the room admin can block members'; end if; if p_user_id=auth.uid() then raise exception 'The room admin cannot block themselves'; end if; insert into public.private_room_blocks(room_id,user_id,blocked_by) values(p_room_id,p_user_id,auth.uid()) on conflict(room_id,user_id) do update set blocked_by=excluded.blocked_by,created_at=now(); delete from public.private_room_members where room_id=p_room_id and user_id=p_user_id; return true; end; $$;
grant execute on function public.block_private_room_member(uuid,uuid) to authenticated;

drop function if exists public.unblock_private_room_member(uuid,uuid);
create or replace function public.unblock_private_room_member(p_room_id uuid,p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.private_rooms where id=p_room_id and owner_id=auth.uid()) then raise exception 'Only the room admin can unblock members'; end if; delete from public.private_room_blocks where room_id=p_room_id and user_id=p_user_id; return found; end; $$;
grant execute on function public.unblock_private_room_member(uuid,uuid) to authenticated;
