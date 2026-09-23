-- Reply metadata for every message type: text/emoji <-> voice in public and private chat.

alter table public.private_voice_messages
  add column if not exists reply_to_message_id uuid references public.private_messages(id) on delete set null;

create index if not exists private_voice_messages_reply_to_message_idx
  on public.private_voice_messages(reply_to_message_id);

-- Public voice messages can reply to either a text/emoji message or another voice message.
drop function if exists public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid);
create or replace function public.accept_voice_message(
  p_user_id uuid,
  p_name text,
  p_country text,
  p_subdivision text,
  p_avatar_id integer,
  p_audio_url text,
  p_storage_path text,
  p_duration_ms integer,
  p_file_size integer,
  p_reply_to_id uuid default null,
  p_reply_to_voice_id uuid default null
) returns public.voice_messages
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.voice_messages;
  recent_count integer;
  target_name text;
  target_preview text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,190914));
  select count(*) into recent_count
    from public.voice_messages
   where user_id=p_user_id and created_at>now()-interval '10 seconds';
  if recent_count>=3 then raise exception 'rate_limited'; end if;
  if char_length(trim(p_name)) not between 2 and 32 then raise exception 'invalid_name'; end if;
  if p_avatar_id not between 1 and 100 then raise exception 'invalid_avatar'; end if;
  if p_duration_ms<500 or p_duration_ms>60000 then raise exception 'duration_invalid'; end if;
  if p_file_size<1 or p_file_size>358400 then raise exception 'file_too_large'; end if;

  if p_reply_to_id is not null then
    select name,body into target_name,target_preview
      from public.messages
     where id=p_reply_to_id and expires_at>now();
    if target_name is null then raise exception 'reply_target_invalid'; end if;
  end if;

  if p_reply_to_voice_id is not null then
    select name,'Voice message' into target_name,target_preview
      from public.voice_messages
     where id=p_reply_to_voice_id and expires_at>now();
    if target_name is null then raise exception 'reply_target_invalid'; end if;
  end if;

  insert into public.voice_messages(
    user_id,name,country,subdivision,avatar_id,audio_url,storage_path,
    duration_ms,file_size,reply_to_message_id,reply_to_voice_id,reply_to_preview,reply_to_name
  )
  values(
    p_user_id,trim(p_name),p_country,p_subdivision,p_avatar_id,p_audio_url,p_storage_path,
    p_duration_ms,p_file_size,p_reply_to_id,p_reply_to_voice_id,target_preview,target_name
  )
  returning * into v;
  return v;
end;
$$;

revoke all on function public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid,uuid) from public;
grant execute on function public.accept_voice_message(uuid,text,text,text,integer,text,text,integer,integer,uuid,uuid) to service_role;

-- Private voice messages can reply to either private text/emoji or private voice.
drop function if exists public.send_private_voice(uuid,text,text,text,integer,text,text,integer,uuid);
create or replace function public.send_private_voice(
  p_room_id uuid,
  p_name text,
  p_country text,
  p_subdivision text,
  p_avatar_id integer,
  p_audio_url text,
  p_storage_path text,
  p_duration_ms integer,
  p_reply_to_id uuid default null,
  p_reply_to_voice_id uuid default null
) returns public.private_voice_messages
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.private_voice_messages;
  target_name text;
  target_preview text;
begin
  if not public.is_private_room_member(p_room_id) then
    raise exception 'Not a member of this private room';
  end if;
  if p_duration_ms<500 or p_duration_ms>60000 then
    raise exception 'Invalid voice duration';
  end if;

  if p_reply_to_id is not null then
    select name,body into target_name,target_preview
      from public.private_messages
     where id=p_reply_to_id and room_id=p_room_id and expires_at>now();
    if target_name is null then raise exception 'Invalid reply target'; end if;
  end if;

  if p_reply_to_voice_id is not null then
    select name,'Voice message' into target_name,target_preview
      from public.private_voice_messages
     where id=p_reply_to_voice_id and room_id=p_room_id and expires_at>now();
    if target_name is null then raise exception 'Invalid voice reply target'; end if;
  end if;

  insert into public.private_voice_messages(
    room_id,user_id,name,country,subdivision,avatar_id,audio_url,storage_path,duration_ms,
    reply_to_message_id,reply_to_voice_id,reply_to_preview,reply_to_name
  )
  values(
    p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),
    p_avatar_id,p_audio_url,p_storage_path,p_duration_ms,p_reply_to_id,p_reply_to_voice_id,
    target_preview,target_name
  )
  returning * into v;
  return v;
end;
$$;

revoke all on function public.send_private_voice(uuid,text,text,text,integer,text,text,integer,uuid,uuid) from public;
grant execute on function public.send_private_voice(uuid,text,text,text,integer,text,text,integer,uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
