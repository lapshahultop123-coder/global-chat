-- Read-only: run in the Supabase SQL Editor as postgres to distinguish a
-- missing Storage object from an access-policy problem.
select
  v.id as voice_message_id,
  v.room_id,
  v.user_id,
  v.created_at,
  v.expires_at,
  v.storage_path,
  (o.id is not null) as storage_object_exists,
  o.metadata ->> 'mimetype' as stored_mime_type,
  o.metadata ->> 'size' as stored_size_bytes
from public.private_voice_messages v
left join storage.objects o
  on o.bucket_id = 'private-voice-messages'
 and o.name = v.storage_path
where v.expires_at > now()
order by v.created_at desc;

-- Also confirm which SELECT policy is active on the private voice bucket.
select policyname, roles, qual
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'private_voice_read';
