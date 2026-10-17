-- Incident reports: customer details, evidence, submission, moderator review,
-- expiry and private matching fingerprints.
begin;
select plan(41);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'owner@alpha.test'),
  ('00000000-0000-0000-0000-0000000006a2', 'staff@alpha.test'),
  ('00000000-0000-0000-0000-0000000006b1', 'owner@bravo.test'),
  ('00000000-0000-0000-0000-0000000006d1', 'mod@clientshield.test');

insert into public.businesses (id, name, created_by, verification_status) values
  ('60000000-0000-0000-0000-00000000000a', 'Alpha Plumbing', '00000000-0000-0000-0000-0000000006a1', 'verified'),
  ('60000000-0000-0000-0000-00000000000b', 'Bravo Steam', '00000000-0000-0000-0000-0000000006b1', 'unverified');
insert into public.business_members (business_id, user_id, role) values
  ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a1', 'owner'),
  ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a2', 'staff'),
  ('60000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000006b1', 'owner');
insert into public.platform_roles (user_id, role)
values ('00000000-0000-0000-0000-0000000006d1', 'moderator');

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;

-- A valid report, used by several tests.
create function pg_temp.report(p_category text, p_service_date date) returns uuid
language sql as $$
  select public.create_incident(
    p_category::public.incident_category,
    p_service_date,
    'Carpet cleaning',
    'INV-1001',
    'Customer disputed the charge after the job was completed and signed off.',
    jsonb_build_object(
      'full_name', 'John Smith',
      'phone', '+12065550100',
      'email', 'John.Smith+jobs@Example.com',
      'address_line1', '123 Main Street, Apt 4',
      'city', 'Seattle', 'state', 'WA', 'postal_code', '98101'
    ),
    null
  );
$$;
grant execute on function pg_temp.report(text, date) to authenticated;

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ---------------------------------------------------------------------------
-- Matching fingerprints: normalization
-- ---------------------------------------------------------------------------
select is(
  private.normalize_identifier('email', '  John.Smith+jobs@Example.com '),
  'john.smith@example.com',
  'emails are lower-cased and +tags removed'
);
select is(
  private.normalize_identifier('phone', '(206) 555-0100'),
  private.normalize_identifier('phone', '+1 206.555.0100'),
  'phone numbers match whatever their formatting'
);
select is(
  private.normalize_identifier('address', '123 Main Street, Apt. 4 98101'),
  '123 main st apt 4 98101',
  'addresses are standardized (Street → st, punctuation removed)'
);
select is(
  private.normalize_identifier('name', '  John   SMITH-Jr. '),
  'john smith jr',
  'names are lower-cased with punctuation and extra spaces removed'
);
select ok(
  private.identifier_hash('phone', '2065550100') <> private.identifier_hash('email', '2065550100'),
  'the same text gives different fingerprints for different kinds of detail'
);
select ok(
  encode(private.identifier_hash('phone', '2065550100'), 'hex') !~ '2065550100',
  'a fingerprint does not contain the original detail'
);

