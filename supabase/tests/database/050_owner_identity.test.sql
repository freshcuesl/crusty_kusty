-- Owner identity checks (Stripe Identity results). Only server code writes them.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'owner@alpha.test'),
  ('00000000-0000-0000-0000-0000000005a2', 'staff@alpha.test'),
  ('00000000-0000-0000-0000-0000000005b1', 'owner@bravo.test'),
  ('00000000-0000-0000-0000-0000000005d1', 'mod@clientshield.test');

insert into public.businesses
  (id, name, created_by, phone, address_line1, city, state, postal_code)
values
  ('50000000-0000-0000-0000-00000000000a', 'Alpha Plumbing', '00000000-0000-0000-0000-0000000005a1',
   '+12065550100', '1 Main St', 'Seattle', 'WA', '98101'),
  ('50000000-0000-0000-0000-00000000000b', 'Bravo Steam', '00000000-0000-0000-0000-0000000005b1',
   '+12065550101', '2 Main St', 'Seattle', 'WA', '98101');
insert into public.business_members (business_id, user_id, role) values
  ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000005a1', 'owner'),
  ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000005a2', 'staff'),
  ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000005b1', 'owner');
insert into public.platform_roles (user_id, role)
values ('00000000-0000-0000-0000-0000000005d1', 'moderator');

insert into storage.objects (bucket_id, name)
values ('business-documents', '50000000-0000-0000-0000-00000000000a/license.pdf');
insert into public.business_documents
  (business_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by)
values
  ('50000000-0000-0000-0000-00000000000a', 'business_license',
   '50000000-0000-0000-0000-00000000000a/license.pdf', 'license.pdf', 'application/pdf', 10,
   repeat('ab', 32), '00000000-0000-0000-0000-0000000005a1');

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Submitting requires a verified identity
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-0000000005a1', 'aal2');
select throws_ok(
  $$select public.submit_for_verification()$$,
  '22023', 'Verify your identity first',
  'a business cannot be submitted before the owner verifies their identity'
);
select throws_ok(
  $$insert into public.owner_identity_checks (business_id, user_id, stripe_session_id, status)
    values ('50000000-0000-0000-0000-00000000000a', auth.uid(), 'vs_fake', 'verified')$$,
  '42501', null,
  'an owner cannot mark themselves verified'
);

-- Stripe's webhook (server code with the service role) records the result.
reset role;
set local role service_role;
insert into public.owner_identity_checks (business_id, user_id, stripe_session_id, status)
values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000005a1',
        'vs_test_1', 'requires_input');
select lives_ok(
  $$select public.record_identity_result('vs_test_1', 'verified', null)$$,
  'server code records Stripe''s result'
);
select throws_ok(
  $$select public.record_identity_result('vs_unknown', 'verified', null)$$,
  'P0002', 'Unknown identity session',
  'results for unknown sessions are refused'
);
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-0000000005a1', 'aal2');
select is(public.my_identity_status(), 'verified', 'the owner sees their verified status');
select lives_ok($$select public.submit_for_verification()$$, 'now the business can be submitted');

-- ---------------------------------------------------------------------------
-- Who can see what
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000005a2', 'aal2');
select results_eq(
  $$select status::text from public.owner_identity_checks$$,
  $$values ('verified')$$,
  'staff can see their owner''s identity status'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000005b1', 'aal2');
select is_empty(
  $$select * from public.owner_identity_checks$$,
  'other businesses cannot see it'
);
select is(public.my_identity_status(), null::public.identity_status, 'an owner who never started has no status');

select pg_temp.sign_in('00000000-0000-0000-0000-0000000005a1', 'aal1');
select is_empty(
  $$select * from public.owner_identity_checks$$,
  'identity status needs two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000005d1', 'aal2');
select is(
  (select count(*)::int from public.owner_identity_checks
    where business_id = '50000000-0000-0000-0000-00000000000a'),
  1,
  'moderators can see identity results while reviewing'
);
select throws_ok(
  $$select public.record_identity_result('vs_test_1', 'canceled', null)$$,
  '42501', null,
  'signed-in users cannot call the server-only recorder'
);

-- ---------------------------------------------------------------------------
-- Approval double-checks identity
-- ---------------------------------------------------------------------------
reset role;
update public.owner_identity_checks set status = 'canceled' where stripe_session_id = 'vs_test_1';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-0000000005d1', 'aal2');
select throws_ok(
  $$select public.review_business('50000000-0000-0000-0000-00000000000a', 'approve', null)$$,
  '55000', 'The owner''s identity is not verified',
  'a business cannot be approved unless the owner''s identity is verified'
);

select * from finish();
rollback;
