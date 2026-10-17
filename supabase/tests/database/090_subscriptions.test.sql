-- Plans, the 14-day trial, Stripe subscription records and plan limits.
begin;
select plan(31);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'owner@alpha9.test'),
  ('00000000-0000-0000-0000-0000000009a2', 'staff@alpha9.test'),
  ('00000000-0000-0000-0000-0000000009b1', 'owner@bravo9.test'),
  ('00000000-0000-0000-0000-0000000009b2', 'second@bravo9.test');

-- ---------------------------------------------------------------------------
-- Trial
-- ---------------------------------------------------------------------------
insert into public.businesses (id, name, created_by) values
  ('90000000-0000-0000-0000-00000000000a', 'Alpha Nine', '00000000-0000-0000-0000-0000000009a1'),
  ('90000000-0000-0000-0000-00000000000b', 'Bravo Nine', '00000000-0000-0000-0000-0000000009b1');
insert into public.business_members (business_id, user_id, role) values
  ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', 'owner'),
  ('90000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000009b1', 'owner');

select is(
  (select row(tier, status, trial_ends_at)::text from public.subscriptions
   where business_id = '90000000-0000-0000-0000-00000000000a'),
  row('free'::public.plan_tier, 'none', null::timestamptz)::text,
  'a new business gets a billing record; the trial has not started yet'
);
select is(
  private.effective_tier('90000000-0000-0000-0000-00000000000a'),
  'pro',
  'before verification a business has trial limits, so it can set up its team'
);

update public.businesses set verification_status = 'verified'
where id in ('90000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000b');
select ok(
  (select trial_ends_at between now() + interval '14 days' - interval '1 minute'
                            and now() + interval '14 days'
   from public.subscriptions where business_id = '90000000-0000-0000-0000-00000000000a'),
  'verification starts a 14-day Pro trial'
);
select is(
  private.effective_tier('90000000-0000-0000-0000-00000000000a'),
  'pro',
  'during the trial the business has Pro'
);

update public.subscriptions set trial_ends_at = now() - interval '1 day'
where business_id = '90000000-0000-0000-0000-00000000000a';
select is(
  private.effective_tier('90000000-0000-0000-0000-00000000000a'),
  'free',
  'after the trial, a business without a subscription is on Free'
);
update public.businesses set verification_status = 'pending'
where id = '90000000-0000-0000-0000-00000000000a';
update public.businesses set verification_status = 'verified'
where id = '90000000-0000-0000-0000-00000000000a';
select ok(
  (select trial_ends_at < now() from public.subscriptions
   where business_id = '90000000-0000-0000-0000-00000000000a'),
  're-verification never restarts the trial'
);

-- ---------------------------------------------------------------------------
-- Free plan limits
-- ---------------------------------------------------------------------------
insert into public.customer_checks (business_id, user_id, provided, incident_count, created_at)
select '90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', '{phone}', 0,
       date_trunc('month', now()) - interval '1 day'
from generate_series(1, 12);
select lives_ok(
  $$insert into public.customer_checks (business_id, user_id, provided, incident_count)
    select '90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', '{phone}', 0
    from generate_series(1, 10)$$,
  'Free includes 10 checks a month; last month''s checks don''t count'
);
select throws_ok(
  $$insert into public.customer_checks (business_id, user_id, provided, incident_count)
    values ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', '{phone}', 0)$$,
  '54000',
  'You have used all 10 checks on the Free plan this month. Upgrade in Plan and billing to keep checking.',
  'the 11th check of the month is refused on Free'
);
select throws_ok(
  $$insert into public.business_members (business_id, user_id, role)
    values ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a2', 'staff')$$,
  '54000', 'Your plan includes 1 user. Upgrade in Plan and billing to add more.',
  'Free has one user'
);
select throws_ok(
  $$insert into public.business_invites (business_id, email, token_hash, invited_by)
    values ('90000000-0000-0000-0000-00000000000a', 'new@alpha9.test', '\x01',
            '00000000-0000-0000-0000-0000000009a1')$$,
  '54000', 'Your plan includes 1 user. Upgrade in Plan and billing to add more.',
  'Free cannot invite staff'
);

-- ---------------------------------------------------------------------------
-- Pro trial limits: three users, counting pending invites
-- ---------------------------------------------------------------------------
insert into public.business_invites (business_id, email, token_hash, invited_by) values
  ('90000000-0000-0000-0000-00000000000b', 'one@bravo9.test', '\x02', '00000000-0000-0000-0000-0000000009b1');
insert into public.business_members (business_id, user_id, role) values
  ('90000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000009b2', 'staff');
