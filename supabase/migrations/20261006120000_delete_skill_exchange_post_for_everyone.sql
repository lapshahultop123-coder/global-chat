-- Let only the owner remove a Skill Exchange post for everyone.
-- The interest rows are removed by the post_id foreign key's ON DELETE CASCADE.
create or replace function public.delete_skill_exchange_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;

  delete from public.skill_exchange_posts
   where id = p_post_id
     and owner_id = auth.uid();

  return found;
end;
$$;

revoke all on function public.delete_skill_exchange_post(uuid) from public, anon;
grant execute on function public.delete_skill_exchange_post(uuid) to authenticated;
