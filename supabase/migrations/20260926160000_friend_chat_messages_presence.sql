-- Stage 2: direct-chat voice messages, read cursors, and durable last-seen.
create table if not exists public.friend_message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(user_id,friend_id), check(user_id<>friend_id)
);
create table if not exists public.friend_voice_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  duration_ms integer not null check(duration_ms between 500 and 60000),
  file_size integer not null check(file_size between 1 and 358400),
  created_at timestamptz not null default now(),
  check(sender_id<>recipient_id)
);
create index if not exists friend_voice_pair_created on public.friend_voice_messages(sender_id,recipient_id,created_at desc);
alter table public.friend_message_reads enable row level security;
alter table public.friend_voice_messages enable row level security;
drop policy if exists friend_reads_select_own on public.friend_message_reads;
create policy friend_reads_select_own on public.friend_message_reads for select to authenticated using(user_id=auth.uid());
drop policy if exists friend_reads_upsert_own on public.friend_message_reads;
create policy friend_reads_upsert_own on public.friend_message_reads for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.friendships f where f.user_a=least(user_id,friend_id) and f.user_b=greatest(user_id,friend_id)));
drop policy if exists friend_reads_update_own on public.friend_message_reads;
create policy friend_reads_update_own on public.friend_message_reads for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists friend_voice_select_pair on public.friend_voice_messages;
create policy friend_voice_select_pair on public.friend_voice_messages for select to authenticated using((sender_id=auth.uid() or recipient_id=auth.uid()) and exists(select 1 from public.friendships f where f.user_a=least(sender_id,recipient_id) and f.user_b=greatest(sender_id,recipient_id)) and not exists(select 1 from public.friend_blocks b where (b.blocker_id=sender_id and b.blocked_id=recipient_id) or (b.blocker_id=recipient_id and b.blocked_id=sender_id)));
drop policy if exists friend_voice_insert_pair on public.friend_voice_messages;
create policy friend_voice_insert_pair on public.friend_voice_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.friendships f where f.user_a=least(sender_id,recipient_id) and f.user_b=greatest(sender_id,recipient_id)) and not exists(select 1 from public.friend_blocks b where (b.blocker_id=sender_id and b.blocked_id=recipient_id) or (b.blocker_id=recipient_id and b.blocked_id=sender_id)));
grant select,insert,update on public.friend_message_reads to authenticated;
grant select,insert on public.friend_voice_messages to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('friend-voice-messages','friend-voice-messages',false,358400,array['audio/webm','audio/mp4','audio/x-m4a'])
on conflict(id) do update set public=false,file_size_limit=358400,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists friend_voice_storage_read on storage.objects;
create policy friend_voice_storage_read on storage.objects for select to authenticated using(bucket_id='friend-voice-messages' and exists(select 1 from public.friend_voice_messages v where v.storage_path=name and (v.sender_id=auth.uid() or v.recipient_id=auth.uid())));
drop policy if exists friend_voice_storage_insert on storage.objects;
create policy friend_voice_storage_insert on storage.objects for insert to authenticated with check(bucket_id='friend-voice-messages' and (storage.foldername(name))[1]=auth.uid()::text);

-- Enable realtime for direct friend messages and voice messages.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_messages') then alter publication supabase_realtime add table public.friend_messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_voice_messages') then alter publication supabase_realtime add table public.friend_voice_messages; end if;
end $$;
