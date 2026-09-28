-- Accounts, businesses, staff invites and platform (moderator/admin) roles.
--
-- Rules:
--   * Every table requires two-step login (aal2) through a RESTRICTIVE policy,
--     so no permissive policy added later can bypass it.
--   * Writes that need checks (creating a business, inviting, joining) go through
--     SECURITY DEFINER functions. Clients get no direct INSERT on these tables.
--   * A user belongs to at most one business.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.business_role as enum ('owner', 'staff');
create type public.platform_role as enum ('moderator', 'admin');
create type public.verification_status as enum (
  'unverified', 'pending', 'verified', 'rejected', 'suspended'
);

-- ---------------------------------------------------------------------------
-- Private helpers (not exposed through the API schema)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_aal2() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create function private.require_aal2() returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_aal2() then
    raise exception 'Two-step login required' using errcode = '42501';
  end if;
end;
$$;

grant execute on function private.is_aal2(), private.require_aal2() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  verification_status public.verification_status not null default 'unverified',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.business_role not null,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create unique index business_members_one_business_per_user on public.business_members (user_id);

create table public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  token_hash bytea not null unique,
  invited_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id)
);
create index business_invites_business_id on public.business_invites (business_id);

create table public.platform_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.platform_role not null,
  granted_at timestamptz not null default now()
);

-- Membership helpers. Defined after the tables because SQL function bodies are
-- checked at creation time.
create function private.my_business_role(p_business_id uuid) returns public.business_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.business_members
  where business_id = p_business_id and user_id = auth.uid();
$$;

create function private.is_platform_staff() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_roles where user_id = auth.uid());
$$;

grant execute on function private.my_business_role(uuid), private.is_platform_staff()
  to authenticated;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_invites enable row level security;
alter table public.platform_roles enable row level security;

-- ---------------------------------------------------------------------------
-- Grants (deny by default: only what the app needs)
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, delete on public.business_invites to authenticated;
grant select on public.platform_roles to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy require_two_step_login on public.profiles
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.businesses
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.business_members
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.business_invites
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.platform_roles
  as restrictive for all to authenticated using (private.is_aal2());

create policy read_own_profile on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy update_own_profile on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy members_read_their_business on public.businesses
  for select to authenticated using (private.my_business_role(id) is not null);
create policy platform_staff_read_businesses on public.businesses
  for select to authenticated using (private.is_platform_staff());
create policy owner_renames_business on public.businesses
  for update to authenticated
  using (private.my_business_role(id) = 'owner')
  with check (private.my_business_role(id) = 'owner');

create policy members_read_coworkers on public.business_members
  for select to authenticated using (private.my_business_role(business_id) is not null);
create policy platform_staff_read_members on public.business_members
  for select to authenticated using (private.is_platform_staff());

create policy owner_reads_invites on public.business_invites
  for select to authenticated using (private.my_business_role(business_id) = 'owner');
create policy owner_revokes_invites on public.business_invites
  for delete to authenticated
  using (private.my_business_role(business_id) = 'owner' and accepted_at is null);

create policy read_own_platform_role on public.platform_roles
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profile on sign-up
-- ---------------------------------------------------------------------------
create function private.create_profile_for_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------
create function public.create_business(p_name text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_business_id uuid;
begin
  perform private.require_aal2();

  if char_length(v_name) not between 2 and 120 then
    raise exception 'Business name must be 2 to 120 characters' using errcode = '22023';
  end if;
  if exists (select 1 from public.business_members where user_id = auth.uid()) then
    raise exception 'You already belong to a business' using errcode = '23505';
  end if;

  insert into public.businesses (name, created_by)
  values (v_name, auth.uid())
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, auth.uid(), 'owner');

  return v_business_id;
end;
$$;

-- Returns the plain invite token once. Only its SHA-256 hash is stored.
create function public.create_invite(p_business_id uuid, p_email text) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
begin
  perform private.require_aal2();

  if private.my_business_role(p_business_id) is distinct from 'owner' then
    raise exception 'Only the business owner can invite staff' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if (
    select count(*) from public.business_invites
    where business_id = p_business_id and accepted_at is null and expires_at > now()
  ) >= 25 then
    raise exception 'Too many pending invites. Revoke some first.' using errcode = '54000';
  end if;

  -- 32 random bytes, URL-safe base64 without padding (43 characters).
  v_token := rtrim(
    translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );

  insert into public.business_invites (business_id, email, token_hash, invited_by)
  values (p_business_id, v_email, extensions.digest(v_token, 'sha256'), auth.uid());

  return v_token;
end;
$$;

create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_invite public.business_invites;
begin
  perform private.require_aal2();

  select * into v_invite
  from public.business_invites
  where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
    and accepted_at is null
    and expires_at > now()
    and email = lower(auth.jwt() ->> 'email')
  for update;

  if not found then
    raise exception 'Invite not found, expired, or for a different email' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.business_members where user_id = auth.uid()) then
    raise exception 'You already belong to a business' using errcode = '23505';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (v_invite.business_id, auth.uid(), 'staff');

  update public.business_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return v_invite.business_id;
end;
$$;

create function public.my_platform_role() returns public.platform_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.platform_roles
  where user_id = auth.uid() and private.is_aal2();
$$;

grant execute on function
  public.create_business(text),
  public.create_invite(uuid, text),
  public.accept_invite(text),
  public.my_platform_role()
to authenticated;
