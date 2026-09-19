alter table public.private_messages add column if not exists reply_to_preview text;
alter table public.private_messages add column if not exists reply_to_name text;
alter table public.private_voice_messages add column if not exists reply_to_preview text;
alter table public.private_voice_messages add column if not exists reply_to_name text;

create or replace function public.send_private_message(p_room_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_body text,p_reply_to_id uuid default null,p_reply_to_voice_id uuid default null) returns public.private_messages language plpgsql security definer set search_path=public as $$
declare m public.private_messages; target_name text; target_preview text;
begin
 if not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 if char_length(trim(p_body))<1 or char_length(p_body)>500 then raise exception 'Invalid message'; end if;
 if p_reply_to_id is not null then select name,body into target_name,target_preview from public.private_messages where id=p_reply_to_id and room_id=p_room_id and expires_at>now(); if target_name is null then raise exception 'Invalid reply target'; end if; end if;
 if p_reply_to_voice_id is not null then select name,'🎙️ Voice message' into target_name,target_preview from public.private_voice_messages where id=p_reply_to_voice_id and room_id=p_room_id and expires_at>now(); if target_name is null then raise exception 'Invalid voice reply target'; end if; end if;
 insert into public.private_messages(room_id,user_id,name,country,subdivision,avatar_id,body,reply_to_id,reply_to_voice_id,reply_to_preview,reply_to_name) values(p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),p_avatar_id,left(trim(p_body),500),case when p_reply_to_voice_id is null then p_reply_to_id end,p_reply_to_voice_id,target_preview,target_name) returning * into m; return m;
end; $$;
grant execute on function public.send_private_message(uuid,text,text,text,integer,text,uuid,uuid) to authenticated;

create or replace function public.send_private_voice(p_room_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_audio_url text,p_storage_path text,p_duration_ms integer,p_reply_to_voice_id uuid default null) returns public.private_voice_messages language plpgsql security definer set search_path=public as $$
declare v public.private_voice_messages; target_name text;
begin
 if not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 if p_duration_ms<500 or p_duration_ms>60000 then raise exception 'Invalid voice duration'; end if;
 if p_reply_to_voice_id is not null then select name into target_name from public.private_voice_messages where id=p_reply_to_voice_id and room_id=p_room_id and expires_at>now(); if target_name is null then raise exception 'Invalid voice reply target'; end if; end if;
 insert into public.private_voice_messages(room_id,user_id,name,country,subdivision,avatar_id,audio_url,storage_path,duration_ms,reply_to_voice_id,reply_to_preview,reply_to_name) values(p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),p_avatar_id,p_audio_url,p_storage_path,p_duration_ms,p_reply_to_voice_id,case when p_reply_to_voice_id is not null then '🎙️ Voice message' end,target_name) returning * into v; return v;
end; $$;
grant execute on function public.send_private_voice(uuid,text,text,text,integer,text,text,integer,uuid) to authenticated;
