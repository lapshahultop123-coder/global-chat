-- Friends foundation: requests, accepted relationships, blocks and direct text messages.
create table if not exists public.friend_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check(sender_id<>recipient_id)
);
create unique index if not exists friend_requests_one_pending_pair
 on public.friend_requests(sender_id,recipient_id) where status='pending';
create index if not exists friend_requests_recipient_pending on public.friend_requests(recipient_id,created_at desc) where status='pending';
create table if not exists public.friendships (
 user_a uuid not null references auth.users(id) on delete cascade,
 user_b uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_a,user_b),
 check(user_a<user_b)
);
create table if not exists public.friend_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
create table if not exists public.friend_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 500),
 created_at timestamptz not null default now(),
 check(sender_id<>recipient_id)
);
create index if not exists friend_messages_pair_created on public.friend_messages(sender_id,recipient_id,created_at desc);
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_blocks enable row level security;
alter table public.friend_messages enable row level security;
drop policy if exists friend_requests_read_own on public.friend_requests;
create policy friend_requests_read_own on public.friend_requests for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists friendships_read_own on public.friendships;
create policy friendships_read_own on public.friendships for select to authenticated using(user_a=auth.uid() or user_b=auth.uid());
drop policy if exists friend_blocks_read_own on public.friend_blocks;
create policy friend_blocks_read_own on public.friend_blocks for select to authenticated using(blocker_id=auth.uid() or blocked_id=auth.uid());
drop policy if exists friend_messages_read_friends on public.friend_messages;
create policy friend_messages_read_friends on public.friend_messages for select to authenticated using(
 (sender_id=auth.uid() or recipient_id=auth.uid())
 and exists(select 1 from public.friendships f where f.user_a=least(sender_id,recipient_id) and f.user_b=greatest(sender_id,recipient_id))
 and not exists(select 1 from public.friend_blocks b where (b.blocker_id=sender_id and b.blocked_id=recipient_id) or (b.blocker_id=recipient_id and b.blocked_id=sender_id))
);
drop policy if exists friend_messages_insert_friends on public.friend_messages;
create policy friend_messages_insert_friends on public.friend_messages for insert to authenticated with check(
 sender_id=auth.uid()
 and exists(select 1 from public.friendships f where f.user_a=least(sender_id,recipient_id) and f.user_b=greatest(sender_id,recipient_id))
 and not exists(select 1 from public.friend_blocks b where (b.blocker_id=sender_id and b.blocked_id=recipient_id) or (b.blocker_id=recipient_id and b.blocked_id=sender_id))
);
grant select on public.friend_requests,public.friendships,public.friend_blocks,public.friend_messages to authenticated;
grant insert on public.friend_messages to authenticated;

create or replace function public.send_friend_request(p_recipient_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_recipient_id is null or p_recipient_id=auth.uid() then raise exception 'You cannot add yourself'; end if;
 if exists(select 1 from public.friendships where user_a=least(auth.uid(),p_recipient_id) and user_b=greatest(auth.uid(),p_recipient_id)) then raise exception 'Already friends'; end if;
 if exists(select 1 from public.friend_blocks where (blocker_id=auth.uid() and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=auth.uid())) then raise exception 'Friend requests are unavailable for this user'; end if;
 if exists(select 1 from public.friend_requests where sender_id=auth.uid() and recipient_id=p_recipient_id and status='pending') then raise exception 'A request is already pending'; end if;
 if exists(select 1 from public.friend_requests where sender_id=auth.uid() and recipient_id=p_recipient_id and created_at>now()-interval '5 minutes') then raise exception 'Please wait 5 minutes before sending another request'; end if;
 if exists(select 1 from public.friend_requests where sender_id=p_recipient_id and recipient_id=auth.uid() and status='pending') then raise exception 'This person has already sent you a request'; end if;
 insert into public.friend_requests(sender_id,recipient_id) values(auth.uid(),p_recipient_id) returning id into v_id;
 return v_id;
end $$;
create or replace function public.respond_friend_request(p_request_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.friend_requests%rowtype;
begin
 select * into r from public.friend_requests where id=p_request_id for update;
 if not found or r.recipient_id<>auth.uid() or r.status<>'pending' then raise exception 'Request is no longer available'; end if;
 if exists(select 1 from public.friend_blocks where (blocker_id=r.sender_id and blocked_id=r.recipient_id) or (blocker_id=r.recipient_id and blocked_id=r.sender_id)) then raise exception 'This request is unavailable'; end if;
 update public.friend_requests set status=case when p_accept then 'accepted' else 'rejected' end,responded_at=now() where id=r.id;
 if p_accept then
  insert into public.friendships(user_a,user_b) values(least(r.sender_id,r.recipient_id),greatest(r.sender_id,r.recipient_id)) on conflict do nothing;
 end if;
 return true;
end $$;
revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;
