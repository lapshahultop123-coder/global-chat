-- Topic Trails are already handled by 20261003110000_add_public_message_threads.sql.
-- This migration adds the skill board, durable private saves, and server scheduled text.

create table if not exists public.skill_exchange_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  country text not null,
  avatar_id integer not null,
  kind text not null check (kind in ('teach','learn')),
  skill text not null check (char_length(btrim(skill)) between 2 and 80),
  details text not null default '' check (char_length(details) <= 300),
  interest_count integer not null default 0 check (interest_count >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists skill_exchange_posts_active_idx on public.skill_exchange_posts(expires_at,created_at desc);
alter table public.skill_exchange_posts enable row level security;
drop policy if exists skill_exchange_posts_read_active on public.skill_exchange_posts;
create policy skill_exchange_posts_read_active on public.skill_exchange_posts for select to authenticated using (expires_at > now());
grant select on public.skill_exchange_posts to authenticated;

create table if not exists public.skill_exchange_interests (
  post_id uuid not null references public.skill_exchange_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.skill_exchange_interests enable row level security;
drop policy if exists skill_exchange_interests_owner_or_self_read on public.skill_exchange_interests;
create policy skill_exchange_interests_owner_or_self_read on public.skill_exchange_interests for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.skill_exchange_posts p where p.id=post_id and p.owner_id=auth.uid())
);
grant select on public.skill_exchange_interests to authenticated;

create or replace function public.create_skill_exchange_post(p_kind text,p_skill text,p_details text)
returns public.skill_exchange_posts language plpgsql security definer set search_path=public as $$
declare p public.skill_exchange_posts; me public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_kind not in ('teach','learn') or p_skill is null or char_length(btrim(p_skill)) not between 2 and 80 or char_length(coalesce(p_details,''))>300 then raise exception 'invalid_skill_post'; end if;
  select * into me from public.profiles where user_id=auth.uid();
  if not found then raise exception 'profile_required'; end if;
  if (select count(*) from public.skill_exchange_posts where owner_id=auth.uid() and expires_at>now()) >= 5 then raise exception 'post_limit_reached'; end if;
  insert into public.skill_exchange_posts(owner_id,owner_name,country,avatar_id,kind,skill,details)
  values(auth.uid(),left(me.name,32),me.country,me.avatar_id,p_kind,btrim(p_skill),left(coalesce(btrim(p_details),''),300)) returning * into p;
  return p;
end; $$;
revoke all on function public.create_skill_exchange_post(text,text,text) from public,anon;
grant execute on function public.create_skill_exchange_post(text,text,text) to authenticated;

create or replace function public.toggle_skill_exchange_interest(p_post_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare p public.skill_exchange_posts%rowtype; removed integer;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into p from public.skill_exchange_posts where id=p_post_id and expires_at>now() for update;
  if not found then raise exception 'post_expired'; end if;
  if p.owner_id=auth.uid() then raise exception 'cannot_interest_own_post'; end if;
  delete from public.skill_exchange_interests where post_id=p_post_id and user_id=auth.uid();
  get diagnostics removed = row_count;
  if removed>0 then update public.skill_exchange_posts set interest_count=greatest(0,interest_count-1) where id=p_post_id; return false; end if;
  insert into public.skill_exchange_interests(post_id,user_id) values(p_post_id,auth.uid());
  update public.skill_exchange_posts set interest_count=interest_count+1 where id=p_post_id;
  return true;
end; $$;
revoke all on function public.toggle_skill_exchange_interest(uuid) from public,anon;
grant execute on function public.toggle_skill_exchange_interest(uuid) to authenticated;

create or replace function public.get_skill_exchange_interested_users(p_post_id uuid)
returns table(user_id uuid,name text,country text,avatar_id integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.skill_exchange_posts where id=p_post_id and owner_id=auth.uid()) then raise exception 'not_post_owner'; end if;
  return query select i.user_id,pr.name,pr.country,pr.avatar_id
    from public.skill_exchange_interests i join public.profiles pr on pr.user_id=i.user_id
    where i.post_id=p_post_id order by i.created_at;
end; $$;
revoke all on function public.get_skill_exchange_interested_users(uuid) from public,anon;
grant execute on function public.get_skill_exchange_interested_users(uuid) to authenticated;

-- Saved text is copied to an owner-only table and survives the source message expiry.
create table if not exists public.saved_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_context text not null check (source_context in ('public','private','friend')),
  source_message_id uuid not null,
  source_author_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  original_created_at timestamptz not null,
  saved_at timestamptz not null default now(),
  unique(user_id,source_context,source_message_id)
);
create index if not exists saved_messages_owner_date_idx on public.saved_messages(user_id,saved_at desc);
alter table public.saved_messages enable row level security;
drop policy if exists saved_messages_owner_all on public.saved_messages;
create policy saved_messages_owner_all on public.saved_messages for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,delete on public.saved_messages to authenticated;

