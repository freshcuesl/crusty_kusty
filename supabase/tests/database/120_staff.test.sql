-- Admins manage ClientShield staff (moderators and admins) from the admin panel.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000ca1', 'admin@staff12.test'),
  ('00000000-0000-0000-0000-000000000cb1', 'mod@staff12.test'),
  ('00000000-0000-0000-0000-000000000cc1', 'NewHire@Staff12.test');
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000ca1', 'admin'),
  ('00000000-0000-0000-0000-000000000cb1', 'moderator');

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

-- Moderators can't manage staff.
select pg_temp.sign_in('00000000-0000-0000-0000-000000000cb1', 'aal2');
select throws_ok(
  $$select * from public.staff_members()$$,
  '42501', 'Only admins can manage staff',
  'moderators cannot list staff'
);
select throws_ok(
  $$select public.add_staff_member('newhire@staff12.test', 'moderator')$$,
  '42501', 'Only admins can manage staff',
  'moderators cannot add staff'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000ca1', 'aal1');
select throws_ok(
  $$select * from public.staff_members()$$,
  '42501', 'Two-step login required',
  'managing staff needs two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000ca1', 'aal2');
select ok(
  (select count(*) >= 2 from public.staff_members()),
  'admins see the staff list'
);
select is(
  (select email from public.staff_members() where user_id = '00000000-0000-0000-0000-000000000cb1'),
  'mod@staff12.test',
  'with each person''s email and role'
);

select lives_ok(
  $$select public.add_staff_member('  newhire@STAFF12.test ', 'moderator')$$,
  'an admin adds a moderator by email, whatever the capitals'
);
select is(
  (select role::text from public.staff_members() where user_id = '00000000-0000-0000-0000-000000000cc1'),
  'moderator',
  'the new moderator is on the list'
);
select throws_ok(
  $$select public.add_staff_member('nobody@staff12.test', 'moderator')$$,
  'P0002', 'No ClientShield account uses that email. Ask them to sign up first.',
  'only existing accounts can be added'
);
select lives_ok(
  $$select public.add_staff_member('newhire@staff12.test', 'admin')$$,
  'an admin can change someone''s role'
);

select throws_ok(
  $$select public.remove_staff_member('00000000-0000-0000-0000-000000000ca1')$$,
  '55000', 'You can''t remove yourself. Ask another admin.',
  'admins cannot remove themselves'
);
select lives_ok(
  $$select public.remove_staff_member('00000000-0000-0000-0000-000000000cb1')$$,
  'an admin removes a moderator'
);
select is(
  (select count(*)::int from public.staff_members() where user_id = '00000000-0000-0000-0000-000000000cb1'),
  0,
  'removed staff lose access'
);

reset role;
select is(
  (select count(*)::int from private.staff_events
   where target_user_id in ('00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000cc1')),
  3,
  'every change is recorded'
);

select * from finish();
rollback;
