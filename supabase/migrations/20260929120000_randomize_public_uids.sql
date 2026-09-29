-- Replace sequential public IDs with random, unique ten-digit identifiers.
create or replace function public.generate_public_uid()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_random numeric;
  v_uid bigint;
begin
  loop
    v_bytes := public.gen_random_bytes(6);
    v_random := pg_catalog.get_byte(v_bytes, 0)::numeric * 1099511627776
      + pg_catalog.get_byte(v_bytes, 1)::numeric * 4294967296
      + pg_catalog.get_byte(v_bytes, 2)::numeric * 16777216
      + pg_catalog.get_byte(v_bytes, 3)::numeric * 65536
      + pg_catalog.get_byte(v_bytes, 4)::numeric * 256
      + pg_catalog.get_byte(v_bytes, 5)::numeric;
    v_uid := 1000000000 + pg_catalog.mod(v_random, 9000000000)::bigint;
    exit when not exists (
      select 1 from public.profiles where public_uid = v_uid
    );
  end loop;
  return v_uid;
end;
$$;

revoke all on function public.generate_public_uid() from public, anon;
grant execute on function public.generate_public_uid() to authenticated, service_role;

alter table public.profiles
  alter column public_uid set default public.generate_public_uid();

update public.profiles
set public_uid = public.generate_public_uid();
