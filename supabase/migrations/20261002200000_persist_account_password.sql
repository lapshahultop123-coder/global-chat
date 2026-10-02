-- Store a reversible, application-encrypted copy so an authenticated account
-- can show its UID password on another device. The plaintext is never stored.
alter table public.account_recovery_credentials
  add column if not exists password_ciphertext text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.account_recovery_credentials'::regclass
      and conname = 'account_recovery_credentials_password_ciphertext_format'
  ) then
    alter table public.account_recovery_credentials
      add constraint account_recovery_credentials_password_ciphertext_format
      check (
        password_ciphertext is null
        or password_ciphertext ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{28}$'
      );
  end if;
end;
$$;

comment on column public.account_recovery_credentials.password_ciphertext is
  'AES-GCM encrypted 5-digit account password. Decryption key is held only as an Edge Function secret.';
