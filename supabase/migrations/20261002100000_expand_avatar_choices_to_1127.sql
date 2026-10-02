do $$
declare
  table_name text;
  check_name text;
  routine record;
  definition text;
  original_definition text;
begin
  foreach table_name in array array['profiles','messages','voice_messages','private_messages','private_voice_messages'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      for check_name in
        select c.conname from pg_constraint c
        where c.conrelid = format('public.%I', table_name)::regclass
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%avatar_id%'
      loop
        execute format('alter table public.%I drop constraint %I', table_name, check_name);
      end loop;
      execute format('alter table public.%I add constraint %I check (avatar_id between 1 and 1127)', table_name, table_name || '_avatar_id_range');
    end if;
  end loop;

  for routine in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.prosrc ilike '%avatar_id%' and p.prosrc ilike '%782%'
  loop
    original_definition := pg_get_functiondef(routine.oid);
    definition := replace(original_definition, 'not between 1 and 782', 'not between 1 and 1127');
    definition := replace(definition, 'between 1 and 782', 'between 1 and 1127');
    definition := replace(definition, '> 782', '> 1127');
    definition := replace(definition, '>782', '>1127');
    definition := replace(definition, '<= 782', '<= 1127');
    definition := replace(definition, '<=782', '<=1127');
    if definition <> original_definition then execute definition; end if;
  end loop;
end;
$$;
