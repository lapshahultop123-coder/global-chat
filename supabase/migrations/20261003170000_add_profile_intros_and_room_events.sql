alter table public.profiles
  add column if not exists profile_intro text not null default '',
  add column if not exists profile_intro_visibility text not null default 'hidden';

alter table public.profiles drop constraint if exists profiles_profile_intro_length_check;
alter table public.profiles add constraint profiles_profile_intro_length_check
  check (char_length(profile_intro) <= 80);
alter table public.profiles drop constraint if exists profiles_profile_intro_visibility_check;
alter table public.profiles add constraint profiles_profile_intro_visibility_check
  check (profile_intro_visibility in ('everyone','friends','hidden'));

-- Always derive the viewer from auth.uid(); clients cannot choose their own audience.
create or replace function public.get_visible_profile_intros(p_user_ids uuid[])
returns table(user_id uuid, profile_intro text)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if coalesce(array_length(p_user_ids,1),0)>100 then raise exception 'too_many_profiles'; end if;
  return query
    select p.user_id,p.profile_intro
    from public.profiles p
    where p.user_id=any(coalesce(p_user_ids,'{}'::uuid[]))
      and char_length(p.profile_intro)<=80
      and (
        p.profile_intro_visibility='everyone'
        or (p.user_id=auth.uid() and p.profile_intro_visibility='friends')
        or (p.profile_intro_visibility='friends'
          and exists(select 1 from public.friendships f where f.user_a=least(auth.uid(),p.user_id) and f.user_b=greatest(auth.uid(),p.user_id))
          and not exists(select 1 from public.friend_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p.user_id) or (b.blocker_id=p.user_id and b.blocked_id=auth.uid())))
      )
      ;
end;
$$;
revoke all on function public.get_visible_profile_intros(uuid[]) from public,anon;
grant execute on function public.get_visible_profile_intros(uuid[]) to authenticated;

create table if not exists public.private_chat_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.private_rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists private_chat_events_room_time on public.private_chat_events(room_id,starts_at);

create table if not exists public.private_chat_event_rsvps (
  event_id uuid not null references public.private_chat_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  response text not null check (response in ('going','maybe','no')),
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id)
);

create or replace function public.is_private_chat_event_member(p_event_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(
    select 1 from public.private_chat_events e
    join public.private_room_members m on m.room_id=e.room_id
    where e.id=p_event_id and m.user_id=auth.uid()
  );
$$;
revoke all on function public.is_private_chat_event_member(uuid) from public,anon;
grant execute on function public.is_private_chat_event_member(uuid) to authenticated;

alter table public.private_chat_events enable row level security;
alter table public.private_chat_event_rsvps enable row level security;
drop policy if exists private_chat_events_read_members on public.private_chat_events;
create policy private_chat_events_read_members on public.private_chat_events for select to authenticated
  using (exists(select 1 from public.private_room_members m where m.room_id=private_chat_events.room_id and m.user_id=auth.uid()));
drop policy if exists private_chat_event_rsvps_read_members on public.private_chat_event_rsvps;
create policy private_chat_event_rsvps_read_members on public.private_chat_event_rsvps for select to authenticated
  using (public.is_private_chat_event_member(event_id));
revoke all on public.private_chat_events,public.private_chat_event_rsvps from anon,authenticated;
grant select on public.private_chat_events,public.private_chat_event_rsvps to authenticated;

create or replace function public.create_private_chat_event(p_room_id uuid,p_title text,p_starts_at timestamptz)
returns public.private_chat_events language plpgsql security definer set search_path=public as $$
declare inserted public.private_chat_events;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if not exists(select 1 from public.private_room_members where room_id=p_room_id and user_id=auth.uid()) then raise exception 'not_a_private_member'; end if;
  if p_title is null or char_length(btrim(p_title))<2 or char_length(p_title)>120 then raise exception 'invalid_event_title'; end if;
  if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '1 year' then raise exception 'invalid_event_time'; end if;
  insert into public.private_chat_events(room_id,created_by,title,starts_at)
    values(p_room_id,auth.uid(),btrim(p_title),p_starts_at) returning * into inserted;
  return inserted;
end;
$$;
revoke all on function public.create_private_chat_event(uuid,text,timestamptz) from public,anon;
grant execute on function public.create_private_chat_event(uuid,text,timestamptz) to authenticated;

create or replace function public.respond_private_chat_event(p_event_id uuid,p_response text)
returns public.private_chat_event_rsvps language plpgsql security definer set search_path=public as $$
declare result public.private_chat_event_rsvps; event_time timestamptz;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_response not in ('going','maybe','no') then raise exception 'invalid_response'; end if;
  if not public.is_private_chat_event_member(p_event_id) then raise exception 'event_unavailable'; end if;
  select starts_at into event_time from public.private_chat_events where id=p_event_id;
  if event_time<=now() then raise exception 'event_started'; end if;
  insert into public.private_chat_event_rsvps(event_id,user_id,response,updated_at)
    values(p_event_id,auth.uid(),p_response,now())
    on conflict(event_id,user_id) do update set response=excluded.response,updated_at=now()
    returning * into result;
  return result;
end;
$$;
revoke all on function public.respond_private_chat_event(uuid,text) from public,anon;
grant execute on function public.respond_private_chat_event(uuid,text) to authenticated;
