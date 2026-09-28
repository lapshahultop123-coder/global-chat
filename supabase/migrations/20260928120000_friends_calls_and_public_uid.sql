-- Stable, unique numeric public UID for each anonymous profile.
create sequence if not exists public.profile_public_uid_seq
  as bigint minvalue 1000000000 maxvalue 9999999999 start with 1000000000;

alter table public.profiles add column if not exists public_uid bigint;
alter table public.profiles alter column public_uid set default nextval('public.profile_public_uid_seq');
update public.profiles set public_uid=nextval('public.profile_public_uid_seq') where public_uid is null;
alter table public.profiles alter column public_uid set not null;
grant usage, select on sequence public.profile_public_uid_seq to service_role;
create unique index if not exists profiles_public_uid_unique on public.profiles(public_uid);

-- Return only directory fields for users with an existing relationship, request,
-- or recent public-chat participation. Never expose auth UUIDs as public IDs.
create or replace function public.get_friend_directory(p_user_ids uuid[])
returns table(user_id uuid,public_uid bigint,name text,country text,subdivision text,avatar_id integer)
language sql stable security definer set search_path=public as $$
  select p.user_id,p.public_uid,p.name,p.country,p.subdivision,p.avatar_id
  from public.profiles p
  where p.user_id=any(coalesce(p_user_ids,'{}'::uuid[]))
    and p.user_id<>auth.uid()
    and (
      exists(select 1 from public.friendships f where f.user_a=least(auth.uid(),p.user_id) and f.user_b=greatest(auth.uid(),p.user_id))
      or exists(select 1 from public.friend_requests r where r.status in ('pending','accepted') and ((r.sender_id=auth.uid() and r.recipient_id=p.user_id) or (r.sender_id=p.user_id and r.recipient_id=auth.uid())))
      or exists(select 1 from public.messages m where m.user_id=p.user_id and m.expires_at>now())
    )
  limit 200;
$$;
revoke all on function public.get_friend_directory(uuid[]) from public,anon;
grant execute on function public.get_friend_directory(uuid[]) to authenticated;

-- Both sides must still be friends and neither may have blocked the other.
create or replace function public.check_friend_call_target(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null
    and p_user_id is not null
    and p_user_id<>auth.uid()
    and exists(select 1 from public.friendships f where f.user_a=least(auth.uid(),p_user_id) and f.user_b=greatest(auth.uid(),p_user_id))
    and not exists(select 1 from public.friend_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p_user_id) or (b.blocker_id=p_user_id and b.blocked_id=auth.uid()));
$$;
revoke all on function public.check_friend_call_target(uuid) from public,anon;
grant execute on function public.check_friend_call_target(uuid) to authenticated;
