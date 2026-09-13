-- GLOBAL CHAT — Supabase schema
-- Run this in Supabase SQL Editor, then deploy the Edge Functions.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 32),
  country text not null,
  subdivision text not null,
  avatar_id integer not null check (avatar_id between 1 and 100),
  theme_id text not null,
  agreed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  subdivision text not null,
  avatar_id integer not null check (avatar_id between 1 and 100),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists messages_active_idx on public.messages(expires_at, created_at);
create index if not exists messages_user_time_idx on public.messages(user_id, created_at desc);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('👍','❤️','😂','😮','😢','😡','🎉','🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "profiles_own_read" on public.profiles;
drop policy if exists "profiles_own_write" on public.profiles;
drop policy if exists "messages_active_read" on public.messages;
drop policy if exists "messages_no_direct_insert" on public.messages;
drop policy if exists "reactions_active_read" on public.message_reactions;

create policy "profiles_own_read" on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "profiles_own_write" on public.profiles for all to authenticated using (false) with check (false);

create policy "messages_active_read" on public.messages for select to authenticated
using (expires_at > now());
create policy "messages_no_direct_insert" on public.messages for insert to authenticated with check (false);

create policy "reactions_active_read" on public.message_reactions for select to authenticated
using (exists(select 1 from public.messages m where m.id = message_id and m.expires_at > now()));

-- Atomic server-side message acceptance. Only the Edge Function service role may execute it.
create or replace function public.accept_global_message(
  p_user_id uuid,
  p_name text,
  p_country text,
  p_subdivision text,
  p_avatar_id integer,
  p_body text,
  p_reply_to_id uuid default null
) returns public.messages
language plpgsql security definer set search_path = public
as $$
declare
  result public.messages;
  recent_count integer;
begin
  if p_user_id is null or p_name is null or p_country is null or p_subdivision is null then
    raise exception 'invalid_profile';
  end if;
  if p_avatar_id < 1 or p_avatar_id > 100 then raise exception 'invalid_avatar'; end if;
  if char_length(p_name) < 2 or char_length(p_name) > 32 then raise exception 'invalid_name'; end if;
  if char_length(p_body) < 1 or char_length(p_body) > 500 then raise exception 'message_length'; end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select count(*) into recent_count from public.messages
  where user_id=p_user_id and created_at > now() - interval '10 seconds';
  if recent_count >= 3 then raise exception 'rate_limited'; end if;

  if exists(
    select 1 from public.messages
    where user_id=p_user_id and body=p_body
      and created_at > now() - interval '10 seconds'
  ) then raise exception 'duplicate_message'; end if;

  if p_reply_to_id is not null and not exists(
    select 1 from public.messages where id=p_reply_to_id and expires_at > now()
  ) then raise exception 'reply_target_invalid'; end if;

  insert into public.messages(user_id,name,country,subdivision,avatar_id,body,reply_to_id)
  values(p_user_id,p_name,p_country,p_subdivision,p_avatar_id,p_body,p_reply_to_id)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.accept_global_message(uuid,text,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.accept_global_message(uuid,text,text,text,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.accept_global_message(uuid,text,text,text,integer,text,uuid) to service_role;

create or replace function public.toggle_global_reaction(p_user_id uuid, p_message_id uuid, p_reaction text)
returns boolean language plpgsql security definer set search_path = public as $$
declare exists_now boolean;
begin
  if p_reaction not in ('👍','❤️','😂','😮','😢','😡','🎉','🙏') then raise exception 'invalid_reaction'; end if;
  if not exists(select 1 from public.messages where id=p_message_id and expires_at > now()) then raise exception 'message_expired'; end if;
  select exists(select 1 from public.message_reactions where message_id=p_message_id and user_id=p_user_id and reaction=p_reaction) into exists_now;
  if exists_now then
    delete from public.message_reactions where message_id=p_message_id and user_id=p_user_id and reaction=p_reaction;
    return false;
  else
    insert into public.message_reactions(message_id,user_id,reaction) values(p_message_id,p_user_id,p_reaction);
    return true;
  end if;
end; $$;

revoke all on function public.accept_global_message(uuid,text,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.toggle_global_reaction(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.accept_global_message(uuid,text,text,text,integer,text) to service_role;
grant execute on function public.toggle_global_reaction(uuid,uuid,text) to service_role;

grant select on public.messages, public.message_reactions, public.profiles to authenticated;

-- Private Realtime channel authorization for the one global room.
drop policy if exists "global_chat_presence_read" on realtime.messages;
drop policy if exists "global_chat_presence_write" on realtime.messages;
create policy "global_chat_presence_read" on realtime.messages for select to authenticated using (realtime.topic() = 'global-chat');
create policy "global_chat_presence_write" on realtime.messages for insert to authenticated with check (realtime.topic() = 'global-chat');

-- Stream only the tables the UI needs.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null; end $$;

-- Expired messages are never visible through RLS. This sweep removes them physically.
-- Enable pg_cron in Supabase Dashboard if it is not already enabled, then run this schedule.
-- select cron.schedule('global-chat-expiry', '* * * * *', $$delete from public.messages where expires_at <= now()$$);
