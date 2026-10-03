-- Per-profile location visibility. Existing profile locations remain stored for
-- the owner's settings; chat rows and directory RPCs only expose allowed parts.
alter table public.profiles
  add column if not exists show_country boolean not null default true,
  add column if not exists show_subdivision boolean not null default true;

create or replace function public.apply_message_location_privacy()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  allow_country boolean;
  allow_subdivision boolean;
begin
  select p.show_country,p.show_subdivision into allow_country,allow_subdivision
  from public.profiles p where p.user_id=new.user_id;
  if found then
    if not coalesce(allow_country,true) then new.country:=''; end if;
    if not coalesce(allow_subdivision,true) then new.subdivision:=''; end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_skill_exchange_location_privacy()
returns trigger language plpgsql security definer set search_path=public as $$
declare allow_country boolean;
begin
  select p.show_country into allow_country from public.profiles p where p.user_id=new.owner_id;
  if found and not coalesce(allow_country,true) then new.country:=''; end if;
  return new;
end;
$$;
drop trigger if exists apply_skill_location_privacy_before_write on public.skill_exchange_posts;
create trigger apply_skill_location_privacy_before_write
before insert or update of owner_id,country on public.skill_exchange_posts
for each row execute function public.apply_skill_exchange_location_privacy();

do $$
declare table_name text;
begin
  foreach table_name in array array['messages','voice_messages','private_messages','private_voice_messages'] loop
    execute format('drop trigger if exists apply_location_privacy_before_write on public.%I',table_name);
    execute format('create trigger apply_location_privacy_before_write before insert or update of user_id,country,subdivision on public.%I for each row execute function public.apply_message_location_privacy()',table_name);
  end loop;
end;
$$;

create or replace function public.sync_profile_location_privacy()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.country is not distinct from old.country
     and new.subdivision is not distinct from old.subdivision
     and new.show_country is not distinct from old.show_country
     and new.show_subdivision is not distinct from old.show_subdivision then
    return new;
  end if;
  update public.messages set country=case when new.show_country then new.country else '' end,
    subdivision=case when new.show_subdivision then new.subdivision else '' end where user_id=new.user_id;
  update public.voice_messages set country=case when new.show_country then new.country else '' end,
    subdivision=case when new.show_subdivision then new.subdivision else '' end where user_id=new.user_id;
  update public.private_messages set country=case when new.show_country then new.country else '' end,
    subdivision=case when new.show_subdivision then new.subdivision else '' end where user_id=new.user_id;
  update public.private_voice_messages set country=case when new.show_country then new.country else '' end,
    subdivision=case when new.show_subdivision then new.subdivision else '' end where user_id=new.user_id;
  update public.skill_exchange_posts set country=case when new.show_country then new.country else '' end
    where owner_id=new.user_id;
  return new;
end;
$$;

drop trigger if exists sync_profile_location_privacy_after_change on public.profiles;
create trigger sync_profile_location_privacy_after_change
after update of country,subdivision,show_country,show_subdivision on public.profiles
for each row execute function public.sync_profile_location_privacy();

-- Hide location in the room-member directory as well as in chat messages.
create or replace function public.get_private_room_members(p_room_id uuid)
returns table(user_id uuid,name text,country text,subdivision text,avatar_id integer,joined_at timestamptz,is_owner boolean,is_blocked boolean)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
  return query
    select u.id,coalesce(p.name,lm.name,lv.name,'User'),
      case when p.show_country is false then '' else coalesce(p.country,lm.country,lv.country,'') end,
      case when p.show_subdivision is false then '' else coalesce(p.subdivision,lm.subdivision,lv.subdivision,'') end,
      coalesce(p.avatar_id,lm.avatar_id,lv.avatar_id,1),m.joined_at,r.owner_id=u.id,(b.user_id is not null)
    from public.private_room_members m
    join public.private_rooms r on r.id=m.room_id
    join auth.users u on u.id=m.user_id
    left join public.profiles p on p.user_id=u.id
    left join lateral(select pm.name,pm.country,pm.subdivision,pm.avatar_id from public.private_messages pm where pm.room_id=p_room_id and pm.user_id=u.id order by pm.created_at desc limit 1) lm on true
    left join lateral(select pv.name,pv.country,pv.subdivision,pv.avatar_id from public.private_voice_messages pv where pv.room_id=p_room_id and pv.user_id=u.id order by pv.created_at desc limit 1) lv on true
    left join public.private_room_blocks b on b.room_id=p_room_id and b.user_id=u.id
    where m.room_id=p_room_id;
  return query
    select u.id,coalesce(p.name,'User'),case when p.show_country is false then '' else coalesce(p.country,'') end,
      case when p.show_subdivision is false then '' else coalesce(p.subdivision,'') end,coalesce(p.avatar_id,1),null::timestamptz,r.owner_id=u.id,true
    from public.private_room_blocks b
    join public.private_rooms r on r.id=b.room_id
    join auth.users u on u.id=b.user_id
    left join public.profiles p on p.user_id=u.id
    where b.room_id=p_room_id and not exists(select 1 from public.private_room_members m where m.room_id=p_room_id and m.user_id=b.user_id);
end;
$$;
revoke all on function public.get_private_room_members(uuid) from public,anon;
grant execute on function public.get_private_room_members(uuid) to authenticated;

create or replace function public.get_friend_directory(p_user_ids uuid[])
returns table(user_id uuid,public_uid bigint,name text,country text,subdivision text,avatar_id integer)
language sql stable security definer set search_path=public as $$
  select p.user_id,p.public_uid,p.name,
    case when p.show_country is false then '' else p.country end,
    case when p.show_subdivision is false then '' else p.subdivision end,
    p.avatar_id
  from public.profiles p
  where p.user_id=any(coalesce(p_user_ids,'{}'::uuid[]))
    and p.user_id<>auth.uid()
    and (
      exists(select 1 from public.friendships f where f.user_a=least(auth.uid(),p.user_id) and f.user_b=greatest(auth.uid(),p.user_id))
      or exists(select 1 from public.friend_requests r where r.status in ('pending','accepted') and ((r.sender_id=auth.uid() and r.recipient_id=p.user_id) or (r.sender_id=p.user_id and r.recipient_id=auth.uid())))
      or exists(select 1 from public.messages m where m.user_id=p.user_id and m.expires_at>now())
    )
  limit 200;
$$;
revoke all on function public.get_friend_directory(uuid[]) from public,anon;
grant execute on function public.get_friend_directory(uuid[]) to authenticated;

-- Status values are visible only to the report owner under the existing RLS
-- policy. This migration makes those permissions explicit for tracking.
grant select on public.feedback_reports to authenticated;
grant all privileges on public.feedback_reports to service_role;

notify pgrst,'reload schema';