select throws_ok(
  $$insert into public.business_invites (business_id, email, token_hash, invited_by)
    values ('90000000-0000-0000-0000-00000000000b', 'two@bravo9.test', '\x03',
            '00000000-0000-0000-0000-0000000009b1')$$,
  '54000', 'Your plan includes 3 users. Upgrade in Plan and billing to add more.',
  'pending invites count toward the user limit'
);
update public.business_invites set expires_at = now() - interval '1 minute'
where email = 'one@bravo9.test';
select lives_ok(
  $$insert into public.business_invites (business_id, email, token_hash, invited_by)
    values ('90000000-0000-0000-0000-00000000000b', 'two@bravo9.test', '',
            '00000000-0000-0000-0000-0000000009b1')$$,
  'expired invites free up their place'
);

-- ---------------------------------------------------------------------------
-- Stripe subscription records (server only)
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated',
    'public.record_subscription(uuid, text, text, public.plan_tier, text, text, timestamptz, boolean)',
    'execute')
  and has_function_privilege('service_role',
    'public.record_subscription(uuid, text, text, public.plan_tier, text, text, timestamptz, boolean)',
    'execute'),
  'only the server records subscriptions'
);

set local role service_role;
select lives_ok(
  $$select public.record_subscription('90000000-0000-0000-0000-00000000000a', 'cus_A', 'sub_A',
      'team', 'active', 'year', now() + interval '1 year', false)$$,
  'the webhook records a paid subscription'
);
select is(
  public.business_for_stripe_customer('cus_A'),
  '90000000-0000-0000-0000-00000000000a'::uuid,
  'businesses can be found by their Stripe customer'
);
select throws_ok(
  $$select public.record_subscription('90000000-0000-0000-0000-0000000000ff', 'cus_X', 'sub_X',
      'pro', 'active', 'month', now(), false)$$,
  'P0002', 'Unknown business',
  'subscriptions for unknown businesses are refused'
);
select lives_ok(
  $$select public.set_stripe_customer('90000000-0000-0000-0000-00000000000b', 'cus_B')$$,
  'the checkout function remembers a business''s Stripe customer'
);
reset role;

select is(
  private.effective_tier('90000000-0000-0000-0000-00000000000a'),
  'team',
  'an active subscription sets the plan'
);
select lives_ok(
  $$insert into public.business_members (business_id, user_id, role)
    values ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a2', 'staff')$$,
  'paid plans allow more users'
);
select lives_ok(
  $$insert into public.customer_checks (business_id, user_id, provided, incident_count)
    values ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000009a1', '{phone}', 0)$$,
  'paid plans have unlimited monthly checks'
);

set local role service_role;
select public.record_subscription('90000000-0000-0000-0000-00000000000a', 'cus_A', 'sub_A',
  'team', 'past_due', 'year', now() + interval '1 year', false);
reset role;
select is(
  private.effective_tier('90000000-0000-0000-0000-00000000000a'),
  'team',
  'a failed payment keeps the plan while Stripe retries'
);

set local role service_role;
select public.record_subscription('90000000-0000-0000-0000-00000000000a', 'cus_A', 'sub_A',
  'team', 'canceled', 'year', now(), false);
reset role;
select is(
  private.effective_tier('90000000-0000-0000-0000-00000000000a'),
  'free',
  'a canceled subscription drops to Free'
);
select is(
  (select stripe_customer_id from public.subscriptions
   where business_id = '90000000-0000-0000-0000-00000000000a'),
  'cus_A',
  'the Stripe customer is kept so they can subscribe again'
);

-- ---------------------------------------------------------------------------
-- What members see
-- ---------------------------------------------------------------------------
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

select pg_temp.sign_in('00000000-0000-0000-0000-0000000009a2', 'aal2');
select is(
  public.my_subscription() ->> 'tier',
  'free',
  'staff can see their business''s plan'
);
select is(
  (public.my_subscription() ->> 'checks_used')::int,
  11,
  'it counts this month''s checks'
);
select is(
  (public.my_subscription() ->> 'monthly_checks')::int,
  10,
  'and the plan''s monthly limit'
);
select is(
  (public.my_subscription() ->> 'members')::int,
  2,
  'and how many users the business has'
);
select is(
  (select count(*)::int from public.plans),
  4,
  'everyone signed in can read the plans'
);
select is(
  (select count(*)::int from public.subscriptions),
  1,
  'members see only their own billing record'
);

select pg_temp.sign_in('00000000-0000-0000-0000-0000000009a2', 'aal1');
select throws_ok(
  $$select public.my_subscription()$$,
  '42501', 'Two-step login required',
  'billing needs two-step login'
);
select is(
  (select count(*)::int from public.subscriptions),
  0,
  'billing records need two-step login to read'
);

select * from finish();
rollback;
