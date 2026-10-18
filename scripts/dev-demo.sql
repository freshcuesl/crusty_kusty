-- LOCAL DEVELOPMENT ONLY. Run by `npm run dev:demo -- you@example.com`.
-- 1. Makes that person's business fully verified (details, approval, owner ID check).
-- 2. Adds sample data: a separate "Demo Reporter Co" business with one verified
--    incident about a made-up customer, Jordan Demo, so a customer check shows an alert.
-- Safe to run again. The email arrives as the psql variable :email (never pasted into SQL).
\set ON_ERROR_STOP on
begin;

create temporary table demo_target on commit drop as
select u.id as user_id, m.business_id
from auth.users u
join public.business_members m on m.user_id = u.id and m.role = 'owner'
where lower(u.email) = lower(:'email');

do $$
begin
  if not exists (select 1 from demo_target) then
    raise exception 'NO_BUSINESS';
  end if;
end;
$$;

-- 1. The person's own business: details filled in and approved.
update public.businesses b set
  phone = coalesce(b.phone, '+12065550100'),
  address_line1 = coalesce(b.address_line1, '100 Demo Way'),
  city = coalesce(b.city, 'Seattle'),
  state = coalesce(b.state, 'WA'),
  postal_code = coalesce(b.postal_code, '98101'),
  submitted_at = coalesce(b.submitted_at, now()),
  reviewed_at = now(),
  verification_status = 'verified'
from demo_target t
where b.id = t.business_id and b.verification_status <> 'verified';

insert into public.verification_events (business_id, action, note)
select business_id, 'approved', 'Demo setup (local only)' from demo_target t
where not exists (
  select 1 from public.verification_events e
  where e.business_id = t.business_id and e.action = 'approved'
);

insert into public.owner_identity_checks (business_id, user_id, stripe_session_id, status)
select business_id, user_id, 'vs_localdev_demo_' || substr(md5(random()::text), 1, 12), 'verified'
from demo_target t
where not exists (
  select 1 from public.owner_identity_checks c
  where c.user_id = t.user_id and c.status = 'verified'
);

-- 2. Sample data: another business that reported a verified incident.
-- The reporter account has no password, so nobody can sign in as it.
insert into auth.users (id, email)
values ('d0000000-0000-4000-8000-000000000001', 'demo-reporter@clientshield.test')
on conflict (id) do nothing;

insert into public.businesses (id, name, created_by, verification_status)
values ('d0000000-0000-4000-8000-0000000000b1', 'Demo Reporter Co (sample data)',
        'd0000000-0000-4000-8000-000000000001', 'verified')
on conflict (id) do nothing;

insert into public.business_members (business_id, user_id, role)
values ('d0000000-0000-4000-8000-0000000000b1', 'd0000000-0000-4000-8000-000000000001', 'owner')
on conflict do nothing;

insert into public.incidents
  (id, business_id, created_by, status, category, service_date, service_type, description,
   review_rating, review_text, expires_at, submitted_at, reviewed_at)
values
  ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000b1',
   'd0000000-0000-4000-8000-000000000001', 'evidence_verified', 'chargeback',
   current_date - 60, 'Carpet cleaning',
   'Customer signed the completed work order and paid, then filed a chargeback saying the work was never done. Before and after photos and the signed order were provided.',
   1, 'Never showed up!', now() + interval '5 years', now() - interval '50 days',
   now() - interval '49 days')
on conflict (id) do nothing;

insert into public.incident_customers
  (incident_id, full_name, phone, email, address_line1, city, state, postal_code)
values
  ('d0000000-0000-4000-8000-0000000000a1', 'Jordan Demo', '+12065550142',
   'jordan.demo@example.com', '42 Sample Street', 'Seattle', 'WA', '98101')
on conflict (incident_id) do nothing;

insert into storage.objects (bucket_id, name)
select 'incident-evidence', p
from unnest(array[
  'd0000000-0000-4000-8000-0000000000b1/d0000000-0000-4000-8000-0000000000a1/signed-order.pdf',
  'd0000000-0000-4000-8000-0000000000b1/d0000000-0000-4000-8000-0000000000a1/after-photo.jpg'
]) p
where not exists (select 1 from storage.objects o where o.bucket_id = 'incident-evidence' and o.name = p);

insert into public.incident_evidence
  (incident_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by)
values
  ('d0000000-0000-4000-8000-0000000000a1', 'work_authorization',
   'd0000000-0000-4000-8000-0000000000b1/d0000000-0000-4000-8000-0000000000a1/signed-order.pdf',
   'signed-order.pdf', 'application/pdf', 1024, repeat('a1', 32),
   'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-0000000000a1', 'before_after_photo',
   'd0000000-0000-4000-8000-0000000000b1/d0000000-0000-4000-8000-0000000000a1/after-photo.jpg',
   'after-photo.jpg', 'image/jpeg', 2048, repeat('b2', 32),
   'd0000000-0000-4000-8000-000000000001')
on conflict (storage_path) do nothing;

select private.store_identifiers('d0000000-0000-4000-8000-0000000000a1');

insert into public.incident_events (incident_id, action, note)
select 'd0000000-0000-4000-8000-0000000000a1', a, null
from unnest(array['created', 'submitted', 'evidence_verified']::public.incident_action[]) a
where not exists (
  select 1 from public.incident_events e
  where e.incident_id = 'd0000000-0000-4000-8000-0000000000a1'
);

commit;
