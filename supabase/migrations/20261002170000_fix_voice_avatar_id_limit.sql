-- Voice RPC validation was left at the original 100-avatar catalog limit.
-- Keep public voice sending in sync with the current 1..1262 avatar catalog.
do $$
declare
  routine record;
  original_definition text;
  definition text;
begin
  for routine in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosrc ilike '%p_avatar_id%'
      and (
        p.prosrc ilike '%p_avatar_id not between 1 and 100%'
        or p.prosrc ilike '%p_avatar_id > 100%'
        or p.prosrc ilike '%p_avatar_id<=100%'
        or p.prosrc ilike '%p_avatar_id <= 100%'
      )
  loop
    original_definition := pg_get_functiondef(routine.oid);
    definition := replace(original_definition, 'p_avatar_id not between 1 and 100', 'p_avatar_id not between 1 and 1262');
    definition := replace(definition, 'p_avatar_id > 100', 'p_avatar_id > 1262');
    definition := replace(definition, 'p_avatar_id<=100', 'p_avatar_id<=1262');
    definition := replace(definition, 'p_avatar_id <= 100', 'p_avatar_id <= 1262');
    if definition <> original_definition then
      execute definition;
    end if;
  end loop;
end;
$$;
