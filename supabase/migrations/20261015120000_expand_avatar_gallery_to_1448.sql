-- Expand the supported avatar IDs while preserving every existing avatar ID.
-- The new artwork uses IDs 1263 through 1448.
do $$
declare
  target_table record;
  old_check record;
  routine record;
  original_definition text;
  definition text;
begin
  for target_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relispartition
      and a.attname = 'avatar_id'
      and not a.attisdropped
  loop
    for old_check in
      select con.conname
      from pg_constraint con
      where con.conrelid = format('public.%I', target_table.relname)::regclass
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%avatar_id%'
    loop
      execute format('alter table public.%I drop constraint %I', target_table.relname, old_check.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I check (avatar_id between 1 and 1448)',
      target_table.relname,
      target_table.relname || '_avatar_id_range'
    );
  end loop;

  -- Keep all existing avatar-aware RPCs in sync with the table constraints.
  for routine in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosrc ilike '%avatar%'
      and p.prosrc ilike '%1262%'
  loop
    original_definition := pg_get_functiondef(routine.oid);
    definition := replace(original_definition, '1262', '1448');
    if definition <> original_definition then
      execute definition;
    end if;
  end loop;
end;
$$;
