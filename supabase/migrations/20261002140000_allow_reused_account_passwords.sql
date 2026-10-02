-- A password is combined with a public UID at sign-in, so two accounts may
-- safely choose the same five-digit password. Keep the keyed hash private.
alter table public.account_recovery_credentials
  drop constraint if exists account_recovery_credentials_code_hash_key;
