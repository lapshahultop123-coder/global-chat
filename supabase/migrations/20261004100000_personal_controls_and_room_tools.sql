-- Room controls, public feedback tags, room glossary, request notes and device history.

-- 1. Temporary owner pause for private room message creation.
alter table public.private_rooms add column if not exists messages_paused_until timestamptz;

create or replace function public.set_private_room_message_pause(p_room_id uuid,p_duration_minutes integer)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_duration_minutes is not null and (p_duration_minutes < 1 or p_duration_minutes > 1440) then raise exception 'Pause duration must be between 1 minute and 24 hours'; end if;
  perform 1 from public.private_rooms where id=p_room_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Only the room owner can pause messages'; end if;
  v_until:=case when p_duration_minutes is null then null else now()+make_interval(mins=>p_duration_minutes) end;
  update public.private_rooms set messages_paused_until=v_until where id=p_room_id;
  return v_until;
end; $$;
revoke all on function public.set_private_room_message_pause(uuid,integer) from public,anon;
grant execute on function public.set_private_room_message_pause(uuid,integer) to authenticated;

create or replace function public.reject_paused_private_room_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_until timestamptz;
begin
  select messages_paused_until into v_until from public.private_rooms where id=new.room_id for share;
  if v_until is not null and v_until>now() then raise exception 'Room messages are paused until %',v_until using errcode='P0001'; end if;
  return new;
end; $$;
drop trigger if exists private_messages_check_pause on public.private_messages;
create trigger private_messages_check_pause before insert on public.private_messages for each row execute function public.reject_paused_private_room_message();
drop trigger if exists private_voice_messages_check_pause on public.private_voice_messages;
create trigger private_voice_messages_check_pause before insert on public.private_voice_messages for each row execute function public.reject_paused_private_room_message();
revoke all on function public.reject_paused_private_room_message() from public,anon,authenticated;

-- 4. One private vote per account and tag; counts are visible to authenticated users.
create table if not exists public.public_message_feedback (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_tag text not null check(feedback_tag in ('helpful','needs_answer','outdated')),
  created_at timestamptz not null default now(),
  primary key(message_id,user_id,feedback_tag)
);
alter table public.public_message_feedback enable row level security;
drop policy if exists public_message_feedback_read_active on public.public_message_feedback;
create policy public_message_feedback_read_active on public.public_message_feedback for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and m.expires_at>now()));
grant select on public.public_message_feedback to authenticated;
revoke insert,update,delete on public.public_message_feedback from public,anon,authenticated;
create or replace function public.toggle_public_message_feedback(p_message_id uuid,p_feedback_tag text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_exists boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_feedback_tag not in ('helpful','needs_answer','outdated') then raise exception 'Invalid message feedback'; end if;
  if not exists(select 1 from public.messages where id=p_message_id and expires_at>now()) then raise exception 'Message is no longer available'; end if;
  select exists(select 1 from public.public_message_feedback where message_id=p_message_id and user_id=auth.uid() and feedback_tag=p_feedback_tag) into v_exists;
  if v_exists then delete from public.public_message_feedback where message_id=p_message_id and user_id=auth.uid() and feedback_tag=p_feedback_tag;
  else insert into public.public_message_feedback(message_id,user_id,feedback_tag) values(p_message_id,auth.uid(),p_feedback_tag); end if;
  return not v_exists;
end; $$;
revoke all on function public.toggle_public_message_feedback(uuid,text) from public,anon;
grant execute on function public.toggle_public_message_feedback(uuid,text) to authenticated;

-- 7. A short optional note attached to a friend request.
alter table public.friend_requests add column if not exists note text not null default '';
alter table public.friend_requests drop constraint if exists friend_requests_note_length_check;
alter table public.friend_requests add constraint friend_requests_note_length_check check(char_length(note)<=200);
create or replace function public.send_friend_request(p_recipient_id uuid,p_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_note text:=left(btrim(coalesce(p_note,'')),200);
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_recipient_id is null or p_recipient_id=auth.uid() then raise exception 'You cannot add yourself'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid()::text,p_recipient_id::text)||':'||greatest(auth.uid()::text,p_recipient_id::text),0));
 if exists(select 1 from public.friendships where user_a=least(auth.uid(),p_recipient_id) and user_b=greatest(auth.uid(),p_recipient_id)) then raise exception 'Already friends'; end if;
 if exists(select 1 from public.friend_blocks where (blocker_id=auth.uid() and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=auth.uid())) then raise exception 'Friend requests are unavailable for this user'; end if;
 if exists(select 1 from public.friend_requests where sender_id=auth.uid() and recipient_id=p_recipient_id and status='pending') then raise exception 'A request is already pending'; end if;
 if exists(select 1 from public.friend_requests where sender_id=auth.uid() and recipient_id=p_recipient_id and created_at>now()-interval '5 minutes') then raise exception 'Please wait 5 minutes before sending another request'; end if;
 if exists(select 1 from public.friend_requests where sender_id=p_recipient_id and recipient_id=auth.uid() and status='pending') then raise exception 'This person has already sent you a request'; end if;
 insert into public.friend_requests(sender_id,recipient_id,note) values(auth.uid(),p_recipient_id,v_note) returning id into v_id;
 return v_id;