create or replace function public.save_chat_message(p_context text,p_message_id uuid)
returns public.saved_messages language plpgsql security definer set search_path=public as $$
declare saved public.saved_messages; author_name text; message_body text; message_time timestamptz; message_user uuid; recipient uuid; room uuid;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_context='public' then
    select m.name,m.body,m.created_at,m.user_id into author_name,message_body,message_time,message_user from public.messages m where m.id=p_message_id and m.expires_at>now();
  elsif p_context='private' then
    select m.name,m.body,m.created_at,m.user_id,m.room_id into author_name,message_body,message_time,message_user,room from public.private_messages m where m.id=p_message_id and m.expires_at>now();
    if room is not null and not exists(select 1 from public.private_room_members where room_id=room and user_id=auth.uid()) then raise exception 'message_unavailable'; end if;
  elsif p_context='friend' then
    select m.body,m.created_at,m.sender_id,m.recipient_id into message_body,message_time,message_user,recipient from public.friend_messages m where m.id=p_message_id and m.expires_at>now();
    if message_user is not null and auth.uid() not in (message_user,recipient) then raise exception 'message_unavailable'; end if;
    if message_user is not null and (not exists(select 1 from public.friendships f where f.user_a=least(message_user,recipient) and f.user_b=greatest(message_user,recipient)) or exists(select 1 from public.friend_blocks b where (b.blocker_id=message_user and b.blocked_id=recipient) or (b.blocker_id=recipient and b.blocked_id=message_user))) then raise exception 'message_unavailable'; end if;
    select p.name into author_name from public.profiles p where p.user_id=message_user;
  else raise exception 'invalid_context'; end if;
  if message_user is null or author_name is null or message_body is null then raise exception 'message_unavailable'; end if;
  if p_context='private' and message_user is not null and not exists(select 1 from public.private_room_members where room_id=room and user_id=auth.uid()) then raise exception 'message_unavailable'; end if;
  insert into public.saved_messages(user_id,source_context,source_message_id,source_author_name,body,original_created_at)
    values(auth.uid(),p_context,p_message_id,author_name,message_body,message_time)
    on conflict(user_id,source_context,source_message_id) do update set body=excluded.body,source_author_name=excluded.source_author_name
    returning * into saved;
  return saved;
end; $$;
revoke all on function public.save_chat_message(text,uuid) from public,anon;
grant execute on function public.save_chat_message(text,uuid) to authenticated;

-- Scheduled texts are delivered by the database even when the sender is offline.
create table if not exists public.scheduled_text_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context text not null check(context in ('public','private','friend')),
  room_id uuid references public.private_rooms(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 1 and 500),
  sender_name text not null,
  country text not null,
  subdivision text not null,
  avatar_id integer not null check(avatar_id between 1 and 1262),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','sent','failed','cancelled')),
  status_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check((context='public' and room_id is null and recipient_id is null) or (context='private' and room_id is not null and recipient_id is null) or (context='friend' and room_id is null and recipient_id is not null and recipient_id<>user_id))
);
create index if not exists scheduled_text_due_idx on public.scheduled_text_messages(scheduled_at) where status='pending';
create index if not exists scheduled_text_owner_idx on public.scheduled_text_messages(user_id,scheduled_at desc);
alter table public.scheduled_text_messages enable row level security;
drop policy if exists scheduled_text_owner_read on public.scheduled_text_messages;
create policy scheduled_text_owner_read on public.scheduled_text_messages for select to authenticated using(user_id=auth.uid());
grant select,delete on public.scheduled_text_messages to authenticated;
drop policy if exists scheduled_text_owner_cancel on public.scheduled_text_messages;
create policy scheduled_text_owner_cancel on public.scheduled_text_messages for delete to authenticated using(user_id=auth.uid() and status='pending');

