-- Private/friend polls; every read and vote is checked against chat membership.
create table if not exists public.chat_polls (
  id uuid primary key default gen_random_uuid(),
  context text not null check (context in ('private','friend')),
  room_id uuid references public.private_rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 3 and 180),
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '24 hours',
  check ((context='private' and room_id is not null and recipient_id is null) or (context='friend' and room_id is null and recipient_id is not null and recipient_id<>created_by))
);
create index if not exists chat_polls_private_room_active on public.chat_polls(room_id,created_at desc) where context='private';
create index if not exists chat_polls_friend_pair_active on public.chat_polls(created_by,recipient_id,created_at desc) where context='friend';

create table if not exists public.chat_poll_votes (
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (poll_id,user_id)
);
create index if not exists chat_poll_votes_user on public.chat_poll_votes(user_id,poll_id);

create or replace function public.is_chat_poll_participant(p_poll_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists (
    select 1 from public.chat_polls p
    where p.id=p_poll_id and p.expires_at>now() and (
      (p.context='private' and exists(select 1 from public.private_room_members m where m.room_id=p.room_id and m.user_id=auth.uid()))
      or (p.context='friend' and auth.uid() in (p.created_by,p.recipient_id)
        and exists(select 1 from public.friendships f where f.user_a=least(p.created_by,p.recipient_id) and f.user_b=greatest(p.created_by,p.recipient_id))
        and not exists(select 1 from public.friend_blocks b where (b.blocker_id=p.created_by and b.blocked_id=p.recipient_id) or (b.blocker_id=p.recipient_id and b.blocked_id=p.created_by)))
    )
  );
$$;
revoke all on function public.is_chat_poll_participant(uuid) from public,anon;
grant execute on function public.is_chat_poll_participant(uuid) to authenticated;

alter table public.chat_polls enable row level security;
alter table public.chat_poll_votes enable row level security;
drop policy if exists chat_polls_read_members on public.chat_polls;
create policy chat_polls_read_members on public.chat_polls for select to authenticated using(expires_at>now() and public.is_chat_poll_participant(id));
drop policy if exists chat_poll_votes_read_members on public.chat_poll_votes;
create policy chat_poll_votes_read_members on public.chat_poll_votes for select to authenticated using(public.is_chat_poll_participant(poll_id));
revoke all on public.chat_polls,public.chat_poll_votes from anon,authenticated;
grant select on public.chat_polls,public.chat_poll_votes to authenticated;

create or replace function public.create_chat_poll(p_context text,p_room_id uuid,p_recipient_id uuid,p_question text,p_options text[])
returns public.chat_polls language plpgsql security definer set search_path=public as $$
declare inserted public.chat_polls; normalized text[];
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_question is null or char_length(btrim(p_question))<3 or char_length(p_question)>180 then raise exception 'invalid_question'; end if;
  if p_options is null or cardinality(p_options)<2 or cardinality(p_options)>6 then raise exception 'invalid_options'; end if;
  select array_agg(left(btrim(value),100)) into normalized from unnest(p_options) as opts(value) where char_length(btrim(value))>0;
  if coalesce(cardinality(normalized),0)<2 or (select count(distinct lower(value)) from unnest(normalized) as opts(value))<>coalesce(cardinality(normalized),0) then raise exception 'invalid_options'; end if;
  if p_context='private' then
    if p_room_id is null or p_recipient_id is not null or not exists(select 1 from public.private_room_members where room_id=p_room_id and user_id=auth.uid()) then raise exception 'not_a_private_member'; end if;
  elsif p_context='friend' then
    if p_room_id is not null or p_recipient_id is null or p_recipient_id=auth.uid()
      or not exists(select 1 from public.friendships where user_a=least(auth.uid(),p_recipient_id) and user_b=greatest(auth.uid(),p_recipient_id))
      or exists(select 1 from public.friend_blocks where (blocker_id=auth.uid() and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=auth.uid())) then raise exception 'not_a_friend'; end if;
  else raise exception 'invalid_context'; end if;
  insert into public.chat_polls(context,room_id,created_by,recipient_id,question,options)
  values(p_context,p_room_id,auth.uid(),btrim(p_question),to_jsonb(normalized)) returning * into inserted;
  return inserted;
end;
$$;
revoke all on function public.create_chat_poll(text,uuid,uuid,text,text[]) from public,anon;
grant execute on function public.create_chat_poll(text,uuid,uuid,text,text[]) to authenticated;

create or replace function public.cast_chat_poll_vote(p_poll_id uuid,p_option_index integer)
returns public.chat_poll_votes language plpgsql security definer set search_path=public as $$
declare poll public.chat_polls; result public.chat_poll_votes;
begin
  if not public.is_chat_poll_participant(p_poll_id) then raise exception 'poll_unavailable'; end if;
  select * into poll from public.chat_polls where id=p_poll_id and expires_at>now();
  if p_option_index<0 or p_option_index>=jsonb_array_length(poll.options) then raise exception 'invalid_option'; end if;
  insert into public.chat_poll_votes(poll_id,user_id,option_index) values(p_poll_id,auth.uid(),p_option_index)
  on conflict(poll_id,user_id) do update set option_index=excluded.option_index,created_at=now()
  returning * into result;
  return result;
end;
$$;
revoke all on function public.cast_chat_poll_vote(uuid,integer) from public,anon;
grant execute on function public.cast_chat_poll_vote(uuid,integer) to authenticated;

create or replace function public.get_public_country_activity()
returns table(country text,message_count bigint) language sql stable security definer set search_path=public as $$
  select m.country,count(*) from public.messages m
   where m.expires_at>now() and char_length(btrim(coalesce(m.country,'')))=2
   group by m.country order by count(*) desc;
$$;
revoke all on function public.get_public_country_activity() from public,anon;
grant execute on function public.get_public_country_activity() to authenticated;

do $$ begin alter publication supabase_realtime add table public.chat_polls; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_poll_votes; exception when duplicate_object then null; end $$;
