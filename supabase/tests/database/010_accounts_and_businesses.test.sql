-- Accounts, businesses, staff invites and platform roles.
-- Every test signs in as a specific user by setting the JWT claims PostgREST would send.
begin;
select plan(36);

-- ---------------------------------------------------------------------------
-- Fixtures (created as the migration owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', '{"full_name":"Olive Owner"}'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@alpha.test', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'owner@bravo.test', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'mod@krustees.test', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'stranger@else.test', '{}');

insert into public.platform_roles (user_id, role)
values ('00000000-0000-0000-0000-00000000000d', 'moderator');

create function pg_temp.sign_in(uid uuid, email text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'email', email, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
-- The deny-by-default baseline blocks new functions, including this test helper.
grant execute on function pg_temp.sign_in(uuid, text, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
select is(
  (select full_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'Olive Owner',
  'a profile is created automatically at sign-up, using the name given'
);
select is(
  (select full_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  '',
  'a profile is created even when no name was given'
);

set local role authenticated;

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', 'aal1');
select is_empty(
  'select * from public.profiles',
  'without two-step login, a user cannot read even their own profile'
);

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', 'aal2');
select results_eq(
  'select user_id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'with two-step login, a user sees only their own profile'
);

update public.profiles set full_name = 'Olive O.' where user_id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select full_name from public.profiles),
  'Olive O.',
  'a user can rename themselves'
);

update public.profiles set full_name = 'Hacked' where user_id = '00000000-0000-0000-0000-00000000000c';
reset role;
select is(
  (select full_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000c'),
  '',
  'a user cannot rename someone else'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Creating a business
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', 'aal1');
select throws_ok(
  $$select public.create_business('Alpha Plumbing')$$,
  '42501',
  'Two-step login required',
  'a business cannot be created without two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', 'aal2');
select lives_ok(
  $$select public.create_business('  Alpha Plumbing  ')$$,
  'a signed-in owner with two-step login can create a business'
);
select results_eq(
  $$select name, verification_status::text from public.businesses$$,
  $$values ('Alpha Plumbing', 'unverified')$$,
  'the new business name is trimmed and starts unverified'
);
select results_eq(
  $$select role::text from public.business_members where user_id = auth.uid()$$,
  $$values ('owner')$$,
  'the creator becomes the owner'
);
select throws_ok(
  $$select public.create_business('Second Shop')$$,
  '23505',
  'You already belong to a business',
  'a user cannot own or join two businesses'
);
select throws_ok(
  $$select public.create_business('X')$$,
  '22023',
  'Business name must be 2 to 120 characters',
  'business names are validated'
);

select throws_ok(
  $$insert into public.businesses (name, created_by) values ('Sneaky', auth.uid())$$,
  '42501',
  null,
  'businesses cannot be inserted directly, only through create_business'
);
select throws_ok(
  $$update public.businesses set verification_status = 'verified'$$,
  '42501',
  null,
  'a business cannot mark itself verified'
);
select throws_ok(
  $$insert into public.business_members (business_id, user_id, role)
    select id, '00000000-0000-0000-0000-00000000000e', 'owner' from public.businesses$$,
  '42501',
  null,
  'members cannot be added directly, only through invites'
);

-- A second, unrelated business
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000c', 'owner@bravo.test', 'aal2');
select lives_ok($$select public.create_business('Bravo Steam Clean')$$, 'another owner creates a business');
select results_eq(
  'select name from public.businesses',
  $$values ('Bravo Steam Clean')$$,
  'a business owner cannot see other businesses'
);
select is_empty(
  $$select * from public.business_members where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'a business owner cannot see other businesses'' members'
);

-- ---------------------------------------------------------------------------
-- Staff invites
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', 'aal2');
create temporary table invite_token on commit drop as
  select public.create_invite((select id from public.businesses), '  Staff@Alpha.test ') as token;
grant select on invite_token to authenticated;

select ok(
  (select length(token) >= 43 from invite_token),
  'an invite returns a long random token'
);
select results_eq(
  $$select email from public.business_invites$$,
  $$values ('staff@alpha.test')$$,
  'the owner sees the pending invite with a normalized email'
);
reset role;
select is(
  (select count(*)::int from public.business_invites
    where token_hash = extensions.digest((select token from invite_token), 'sha256')),
  1,
  'only the SHA-256 hash of the token is stored'
);
create temporary table alpha on commit drop as
  select id from public.businesses where name = 'Alpha Plumbing';
grant select on alpha to authenticated;
set local role authenticated;

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000c', 'owner@bravo.test', 'aal2');
select throws_ok(
  $$select public.create_invite((select id from alpha), 'x@y.test')$$,
  '42501',
  'Only the business owner can invite staff',
  'an owner cannot invite into a business they do not own'
);
select is_empty('select * from public.business_invites', 'owners cannot see other businesses'' invites');

-- Wrong person tries the token
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000e', 'stranger@else.test', 'aal2');
select throws_ok(
  $$select public.accept_invite((select token from invite_token))$$,
  'P0002',
  'Invite not found, expired, or for a different email',
  'an invite only works for the email it was sent to'
);

-- Right person, no two-step login yet
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000b', 'staff@alpha.test', 'aal1');
select throws_ok(
  $$select public.accept_invite((select token from invite_token))$$,
  '42501',
  'Two-step login required',
  'accepting an invite requires two-step login'
);

-- Right person
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000b', 'staff@alpha.test', 'aal2');
select lives_ok(
  $$select public.accept_invite((select token from invite_token))$$,
  'the invited person can accept'
);
select results_eq(
  $$select b.name, m.role::text from public.business_members m
      join public.businesses b on b.id = m.business_id where m.user_id = auth.uid()$$,
  $$values ('Alpha Plumbing', 'staff')$$,
  'accepting makes them staff of that business'
);
select throws_ok(
  $$select public.accept_invite((select token from invite_token))$$,
  'P0002',
  'Invite not found, expired, or for a different email',
  'an invite cannot be used twice'
);
select throws_ok(
  $$select public.create_invite((select id from public.businesses), 'z@z.test')$$,
  '42501',
  'Only the business owner can invite staff',
  'staff cannot invite others'
);

-- Expired invite
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000a', 'owner@alpha.test', 'aal2');
create temporary table old_token on commit drop as
  select public.create_invite((select id from public.businesses), 'late@alpha.test') as token;
grant select on old_token to authenticated;
reset role;
update public.business_invites set expires_at = now() - interval '1 minute'
  where email = 'late@alpha.test';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000f', 'late@alpha.test');
set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000f', 'late@alpha.test', 'aal2');
select throws_ok(
  $$select public.accept_invite((select token from old_token))$$,
  'P0002',
  'Invite not found, expired, or for a different email',
  'expired invites cannot be accepted'
);

-- ---------------------------------------------------------------------------
-- Platform roles (moderators and admins)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-00000000000e', 'stranger@else.test', 'aal2');
select throws_ok(
  $$insert into public.platform_roles (user_id, role) values (auth.uid(), 'admin')$$,
  '42501',
  null,
  'nobody can make themselves an admin'
);
select is(public.my_platform_role(), null::public.platform_role, 'a regular user has no platform role');

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000d', 'mod@krustees.test', 'aal2');
select is(public.my_platform_role(), 'moderator'::public.platform_role, 'a moderator can see their own role');
select results_eq(
  'select name from public.businesses order by name',
  $$values ('Alpha Plumbing'), ('Bravo Steam Clean')$$,
  'moderators see every business, for verification'
);

select pg_temp.sign_in('00000000-0000-0000-0000-00000000000d', 'mod@krustees.test', 'aal1');
select is_empty(
  'select * from public.businesses',
  'moderators also need two-step login'
);

-- ---------------------------------------------------------------------------
-- Anonymous visitors
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$select public.create_business('Anon Co')$$,
  '42501',
  null,
  'anonymous visitors cannot call account functions'
);

select * from finish();
rollback;
