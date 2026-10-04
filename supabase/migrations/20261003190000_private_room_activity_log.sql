create table if not exists public.private_room_activity (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.private_rooms(id) on delete cascade,
  event_type text not null check (event_type in ('member_joined','member_left','member_removed','owner_changed','role_changed')),
  actor_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'A member',
  subject_name text not null default 'A member',
  created_at timestamptz not null default now()
);

create index if not exists private_room_activity_room_time_idx
  on public.private_room_activity(room_id, created_at desc);

alter table public.private_room_activity enable row level security;
drop policy if exists private_room_activity_member_read on public.private_room_activity;
create policy private_room_activity_member_read
  on public.private_room_activity for select to authenticated
  using (exists (
    select 1 from public.private_room_members m
    where m.room_id = private_room_activity.room_id and m.user_id = auth.uid()
  ));

grant select on public.private_room_activity to authenticated;
revoke insert, update, delete on public.private_room_activity from anon, authenticated;

create or replace function public.record_private_room_activity(
  p_room_id uuid,
  p_event_type text,
  p_actor_id uuid,
  p_subject_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_label text;
  subject_label text;
begin
  if p_actor_id is null then return; end if;
  if p_event_type not in ('member_joined','member_left','member_removed','owner_changed','role_changed') then
    raise exception 'Invalid room activity event';
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'A member') into actor_label
  from public.profiles p where p.user_id = p_actor_id;
  select coalesce(nullif(btrim(p.name), ''), 'A member') into subject_label
  from public.profiles p where p.user_id = p_subject_id;

  insert into public.private_room_activity(room_id,event_type,actor_id,subject_id,actor_name,subject_name)
  values(p_room_id,p_event_type,p_actor_id,p_subject_id,coalesce(actor_label,'A member'),coalesce(subject_label,'A member'));
end;
$$;

revoke all on function public.record_private_room_activity(uuid,text,uuid,uuid) from public, anon, authenticated;

create or replace function public.log_private_room_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    perform public.record_private_room_activity(new.room_id,'member_joined',actor,new.user_id);
    return new;
  end if;

  if actor is not null then
    perform public.record_private_room_activity(
      old.room_id,
      case when actor = old.user_id then 'member_left' else 'member_removed' end,
      actor,
      old.user_id
    );
  end if;
  return old;
end;
$$;

drop trigger if exists private_room_membership_activity_log on public.private_room_members;
create trigger private_room_membership_activity_log
  after insert or delete on public.private_room_members
  for each row execute function public.log_private_room_membership_activity();

create or replace function public.log_private_room_owner_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    perform public.record_private_room_activity(new.id,'owner_changed',auth.uid(),new.owner_id);
  end if;
  return new;
end;
$$;

drop trigger if exists private_room_owner_activity_log on public.private_rooms;
create trigger private_room_owner_activity_log
  after update of owner_id on public.private_rooms
  for each row execute function public.log_private_room_owner_activity();

revoke all on function public.log_private_room_membership_activity() from public, anon, authenticated;
revoke all on function public.log_private_room_owner_activity() from public, anon, authenticated;
