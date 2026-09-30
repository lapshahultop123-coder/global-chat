-- Recovery codes are stored only as keyed hashes and are visible only to trusted
-- Edge Functions. A 5-digit code has low entropy, so attempts are tightly limited.
create table if not exists public.account_recovery_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_uid bigint not null unique references public.profiles(public_uid) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.account_recovery_credentials enable row level security;
revoke all on table public.account_recovery_credentials from public, anon, authenticated;
grant all on table public.account_recovery_credentials to service_role;

create table if not exists public.account_recovery_attempts (
  public_uid bigint primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  locked_until timestamptz
);

alter table public.account_recovery_attempts enable row level security;
revoke all on table public.account_recovery_attempts from public, anon, authenticated;
grant all on table public.account_recovery_attempts to service_role;

-- Atomically allow a maximum of five recovery attempts per UID in a 24-hour
-- window. The Edge Function resets the row after successful authentication.
create or replace function public.claim_account_recovery_attempt(p_public_uid bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked_until timestamptz;
begin
  if p_public_uid is null or p_public_uid < 1000000000 or p_public_uid > 9999999999 then
    return false;
  end if;

  insert into public.account_recovery_attempts as current_attempts
    (public_uid, window_started_at, attempt_count, locked_until)
  values (p_public_uid, pg_catalog.now(), 1, null)
  on conflict (public_uid) do update
    set window_started_at = case
          when current_attempts.locked_until > pg_catalog.now() then current_attempts.window_started_at
          when current_attempts.window_started_at <= pg_catalog.now() - interval '24 hours' then pg_catalog.now()
          else current_attempts.window_started_at
        end,
        attempt_count = case
          when current_attempts.locked_until > pg_catalog.now() then current_attempts.attempt_count
          when current_attempts.window_started_at <= pg_catalog.now() - interval '24 hours' then 1
          else least(5, current_attempts.attempt_count + 1)
        end,
        locked_until = case
          when current_attempts.locked_until > pg_catalog.now() then current_attempts.locked_until
          when current_attempts.window_started_at <= pg_catalog.now() - interval '24 hours' then null
          when current_attempts.attempt_count >= 5 then current_attempts.window_started_at + interval '24 hours'
          else null
        end
    returning account_recovery_attempts.locked_until into v_locked_until;

  return v_locked_until is null or v_locked_until <= pg_catalog.now();
end;
$$;

revoke all on function public.claim_account_recovery_attempt(bigint) from public, anon, authenticated;
grant execute on function public.claim_account_recovery_attempt(bigint) to service_role;

-- Remove messages authored by one authenticated account in every chat type.
-- This runs only from a JWT-validated Edge Function using the service role.
create or replace function public.delete_account_chat_messages(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_public_voice_paths text[];
  v_friend_voice_paths text[];
  v_private_voice_paths text[];
  v_friend_message_ids uuid[];
  v_friend_voice_ids uuid[];
  v_public_text_count integer := 0;
  v_public_voice_count integer := 0;
  v_friend_text_count integer := 0;
  v_friend_voice_count integer := 0;
  v_private_text_count integer := 0;
  v_private_voice_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  select coalesce(pg_catalog.array_agg(storage_path), '{}'::text[])
    into v_public_voice_paths from public.voice_messages where user_id = p_user_id;
  select coalesce(pg_catalog.array_agg(storage_path), '{}'::text[])
    into v_friend_voice_paths from public.friend_voice_messages where sender_id = p_user_id;
  select coalesce(pg_catalog.array_agg(storage_path), '{}'::text[])
    into v_private_voice_paths from public.private_voice_messages where user_id = p_user_id;
  select coalesce(pg_catalog.array_agg(id), '{}'::uuid[])
    into v_friend_message_ids from public.friend_messages where sender_id = p_user_id;
  select coalesce(pg_catalog.array_agg(id), '{}'::uuid[])
    into v_friend_voice_ids from public.friend_voice_messages where sender_id = p_user_id;

  delete from public.friend_message_reactions
    where message_id = any(v_friend_message_ids || v_friend_voice_ids);
  delete from public.friend_message_hidden
    where message_id = any(v_friend_message_ids || v_friend_voice_ids);

  delete from public.messages where user_id = p_user_id;
  get diagnostics v_public_text_count = row_count;
  delete from public.voice_messages where user_id = p_user_id;
  get diagnostics v_public_voice_count = row_count;
  delete from public.friend_messages where sender_id = p_user_id;
  get diagnostics v_friend_text_count = row_count;
  delete from public.friend_voice_messages where sender_id = p_user_id;
  get diagnostics v_friend_voice_count = row_count;
  delete from public.private_messages where user_id = p_user_id;
  get diagnostics v_private_text_count = row_count;
  delete from public.private_voice_messages where user_id = p_user_id;
  get diagnostics v_private_voice_count = row_count;

  return pg_catalog.jsonb_build_object(
    'public_voice_paths', v_public_voice_paths,
    'friend_voice_paths', v_friend_voice_paths,
    'private_voice_paths', v_private_voice_paths,
    'public_text_count', v_public_text_count,
    'public_voice_count', v_public_voice_count,
    'friend_text_count', v_friend_text_count,
    'friend_voice_count', v_friend_voice_count,
    'private_text_count', v_private_text_count,
    'private_voice_count', v_private_voice_count
  );
end;
$$;

revoke all on function public.delete_account_chat_messages(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_chat_messages(uuid) to service_role;
