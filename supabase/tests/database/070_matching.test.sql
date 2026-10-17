-- Blind customer matching: checks, alerts, privacy of results.
begin;
select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures: Bravo reported John Smith; Alpha later checks a new booking.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'owner@alpha.test'),
  ('00000000-0000-0000-0000-0000000007b1', 'owner@bravo.test'),
  ('00000000-0000-0000-0000-0000000007c1', 'owner@charlie.test');

insert into public.businesses (id, name, created_by, verification_status) values
  ('70000000-0000-0000-0000-00000000000a', 'Alpha Plumbing', '00000000-0000-0000-0000-0000000007a1', 'verified'),
  ('70000000-0000-0000-0000-00000000000b', 'Bravo Steam', '00000000-0000-0000-0000-0000000007b1', 'verified'),
  ('70000000-0000-0000-0000-00000000000c', 'Charlie HVAC', '00000000-0000-0000-0000-0000000007c1', 'unverified');
insert into public.business_members (business_id, user_id, role) values
  ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'owner'),
  ('70000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000007b1', 'owner'),
  ('70000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000007c1', 'owner');

-- Three incidents about the same customer: verified, expired, and still in review.
insert into public.incidents
  (id, business_id, created_by, status, category, service_date, service_type, description,
   review_rating, expires_at)
values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000007b1', 'evidence_verified', 'chargeback', '2026-03-10',
   'Carpet cleaning', 'Customer filed a chargeback after signing off the work.', 1,
   now() + interval '5 years'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000007b1', 'evidence_verified', 'repeated_callbacks_no_defect',
   '2020-01-10', 'Carpet cleaning', 'Old dispute that has already expired by now.', null,
   now() - interval '1 day'),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000007b1', 'submitted', 'fraud', '2026-09-01',
   'Carpet cleaning', 'Not verified yet, so it must never match anyone.', null, null);

insert into public.incident_customers
  (incident_id, full_name, phone, email, address_line1, city, state, postal_code)
select id, 'John Smith', '+12065550100', 'john.smith@example.com', '123 Main Street',
       'Seattle', 'WA', '98101'
from public.incidents where business_id = '70000000-0000-0000-0000-00000000000b';

select private.store_identifiers(id) from public.incidents
where business_id = '70000000-0000-0000-0000-00000000000b';

insert into storage.objects (bucket_id, name)
values ('incident-evidence', '70000000-0000-0000-0000-00000000000b/71000000-0000-0000-0000-000000000001/a.pdf'),
       ('incident-evidence', '70000000-0000-0000-0000-00000000000b/71000000-0000-0000-0000-000000000001/b.jpg');
insert into public.incident_evidence
  (incident_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by)
values
  ('71000000-0000-0000-0000-000000000001', 'invoice',
   '70000000-0000-0000-0000-00000000000b/71000000-0000-0000-0000-000000000001/a.pdf',
   'invoice.pdf', 'application/pdf', 10, repeat('ab', 32), '00000000-0000-0000-0000-0000000007b1'),
  ('71000000-0000-0000-0000-000000000001', 'before_after_photo',
   '70000000-0000-0000-0000-00000000000b/71000000-0000-0000-0000-000000000001/b.jpg',
   'after.jpg', 'image/jpeg', 10, repeat('cd', 32), '00000000-0000-0000-0000-0000000007b1');

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;

create temporary table results (name text primary key, result jsonb);
grant all on results to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Who can check
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000007c1', 'aal2');
select throws_ok(
  $$select public.check_customer('{"full_name":"John Smith","phone":"(206) 555-0100"}')$$,
  '42501', 'Only verified businesses can check customers',
  'unverified businesses cannot check customers'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000007a1', 'aal1');
select throws_ok(
  $$select public.check_customer('{"full_name":"John Smith","phone":"(206) 555-0100"}')$$,
  '42501', 'Two-step login required',
  'checks need two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000007a1', 'aal2');
select throws_ok(
  $$select public.check_customer('{"full_name":"John Smith"}')$$,
  '22023', 'Enter at least a phone, email or address',
  'a name alone cannot be checked'
);

-- ---------------------------------------------------------------------------
-- Matching rules
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into results values ('name+phone',
      public.check_customer('{"full_name":"john  SMITH","phone":"206.555.0100"}'))$$,
  'a check runs'
);
select is(
  (select (result ->> 'incident_count')::int from results where name = 'name+phone'),
  1,
  'name and phone together match the one verified, unexpired incident'
);

