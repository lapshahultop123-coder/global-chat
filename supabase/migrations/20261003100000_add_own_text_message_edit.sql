-- Allow the original sender to edit text messages for five minutes after sending.
-- Message expiry remains unchanged, and voice message tables are intentionally untouched.

alter table public.messages
  add column if not exists edited_at timestamptz;
alter table public.private_messages
  add column if not exists edited_at timestamptz;
alter table public.friend_messages
  add column if not exists edited_at timestamptz;

create or replace function public.edit_global_message(p_message_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  edited public.messages;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or char_length(btrim(p_body)) < 1 or char_length(p_body) > 500 then
    raise exception 'Message must contain 1 to 500 characters';
  end if;

  update public.messages
     set body = btrim(p_body), edited_at = now()
   where id = p_message_id
     and user_id = auth.uid()
     and created_at > now() - interval '5 minutes'
     and expires_at > now()
  returning * into edited;

  if not found then raise exception 'Message cannot be edited; it may have expired or the edit window may have ended'; end if;
  return edited;
end;
$$;
revoke all on function public.edit_global_message(uuid, text) from public, anon;
grant execute on function public.edit_global_message(uuid, text) to authenticated;

create or replace function public.edit_private_message(p_message_id uuid, p_body text)
returns public.private_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  edited public.private_messages;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or char_length(btrim(p_body)) < 1 or char_length(p_body) > 500 then
    raise exception 'Message must contain 1 to 500 characters';
  end if;

  update public.private_messages
     set body = btrim(p_body), edited_at = now()
   where id = p_message_id
     and user_id = auth.uid()
     and public.is_private_room_member(room_id)
     and created_at > now() - interval '5 minutes'
     and expires_at > now()
  returning * into edited;

  if not found then raise exception 'Message cannot be edited; it may have expired or the edit window may have ended'; end if;
  return edited;
end;
$$;
revoke all on function public.edit_private_message(uuid, text) from public, anon;
grant execute on function public.edit_private_message(uuid, text) to authenticated;

create or replace function public.edit_friend_message(p_message_id uuid, p_body text)
returns public.friend_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  edited public.friend_messages;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or char_length(btrim(p_body)) < 1 or char_length(p_body) > 500 then
    raise exception 'Message must contain 1 to 500 characters';
  end if;

  update public.friend_messages m
     set body = btrim(p_body), edited_at = now()
   where m.id = p_message_id
     and m.sender_id = auth.uid()
     and m.created_at > now() - interval '5 minutes'
     and m.expires_at > now()
     and exists (
       select 1 from public.friendships f
        where f.user_a = least(m.sender_id, m.recipient_id)
          and f.user_b = greatest(m.sender_id, m.recipient_id)
     )
     and not exists (
       select 1 from public.friend_blocks b
        where (b.blocker_id = m.sender_id and b.blocked_id = m.recipient_id)
           or (b.blocker_id = m.recipient_id and b.blocked_id = m.sender_id)
     )
  returning m.* into edited;

  if not found then raise exception 'Message cannot be edited; it may have expired or the edit window may have ended'; end if;
  return edited;
end;
$$;
revoke all on function public.edit_friend_message(uuid, text) from public, anon;
grant execute on function public.edit_friend_message(uuid, text) to authenticated;
