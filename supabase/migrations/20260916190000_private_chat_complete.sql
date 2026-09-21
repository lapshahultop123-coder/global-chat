-- GLOBAL CHAT: complete private chat backend
create extension if not exists pgcrypto;

create table if not exists public.private_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  password_hash text not null check (char_length(password_hash)=64),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.private_room_members (
  room_id uuid not null references public.private_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.private_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, name text not null, country text not null, subdivision text not null,
  avatar_id integer not null check(avatar_id between 1 and 100), body text not null check(char_length(body) between 1 and 500),
  reply_to_id uuid references public.private_messages(id) on delete set null,
  created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '5 minutes')
);
create table if not exists public.private_voice_messages (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.private_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, name text not null, country text not null, subdivision text not null,
  avatar_id integer not null check(avatar_id between 1 and 100), audio_url text not null, storage_path text not null,
  duration_ms integer not null check(duration_ms between 500 and 60000), created_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '3 minutes')
);
create table if not exists public.private_message_reactions (
  message_id uuid not null references public.private_messages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in (U&'\+1F44D',U&'\+2764\+FE0F',U&'\+1F602',U&'\+1F62E',U&'\+1F622',U&'\+1F621',U&'\+1F389',U&'\+1F64F')), created_at timestamptz not null default now(), primary key(message_id,user_id,reaction)
);
create table if not exists public.private_voice_reactions (
  voice_id uuid not null references public.private_voice_messages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in (U&'\+1F44D',U&'\+2764\+FE0F',U&'\+1F602',U&'\+1F62E',U&'\+1F622',U&'\+1F621',U&'\+1F389',U&'\+1F64F')), created_at timestamptz not null default now(), primary key(voice_id,user_id,reaction)
);
create index if not exists private_messages_room_time_idx on public.private_messages(room_id,created_at);
create index if not exists private_voice_room_time_idx on public.private_voice_messages(room_id,created_at);

create or replace function public.is_private_room_member(p_room_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.private_room_members where room_id=p_room_id and user_id=auth.uid()); $$;
grant execute on function public.is_private_room_member(uuid) to authenticated;

alter table public.private_rooms enable row level security; alter table public.private_room_members enable row level security;
alter table public.private_messages enable row level security; alter table public.private_voice_messages enable row level security;
alter table public.private_message_reactions enable row level security; alter table public.private_voice_reactions enable row level security;

drop policy if exists private_rooms_member_select on public.private_rooms;
create policy private_rooms_member_select on public.private_rooms for select to authenticated using(public.is_private_room_member(id));
drop policy if exists private_members_own_select on public.private_room_members;
create policy private_members_own_select on public.private_room_members for select to authenticated using(user_id=auth.uid());
drop policy if exists private_messages_member_select on public.private_messages;
create policy private_messages_member_select on public.private_messages for select to authenticated using(public.is_private_room_member(room_id));
drop policy if exists private_voice_member_select on public.private_voice_messages;
create policy private_voice_member_select on public.private_voice_messages for select to authenticated using(public.is_private_room_member(room_id));
drop policy if exists private_message_reactions_member_select on public.private_message_reactions;
create policy private_message_reactions_member_select on public.private_message_reactions for select to authenticated using(public.is_private_room_member((select room_id from public.private_messages m where m.id=message_id)));
drop policy if exists private_voice_reactions_member_select on public.private_voice_reactions;
create policy private_voice_reactions_member_select on public.private_voice_reactions for select to authenticated using(public.is_private_room_member((select room_id from public.private_voice_messages v where v.id=voice_id)));

grant select on public.private_rooms,public.private_room_members,public.private_messages,public.private_voice_messages,public.private_message_reactions,public.private_voice_reactions to authenticated;

create or replace function public.create_private_room(p_name text,p_password_hash text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.private_rooms; code text; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if char_length(trim(p_name))<2 or char_length(p_name)>40 or char_length(p_password_hash)<>64 then raise exception 'Invalid room details'; end if;
 loop code=upper(encode(gen_random_bytes(4),'hex'));
   code=substr(code,1,6); exit when not exists(select 1 from public.private_rooms where join_code=code); end loop;
 insert into public.private_rooms(name,join_code,password_hash,owner_id) values(left(trim(p_name),40),code,lower(p_password_hash),auth.uid()) returning * into r;
 insert into public.private_room_members(room_id,user_id) values(r.id,auth.uid());
 return jsonb_build_object('room_id',r.id,'room_name',r.name,'join_code',r.join_code,'owner',true);
end; $$;
revoke all on function public.create_private_room(text,text) from public,anon; grant execute on function public.create_private_room(text,text) to authenticated;

create or replace function public.join_private_room(p_join_code text,p_password_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.private_rooms; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into r from public.private_rooms where join_code=upper(trim(p_join_code));
 if not found or r.password_hash<>lower(p_password_hash) then raise exception 'Invalid join code or password'; end if;
 insert into public.private_room_members(room_id,user_id) values(r.id,auth.uid()) on conflict do nothing;
 return jsonb_build_object('room_id',r.id,'room_name',r.name,'join_code',r.join_code,'owner',r.owner_id=auth.uid());
end; $$;
revoke all on function public.join_private_room(text,text) from public,anon; grant execute on function public.join_private_room(text,text) to authenticated;

-- Replace old signatures safely where possible.
drop function if exists public.send_private_message(uuid,text,text,text,integer,text);
create or replace function public.send_private_message(p_room_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_body text,p_reply_to_id uuid default null)
returns public.private_messages language plpgsql security definer set search_path=public as $$ declare m public.private_messages; begin
 if not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 if char_length(trim(p_body))<1 or char_length(p_body)>500 then raise exception 'Invalid message'; end if;
 if p_reply_to_id is not null and not exists(select 1 from public.private_messages where id=p_reply_to_id and room_id=p_room_id and expires_at>now()) then raise exception 'Invalid reply target'; end if;
 insert into public.private_messages(room_id,user_id,name,country,subdivision,avatar_id,body,reply_to_id) values(p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),p_avatar_id,left(trim(p_body),500),p_reply_to_id) returning * into m; return m;
end; $$;
grant execute on function public.send_private_message(uuid,text,text,text,integer,text,uuid) to authenticated;

create or replace function public.send_private_voice(p_room_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_audio_url text,p_storage_path text,p_duration_ms integer)
returns public.private_voice_messages language plpgsql security definer set search_path=public as $$ declare v public.private_voice_messages; begin
 if not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 if p_duration_ms<500 or p_duration_ms>60000 then raise exception 'Invalid voice duration'; end if;
 insert into public.private_voice_messages(room_id,user_id,name,country,subdivision,avatar_id,audio_url,storage_path,duration_ms) values(p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),p_avatar_id,p_audio_url,p_storage_path,p_duration_ms) returning * into v; return v;
