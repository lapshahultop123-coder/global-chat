-- Earth Pulse shows how many distinct users are active in each country.
-- The RPC retains its existing name so all clients keep using the same entry point.
drop function if exists public.get_public_country_activity();

create function public.get_public_country_activity()
returns table(country text, user_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.country, count(distinct m.user_id)
    from public.messages m
   where m.expires_at > now()
     and char_length(btrim(coalesce(m.country, ''))) = 2
   group by m.country
   order by count(distinct m.user_id) desc;
$$;

revoke all on function public.get_public_country_activity() from public, anon;
grant execute on function public.get_public_country_activity() to authenticated;
