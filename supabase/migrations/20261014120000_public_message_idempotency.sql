-- Give every public text send a stable request ID so a retry cannot create a duplicate.
alter table public.messages
  add column if not exists client_request_id uuid;

create unique index if not exists messages_user_client_request_id_uq
  on public.messages(user_id, client_request_id)
  where client_request_id is not null;

create or replace function public.accept_global_message(
  p_user_id uuid,
  p_name text,
  p_country text,
  p_subdivision text,
  p_avatar_id integer,
  p_body text,
  p_reply_to_id uuid,
  p_reply_to_voice_id uuid,
  p_client_request_id uuid
) returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.messages;
  recent_count integer;
begin
  if p_user_id is null or p_client_request_id is null then
    raise exception 'invalid_request_id';
  end if;
  if p_name is null or p_country is null or p_subdivision is null then
    raise exception 'invalid_profile';
  end if;
  if p_avatar_id is null or p_avatar_id < 1 or p_avatar_id > 1262 then
    raise exception 'invalid_avatar';
  end if;
  if char_length(p_name) < 2 or char_length(p_name) > 32 then
    raise exception 'invalid_name';
  end if;
  if char_length(p_body) < 1 or char_length(p_body) > 550 then
    raise exception 'message_length';
  end if;

  -- Serialize same-account sends before checking the idempotency key and rate limits.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into result
  from public.messages
  where user_id = p_user_id and client_request_id = p_client_request_id;
  if found then
    if result.body <> p_body
      or result.reply_to_id is distinct from p_reply_to_id
      or result.reply_to_voice_id is distinct from p_reply_to_voice_id then
      raise exception 'idempotency_key_conflict';
    end if;
    return result;
  end if;

  select count(*) into recent_count
  from public.messages
  where user_id = p_user_id
    and created_at > now() - interval '10 seconds';
  if recent_count >= 3 then raise exception 'rate_limited'; end if;

  if exists(
    select 1 from public.messages
    where user_id = p_user_id
      and body = p_body
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'duplicate_message';
  end if;

  if p_reply_to_id is not null and not exists(
    select 1 from public.messages
    where id = p_reply_to_id and expires_at > now()
  ) then
    raise exception 'reply_target_invalid';
  end if;
  if p_reply_to_voice_id is not null and not exists(
    select 1 from public.voice_messages
    where id = p_reply_to_voice_id and expires_at > now()
  ) then
    raise exception 'reply_target_invalid';
  end if;

  insert into public.messages(
    user_id, name, country, subdivision, avatar_id, body,
    reply_to_id, reply_to_voice_id, reply_to_preview, reply_to_name,
    client_request_id
  ) values (
    p_user_id, trim(p_name), p_country, p_subdivision, p_avatar_id, p_body,
    case when p_reply_to_voice_id is null then p_reply_to_id else null end,
    p_reply_to_voice_id,
    case when p_reply_to_voice_id is not null then 'Voice message' end,
    case when p_reply_to_voice_id is not null then (
      select name from public.voice_messages where id = p_reply_to_voice_id
    ) end,
    p_client_request_id
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.accept_global_message(uuid,text,text,text,integer,text,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.accept_global_message(uuid,text,text,text,integer,text,uuid,uuid,uuid)
  to service_role;
