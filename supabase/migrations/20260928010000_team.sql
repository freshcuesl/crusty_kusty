-- Team list (names and emails of coworkers) and removing members.
-- Profiles stay private per user; this function exposes only what a teammate needs.

create function public.team_members()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.business_role,
  joined_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, p.full_name, u.email::text, m.role, m.created_at
  from public.business_members m
  join public.profiles p on p.user_id = m.user_id
  join auth.users u on u.id = m.user_id
  where private.is_aal2()
    and m.business_id = (
      select business_id from public.business_members where user_id = auth.uid()
    )
  order by m.role, m.created_at;
$$;

create function public.remove_member(p_user_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  perform private.require_aal2();

  select business_id into v_business_id
  from public.business_members
  where user_id = auth.uid() and role = 'owner';

  if v_business_id is null or not exists (
    select 1 from public.business_members
    where business_id = v_business_id and user_id = p_user_id
  ) then
    raise exception 'Only the business owner can remove people' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Owners cannot remove themselves' using errcode = '22023';
  end if;

  delete from public.business_members
  where business_id = v_business_id and user_id = p_user_id;
end;
$$;

grant execute on function public.team_members(), public.remove_member(uuid) to authenticated;
