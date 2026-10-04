alter table public.saved_messages
  drop constraint if exists saved_messages_body_check;

alter table public.saved_messages
  add constraint saved_messages_body_length_check
  check (char_length(body) between 1 and 550);