insert into results values ('phone only', public.check_customer('{"phone":"+1 (206) 555-0100"}'));
select is(
  (select (result ->> 'incident_count')::int from results where name = 'phone only'),
  0,
  'one detail alone is never enough for an alert'
);

insert into results values ('email+address', public.check_customer(
  '{"full_name":"Jane Doe","email":"John.Smith+booking@Example.com","address_line1":"123 Main St.","postal_code":"98101"}'));
select is(
  (select (result ->> 'incident_count')::int from results where name = 'email+address'),
  1,
  'email and address match even when typed differently'
);

insert into results values ('nobody', public.check_customer(
  '{"full_name":"Someone Else","phone":"(425) 555-0199","email":"someone@else.com"}'));
select is(
  (select (result ->> 'incident_count')::int from results where name = 'nobody'),
  0,
  'an unknown customer has no incidents'
);
select is(
  (select result -> 'alert_id' from results where name = 'nobody'),
  'null'::jsonb,
  'no alert is created when nothing matches'
);

-- ---------------------------------------------------------------------------
-- What the result reveals
-- ---------------------------------------------------------------------------
select is(
  (select result -> 'incidents' -> 0 ->> 'category' from results where name = 'name+phone'),
  'chargeback',
  'the result shows the dispute type'
);
select is(
  (select result -> 'incidents' -> 0 ->> 'service_month' from results where name = 'name+phone'),
  '2026-03',
  'the result shows the month, not the exact date'
);
select is(
  (select (result -> 'incidents' -> 0 ->> 'evidence_count')::int from results where name = 'name+phone'),
  2,
  'the result shows how much evidence was verified'
);
select is(
  (select (result -> 'incidents' -> 0 ->> 'review_rating')::int from results where name = 'name+phone'),
  1,
  'the result shows the Google review rating when there was one'
);
select ok(
  (select result::text !~* 'john|smith|555|example\.com|main|bravo|71000000'
     from results where name = 'name+phone'),
  'the result never reveals the customer, the reporting business or the incident'
);

-- ---------------------------------------------------------------------------
-- Logging and alerts
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.customer_checks),
  4,
  'every check is logged for the business'
);
select is(
  (select count(*)::int from public.match_alerts),
  2,
  'an alert is saved for each check that matched'
);
select throws_ok(
  'select * from public.match_alert_incidents',
  '42501', null,
  'which incidents an alert points to is never readable directly'
);
select is(
  (select (public.alert_details((select (result ->> 'alert_id')::uuid from results where name = 'name+phone'))
     ->> 'incident_count')::int),
  1,
  'the business can open its alert again later'
);
select lives_ok(
  $$select public.respond_to_alert(
      (select (result ->> 'alert_id')::uuid from results where name = 'name+phone'),
      'require_authorization')$$,
  'the business records what it decided'
);
select is(
  (select decision::text from public.match_alerts
    where id = (select (result ->> 'alert_id')::uuid from results where name = 'name+phone')),
  'require_authorization',
  'the decision is saved on the alert'
);

-- New customer: saved privately and checked in one step.
select lives_ok(
  $$insert into results values ('new customer', public.add_customer(
      '{"full_name":"John Smith","phone":"(206) 555-0100","email":"jsmith@other.com"}'))$$,
  'adding a new customer checks them automatically'
);
select is(
  (select (result ->> 'incident_count')::int from results where name = 'new customer'),
  1,
  'the new customer''s check found the incident'
);
select is(
  (select count(*)::int from public.customers where full_name = 'John Smith'),
  1,
  'the customer is saved in the business''s own records'
);

-- ---------------------------------------------------------------------------
-- Other businesses
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000007b1', 'aal2');
select is_empty('select * from public.match_alerts', 'other businesses cannot see Alpha''s alerts');
select is_empty('select * from public.customers', 'or Alpha''s customers');
select throws_ok(
  $$select public.alert_details((select (result ->> 'alert_id')::uuid from results where name = 'name+phone'))$$,
  'P0002', 'Alert not found',
  'or open Alpha''s alert'
);

select * from finish();
rollback;
