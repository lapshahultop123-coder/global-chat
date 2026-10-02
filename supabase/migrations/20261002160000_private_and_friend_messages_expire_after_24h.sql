-- Keep private and friend text/voice messages for 24 hours from creation.
alter table public.private_messages
  alter column expires_at set default (now() + interval '24 hours');
alter table public.private_voice_messages
  alter column expires_at set default (now() + interval '24 hours');

-- Extend still-retained private messages to their requested 24-hour lifetime.
update public.private_messages
   set expires_at = created_at + interval '24 hours'
 where created_at > now() - interval '24 hours';
update public.private_voice_messages
   set expires_at = created_at + interval '24 hours'
 where created_at > now() - interval '24 hours';

alter table public.friend_messages
  add column if not exists expires_at timestamptz;
update public.friend_messages
   set expires_at = created_at + interval '24 hours'
 where expires_at is null;
alter table public.friend_messages
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

alter table public.friend_voice_messages
  add column if not exists expires_at timestamptz;
update public.friend_voice_messages
   set expires_at = created_at + interval '24 hours'
 where expires_at is null;
alter table public.friend_voice_messages
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

create index if not exists private_messages_expires_idx on public.private_messages(expires_at);
create index if not exists private_voice_messages_expires_idx on public.private_voice_messages(expires_at);
create index if not exists friend_messages_expires_idx on public.friend_messages(expires_at);
create index if not exists friend_voice_messages_expires_idx on public.friend_voice_messages(expires_at);

drop policy if exists private_messages_member_select on public.private_messages;
create policy private_messages_member_select on public.private_messages
  for select to authenticated
  using (expires_at > now() and public.is_private_room_member(room_id));

drop policy if exists private_voice_member_select on public.private_voice_messages;
create policy private_voice_member_select on public.private_voice_messages
  for select to authenticated
  using (expires_at > now() and public.is_private_room_member(room_id));

drop policy if exists friend_messages_read_friends on public.friend_messages;
create policy friend_messages_read_friends on public.friend_messages
  for select to authenticated using (
    expires_at > now()
    and (sender_id = auth.uid() or recipient_id = auth.uid())
    and exists (
      select 1 from public.friendships f
       where f.user_a = least(sender_id, recipient_id)
         and f.user_b = greatest(sender_id, recipient_id)
    )
    and not exists (
      select 1 from public.friend_blocks b
       where (b.blocker_id = sender_id and b.blocked_id = recipient_id)
          or (b.blocker_id = recipient_id and b.blocked_id = sender_id)
    )
  );

drop policy if exists friend_voice_select_pair on public.friend_voice_messages;
create policy friend_voice_select_pair on public.friend_voice_messages
  for select to authenticated using (
    expires_at > now()
    and (sender_id = auth.uid() or recipient_id = auth.uid())
    and exists (
      select 1 from public.friendships f
       where f.user_a = least(sender_id, recipient_id)
         and f.user_b = greatest(sender_id, recipient_id)
    )
    and not exists (
      select 1 from public.friend_blocks b
       where (b.blocker_id = sender_id and b.blocked_id = recipient_id)
          or (b.blocker_id = recipient_id and b.blocked_id = sender_id)
    )
  );

drop policy if exists private_voice_read on storage.objects;
create policy private_voice_read on storage.objects
  for select to authenticated using (
    bucket_id = 'private-voice-messages'
    and exists (
      select 1 from public.private_voice_messages v
       where v.storage_path = name
         and v.expires_at > now()
         and public.is_private_room_member(v.room_id)
    )
  );

drop policy if exists friend_voice_storage_read on storage.objects;
create policy friend_voice_storage_read on storage.objects
  for select to authenticated using (
    bucket_id = 'friend-voice-messages'
    and exists (
      select 1 from public.friend_voice_messages v
       where v.storage_path = name
         and v.expires_at > now()
         and (v.sender_id = auth.uid() or v.recipient_id = auth.uid())
         and exists (
           select 1 from public.friendships f
            where f.user_a = least(v.sender_id, v.recipient_id)
              and f.user_b = greatest(v.sender_id, v.recipient_id)
         )
         and not exists (
           select 1 from public.friend_blocks b
            where (b.blocker_id = v.sender_id and b.blocked_id = v.recipient_id)
               or (b.blocker_id = v.recipient_id and b.blocked_id = v.sender_id)
         )
    )
  );