end; $$;
grant execute on function public.send_private_voice(uuid,text,text,text,integer,text,text,integer) to authenticated;

create or replace function public.toggle_private_message_reaction(p_message_id uuid,p_reaction text) returns boolean language plpgsql security definer set search_path=public as $$ declare e boolean; begin if not public.is_private_room_member((select room_id from public.private_messages where id=p_message_id)) then raise exception 'Not a member'; end if; if p_reaction not in (U&'\+1F44D',U&'\+2764\+FE0F',U&'\+1F602',U&'\+1F62E',U&'\+1F622',U&'\+1F621',U&'\+1F389',U&'\+1F64F') then raise exception 'Invalid reaction'; end if; select exists(select 1 from public.private_message_reactions where message_id=p_message_id and user_id=auth.uid() and reaction=p_reaction) into e; if e then delete from public.private_message_reactions where message_id=p_message_id and user_id=auth.uid() and reaction=p_reaction; else insert into public.private_message_reactions values(p_message_id,auth.uid(),p_reaction); end if; return not e; end; $$;
grant execute on function public.toggle_private_message_reaction(uuid,text) to authenticated;
create or replace function public.toggle_private_voice_reaction(p_voice_id uuid,p_reaction text) returns boolean language plpgsql security definer set search_path=public as $$ declare e boolean; begin if not public.is_private_room_member((select room_id from public.private_voice_messages where id=p_voice_id)) then raise exception 'Not a member'; end if; if p_reaction not in (U&'\+1F44D',U&'\+2764\+FE0F',U&'\+1F602',U&'\+1F62E',U&'\+1F622',U&'\+1F621',U&'\+1F389',U&'\+1F64F') then raise exception 'Invalid reaction'; end if; select exists(select 1 from public.private_voice_reactions where voice_id=p_voice_id and user_id=auth.uid() and reaction=p_reaction) into e; if e then delete from public.private_voice_reactions where voice_id=p_voice_id and user_id=auth.uid() and reaction=p_reaction; else insert into public.private_voice_reactions values(p_voice_id,auth.uid(),p_reaction); end if; return not e; end; $$;
grant execute on function public.toggle_private_voice_reaction(uuid,text) to authenticated;

create or replace function public.delete_private_message(p_message_id uuid) returns boolean language plpgsql security definer set search_path=public as $$ begin if not public.is_private_room_member((select room_id from public.private_messages where id=p_message_id)) then raise exception 'Not a member'; end if; if (select user_id from public.private_messages where id=p_message_id)<>auth.uid() then raise exception 'Only the sender can delete for everyone'; end if; delete from public.private_messages where id=p_message_id; return true; end; $$;
grant execute on function public.delete_private_message(uuid) to authenticated;
create or replace function public.delete_private_voice(p_voice_id uuid) returns boolean language plpgsql security definer set search_path=public as $$ begin if not public.is_private_room_member((select room_id from public.private_voice_messages where id=p_voice_id)) then raise exception 'Not a member'; end if; if (select user_id from public.private_voice_messages where id=p_voice_id)<>auth.uid() then raise exception 'Only the sender can delete for everyone'; end if; delete from public.private_voice_messages where id=p_voice_id; return true; end; $$;
grant execute on function public.delete_private_voice(uuid) to authenticated;

-- Private voice storage bucket. Keep it separate from public voice storage.
insert into storage.buckets(id,name,public,file_size_limit) values('private-voice-messages','private-voice-messages',false,350000) on conflict(id) do update set public=false,file_size_limit=350000;
drop policy if exists private_voice_upload on storage.objects;
create policy private_voice_upload on storage.objects for insert to authenticated with check(bucket_id='private-voice-messages' and (storage.foldername(name))[1]::uuid in (select room_id from public.private_room_members where user_id=auth.uid()));
drop policy if exists private_voice_read on storage.objects;
create policy private_voice_read on storage.objects for select to authenticated using(bucket_id='private-voice-messages' and (storage.foldername(name))[1]::uuid in (select room_id from public.private_room_members where user_id=auth.uid()));
drop policy if exists private_voice_delete on storage.objects;
create policy private_voice_delete on storage.objects for delete to authenticated using(bucket_id='private-voice-messages' and (storage.foldername(name))[2]::uuid=auth.uid());

do $$ begin alter publication supabase_realtime add table public.private_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.private_voice_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.private_message_reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.private_voice_reactions; exception when duplicate_object then null; end $$;