create or replace function public.schedule_chat_text(p_user_id uuid,p_context text,p_room_id uuid,p_recipient_id uuid,p_body text,p_scheduled_at timestamptz,p_sender_name text,p_country text,p_subdivision text,p_avatar_id integer)
returns public.scheduled_text_messages language plpgsql security definer set search_path=public as $$
declare item public.scheduled_text_messages;
begin
  if p_user_id is null then raise exception 'sign_in_required'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 500 then raise exception 'invalid_message'; end if;
  if p_scheduled_at<now()+interval '1 minute' or p_scheduled_at>now()+interval '30 days' then raise exception 'schedule_must_be_within_30_days'; end if;
  if char_length(btrim(p_sender_name)) not between 2 and 32 or p_avatar_id<1 or p_avatar_id>1262 then raise exception 'invalid_profile'; end if;
  if p_context='public' then
    if p_room_id is not null or p_recipient_id is not null then raise exception 'invalid_context'; end if;
  elsif p_context='private' then
    if p_room_id is null or p_recipient_id is not null or not exists(select 1 from public.private_room_members where room_id=p_room_id and user_id=p_user_id) then raise exception 'not_private_member'; end if;
  elsif p_context='friend' then
    if p_room_id is not null or p_recipient_id is null or p_recipient_id=p_user_id
      or not exists(select 1 from public.friendships where user_a=least(p_user_id,p_recipient_id) and user_b=greatest(p_user_id,p_recipient_id))
      or exists(select 1 from public.friend_blocks where (blocker_id=p_user_id and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=p_user_id)) then raise exception 'not_friend'; end if;
  else raise exception 'invalid_context'; end if;
  insert into public.scheduled_text_messages(user_id,context,room_id,recipient_id,body,sender_name,country,subdivision,avatar_id,scheduled_at)
  values(p_user_id,p_context,p_room_id,p_recipient_id,btrim(p_body),left(btrim(p_sender_name),32),left(p_country,80),left(p_subdivision,120),p_avatar_id,p_scheduled_at)
  returning * into item;
  return item;
end; $$;
revoke all on function public.schedule_chat_text(uuid,text,uuid,uuid,text,timestamptz,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.schedule_chat_text(uuid,text,uuid,uuid,text,timestamptz,text,text,text,integer) to service_role;

create or replace function public.dispatch_due_scheduled_text_messages()
returns integer language plpgsql security definer set search_path=public as $$
declare item public.scheduled_text_messages%rowtype; sent_count integer:=0;
begin
  for item in select * from public.scheduled_text_messages where status='pending' and scheduled_at<=now() order by scheduled_at for update skip locked limit 100 loop
    begin
      if item.context='public' then
        perform pg_advisory_xact_lock(hashtext(item.user_id::text));
        if (select count(*) from public.messages where user_id=item.user_id and created_at>now()-interval '10 seconds')>=3 then raise exception 'rate_limited'; end if;
        if exists(select 1 from public.messages where user_id=item.user_id and body=item.body and created_at>now()-interval '10 seconds') then raise exception 'duplicate_message'; end if;
        insert into public.messages(user_id,name,country,subdivision,avatar_id,body) values(item.user_id,item.sender_name,item.country,item.subdivision,item.avatar_id,item.body);
      elsif item.context='private' then
        if not exists(select 1 from public.private_room_members where room_id=item.room_id and user_id=item.user_id) then raise exception 'private_membership_changed'; end if;
        insert into public.private_messages(room_id,user_id,name,country,subdivision,avatar_id,body)
        values(item.room_id,item.user_id,item.sender_name,item.country,item.subdivision,item.avatar_id,item.body);
      elsif item.context='friend' then
        if not exists(select 1 from public.friendships where user_a=least(item.user_id,item.recipient_id) and user_b=greatest(item.user_id,item.recipient_id))
           or exists(select 1 from public.friend_blocks where (blocker_id=item.user_id and blocked_id=item.recipient_id) or (blocker_id=item.recipient_id and blocked_id=item.user_id)) then raise exception 'friendship_changed'; end if;
        insert into public.friend_messages(sender_id,recipient_id,body) values(item.user_id,item.recipient_id,item.body);
      end if;
      update public.scheduled_text_messages set status='sent',sent_at=now(),status_message=null where id=item.id;
      sent_count:=sent_count+1;
    exception when others then
      update public.scheduled_text_messages set status='failed',status_message=left(sqlerrm,180) where id=item.id;
    end;
  end loop;
  return sent_count;
end; $$;
revoke all on function public.dispatch_due_scheduled_text_messages() from public,anon,authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scheduled_text_messages') then
    alter publication supabase_realtime add table public.scheduled_text_messages;
  end if;
end $$;

create extension if not exists pg_cron with schema pg_catalog;
do $$ declare existing_job bigint; begin
  select jobid into existing_job from cron.job where jobname='dispatch-scheduled-chat-texts';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('dispatch-scheduled-chat-texts','* * * * *','select public.dispatch_due_scheduled_text_messages();');
end $$;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='skill_exchange_posts') then
    alter publication supabase_realtime add table public.skill_exchange_posts;
  end if;
end $$;
