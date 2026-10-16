-- Business verification: details, documents, submission, moderator review, private storage.
begin;
select plan(37);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'owner@alpha.test'),
  ('00000000-0000-0000-0000-0000000004a2', 'staff@alpha.test'),
  ('00000000-0000-0000-0000-0000000004b1', 'owner@bravo.test'),
  ('00000000-0000-0000-0000-0000000004d1', 'mod@clientshield.test');

insert into public.businesses (id, name, created_by) values
  ('40000000-0000-0000-0000-00000000000a', 'Alpha Plumbing', '00000000-0000-0000-0000-0000000004a1'),
  ('40000000-0000-0000-0000-00000000000b', 'Bravo Steam', '00000000-0000-0000-0000-0000000004b1');
insert into public.business_members (business_id, user_id, role) values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a1', 'owner'),
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a2', 'staff'),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000004b1', 'owner');
insert into public.platform_roles (user_id, role)
values ('00000000-0000-0000-0000-0000000004d1', 'moderator');

-- Files as if already uploaded to storage.
insert into storage.objects (bucket_id, name) values
  ('business-documents', '40000000-0000-0000-0000-00000000000a/license.pdf'),
  ('business-documents', '40000000-0000-0000-0000-00000000000a/ein.pdf'),
  ('business-documents', '40000000-0000-0000-0000-00000000000b/bravo.pdf');

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;

create function pg_temp.add_doc(path text) returns uuid
language sql as $$
  select public.add_business_document(
    'business_license', path, 'license.pdf', 'application/pdf', 1024, repeat('ab', 32)
  );
$$;
grant execute on function pg_temp.add_doc(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'business-documents'),
  false,
  'the documents bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'business-documents'),
  10485760::bigint,
  'uploads are limited to 10 MB'
);
select ok(
  (select 'application/pdf' = any(allowed_mime_types) and not ('text/html' = any(allowed_mime_types))
     from storage.buckets where id = 'business-documents'),
  'only PDFs and images are accepted'
);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Business details
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a1', 'aal1');
select throws_ok(
  $$select public.update_business_details('+12065550100', '1 Main St', null, 'Seattle', 'WA', '98101')$$,
  '42501', 'Two-step login required',
  'details need two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a1', 'aal2');
