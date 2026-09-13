alter table public.messages
  add column if not exists reply_to_id uuid null
  references public.messages(id) on delete set null;

create index if not exists messages_reply_to_id_idx
on public.messages(reply_to_id);

create or replace function public.accept_global_message(
  p_user_id uuid,
  p_name text,
  p_country text,
  p_subdivision text,
  p_avatar_id integer,
  p_body text,
  p_reply_to_id uuid default null
) returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.messages;
  recent_count integer;
begin
  if p_user_id is null
     or p_name is null
     or p_country is null
     or p_subdivision is null then
    raise exception 'invalid_profile';
  end if;

  if p_avatar_id < 1 or p_avatar_id > 100 then
    raise exception 'invalid_avatar';
  end if;

  if char_length(p_name) < 2 or char_length(p_name) > 32 then
    raise exception 'invalid_name';
  end if;

  if char_length(p_body) < 1 or char_length(p_body) > 500 then
    raise exception 'message_length';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*)
  into recent_count
  from public.messages
  where user_id = p_user_id
    and created_at > now() - interval '10 seconds';

  if recent_count >= 3 then
    raise exception 'rate_limited';
  end if;

  if p_reply_to_id is not null
     and not exists (
       select 1
       from public.messages
       where id = p_reply_to_id
         and expires_at > now()
     ) then
    raise exception 'reply_target_invalid';
  end if;

  insert into public.messages(
    user_id,
    name,
    country,
    subdivision,
    avatar_id,
    body,
    reply_to_id
  )
  values(
    p_user_id,
    p_name,
    p_country,
    p_subdivision,
    p_avatar_id,
    p_body,
    p_reply_to_id
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.accept_global_message(
  uuid,text,text,text,integer,text
) from public, anon, authenticated;

revoke all on function public.accept_global_message(
  uuid,text,text,text,integer,text,uuid
) from public, anon, authenticated;

grant execute on function public.accept_global_message(
  uuid,text,text,text,integer,text,uuid
) to service_role;