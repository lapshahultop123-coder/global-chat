-- Private rooms: unique 8-character code, no password.
alter table public.private_rooms alter column password_hash drop not null;
alter table public.private_rooms drop constraint if exists private_rooms_join_code_check;
update public.private_rooms r set join_code=upper(lpad(to_hex(x.rn::bigint),8,'0')) from (select id,row_number() over(order by created_at,id) rn from public.private_rooms) x where r.id=x.id;
alter table public.private_rooms add constraint private_rooms_join_code_check check (join_code ~ '^[A-Z0-9]{8}$');

drop function if exists public.create_private_room(text,text);
drop function if exists public.join_private_room(text,text);
drop function if exists public.create_private_room(text);
create or replace function public.create_private_room(p_name text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.private_rooms; code text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if char_length(trim(p_name))<2 or char_length(trim(p_name))>40 then raise exception 'Invalid room name'; end if;
 loop code:=upper(substr(encode(gen_random_bytes(4),'hex'),1,8)); exit when not exists(select 1 from public.private_rooms where join_code=code); end loop;
 insert into public.private_rooms(name,join_code,password_hash,owner_id) values(left(trim(p_name),40),code,null,auth.uid()) returning * into r;
 insert into public.private_room_members(room_id,user_id) values(r.id,auth.uid());
 return jsonb_build_object('room_id',r.id,'room_name',r.name,'join_code',r.join_code,'owner',true,'owner_id',r.owner_id);
end; $$;
revoke all on function public.create_private_room(text) from public,anon; grant execute on function public.create_private_room(text) to authenticated;

drop function if exists public.join_private_room(text);
create or replace function public.join_private_room(p_join_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.private_rooms; code text:=upper(trim(p_join_code));
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if code !~ '^[A-Z0-9]{8}$' then raise exception 'Invalid 8-character room code'; end if;
 select * into r from public.private_rooms where join_code=code;
 if not found then raise exception 'Private room not found'; end if;
 insert into public.private_room_members(room_id,user_id) values(r.id,auth.uid()) on conflict do nothing;
 return jsonb_build_object('room_id',r.id,'room_name',r.name,'join_code',r.join_code,'owner',r.owner_id=auth.uid(),'owner_id',r.owner_id);
end; $$;
revoke all on function public.join_private_room(text) from public,anon; grant execute on function public.join_private_room(text) to authenticated;

alter table public.private_messages add column if not exists reply_to_voice_id uuid references public.private_voice_messages(id) on delete set null;
alter table public.private_voice_messages add column if not exists reply_to_voice_id uuid references public.private_voice_messages(id) on delete set null;

drop function if exists public.send_private_message(uuid,text,text,text,integer,text,uuid);
create or replace function public.send_private_message(p_room_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_body text,p_reply_to_id uuid default null,p_reply_to_voice_id uuid default null) returns public.private_messages language plpgsql security definer set search_path=public as $$
declare m public.private_messages;
begin
 if not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 if char_length(trim(p_body))<1 or char_length(p_body)>500 then raise exception 'Invalid message'; end if;
 if p_reply_to_id is not null and not exists(select 1 from public.private_messages where id=p_reply_to_id and room_id=p_room_id and expires_at>now()) then raise exception 'Invalid reply target'; end if;
 if p_reply_to_voice_id is not null and not exists(select 1 from public.private_voice_messages where id=p_reply_to_voice_id and room_id=p_room_id and expires_at>now()) then raise exception 'Invalid voice reply target'; end if;
 insert into public.private_messages(room_id,user_id,name,country,subdivision,avatar_id,body,reply_to_id,reply_to_voice_id) values(p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),p_avatar_id,left(trim(p_body),500),case when p_reply_to_voice_id is null then p_reply_to_id end,p_reply_to_voice_id) returning * into m; return m;
end; $$;
grant execute on function public.send_private_message(uuid,text,text,text,integer,text,uuid,uuid) to authenticated;

drop function if exists public.send_private_voice(uuid,text,text,text,integer,text,text,integer);
create or replace function public.send_private_voice(p_room_id uuid,p_name text,p_country text,p_subdivision text,p_avatar_id integer,p_audio_url text,p_storage_path text,p_duration_ms integer,p_reply_to_voice_id uuid default null) returns public.private_voice_messages language plpgsql security definer set search_path=public as $$
declare v public.private_voice_messages;
begin
 if not public.is_private_room_member(p_room_id) then raise exception 'Not a member of this private room'; end if;
 if p_duration_ms<500 or p_duration_ms>60000 then raise exception 'Invalid voice duration'; end if;
 if p_reply_to_voice_id is not null and not exists(select 1 from public.private_voice_messages where id=p_reply_to_voice_id and room_id=p_room_id and expires_at>now()) then raise exception 'Invalid voice reply target'; end if;
 insert into public.private_voice_messages(room_id,user_id,name,country,subdivision,avatar_id,audio_url,storage_path,duration_ms,reply_to_voice_id) values(p_room_id,auth.uid(),left(trim(p_name),32),left(trim(p_country),80),left(trim(p_subdivision),120),p_avatar_id,p_audio_url,p_storage_path,p_duration_ms,p_reply_to_voice_id) returning * into v; return v;
end; $$;
grant execute on function public.send_private_voice(uuid,text,text,text,integer,text,text,integer,uuid) to authenticated;

