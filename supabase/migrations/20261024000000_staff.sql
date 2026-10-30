-- Admins add, change and remove ClientShield staff (moderators and admins) from the
-- admin panel. People must already have a ClientShield account; their two-step login
-- carries over. Every change is recorded in private.staff_events.

create table private.staff_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users (id),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('added', 'role_changed', 'removed')),
  role public.platform_role,
  created_at timestamptz not null default now()
);

create function private.require_platform_admin() returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_aal2();
  if not exists (
    select 1 from public.platform_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admins can manage staff' using errcode = '42501';
  end if;
end;
$$;

create function public.staff_members()
returns table (user_id uuid, email text, role public.platform_role, granted_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
    select p.user_id, u.email::text, p.role, p.granted_at
    from public.platform_roles p
    join auth.users u on u.id = p.user_id
    order by p.role desc, u.email;
end;
$$;

create function public.add_staff_member(p_email text, p_role public.platform_role) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_previous public.platform_role;
begin
  perform private.require_platform_admin();
  select id into v_user_id from auth.users
  where lower(email) = lower(btrim(coalesce(p_email, '')));
  if v_user_id is null then
    raise exception 'No ClientShield account uses that email. Ask them to sign up first.'
      using errcode = 'P0002';
  end if;
  if p_role is null then
    raise exception 'Choose a role' using errcode = '22023';
  end if;

  select role into v_previous from public.platform_roles where user_id = v_user_id;
  insert into public.platform_roles (user_id, role) values (v_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  if v_previous is distinct from p_role then
    insert into private.staff_events (actor_user_id, target_user_id, action, role)
    values (auth.uid(), v_user_id, case when v_previous is null then 'added' else 'role_changed' end, p_role);
  end if;
end;
$$;

create function public.remove_staff_member(p_user_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if p_user_id = auth.uid() then
    raise exception 'You can''t remove yourself. Ask another admin.' using errcode = '55000';
  end if;
  delete from public.platform_roles where user_id = p_user_id;
  if found then
    insert into private.staff_events (actor_user_id, target_user_id, action)
    values (auth.uid(), p_user_id, 'removed');
  end if;
end;
$$;

grant execute on function
  public.staff_members(),
  public.add_staff_member(text, public.platform_role),
  public.remove_staff_member(uuid)
to authenticated;
