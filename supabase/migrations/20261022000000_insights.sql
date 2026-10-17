-- Admin insights: growth, usage, moderation and (admins only) finances.
-- Everything is counted inside the database; no personal details leave it.

-- Prices in cents, for revenue figures. Stripe charges the real amounts; keep these
-- in step with scripts/stripe-setup-plans.mjs.
alter table public.plans
  add column monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  add column yearly_price_cents integer not null default 0 check (yearly_price_cents >= 0);
update public.plans set monthly_price_cents = 2900, yearly_price_cents = 29000 where tier = 'pro';
update public.plans set monthly_price_cents = 5900, yearly_price_cents = 59000 where tier = 'team';

create function public.admin_insights(p_weeks integer default 12) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_weeks integer := least(greatest(coalesce(p_weeks, 12), 1), 52);
  v_is_admin boolean;
  v_weekly jsonb;
  v_finances jsonb := null;
begin
  perform private.require_aal2();
  if not private.is_platform_staff() then
    raise exception 'Only ClientShield staff can see insights' using errcode = '42501';
  end if;
  v_is_admin := exists (
    select 1 from public.platform_roles where user_id = auth.uid() and role = 'admin'
  );

  select jsonb_agg(jsonb_build_object(
    'week', to_char(w.start, 'YYYY-MM-DD'),
    'signups', (select count(*) from public.businesses b
                where b.created_at >= w.start and b.created_at < w.start + interval '1 week'),
    'verified', (select count(*) from public.verification_events e
                 where e.action = 'approved'
                   and e.created_at >= w.start and e.created_at < w.start + interval '1 week'),
    'checks', (select count(*) from public.customer_checks c
               where c.created_at >= w.start and c.created_at < w.start + interval '1 week'),
    'alerts', (select count(*) from public.match_alerts a
               where a.created_at >= w.start and a.created_at < w.start + interval '1 week'),
    'incidents_submitted', (select count(*) from public.incident_events e
                            where e.action = 'submitted'
                              and e.created_at >= w.start and e.created_at < w.start + interval '1 week'),
    'incidents_verified', (select count(*) from public.incident_events e
                           where e.action = 'evidence_verified'
                             and e.created_at >= w.start and e.created_at < w.start + interval '1 week')
  ) order by w.start)
  into v_weekly
  from generate_series(
    date_trunc('week', now()) - make_interval(weeks => v_weeks - 1),
    date_trunc('week', now()),
    interval '1 week'
  ) as w(start);

  if v_is_admin then
    select jsonb_build_object(
      'paying', count(*) filter (where s.status in ('active', 'past_due')),
      'mrr_cents', coalesce(sum(
        case when s.billing_interval = 'year' then p.yearly_price_cents / 12 else p.monthly_price_cents end
      ) filter (where s.status in ('active', 'past_due')), 0),
      'arr_cents', coalesce(sum(
        case when s.billing_interval = 'year' then p.yearly_price_cents / 12 else p.monthly_price_cents end
      ) filter (where s.status in ('active', 'past_due')), 0) * 12,
      'stripe_trialing', count(*) filter (where s.status = 'trialing'),
      'trials_ending_7d', count(*) filter (
        where s.status not in ('active', 'trialing', 'past_due')
          and s.trial_ends_at between now() and now() + interval '7 days'
      ),
      'past_due', count(*) filter (where s.status = 'past_due'),
      'canceling', count(*) filter (
        where s.cancel_at_period_end and s.status in ('active', 'trialing', 'past_due')
      ),
      'trial_conversion', jsonb_build_object(
        'ended', count(*) filter (where s.trial_ends_at < now()),
        'converted', count(*) filter (where s.trial_ends_at < now() and s.stripe_subscription_id is not null)
      ),
      'plan_mix', (
        select jsonb_object_agg(t.tier, (
          select count(*) from public.businesses b where private.effective_tier(b.id) = t.tier
        ))
        from unnest(enum_range(null::public.plan_tier)) as t(tier)
      )
    )
    into v_finances
    from public.subscriptions s
    left join public.plans p on p.tier = s.tier;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'businesses', (select count(*) from public.businesses),
      'verified_businesses', (select count(*) from public.businesses where verification_status = 'verified'),
      'users', (select count(*) from public.business_members),
      'active_incidents', (
        select count(*) from public.incidents where status = 'evidence_verified' and expires_at > now()
      ),
      'checks_30d', (
        select count(*) from public.customer_checks where created_at > now() - interval '30 days'
      ),
      'alerts_30d', (
        select count(*) from public.match_alerts where created_at > now() - interval '30 days'
      )
    ),
    'weekly', coalesce(v_weekly, '[]'::jsonb),
    'decisions', (
      select jsonb_build_object(
        'continue_booking', count(*) filter (where decision = 'continue_booking'),
        'require_authorization', count(*) filter (where decision = 'require_authorization'),
        'decline_job', count(*) filter (where decision = 'decline_job'),
        'undecided', count(*) filter (where decision is null)
      )
      from public.match_alerts where created_at > now() - interval '90 days'
    ),
    'moderation', jsonb_build_object(
      'businesses_waiting', (select count(*) from public.businesses where verification_status = 'pending'),
      'incidents_waiting', (select count(*) from public.incidents where status = 'submitted'),
      'open_flags', (select count(*) from public.abuse_flags where resolved_at is null),
      'median_incident_review_hours', (
        select round((percentile_cont(0.5) within group (
          order by extract(epoch from reviewed_at - submitted_at) / 3600
        ))::numeric, 1)
        from public.incidents
        where reviewed_at > now() - interval '30 days' and submitted_at is not null
      ),
      'oldest_incident_waiting_hours', (
        select round((max(extract(epoch from now() - submitted_at)) / 3600)::numeric, 1)
        from public.incidents where status = 'submitted'
      )
    ),
    'finances', v_finances
  );
end;
$$;

grant execute on function public.admin_insights(integer) to authenticated;
