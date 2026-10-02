-- Ensure every public chat table used by the client has Realtime enabled.
-- Missing tables can make Postgres Changes retry while the UI falls back to polling.
do $$
begin
  if to_regclass('public.messages') is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if to_regclass('public.voice_messages') is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voice_messages') then
    alter publication supabase_realtime add table public.voice_messages;
  end if;
  if to_regclass('public.message_reactions') is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
  if to_regclass('public.voice_reactions') is not null and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voice_reactions') then
    alter publication supabase_realtime add table public.voice_reactions;
  end if;
end $$;
