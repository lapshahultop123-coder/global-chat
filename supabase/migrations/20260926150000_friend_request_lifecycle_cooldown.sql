-- Stage 1–4: serialize requests per pair, enforce cooldown under concurrency,
-- and allow the sender to cancel a still-pending request.
create or replace function public.send_friend_request(p_recipient_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_recipient_id is null or p_recipient_id=auth.uid() then raise exception 'You cannot add yourself'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid()::text,p_recipient_id::text)||':'||greatest(auth.uid()::text,p_recipient_id::text),0));
 if exists(select 1 from public.friendships where user_a=least(auth.uid(),p_recipient_id) and user_b=greatest(auth.uid(),p_recipient_id)) then raise exception 'Already friends'; end if;
 if exists(select 1 from public.friend_blocks where (blocker_id=auth.uid() and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=auth.uid())) then raise exception 'Friend requests are unavailable for this user'; end if;
 if exists(select 1 from public.friend_requests where sender_id=auth.uid() and recipient_id=p_recipient_id and status='pending') then raise exception 'A request is already pending'; end if;
 if exists(select 1 from public.friend_requests where sender_id=auth.uid() and recipient_id=p_recipient_id and created_at>now()-interval '5 minutes') then raise exception 'Please wait 5 minutes before sending another request'; end if;
 if exists(select 1 from public.friend_requests where sender_id=p_recipient_id and recipient_id=auth.uid() and status='pending') then raise exception 'This person has already sent you a request'; end if;
 insert into public.friend_requests(sender_id,recipient_id) values(auth.uid(),p_recipient_id) returning id into v_id;
 return v_id;
end $$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.friend_requests%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from public.friend_requests where id=p_request_id for update;
 if not found or r.sender_id<>auth.uid() or r.status<>'pending' then raise exception 'Request is no longer available'; end if;
 update public.friend_requests set status='cancelled',responded_at=now() where id=r.id;
 return true;
end $$;
revoke all on function public.cancel_friend_request(uuid) from public;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
