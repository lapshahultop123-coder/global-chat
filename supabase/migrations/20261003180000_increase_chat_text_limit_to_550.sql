-- Keep all chat text limits aligned with the client and server validation.
do $$
declare
  v_table text;
  v_constraint record;
  v_proc record;
  v_definition text;
begin
  foreach v_table in array array[
    'public.messages',
    'public.private_messages',
    'public.friend_messages',
    'public.message_thread_replies',
    'public.scheduled_text_messages'
  ] loop
    if to_regclass(v_table) is null then continue; end if;
    for v_constraint in
      select conname
      from pg_constraint
      where conrelid = to_regclass(v_table)
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%500%'
        and pg_get_constraintdef(oid) ilike '%body%'
    loop
      execute format('alter table %s drop constraint %I', to_regclass(v_table), v_constraint.conname);
    end loop;
    execute format('alter table %s drop constraint if exists %I', to_regclass(v_table), replace(split_part(v_table,'.',2),'_','') || '_body_length_550');
    execute format(
      'alter table %s add constraint %I check (char_length(btrim(body)) between 1 and 550)',
      to_regclass(v_table),
      replace(split_part(v_table,'.',2),'_','') || '_body_length_550'
    );
  end loop;

  for v_proc in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'accept_global_message',
        'send_private_message',
        'edit_global_message',
        'edit_private_message',
        'edit_friend_message',
        'accept_message_thread_reply',
        'schedule_chat_text'
      ])
  loop
    v_definition := pg_get_functiondef(v_proc.oid);
    v_definition := replace(v_definition, '>500', '>550');
    v_definition := replace(v_definition, '> 500', '> 550');
    v_definition := replace(v_definition, 'between 1 and 500', 'between 1 and 550');
    v_definition := replace(v_definition, '1 to 500 characters', '1 to 550 characters');
    v_definition := replace(v_definition, 'left(trim(p_body),500)', 'left(trim(p_body),550)');
    v_definition := replace(v_definition, 'left(trim(p_body), 500)', 'left(trim(p_body), 550)');
    execute v_definition;
  end loop;
end;
$$;
