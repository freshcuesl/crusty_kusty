-- Admin insights: growth, usage, moderation and finances, for staff only.
begin;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000aa1', 'owner@alpha10.test'),
  ('00000000-0000-0000-0000-000000000ab1', 'owner@bravo10.test'),
  ('00000000-0000-0000-0000-000000000ac1', 'owner@charlie10.test'),
  ('00000000-0000-0000-0000-000000000ad1', 'mod@clientshield10.test'),
  ('00000000-0000-0000-0000-000000000ae1', 'admin@clientshield10.test');
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-0000-0000-000000000ad1', 'moderator'),
  ('00000000-0000-0000-0000-000000000ae1', 'admin');

-- Insights count everything, so measure the change these fixtures make.
create temporary table baseline as select public_admin_insights_snapshot.* from (
  select
    (select count(*) from public.businesses) as businesses,
    (select count(*) from public.businesses where verification_status = 'verified') as verified,
    (select count(*) from public.customer_checks where created_at > now() - interval '30 days') as checks,
    (select count(*) from public.subscriptions where status in ('active', 'past_due')) as paying
) public_admin_insights_snapshot;

insert into public.businesses (id, name, created_by, verification_status) values
  ('a0000000-0000-0000-0000-00000000000a', 'Alpha Ten', '00000000-0000-0000-0000-000000000aa1', 'verified'),
  ('a0000000-0000-0000-0000-00000000000b', 'Bravo Ten', '00000000-0000-0000-0000-000000000ab1', 'verified'),
  ('a0000000-0000-0000-0000-00000000000c', 'Charlie Ten', '00000000-0000-0000-0000-000000000ac1', 'unverified');
insert into public.business_members (business_id, user_id, role) values
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000aa1', 'owner'),
  ('a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000ab1', 'owner'),
  ('a0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000ac1', 'owner');

-- Alpha pays for Pro monthly; Bravo pays for Team yearly.
update public.subscriptions set tier = 'pro', status = 'active', billing_interval = 'month',
  stripe_subscription_id = 'sub_alpha10'
where business_id = 'a0000000-0000-0000-0000-00000000000a';
update public.subscriptions set tier = 'team', status = 'active', billing_interval = 'year',
  stripe_subscription_id = 'sub_bravo10'
where business_id = 'a0000000-0000-0000-0000-00000000000b';

insert into public.customer_checks (business_id, user_id, provided, incident_count)
select 'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000aa1', '{phone}', 0
from generate_series(1, 3);

create function pg_temp.sign_in(uid uuid, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.sign_in(uuid, text) to authenticated;
create temporary table result (who text primary key, data jsonb);
grant all on result to authenticated;
grant select on baseline to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Who can see insights
-- ---------------------------------------------------------------------------
select pg_temp.sign_in('00000000-0000-0000-0000-000000000aa1', 'aal2');
select throws_ok(
  $$select public.admin_insights()$$,
  '42501', 'Only ClientShield staff can see insights',
  'businesses cannot see platform insights'
);
select pg_temp.sign_in('00000000-0000-0000-0000-000000000ae1', 'aal1');
select throws_ok(
  $$select public.admin_insights()$$,
  '42501', 'Two-step login required',
  'insights need two-step login'
);

select pg_temp.sign_in('00000000-0000-0000-0000-000000000ad1', 'aal2');
insert into result values ('moderator', public.admin_insights(8));
select pg_temp.sign_in('00000000-0000-0000-0000-000000000ae1', 'aal2');
insert into result values ('admin', public.admin_insights(8));

select ok(
  (select data -> 'finances' = 'null'::jsonb from result where who = 'moderator'),
  'moderators see activity but not finances'
);
select ok(
  (select jsonb_typeof(data -> 'finances') = 'object' from result where who = 'admin'),
  'admins see finances'
);

-- ---------------------------------------------------------------------------
-- Totals and weekly trends
-- ---------------------------------------------------------------------------
select is(
  (select (data #>> '{totals,businesses}')::int from result where who = 'admin'),
  (select businesses::int + 3 from baseline),
  'counts all businesses'
);
select is(
  (select (data #>> '{totals,verified_businesses}')::int from result where who = 'admin'),
  (select verified::int + 2 from baseline),
  'counts verified businesses'
);
select is(
  (select (data #>> '{totals,checks_30d}')::int from result where who = 'admin'),
  (select checks::int + 3 from baseline),
  'counts customer checks in the last 30 days'
);
select is(
  (select jsonb_array_length(data -> 'weekly') from result where who = 'admin'),
  8,
  'gives one row per week asked for'
);
select ok(
  (select (data -> 'weekly' -> -1 ->> 'signups')::int >= 3 from result where who = 'admin'),
  'this week''s sign-ups include the new businesses'
);
select ok(
  (select (data -> 'weekly' -> -1 ->> 'checks')::int >= 3 from result where who = 'admin'),
  'this week''s checks are counted'
);
select ok(
  (select data -> 'weekly' -> 0 ? 'incidents_verified' from result where who = 'admin'),
  'weeks include verified incidents'
);
select ok(
  (select data -> 'decisions' ?& array['continue_booking', 'require_authorization', 'decline_job', 'undecided']
   from result where who = 'admin'),
  'shows what businesses decided after alerts'
);
select ok(
  (select data -> 'moderation' ?& array['businesses_waiting', 'incidents_waiting', 'open_flags',
     'median_incident_review_hours', 'oldest_incident_waiting_hours']
   from result where who = 'admin'),
  'shows the moderation workload'
);

-- ---------------------------------------------------------------------------
-- Finances
-- ---------------------------------------------------------------------------
select ok(
  (select (data #>> '{finances,paying}')::int >= (select paying::int + 2 from baseline)
   from result where who = 'admin'),
  'counts paying businesses'
);
select ok(
  (select (data #>> '{finances,mrr_cents}')::int >= 2900 + 59000 / 12 from result where who = 'admin'),
  'monthly revenue counts yearly plans as a twelfth a month'
);
select is(
  (select (data #>> '{finances,arr_cents}')::bigint from result where who = 'admin'),
  (select (data #>> '{finances,mrr_cents}')::bigint * 12 from result where who = 'admin'),
  'yearly revenue is twelve months'
);
select ok(
  (select data #> '{finances,plan_mix}' ?& array['free', 'pro', 'team', 'business'] from result where who = 'admin'),
  'shows how many businesses are on each plan'
);
select ok(
  (select data -> 'finances' ?& array['trials_ending_7d', 'past_due', 'canceling', 'trial_conversion']
   from result where who = 'admin'),
  'shows trials ending, failed payments, cancellations and trial conversion'
);
select is(
  (select monthly_price_cents from public.plans where tier = 'team'),
  5900,
  'plan prices match Stripe (scripts/stripe-setup-plans.mjs)'
);

select * from finish();
rollback;
