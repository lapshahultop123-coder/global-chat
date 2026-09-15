create extension if not exists pgcrypto;

alter table public.voice_messages add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;
alter table public.voice_messages add column if not exists reply_to_voice_id uuid references public.voice_messages(id) on delete set null;
alter table public.voice_messages add column if not exists reply_to_preview text;
alter table public.voice_messages add column if not exists reply_to_name text;

create table if not exists public.voice_reactions (
  voice_id uuid not null references public.voice_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('👍','❤️','😂','😮','😢','😡','🎉','🙏')),
  created_at timestamptz not null default now(),
  primary key (voice_id,user_id,reaction)
);

alter table public.voice_reactions enable row level security;
drop policy if exists voice_reactions_select on public.voice_reactions;
create policy voice_reactions_select on public.voice_reactions for select to authenticated using (true);
grant select on public.voice_reactions to authenticated;
grant select,insert,update,delete on public.voice_reactions to service_role;

create or replace function public.toggle_voice_reaction(p_user_id uuid,p_voice_id uuid,p_reaction text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  existed boolean;
begin
  if p_user_id is null then raise exception 'unauthorized'; end if;
  if p_reaction not in ('👍','❤️','😂','😮','😢','😡','🎉','🙏') then raise exception 'invalid_reaction'; end if;
  if not exists(select 1 from public.voice_messages where id=p_voice_id and expires_at>now()) then raise exception 'voice_not_found'; end if;
  select exists(select 1 from public.voice_reactions where voice_id=p_voice_id and user_id=p_user_id and reaction=p_reaction) into existed;
  if existed then
    delete from public.voice_reactions where voice_id=p_voice_id and user_id=p_user_id and reaction=p_reaction;
    return false;
  end if;
  insert into public.voice_reactions(voice_id,user_id,reaction) values(p_voice_id,p_user_id,p_reaction);
  return true;
end;
$$;
revoke all on function public.toggle_voice_reaction(uuid,uuid,text) from public;
grant execute on function public.toggle_voice_reaction(uuid,uuid,text) to service_role;

create or replace function public.accept_global_message(
  p_user_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_body text,p_reply_to_id uuid,p_reply_to_voice_id uuid
) returns public.messages
language plpgsql security definer set search_path=public
as $$
declare v public.messages;
begin
  v:=public.accept_global_message(p_user_id,p_name,p_country,p_subdivision,p_avatar_id,p_body,p_reply_to_id);
  if p_reply_to_voice_id is not null then
    if not exists(select 1 from public.voice_messages where id=p_reply_to_voice_id and expires_at>now()) then raise exception 'reply_target_invalid'; end if;
    update public.messages set reply_to_voice_id=p_reply_to_voice_id,reply_to_id=null,reply_to_preview='🎙️ Voice message',reply_to_name=(select name from public.voice_messages where id=p_reply_to_voice_id) where id=v.id returning * into v;
  end if;
  return v;
end;
$$;
revoke all on function public.accept_global_message(uuid,text,text,text,integer,text,uuid,uuid) from public;
grant execute on function public.accept_global_message(uuid,text,text,text,integer,text,uuid,uuid) to service_role;

create or replace function public.accept_voice_message(
  p_user_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_audio_url text,p_storage_path text,p_duration_ms integer,p_file_size integer,p_reply_to_voice_id uuid default null
) returns public.voice_messages
language plpgsql security definer set search_path=public
as $$
declare v public.voice_messages; recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,190914));
  select count(*) into recent_count from public.voice_messages where user_id=p_user_id and created_at>now()-interval '10 seconds';
  if recent_count>=3 then raise exception 'rate_limited'; end if;
  if char_length(trim(p_name)) not between 2 and 32 then raise exception 'invalid_name'; end if;
  if p_avatar_id not between 1 and 100 then raise exception 'invalid_avatar'; end if;
  if p_duration_ms<500 or p_duration_ms>60000 then raise exception 'duration_invalid'; end if;
  if p_file_size<1 or p_file_size>358400 then raise exception 'file_too_large'; end if;
  if p_reply_to_voice_id is not null and not exists(select 1 from public.voice_messages where id=p_reply_to_voice_id and expires_at>now()) then raise exception 'reply_target_invalid'; end if;
  insert into public.voice_messages(user_id,name,country,subdivision,avatar_id,audio_url,storage_path,duration_ms,file_size,reply_to_voice_id,reply_to_preview,reply_to_name)
  values(p_user_id,trim(p_name),p_country,p_subdivision,p_avatar_id,p_audio_url,p_storage_path,p_duration_ms,p_file_size,p_reply_to_voice_id,case when p_reply_to_voice_id is not null then '🎙️ Voice message' end,case when p_reply_to_voice_id is not null then (select name from public.voice_messages where id=p_reply_to_voice_id) end)
  returning * into v;
  return v;
end;
$$;
revoke all on function public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid) from public;
grant execute on function public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid) to service_role;
