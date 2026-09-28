-- Team list and removing members.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@alpha.test', '{"full_name":"Olive Owner"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'staff@alpha.test', '{"full_name":"Sam Staff"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner@bravo.test', '{}');

insert into public.businesses (id, name, created_by) values
  ('10000000-0000-0000-0000-00000000000a', 'Alpha Plumbing', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-00000000000b', 'Bravo Steam', '00000000-0000-0000-0000-0000000000b1');
insert into public.business_members (business_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'staff'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;

set local role authenticated;

select pg_temp.sign_in('00000000-0000-0000-0000-0000000000a1', 'aal2');
select results_eq(
  'select full_name, email, role::text from public.team_members()',
  $$values ('Olive Owner', 'owner@alpha.test', 'owner'),
           ('Sam Staff', 'staff@alpha.test', 'staff')$$,
  'the owner sees everyone on their team, owner first'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000000a2', 'aal2');
select is(
  (select count(*)::int from public.team_members()),
  2,
  'staff can see their own team'
);
select throws_ok(
  $$select public.remove_member('00000000-0000-0000-0000-0000000000a1')$$,
  '42501',
  'Only the business owner can remove people',
  'staff cannot remove anyone'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000000b1', 'aal2');
select results_eq(
  'select email from public.team_members()',
  $$values ('owner@bravo.test')$$,
  'another business never sees Alpha''s team'
);
select throws_ok(
  $$select public.remove_member('00000000-0000-0000-0000-0000000000a2')$$,
  '42501',
  'Only the business owner can remove people',
  'an owner cannot remove people from another business'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000000a1', 'aal1');
select is_empty(
  'select * from public.team_members()',
  'the team list requires two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000000a1', 'aal2');
select throws_ok(
  $$select public.remove_member('00000000-0000-0000-0000-0000000000a1')$$,
  '22023',
  'Owners cannot remove themselves',
  'the owner cannot remove themselves and leave the business ownerless'
);
select lives_ok(
  $$select public.remove_member('00000000-0000-0000-0000-0000000000a2')$$,
  'the owner can remove a staff member'
);
select results_eq(
  'select email from public.team_members()',
  $$values ('owner@alpha.test')$$,
  'the removed person is gone from the team'
);

select * from finish();
rollback;