-- ---------------------------------------------------------------------------
-- Who can report
-- ---------------------------------------------------------------------------
set local role authenticated;

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006b1', 'aal2');
select throws_ok(
  $$select pg_temp.report('chargeback', current_date - 10)$$,
  '42501', 'Only verified businesses can report incidents',
  'unverified businesses cannot report'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006a1', 'aal1');
select throws_ok(
  $$select pg_temp.report('chargeback', current_date - 10)$$,
  '42501', 'Two-step login required',
  'reporting needs two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006a1', 'aal2');
select lives_ok(
  $$insert into ids values ('chargeback', pg_temp.report('chargeback', current_date - 10))$$,
  'a verified owner can report an incident'
);
select results_eq(
  $$select status::text, expires_at is null from public.incidents
     where id = (select id from ids where name = 'chargeback')$$,
  $$values ('draft', true)$$,
  'a new report starts as a draft that does not expire yet'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006a2', 'aal2');
select lives_ok(
  $$insert into ids values ('callbacks', pg_temp.report('repeated_callbacks_no_defect', current_date - 5))$$,
  'staff of a verified business can report too'
);

-- ---------------------------------------------------------------------------
-- Validation
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select pg_temp.report('chargeback', current_date + 1)$$,
  '22023', 'The service date can''t be in the future',
  'service dates are checked'
);
select throws_ok(
  $$select public.create_incident('chargeback', current_date, 'Cleaning', null, 'Too short',
      '{"full_name":"John Smith","phone":"+12065550100"}', null)$$,
  '22023', 'Describe what happened in at least 20 characters',
  'a real description is required'
);
select throws_ok(
  $$select public.create_incident('chargeback', current_date, 'Cleaning', null,
      'Customer disputed the charge after the job was completed.',
      '{"full_name":"John Smith"}', null)$$,
  '22023', 'Add a phone number, email or address for the customer',
  'a customer needs at least one way to be matched'
);
select throws_ok(
  $$select public.create_incident('threatened_bad_review', current_date, 'Cleaning', null,
      'Customer posted a review about work that was never disputed.',
      '{"full_name":"John Smith","phone":"+12065550100"}',
      '{"url":"https://evil.example/review","rating":1,"date":"2026-10-01"}')$$,
  '22023', 'Use the link to the Google review',
  'review links must point to Google'
);

-- ---------------------------------------------------------------------------
-- Privacy
-- ---------------------------------------------------------------------------
select is(
  (select full_name from public.incident_customers
    where incident_id = (select id from ids where name = 'chargeback')),
  'John Smith',
  'staff of the reporting business can read the customer details'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006b1', 'aal2');
select is_empty('select * from public.incidents', 'other businesses cannot see the incidents');
select is_empty('select * from public.incident_customers', 'or the customer details');
select throws_ok(
  'select * from public.incident_identifiers',
  '42501', null,
  'nobody can read matching fingerprints through the API'
);
select throws_ok(
  $$insert into public.incidents (business_id, created_by, category, service_date, service_type, description)
    values ('60000000-0000-0000-0000-00000000000b', auth.uid(), 'fraud', current_date, 'x', repeat('x', 30))$$,
  '42501', null,
  'incidents cannot be inserted directly'
);

-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name)
select 'incident-evidence', '60000000-0000-0000-0000-00000000000a/' || id || '/invoice.pdf'
from ids where name = 'chargeback';
insert into storage.objects (bucket_id, name)
values ('incident-evidence', '60000000-0000-0000-0000-00000000000b/x/other.pdf');
set local role authenticated;

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006a1', 'aal2');
select throws_ok(
  $$select public.submit_incident((select id from ids where name = 'chargeback'))$$,
  '22023', 'Add at least one piece of evidence',
  'an incident needs evidence before it is submitted'
);
select lives_ok(
  $$select public.add_incident_evidence(
      (select id from ids where name = 'chargeback'), 'invoice',
      '60000000-0000-0000-0000-00000000000a/' || (select id from ids where name = 'chargeback') || '/invoice.pdf',
      'invoice.pdf', 'application/pdf', 2048, repeat('cd', 32))$$,
  'evidence already in storage can be recorded'
);
select throws_ok(
  $$select public.add_incident_evidence(
      (select id from ids where name = 'chargeback'), 'invoice',
      '60000000-0000-0000-0000-00000000000b/x/other.pdf', 'other.pdf', 'application/pdf', 10, repeat('cd', 32))$$,
  '42501', 'That file is not in this incident''s folder',
  'evidence must live in the incident''s own folder'
);
select throws_ok(
  $$select public.add_incident_evidence(
      (select id from ids where name = 'chargeback'), 'invoice',
      '60000000-0000-0000-0000-00000000000a/' || (select id from ids where name = 'chargeback') || '/missing.pdf',
      'missing.pdf', 'application/pdf', 10, repeat('cd', 32))$$,
  'P0002', 'Upload the file first',
  'evidence must be uploaded before it is recorded'
);

-- ---------------------------------------------------------------------------
-- Submission and review
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.submit_incident((select id from ids where name = 'chargeback'))$$,
  'the incident is submitted for review'
);
select throws_ok(
  $$select public.update_incident((select id from ids where name = 'chargeback'), 'chargeback',
      current_date - 10, 'Carpet cleaning', null,
      'Changing the story after submitting it for review.',
      '{"full_name":"John Smith","phone":"+12065550100"}', null)$$,
  '55000', 'This incident is being reviewed. Changes are locked until then.',
  'a submitted incident is locked'
);
select throws_ok(
  $$select public.review_incident((select id from ids where name = 'chargeback'), 'verify', null)$$,
  '42501', 'Only moderators can review incidents',
  'businesses cannot verify their own reports'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006d1', 'aal2');
select is(
  (select count(*)::int from public.incidents
    where business_id = '60000000-0000-0000-0000-00000000000a'),
  2,
  'moderators can see reports from every business'
);
select throws_ok(
  $$select public.review_incident((select id from ids where name = 'chargeback'), 'needs_info', ' ')$$,
  '22023', 'Add a note explaining the decision',
  'asking for more information requires a note'
);
select lives_ok(
  $$select public.review_incident((select id from ids where name = 'chargeback'), 'needs_info',
      'Please add the signed work order.')$$,
  'a moderator asks for more information'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006a1', 'aal2');
select lives_ok(
  $$select public.update_incident((select id from ids where name = 'chargeback'), 'chargeback',
      current_date - 10, 'Carpet cleaning', 'INV-1001',
      'Customer filed a chargeback after signing the completed work order.',
      '{"full_name":"John Smith","phone":"+12065550100","email":"john.smith@example.com",
        "address_line1":"123 Main Street, Apt 4","city":"Seattle","state":"WA","postal_code":"98101"}',
      null)$$,
  'the reporter can update the incident after a request for more information'
);
select lives_ok(
  $$select public.submit_incident((select id from ids where name = 'chargeback'))$$,
  'and resubmit it'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000006d1', 'aal2');
select lives_ok(
  $$select public.review_incident((select id from ids where name = 'chargeback'), 'verify', null)$$,
  'a moderator verifies the evidence'
);
select throws_ok(
  $$select public.review_incident((select id from ids where name = 'chargeback'), 'reject', 'No')$$,
  '55000', 'Only incidents waiting for review can be decided',
  'a decided incident cannot be decided again'
);

-- ---------------------------------------------------------------------------
-- Outcome: status, expiry, fingerprints, history
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000006a1', 'aal2');
select results_eq(
  $$select status::text, expires_at::date = (service_date + interval '60 months')::date
     from public.incidents where id = (select id from ids where name = 'chargeback')$$,
  $$values ('evidence_verified', true)$$,
  'a verified chargeback expires after 60 months'
);
select results_eq(
  $$select action::text from public.incident_events
     where incident_id = (select id from ids where name = 'chargeback') order by id$$,
  $$values ('created'), ('evidence_added'), ('submitted'), ('needs_info'), ('updated'),
           ('submitted'), ('evidence_verified')$$,
  'every step is recorded in order'
);
select throws_ok(
  $$delete from public.incident_events$$,
  '42501', null,
  'the incident history cannot be deleted'
);

reset role;
select results_eq(
  $$select kind::text from public.incident_identifiers
     where incident_id = (select id from ids where name = 'chargeback') order by 1$$,
  $$values ('address'), ('email'), ('name'), ('phone')$$,
  'verifying stores a fingerprint for each customer detail'
);
select ok(
  (select hash = private.identifier_hash('phone', private.normalize_identifier('phone', '(206) 555-0100'))
     from public.incident_identifiers
    where incident_id = (select id from ids where name = 'chargeback') and kind = 'phone'),
  'the stored phone fingerprint matches the same number typed differently'
);
select is_empty(
  $$select * from public.incident_identifiers
     where incident_id = (select id from ids where name = 'callbacks')$$,
  'unverified drafts have no fingerprints, so they can never match'
);
select is(
  private.incident_expiry('repeated_callbacks_no_defect', '2026-01-15')::date,
  '2028-01-15'::date,
  'minor disputes expire after 24 months'
);

select * from finish();
rollback;
