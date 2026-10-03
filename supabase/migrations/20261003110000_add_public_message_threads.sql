-- Public text-message discussions live separately from the main public feed.
-- Replies expire with their root message, matching public chat retention.

create table if not exists public.message_thread_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  subdivision text not null,
  avatar_id integer not null check (avatar_id between 1 and 1262),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists message_thread_replies_parent_time_idx
  on public.message_thread_replies(message_id, created_at);
create index if not exists message_thread_replies_expires_idx
  on public.message_thread_replies(expires_at);

alter table public.message_thread_replies enable row level security;

drop policy if exists message_thread_replies_read_active on public.message_thread_replies;
create policy message_thread_replies_read_active
  on public.message_thread_replies for select to authenticated
  using (
    expires_at > now()
    and exists (
      select 1 from public.messages m
       where m.id = message_id and m.expires_at > now()
    )
  );

revoke all on public.message_thread_replies from anon, authenticated;
grant select on public.message_thread_replies to authenticated;

create or replace function public.accept_message_thread_reply(
  p_user_id uuid,
  p_message_id uuid,
  p_name text,
  p_country text,
  p_subdivision text,
  p_avatar_id integer,
  p_body text
)
returns public.message_thread_replies
language plpgsql
security definer
set search_path = public
as $$
declare
  root_message public.messages;
  inserted public.message_thread_replies;
  recent_count integer;
begin
  if p_user_id is null or p_message_id is null then raise exception 'invalid_request'; end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(p_name) > 32 then raise exception 'invalid_name'; end if;
  if p_country is null or p_subdivision is null then raise exception 'invalid_profile'; end if;
  if p_avatar_id is null or p_avatar_id < 1 or p_avatar_id > 1262 then raise exception 'invalid_avatar'; end if;
  if p_body is null or char_length(btrim(p_body)) < 1 or char_length(p_body) > 500 then raise exception 'message_length'; end if;

  select * into root_message
    from public.messages
   where id = p_message_id and expires_at > now();
  if not found then raise exception 'thread_root_expired'; end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select count(*) into recent_count from (
    select created_at from public.messages
     where user_id = p_user_id and created_at > now() - interval '10 seconds'
    union all
    select created_at from public.message_thread_replies
     where user_id = p_user_id and created_at > now() - interval '10 seconds'
  ) recent;
  if recent_count >= 3 then raise exception 'rate_limited'; end if;

  if exists (
    select 1 from public.messages
     where user_id = p_user_id and body = btrim(p_body)
       and created_at > now() - interval '10 seconds'
    union all
    select 1 from public.message_thread_replies
     where user_id = p_user_id and body = btrim(p_body)
       and created_at > now() - interval '10 seconds'
  ) then raise exception 'duplicate_message'; end if;

  insert into public.message_thread_replies(
    message_id, user_id, name, country, subdivision, avatar_id, body, expires_at
  ) values (
    p_message_id, p_user_id, btrim(p_name), p_country, p_subdivision,
    p_avatar_id, btrim(p_body), root_message.expires_at
  ) returning * into inserted;

  return inserted;
end;
$$;
revoke all on function public.accept_message_thread_reply(uuid, uuid, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.accept_message_thread_reply(uuid, uuid, text, text, text, integer, text) to service_role;

create or replace function public.get_message_thread_counts(p_message_ids uuid[])
returns table(message_id uuid, reply_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, count(r.id)
    from unnest(coalesce(p_message_ids, '{}'::uuid[])) requested(id)
    join public.messages m on m.id = requested.id and m.expires_at > now()
    left join public.message_thread_replies r
      on r.message_id = m.id and r.expires_at > now()
   where auth.uid() is not null
   group by m.id;
$$;
revoke all on function public.get_message_thread_counts(uuid[]) from public, anon;
grant execute on function public.get_message_thread_counts(uuid[]) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'message_thread_replies'
  ) then
    alter publication supabase_realtime add table public.message_thread_replies;
  end if;
end;
$$;
