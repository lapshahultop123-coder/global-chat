-- Evaluate private voice membership from a SECURITY DEFINER function so the
-- storage.objects policy does not depend on nested RLS evaluation.
create or replace function public.can_read_private_voice_storage(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
         from public.private_voice_messages v
        where v.storage_path = p_path
          and v.expires_at > now()
          and public.is_private_room_member(v.room_id)
     );
$$;

revoke all on function public.can_read_private_voice_storage(text) from public, anon;
grant execute on function public.can_read_private_voice_storage(text) to authenticated;

drop policy if exists private_voice_read on storage.objects;
create policy private_voice_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-voice-messages'
    and public.can_read_private_voice_storage(name)
  );