select lives_ok(
  $$select public.update_business_details('+12065550100', ' 1 Main St ', 'Suite 2', ' Seattle ', 'wa', '98101')$$,
  'the owner can save business details'
);
select results_eq(
  $$select phone, address_line1, address_line2, city, state, postal_code from public.businesses$$,
  $$values ('+12065550100', '1 Main St', 'Suite 2', 'Seattle', 'WA', '98101')$$,
  'details are trimmed and the state is upper-cased'
);
select throws_ok(
  $$select public.update_business_details('555-0100', '1 Main St', null, 'Seattle', 'WA', '98101')$$,
  '22023', 'Enter a 10-digit US phone number',
  'phone numbers are validated'
);
select throws_ok(
  $$select public.update_business_details('+12065550100', '1 Main St', null, 'Seattle', 'ZZ', '98101')$$,
  '22023', 'Choose a US state',
  'states are validated'
);
select throws_ok(
  $$select public.update_business_details('+12065550100', '1 Main St', null, 'Seattle', 'WA', '981')$$,
  '22023', 'Enter a 5-digit ZIP code',
  'ZIP codes are validated'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a2', 'aal2');
select throws_ok(
  $$select public.update_business_details('+12065550100', '1 Main St', null, 'Seattle', 'WA', '98101')$$,
  '42501', 'Only the business owner can do this',
  'staff cannot change business details'
);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a1', 'aal2');
select throws_ok(
  $$select public.submit_for_verification()$$,
  '22023', 'Add at least one document',
  'a business cannot be submitted without documents'
);
select lives_ok(
  $$select pg_temp.add_doc('40000000-0000-0000-0000-00000000000a/license.pdf')$$,
  'the owner can record an uploaded document'
);
select throws_ok(
  $$select pg_temp.add_doc('40000000-0000-0000-0000-00000000000b/bravo.pdf')$$,
  '42501', 'That file is not in your business folder',
  'an owner cannot claim another business''s file'
);
select throws_ok(
  $$select pg_temp.add_doc('40000000-0000-0000-0000-00000000000a/missing.pdf')$$,
  'P0002', 'Upload the file first',
  'a document must exist in storage before it is recorded'
);
select throws_ok(
  $$select public.add_business_document('ein_letter', '40000000-0000-0000-0000-00000000000a/ein.pdf',
      'ein.pdf', 'application/pdf', 1024, 'not-a-hash')$$,
  '22023', 'Invalid file fingerprint',
  'the SHA-256 fingerprint is validated'
);
select throws_ok(
  $$insert into public.business_documents (business_id, kind, storage_path, file_name, mime_type,
      size_bytes, sha256, uploaded_by)
    values ('40000000-0000-0000-0000-00000000000a', 'ein_letter', 'x', 'x', 'x', 1, repeat('a', 64), auth.uid())$$,
  '42501', null,
  'documents cannot be inserted directly'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a2', 'aal2');
select is(
  (select count(*)::int from public.business_documents),
  1,
  'staff can see their business''s documents'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004b1', 'aal2');
select is_empty('select * from public.business_documents', 'other businesses see no documents');
select is_empty(
  $$select * from storage.objects
     where bucket_id = 'business-documents' and name like '40000000-0000-0000-0000-00000000000a/%'$$,
  'other businesses cannot read the files either'
);

-- ---------------------------------------------------------------------------
-- Submission
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.submit_for_verification()$$,
  '22023', 'Add your business phone and address first',
  'a business needs its details before submitting'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a1', 'aal2');
select lives_ok($$select public.submit_for_verification()$$, 'the owner submits for review');
select results_eq(
  $$select verification_status::text, submitted_at is not null from public.businesses$$,
  $$values ('pending', true)$$,
  'the business is now waiting for review'
);
select throws_ok(
  $$select public.update_business_details('+12065550100', '9 Elm St', null, 'Seattle', 'WA', '98101')$$,
  '55000', 'Your business is being reviewed. Changes are locked until then.',
  'details are locked during review'
);
select throws_ok(
  $$select public.submit_for_verification()$$,
  '55000', 'Your business is being reviewed. Changes are locked until then.',
  'a business cannot be submitted twice'
);

-- ---------------------------------------------------------------------------
-- Moderator review
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.review_business('40000000-0000-0000-0000-00000000000a', 'approve', null)$$,
  '42501', 'Only moderators can review businesses',
  'an owner cannot approve their own business'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004d1', 'aal1');
select throws_ok(
  $$select public.review_business('40000000-0000-0000-0000-00000000000a', 'approve', null)$$,
  '42501', 'Two-step login required',
  'moderators need two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004d1', 'aal2');
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'business-documents' and name like '40000000-0000-0000-0000-00000000000a/%'),
  2,
  'moderators can read the files they review'
);
select throws_ok(
  $$select public.review_business('40000000-0000-0000-0000-00000000000a', 'needs_info', '  ')$$,
  '22023', 'Add a note explaining the decision',
  'asking for more information requires a note'
);
select lives_ok(
  $$select public.review_business('40000000-0000-0000-0000-00000000000a', 'needs_info', 'License is expired.')$$,
  'a moderator can ask for more information'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a1', 'aal2');
select results_eq(
  $$select verification_status::text, review_note from public.businesses$$,
  $$values ('needs_info', 'License is expired.')$$,
  'the owner sees what the moderator needs'
);
select lives_ok(
  $$select pg_temp.add_doc('40000000-0000-0000-0000-00000000000a/ein.pdf')$$,
  'the owner can add documents again'
);
select lives_ok($$select public.submit_for_verification()$$, 'the owner resubmits');

select pg_temp.sign_in('00000000-0000-0000-0000-0000000004d1', 'aal2');
select lives_ok(
  $$select public.review_business('40000000-0000-0000-0000-00000000000a', 'approve', null)$$,
  'a moderator approves the business'
);
select throws_ok(
  $$select public.review_business('40000000-0000-0000-0000-00000000000a', 'reject', 'Changed my mind')$$,
  '55000', 'Only businesses waiting for review can be decided',
  'a decided business cannot be decided again'
);

-- ---------------------------------------------------------------------------
-- Outcome and audit trail
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-0000000004a1', 'aal2');
select ok(private.is_my_business_verified(), 'the approved business counts as verified');
select results_eq(
  $$select action::text from public.verification_events order by id$$,
  $$values ('details_updated'), ('document_added'), ('submitted'), ('needs_info'),
           ('document_added'), ('submitted'), ('approved')$$,
  'every step is recorded in order'
);
select throws_ok(
  $$delete from public.verification_events$$,
  '42501', null,
  'the audit trail cannot be deleted'
);

select * from finish();
rollback;
