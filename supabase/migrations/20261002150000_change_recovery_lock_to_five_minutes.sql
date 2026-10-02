-- Allow six password checks for an account UID, then block further checks for
-- five minutes. Clear legacy 24-hour lock rows so users are not left waiting.
alter table public.account_recovery_attempts
  drop constraint if exists account_recovery_attempts_attempt_count_check;

alter table public.account_recovery_attempts
  add constraint account_recovery_attempts_attempt_count_check
  check (attempt_count between 0 and 6);

delete from public.account_recovery_attempts;

create or replace function public.claim_account_recovery_attempt(p_public_uid bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked_until timestamptz;
  v_attempt_count integer;
begin
  if p_public_uid is null or p_public_uid < 1000000000 or p_public_uid > 9999999999 then
    return false;
  end if;

  insert into public.account_recovery_attempts
    (public_uid, window_started_at, attempt_count, locked_until)
  values (p_public_uid, pg_catalog.now(), 0, null)
  on conflict (public_uid) do nothing;

  select attempt_count, locked_until
    into v_attempt_count, v_locked_until
    from public.account_recovery_attempts
   where public_uid = p_public_uid
   for update;

  if v_locked_until is not null and v_locked_until > pg_catalog.now() then
    return false;
  end if;

  if v_locked_until is not null and v_locked_until <= pg_catalog.now() then
    v_attempt_count := 0;
  end if;

  if v_attempt_count >= 6 then
    update public.account_recovery_attempts
       set locked_until = pg_catalog.now() + interval '5 minutes'
     where public_uid = p_public_uid;
    return false;
  end if;

  v_attempt_count := v_attempt_count + 1;
  update public.account_recovery_attempts
     set window_started_at = case when v_locked_until is not null then pg_catalog.now() else window_started_at end,
         attempt_count = v_attempt_count,
         locked_until = case when v_attempt_count = 6 then pg_catalog.now() + interval '5 minutes' else null end
   where public_uid = p_public_uid;

  -- The sixth password check is allowed. If it fails, the next check sees the
  -- lock and is rejected until the five-minute cooldown has elapsed.
  return true;
end;
$$;

revoke all on function public.claim_account_recovery_attempt(bigint) from public, anon, authenticated;
grant execute on function public.claim_account_recovery_attempt(bigint) to service_role;
