-- Fix existing private_messages table: add reply_to_id if missing

alter table public.private_messages
add column if not exists reply_to_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'private_messages_reply_to_id_fkey'
  ) then
    alter table public.private_messages
    add constraint private_messages_reply_to_id_fkey
    foreign key (reply_to_id)
    references public.private_messages(id)
    on delete set null;
  end if;
end
$$;

create index if not exists private_messages_reply_to_idx
on public.private_messages(reply_to_id);