end $$;
create or replace function public.send_friend_request(p_recipient_id uuid)
returns uuid language sql security definer set search_path=public as $$ select public.send_friend_request(p_recipient_id,''); $$;
revoke all on function public.send_friend_request(uuid,text) from public,anon;
revoke all on function public.send_friend_request(uuid) from public,anon;
grant execute on function public.send_friend_request(uuid,text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- 8. Member-managed glossary entries, visible only to current room members.
create table if not exists public.private_room_glossary (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.private_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 term text not null check(char_length(btrim(term)) between 1 and 60),
 definition text not null check(char_length(btrim(definition)) between 1 and 280),
 created_at timestamptz not null default now(),
 unique(room_id,term)
);
alter table public.private_room_glossary enable row level security;
drop policy if exists private_room_glossary_member_read on public.private_room_glossary;
create policy private_room_glossary_member_read on public.private_room_glossary for select to authenticated using(public.is_private_room_member(room_id));
grant select on public.private_room_glossary to authenticated;
revoke insert,update,delete on public.private_room_glossary from public,anon,authenticated;
create or replace function public.save_private_room_glossary_term(p_room_id uuid,p_term text,p_definition text)
returns public.private_room_glossary language plpgsql security definer set search_path=public as $$
declare result public.private_room_glossary; v_term text:=btrim(p_term); v_definition text:=btrim(p_definition);
begin
 if auth.uid() is null or not public.is_private_room_member(p_room_id) then raise exception 'Join this room to use its glossary'; end if;
 if char_length(v_term) not between 1 and 60 or char_length(v_definition) not between 1 and 280 then raise exception 'Term must be 1–60 characters and definition 1–280 characters'; end if;
 insert into public.private_room_glossary(room_id,user_id,term,definition) values(p_room_id,auth.uid(),v_term,v_definition)
 on conflict(room_id,term) do update set definition=excluded.definition,user_id=auth.uid(),created_at=now() returning * into result;
 return result;
end; $$;
create or replace function public.delete_private_room_glossary_term(p_entry_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.private_room_glossary g where g.id=p_entry_id and public.is_private_room_member(g.room_id) and (g.user_id=auth.uid() or exists(select 1 from public.private_rooms r where r.id=g.room_id and r.owner_id=auth.uid()))) then raise exception 'Only the entry author or room owner can remove this term'; end if;
 delete from public.private_room_glossary where id=p_entry_id; return true;
end; $$;
revoke all on function public.save_private_room_glossary_term(uuid,text,text) from public,anon;
revoke all on function public.delete_private_room_glossary_term(uuid) from public,anon;
grant execute on function public.save_private_room_glossary_term(uuid,text,text) to authenticated;
grant execute on function public.delete_private_room_glossary_term(uuid) to authenticated;

-- 6,15. Account-scoped browser device register and minimal sign-in history. No IP/location is stored.
create table if not exists public.account_device_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 device_key text not null check(device_key ~ '^[A-Za-z0-9-]{16,80}$'),
 device_type text not null check(device_type in ('Phone','Tablet','Desktop','Browser')),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 unique(user_id,device_key)
);
create index if not exists account_device_history_user_seen_idx on public.account_device_history(user_id,last_seen_at desc);
alter table public.account_device_history enable row level security;
drop policy if exists account_device_history_read_self on public.account_device_history;
create policy account_device_history_read_self on public.account_device_history for select to authenticated using(user_id=auth.uid());
grant select on public.account_device_history to authenticated;
revoke insert,update,delete on public.account_device_history from public,anon,authenticated;
create or replace function public.record_account_device_login(p_device_key text,p_device_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_new boolean; v_now timestamptz:=now();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_device_key !~ '^[A-Za-z0-9-]{16,80}$' or p_device_type not in ('Phone','Tablet','Desktop','Browser') then raise exception 'Invalid device details'; end if;
 select not exists(select 1 from public.account_device_history where user_id=auth.uid()) into v_new;
 if exists(select 1 from public.account_device_history where user_id=auth.uid() and device_key=p_device_key) then v_new:=false;
 elsif exists(select 1 from public.account_device_history where user_id=auth.uid()) then v_new:=true; end if;
 insert into public.account_device_history(user_id,device_key,device_type) values(auth.uid(),p_device_key,p_device_type)
 on conflict(user_id,device_key) do update set last_seen_at=v_now,device_type=excluded.device_type;
 delete from public.account_device_history where user_id=auth.uid() and id not in(select id from public.account_device_history where user_id=auth.uid() order by last_seen_at desc limit 12);
 return jsonb_build_object('new_device',v_new,'recorded_at',v_now);
end; $$;
revoke all on function public.record_account_device_login(text,text) from public,anon;
grant execute on function public.record_account_device_login(text,text) to authenticated;
