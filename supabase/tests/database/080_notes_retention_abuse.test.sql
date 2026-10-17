-- Private customer notes, retention cleanup, and abuse flags.
begin;
select plan(54);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'owner@alpha8.test'),
  ('00000000-0000-0000-0000-0000000008a2', 'staff@alpha8.test'),
  ('00000000-0000-0000-0000-0000000008b1', 'owner@bravo8.test'),
  ('00000000-0000-0000-0000-0000000008d1', 'mod@clientshield8.test'),
  ('00000000-0000-0000-0000-0000000008e1', 'admin@clientshield8.test');

insert into public.businesses (id, name, created_by, verification_status) values
  ('80000000-0000-0000-0000-00000000000a', 'Alpha Eight', '00000000-0000-0000-0000-0000000008a1', 'verified'),
  ('80000000-0000-0000-0000-00000000000b', 'Bravo Eight', '00000000-0000-0000-0000-0000000008b1', 'verified');
insert into public.business_members (business_id, user_id, role) values
  ('80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a1', 'owner'),
  ('80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a2', 'staff'),
  ('80000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000008b1', 'owner');
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000008d1', 'moderator'),
  ('00000000-0000-0000-0000-0000000008e1', 'admin');

insert into public.customers (id, business_id, created_by, full_name, phone, postal_code) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-0000000008a1', 'Jane Doe', '+12065550199', '98101');

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Private notes
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a2', 'aal2');
select lives_ok(
  $$insert into ids values ('staff note', public.add_customer_note(
      '81000000-0000-0000-0000-000000000001', '  Prefers morning visits. Gate code at front desk.  '))$$,
  'staff can add a note to their business''s customer'
);
select is(
  (select body from public.customer_notes where id = (select id from ids where name = 'staff note')),
  'Prefers morning visits. Gate code at front desk.',
  'notes are saved trimmed'
);
select throws_ok(
  $$select public.add_customer_note('81000000-0000-0000-0000-000000000001', '   ')$$,
  '22023', 'Write a note first',
  'empty notes are refused'
);
select throws_ok(
  $$select public.add_customer_note('81000000-0000-0000-0000-000000000001', repeat('x', 2001))$$,
  '22023', 'Keep notes under 2,000 characters',
  'very long notes are refused'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a2', 'aal1');
select is(
  (select count(*)::int from public.customer_notes
   where customer_id = '81000000-0000-0000-0000-000000000001'),
  0,
  'notes need two-step login to read'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008b1', 'aal2');
select is(
  (select count(*)::int from public.customer_notes
   where customer_id = '81000000-0000-0000-0000-000000000001'),
  0,
  'other businesses never see a business''s notes'
);
select throws_ok(
  $$select public.add_customer_note('81000000-0000-0000-0000-000000000001', 'Sneaky note')$$,
  'P0002', 'Customer not found',
  'other businesses cannot add notes to someone else''s customer'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008d1', 'aal2');
select is(
  (select count(*)::int from public.customer_notes
   where customer_id = '81000000-0000-0000-0000-000000000001'),
  0,
  'moderators cannot read private notes either'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a1', 'aal2');
select is(
  (select count(*)::int from public.customer_notes
   where customer_id = '81000000-0000-0000-0000-000000000001'),
  1,
  'the owner sees notes written by staff'
);
select throws_ok(
  $$insert into public.customer_notes (business_id, customer_id, author_id, body)
    values ('80000000-0000-0000-0000-00000000000a', '81000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-0000000008a1', 'direct')$$,
  '42501', null,
  'notes cannot be written directly, only through add_customer_note'
);

insert into ids values ('owner note', public.add_customer_note(
  '81000000-0000-0000-0000-000000000001', 'Owner''s own note'));

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a2', 'aal2');
select throws_ok(
  format('select public.delete_customer_note(%L)', (select id from ids where name = 'owner note')),
  '42501', 'Only the person who wrote a note, or the owner, can delete it',
  'staff cannot delete someone else''s note'
);
select lives_ok(
  format('select public.delete_customer_note(%L)', (select id from ids where name = 'staff note')),
  'staff can delete their own note'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a1', 'aal2');
select lives_ok(
  format('select public.delete_customer_note(%L)', (select id from ids where name = 'owner note')),
  'the owner can delete any note in their business'
);
select is(
  (select count(*)::int from public.customer_notes
   where customer_id = '81000000-0000-0000-0000-000000000001'),
  0,
  'deleted notes are gone'
);

-- ---------------------------------------------------------------------------
-- Customer records: check again, delete
-- ---------------------------------------------------------------------------
select is(
  (public.recheck_customer('81000000-0000-0000-0000-000000000001') ->> 'incident_count')::int,
  0,
  'a saved customer can be checked again'
);
select is(
  (select customer_id from public.customer_checks
   where business_id = '80000000-0000-0000-0000-00000000000a' order by created_at desc limit 1),
  '81000000-0000-0000-0000-000000000001'::uuid,
  'the re-check is logged against the customer'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008b1', 'aal2');
select throws_ok(
  $$select public.recheck_customer('81000000-0000-0000-0000-000000000001')$$,
  'P0002', 'Customer not found',
  'other businesses cannot re-check someone else''s customer'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a2', 'aal2');
select throws_ok(
  $$select public.delete_customer('81000000-0000-0000-0000-000000000001')$$,
  '42501', 'Only the owner can delete customer records',
  'staff cannot delete customer records'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a1', 'aal2');
select lives_ok(
  $$select public.add_customer_note('81000000-0000-0000-0000-000000000001', 'Will be deleted')$$,
  'a note to be removed with its customer'
);
select lives_ok(
  $$select public.delete_customer('81000000-0000-0000-0000-000000000001')$$,
  'the owner can delete a customer record'
);
reset role;
select is(
  (select count(*)::int from public.customer_notes
   where customer_id = '81000000-0000-0000-0000-000000000001'),
  0,
  'deleting a customer deletes their notes'
);

-- ---------------------------------------------------------------------------
-- Retention rules
-- ---------------------------------------------------------------------------
select is(
  (select months from public.retention_rules where category = 'chargeback')::int,
  60,
  'chargebacks are kept 60 months by default'
);
select is(
  (select months from public.retention_rules where category = 'false_workmanship_complaint')::int,
  24,
  'minor disputes are kept 24 months by default'
);

set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-0000000008d1', 'aal2');
select throws_ok(
  $$select public.set_retention_months('chargeback', 36)$$,
  '42501', 'Only admins can change how long records are kept',
  'moderators cannot change retention'
);
select is(
  (select count(*)::int from public.retention_rules),
  7,
  'moderators can read the retention rules'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008e1', 'aal2');
select throws_ok(
  $$select public.set_retention_months('chargeback', 61)$$,
  '22023', 'Keep records between 6 and 60 months',
  'retention has legal limits'
);
select lives_ok(
  $$select public.set_retention_months('threatened_bad_review', 12)$$,
  'admins can change retention'
);
reset role;
select is(
  private.incident_expiry('threatened_bad_review', '2026-01-15'),
  '2027-01-15'::date::timestamptz,
  'new expiry dates follow the changed rule'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a1', 'aal2');
set local role authenticated;
select is(
  (select count(*)::int from public.retention_rules),
  0,
  'businesses cannot see retention settings'
);
reset role;

-- ---------------------------------------------------------------------------
-- Cleanup of expired records
-- ---------------------------------------------------------------------------
insert into public.incidents
  (id, business_id, created_by, status, category, service_date, service_type, description,
   review_url, review_rating, review_text, expires_at, reviewed_at, updated_at)
values
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000008b1', 'evidence_verified', 'chargeback', '2020-01-10',
   'Carpet cleaning', 'Chargeback by Sam Lee after the job was signed off.',
   'https://g.page/r/abc', 1, 'Terrible, says Sam', now() - interval '1 day', now() - interval '5 years', now()),
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000008b1', 'evidence_verified', 'chargeback', '2026-03-10',
   'Carpet cleaning', 'Still inside its retention period, keep everything.', null, null, null,
   now() + interval '4 years', now(), now()),
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-0000000008b1', 'draft', 'fraud', '2024-01-10',
   'Carpet cleaning', 'An abandoned draft from long ago that was never sent.', null, null, null,
   null, null, now() - interval '13 months');

insert into public.incident_customers (incident_id, full_name, phone)
select id, 'Sam Lee', '+12065550123' from public.incidents
where business_id = '80000000-0000-0000-0000-00000000000b';
select private.store_identifiers(id) from public.incidents
where business_id = '80000000-0000-0000-0000-00000000000b';

insert into storage.objects (bucket_id, name) values
  ('incident-evidence', '80000000-0000-0000-0000-00000000000b/82000000-0000-0000-0000-000000000001/a.pdf'),
  ('incident-evidence', '80000000-0000-0000-0000-00000000000b/82000000-0000-0000-0000-000000000003/b.pdf');
insert into public.incident_evidence
  (incident_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by)
values
  ('82000000-0000-0000-0000-000000000001', 'invoice',
   '80000000-0000-0000-0000-00000000000b/82000000-0000-0000-0000-000000000001/a.pdf',
   'invoice.pdf', 'application/pdf', 10, repeat('ab', 32), '00000000-0000-0000-0000-0000000008b1'),
  ('82000000-0000-0000-0000-000000000003', 'invoice',
   '80000000-0000-0000-0000-00000000000b/82000000-0000-0000-0000-000000000003/b.pdf',
   'draft.pdf', 'application/pdf', 10, repeat('cd', 32), '00000000-0000-0000-0000-0000000008b1');

insert into public.customer_checks (business_id, user_id, provided, incident_count, created_at)
values ('80000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000008b1',
        '{phone}', 0, now() - interval '25 months');

select lives_ok($$select private.purge_expired()$$, 'the cleanup job runs');

select is(
  (select status::text from public.incidents where id = '82000000-0000-0000-0000-000000000001'),
  'expired',
  'an incident past its retention period is marked expired'
);
select is(
  (select row(description, review_url, review_text)::text from public.incidents
   where id = '82000000-0000-0000-0000-000000000001'),
  row('Details removed when this record expired.', null::text, null::text)::text,
  'its written details are scrubbed'
);
select is(
  (select count(*)::int from public.incident_customers
   where incident_id = '82000000-0000-0000-0000-000000000001'),
  0,
  'its customer details are deleted'
);
select is(
  (select count(*)::int from public.incident_identifiers
   where incident_id = '82000000-0000-0000-0000-000000000001'),
  0,
  'its matching fingerprints are deleted'
);
select is(
  (select count(*)::int from public.incident_evidence
   where incident_id = '82000000-0000-0000-0000-000000000001'),
  0,
  'its evidence records are deleted'
);
select ok(
  exists (select 1 from public.incident_events
          where incident_id = '82000000-0000-0000-0000-000000000001' and action = 'expired'),
  'the cleanup is recorded in the incident history'
);
select is(
  (select count(*)::int from public.incident_identifiers
   where incident_id = '82000000-0000-0000-0000-000000000002'),
  2,
  'incidents still inside their retention period are untouched'
);
select ok(
  not exists (select 1 from public.incidents where id = '82000000-0000-0000-0000-000000000003'),
  'drafts abandoned for over a year are deleted'
);
select set_eq(
  $$select path from private.storage_purge_queue
    where path like '80000000-0000-0000-0000-00000000000b/%'$$,
  array[
    '80000000-0000-0000-0000-00000000000b/82000000-0000-0000-0000-000000000001/a.pdf',
    '80000000-0000-0000-0000-00000000000b/82000000-0000-0000-0000-000000000003/b.pdf'
  ],
  'their evidence files are queued for deletion from storage'
);
select is(
  (select count(*)::int from public.customer_checks
   where business_id = '80000000-0000-0000-0000-00000000000b'),
  0,
  'check logs older than 24 months are deleted'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_storage_purge(integer)', 'execute')
  and has_function_privilege('service_role', 'public.claim_storage_purge(integer)', 'execute'),
  'only the server can read the file deletion queue'
);
select is(
  (select count(*)::int from public.claim_storage_purge(500)
   where path like '80000000-0000-0000-0000-00000000000b/%'),
  2,
  'the file cleanup function receives the queued files'
);
select ok(
  exists (select 1 from cron.job where jobname = 'purge-expired-records'),
  'the cleanup runs every night'
);

-- ---------------------------------------------------------------------------
-- Abuse flags
-- ---------------------------------------------------------------------------
-- 39 more checks: with the earlier re-check (its customer was deleted, so it now
-- counts as unsaved) that makes 40 in a day.
insert into public.customer_checks (business_id, user_id, provided, incident_count)
select '80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a1', '{phone,name}', 0
from generate_series(1, 39);
select is(
  (select detail from public.abuse_flags
   where business_id = '80000000-0000-0000-0000-00000000000a' and kind = 'many_unsaved_checks'
     and resolved_at is null),
  '40 checks in 24 hours for people not saved as customers',
  'many checks of unsaved people raise a flag'
);
select is(
  (select count(*)::int from public.abuse_flags
   where business_id = '80000000-0000-0000-0000-00000000000a' and resolved_at is null),
  1,
  'only one open flag per kind, however many checks follow'
);

-- Reports: ten submitted in a week, and repeated rejections.
insert into public.incidents
  (business_id, created_by, status, category, service_date, service_type, description)
select '80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a1', 'draft',
       'other_documented_dispute', '2026-09-01', 'Plumbing', 'Report number ' || n || ' for testing volume.'
from generate_series(1, 10) n;
update public.incidents set status = 'submitted', submitted_at = now()
where business_id = '80000000-0000-0000-0000-00000000000a';
select is(
  (select detail from public.abuse_flags
   where business_id = '80000000-0000-0000-0000-00000000000a' and kind = 'high_report_volume'),
  '10 incident reports submitted in 7 days',
  'an unusual number of reports raises a flag'
);

set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-0000000008d1', 'aal2');
select public.review_incident(id, 'reject', 'No evidence the job took place.')
from public.incidents
where business_id = '80000000-0000-0000-0000-00000000000a' and status = 'submitted'
order by id limit 3;
select is(
  (select detail from public.abuse_flags
   where business_id = '80000000-0000-0000-0000-00000000000a' and kind = 'repeated_rejections'),
  '3 incident reports rejected in 90 days',
  'repeatedly rejected reports raise a flag'
);
select is(
  (select count(*)::int from public.abuse_flags
   where business_id = '80000000-0000-0000-0000-00000000000a'),
  3,
  'moderators see the flags'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000008a1', 'aal2');
select is(
  (select count(*)::int from public.abuse_flags),
  0,
  'businesses never see flags about themselves'
);
select throws_ok(
  format('select public.resolve_abuse_flag(%L, %L)',
    (select id from public.abuse_flags limit 1), 'Nothing to see'),
  '42501', 'Only moderators can resolve flags',
  'businesses cannot resolve flags'
);

reset role;
insert into ids select 'flag', id from public.abuse_flags
where business_id = '80000000-0000-0000-0000-00000000000a' and kind = 'many_unsaved_checks';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-0000-0000-0000000008d1', 'aal2');
select throws_ok(
  format('select public.resolve_abuse_flag(%L, %L)', (select id from ids where name = 'flag'), ' '),
  '22023', 'Add a note explaining what you found',
  'resolving a flag needs a note'
);
select lives_ok(
  format('select public.resolve_abuse_flag(%L, %L)', (select id from ids where name = 'flag'),
    'Called the owner: they imported last year''s bookings. Normal use.'),
  'a moderator resolves a flag with a note'
);
select throws_ok(
  format('select public.resolve_abuse_flag(%L, %L)', (select id from ids where name = 'flag'), 'Again'),
  '55000', 'This flag is already resolved',
  'a flag is resolved only once'
);

reset role;
insert into public.customer_checks (business_id, user_id, provided, incident_count)
values ('80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a1', '{phone}', 0);
select is(
  (select count(*)::int from public.abuse_flags
   where business_id = '80000000-0000-0000-0000-00000000000a' and kind = 'many_unsaved_checks'),
  2,
  'after a flag is resolved, continued unusual use opens a new one'
);

select * from finish();
rollback;
