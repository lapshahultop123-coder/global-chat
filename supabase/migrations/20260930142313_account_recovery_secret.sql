-- Persist a private HMAC key so recovery codes survive Supabase API-key
-- rotation. This table is server-only and is not part of the client API.
create table if not exists public.account_recovery_settings (
  singleton boolean primary key default true check (singleton),
  pepper text not null check (pepper ~ '^[0-9a-f]{64}$')
);

alter table public.account_recovery_settings enable row level security;
revoke all on table public.account_recovery_settings from public, anon, authenticated;
grant all on table public.account_recovery_settings to service_role;

insert into public.account_recovery_settings (singleton, pepper)
values (true, encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (singleton) do nothing;
