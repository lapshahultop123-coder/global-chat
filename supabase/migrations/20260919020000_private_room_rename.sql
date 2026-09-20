-- Private room owner-only rename.
drop function if exists public.rename_private_room(uuid,text);
create or replace function public.rename_private_room(p_room_id uuid,p_name text) returns public.private_rooms language plpgsql security definer set search_path=public as $$
declare r public.private_rooms;
begin
 if not exists(select 1 from public.private_rooms where id=p_room_id and owner_id=auth.uid()) then raise exception 'Only the room admin can rename this private chat'; end if;
 if char_length(trim(p_name))<2 or char_length(trim(p_name))>40 then raise exception 'Room name must be 2-40 characters'; end if;
 update public.private_rooms set name=left(trim(p_name),40) where id=p_room_id returning * into r; return r;
end; $$;
grant execute on function public.rename_private_room(uuid,text) to authenticated;

