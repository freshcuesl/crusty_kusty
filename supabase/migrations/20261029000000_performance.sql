-- Performance: faster security rules, the indexes cleanup and insights need, and a
-- single-pass admin_insights. Behavior is unchanged; every existing test still applies.

-- ---------------------------------------------------------------------------
-- 1. Security rules that look up the caller's business once per query
-- ---------------------------------------------------------------------------
-- Each person belongs to at most one business, so "is this row in my business?" becomes
-- "business_id = my business": Postgres works the value out once and uses the index,
-- instead of calling a function for every row. Wrapping is_aal2(), is_platform_staff()
-- and auth.uid() in ( SELECT ... ) has the same effect: evaluated once, not per row.

create function private.my_business_id() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select business_id from public.business_members where user_id = auth.uid();
$$;

create function private.my_owned_business_id() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select business_id from public.business_members where user_id = auth.uid() and role = 'owner';
$$;

grant execute on function private.my_business_id(), private.my_owned_business_id() to authenticated;

alter policy require_two_step_login on public.abuse_flags
  using (( SELECT private.is_aal2()));

alter policy staff_read on public.abuse_flags
  using (( SELECT private.is_platform_staff()));

alter policy members_read_documents on public.business_documents
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy platform_staff_read_documents on public.business_documents
  using (( SELECT private.is_platform_staff()));

alter policy require_two_step_login on public.business_documents
  using (( SELECT private.is_aal2()));

alter policy owner_reads_invites on public.business_invites
  using (((business_id = ( SELECT private.my_owned_business_id()))));

alter policy owner_revokes_invites on public.business_invites
  using ((((business_id = ( SELECT private.my_owned_business_id()))) AND (accepted_at IS NULL)));

alter policy require_two_step_login on public.business_invites
  using (( SELECT private.is_aal2()));

alter policy members_read_coworkers on public.business_members
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy platform_staff_read_members on public.business_members
  using (( SELECT private.is_platform_staff()));

alter policy require_two_step_login on public.business_members
  using (( SELECT private.is_aal2()));

alter policy members_read_their_business on public.businesses
  using (((id = ( SELECT private.my_business_id()))));

alter policy owner_renames_business on public.businesses
  using (((id = ( SELECT private.my_owned_business_id()))))
  with check (((id = ( SELECT private.my_owned_business_id()))));

alter policy platform_staff_read_businesses on public.businesses
  using (( SELECT private.is_platform_staff()));

alter policy require_two_step_login on public.businesses
  using (( SELECT private.is_aal2()));

alter policy members_read on public.customer_checks
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy require_two_step_login on public.customer_checks
  using (( SELECT private.is_aal2()));

alter policy members_read on public.customer_notes
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy require_two_step_login on public.customer_notes
  using (( SELECT private.is_aal2()));

alter policy members_read on public.customers
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy require_two_step_login on public.customers
  using (( SELECT private.is_aal2()));

alter policy reporters_and_moderators_read on public.incident_customers
  using ((( SELECT private.is_platform_staff()) OR (incident_id IN ( SELECT i.id FROM public.incidents i WHERE (i.business_id = ( SELECT private.my_business_id()))))));

alter policy require_two_step_login on public.incident_customers
  using (( SELECT private.is_aal2()));

alter policy reporters_and_moderators_read on public.incident_events
  using ((( SELECT private.is_platform_staff()) OR (incident_id IN ( SELECT i.id FROM public.incidents i WHERE (i.business_id = ( SELECT private.my_business_id()))))));

alter policy require_two_step_login on public.incident_events
  using (( SELECT private.is_aal2()));

alter policy reporters_and_moderators_read on public.incident_evidence
  using ((( SELECT private.is_platform_staff()) OR (incident_id IN ( SELECT i.id FROM public.incidents i WHERE (i.business_id = ( SELECT private.my_business_id()))))));

alter policy require_two_step_login on public.incident_evidence
  using (( SELECT private.is_aal2()));

alter policy reporters_and_moderators_read on public.incidents
  using ((((business_id = ( SELECT private.my_business_id()))) OR ( SELECT private.is_platform_staff())));

alter policy require_two_step_login on public.incidents
  using (( SELECT private.is_aal2()));

alter policy members_read on public.match_alerts
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy require_two_step_login on public.match_alerts
  using (( SELECT private.is_aal2()));

alter policy members_read_identity on public.owner_identity_checks
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy platform_staff_read_identity on public.owner_identity_checks
  using (( SELECT private.is_platform_staff()));

alter policy require_two_step_login on public.owner_identity_checks
  using (( SELECT private.is_aal2()));

alter policy require_two_step_login on public.plans
  using (( SELECT private.is_aal2()));

alter policy read_own_platform_role on public.platform_roles
  using ((user_id = ( SELECT auth.uid())));

alter policy require_two_step_login on public.platform_roles
  using (( SELECT private.is_aal2()));

alter policy read_own_profile on public.profiles
  using ((user_id = ( SELECT auth.uid())));

alter policy require_two_step_login on public.profiles
  using (( SELECT private.is_aal2()));

alter policy update_own_profile on public.profiles
  using ((user_id = ( SELECT auth.uid())))
  with check ((user_id = ( SELECT auth.uid())));

alter policy require_two_step_login on public.retention_rules
  using (( SELECT private.is_aal2()));

alter policy staff_read on public.retention_rules
  using (( SELECT private.is_platform_staff()));

alter policy members_and_staff_read on public.subscriptions
  using ((((business_id = ( SELECT private.my_business_id()))) OR ( SELECT private.is_platform_staff())));

alter policy require_two_step_login on public.subscriptions
  using (( SELECT private.is_aal2()));

alter policy members_read_events on public.verification_events
  using (((business_id = ( SELECT private.my_business_id()))));

alter policy platform_staff_read_events on public.verification_events
  using (( SELECT private.is_platform_staff()));

alter policy require_two_step_login on public.verification_events
  using (( SELECT private.is_aal2()));

alter policy members_and_moderators_read_business_documents on storage.objects
  using (((bucket_id = 'business-documents'::text) AND ( SELECT private.is_aal2()) AND (((private.try_uuid((storage.foldername(name))[1]) = ( SELECT private.my_business_id()))) OR ( SELECT private.is_platform_staff()))));

alter policy members_and_moderators_read_incident_evidence on storage.objects
  using (((bucket_id = 'incident-evidence'::text) AND ( SELECT private.is_aal2()) AND (((private.try_uuid((storage.foldername(name))[1]) = ( SELECT private.my_business_id()))) OR ( SELECT private.is_platform_staff()))));

alter policy owners_delete_unrecorded_business_documents on storage.objects
  using (((bucket_id = 'business-documents'::text) AND ( SELECT private.is_aal2()) AND ((private.try_uuid((storage.foldername(name))[1]) = ( SELECT private.my_owned_business_id()))) AND private.business_is_editable(private.try_uuid((storage.foldername(name))[1])) AND (NOT (EXISTS ( SELECT 1
   FROM business_documents d
  WHERE (d.storage_path = objects.name))))));

alter policy owners_upload_business_documents on storage.objects
  with check (((bucket_id = 'business-documents'::text) AND ( SELECT private.is_aal2()) AND ((private.try_uuid((storage.foldername(name))[1]) = ( SELECT private.my_owned_business_id()))) AND private.business_is_editable(private.try_uuid((storage.foldername(name))[1]))));

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
-- Foreign keys that cleanup and deletes follow (each would otherwise scan the whole table).
create index customer_checks_customer on public.customer_checks (customer_id) where customer_id is not null;
create index match_alerts_check on public.match_alerts (check_id);
create index match_alerts_customer on public.match_alerts (customer_id) where customer_id is not null;
create index match_alert_incidents_incident on public.match_alert_incidents (incident_id);
create index customer_notes_business on public.customer_notes (business_id);
create index miles_usage_business on public.miles_usage (business_id) where business_id is not null;
-- Identity session limits count a person's recent attempts.
create index owner_identity_checks_user on public.owner_identity_checks (user_id, created_at desc);
-- Platform-wide date ranges for insights and the nightly cleanup.
create index businesses_created on public.businesses (created_at);
create index customer_checks_created on public.customer_checks (created_at);
create index match_alerts_created on public.match_alerts (created_at);
create index incident_events_action_created on public.incident_events (action, created_at);
create index verification_events_action_created on public.verification_events (action, created_at);
create index incidents_expiry on public.incidents (expires_at) where status = 'evidence_verified';

-- ---------------------------------------------------------------------------
-- 3. admin_insights in one pass per table
-- ---------------------------------------------------------------------------
create or replace function public.admin_insights(p_weeks integer default 12) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_weeks integer := least(greatest(coalesce(p_weeks, 12), 1), 52);
  v_is_admin boolean;
  v_weekly jsonb;
  v_finances jsonb := null;
  v_since timestamptz;
begin
  perform private.require_aal2();
  if not private.is_platform_staff() then
    raise exception 'Only ClientShield staff can see insights' using errcode = '42501';
  end if;
  v_is_admin := exists (
    select 1 from public.platform_roles where user_id = auth.uid() and role = 'admin'
  );

  -- One grouped pass per table over the chosen range (not one scan per week).
  v_since := date_trunc('week', now()) - make_interval(weeks => v_weeks - 1);
  with weeks as (
    select generate_series(v_since, date_trunc('week', now()), interval '1 week') as start
  ),
  signups as (
    select date_trunc('week', created_at) as start, count(*) as n
    from public.businesses where created_at >= v_since group by 1
  ),
  verified as (
    select date_trunc('week', created_at) as start, count(*) as n
    from public.verification_events where action = 'approved' and created_at >= v_since group by 1
  ),
  checks as (
    select date_trunc('week', created_at) as start, count(*) as n
    from public.customer_checks where created_at >= v_since group by 1
  ),
  alerts as (
    select date_trunc('week', created_at) as start, count(*) as n
    from public.match_alerts where created_at >= v_since group by 1
  ),
  incident_weeks as (
    select date_trunc('week', created_at) as start,
           count(*) filter (where action = 'submitted') as submitted,
           count(*) filter (where action = 'evidence_verified') as verified
    from public.incident_events
    where action in ('submitted', 'evidence_verified') and created_at >= v_since
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'week', to_char(w.start, 'YYYY-MM-DD'),
    'signups', coalesce(s.n, 0),
    'verified', coalesce(v.n, 0),
    'checks', coalesce(c.n, 0),
    'alerts', coalesce(a.n, 0),
    'incidents_submitted', coalesce(i.submitted, 0),
    'incidents_verified', coalesce(i.verified, 0)
  ) order by w.start)
  into v_weekly
  from weeks w
  left join signups s using (start)
  left join verified v using (start)
  left join checks c using (start)
  left join alerts a using (start)
  left join incident_weeks i using (start);

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
      -- Same rule as private.effective_tier(), worked out in one join (a test keeps them equal).
      'plan_mix', (
        select jsonb_object_agg(t.tier, coalesce(m.n, 0))
        from unnest(enum_range(null::public.plan_tier)) as t(tier)
        left join (
          select case
                   when x.status in ('active', 'trialing', 'past_due') then x.tier
                   when x.trial_ends_at is null or x.trial_ends_at > now() then 'pro'::public.plan_tier
                   else 'free'::public.plan_tier
                 end as tier,
                 count(*) as n
          from public.businesses b
          left join public.subscriptions x on x.business_id = b.id
          group by 1
        ) m on m.tier = t.tier
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

-- ---------------------------------------------------------------------------
-- 4. Customer checks: unlock the matching key once and fingerprint once
-- ---------------------------------------------------------------------------
-- Before: each detail read the key from Vault, and run_check fingerprinted twice
-- (up to 8 Vault reads per check). Now: one Vault read and one set of fingerprints.
create or replace function private.customer_hashes(p_customer jsonb)
returns table (kind public.identifier_kind, hash bytea)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_value text;
  -- Unlock the matching key once per customer, not once per detail.
  v_pepper text := (select decrypted_secret from vault.decrypted_secrets where name = 'identifier_pepper');
begin
  foreach v_kind in array array['name', 'phone', 'email', 'address'] loop
    v_value := private.normalize_identifier(
      v_kind,
      case v_kind
        when 'name' then p_customer ->> 'full_name'
        when 'phone' then p_customer ->> 'phone'
        when 'email' then p_customer ->> 'email'
        when 'address' then
          case when nullif(btrim(coalesce(p_customer ->> 'address_line1', '')), '') is not null
            then (p_customer ->> 'address_line1') || ' ' || left(coalesce(p_customer ->> 'postal_code', ''), 5)
          end
      end
    );
    if v_value is not null then
      kind := v_kind::public.identifier_kind;
      -- Same as private.identifier_hash() (a test keeps them equal), with the key read once.
      hash := extensions.hmac(v_kind || ':' || v_value, v_pepper, 'sha256');
      return next;
    end if;
  end loop;
end;
$$;

create or replace function private.run_check(
  p_business_id uuid,
  p_customer jsonb,
  p_customer_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_provided public.identifier_kind[];
  v_hashes bytea[];
  v_matches uuid[];
  v_check_id uuid;
  v_alert_id uuid;
begin
  -- Fingerprint the details once and reuse them below.
  select coalesce(array_agg(h.kind), '{}'), coalesce(array_agg(h.hash), '{}')
  into v_provided, v_hashes
  from private.customer_hashes(p_customer) h;
  if not (v_provided && array['phone', 'email', 'address']::public.identifier_kind[]) then
    raise exception 'Enter at least a phone, email or address' using errcode = '22023';
  end if;

  if (
    select count(*) from public.customer_checks
    where business_id = p_business_id and created_at > now() - interval '1 day'
  ) >= 300 then
    raise exception 'Daily check limit reached. Contact support if you need more.'
      using errcode = '54000';
  end if;

  -- At least two details must agree; one detail alone never alerts.
  select coalesce(array_agg(m.incident_id), '{}') into v_matches
  from (
    select ii.incident_id
    from public.incident_identifiers ii
    join unnest(v_provided, v_hashes) as h(kind, hash) on h.kind = ii.kind and h.hash = ii.hash
    join public.incidents i on i.id = ii.incident_id
    where i.status = 'evidence_verified' and i.expires_at > now()
    group by ii.incident_id
    having count(*) >= 2
  ) m;

  insert into public.customer_checks (business_id, user_id, customer_id, provided, incident_count)
  values (p_business_id, auth.uid(), p_customer_id, v_provided, cardinality(v_matches))
  returning id into v_check_id;

  if cardinality(v_matches) > 0 then
    insert into public.match_alerts (business_id, check_id, customer_id, customer_label, incident_count)
    values (
      p_business_id, v_check_id, p_customer_id,
      coalesce(nullif(left(btrim(coalesce(p_customer ->> 'full_name', '')), 120), ''), 'Customer check'),
      cardinality(v_matches)
    )
    returning id into v_alert_id;

    insert into public.match_alert_incidents (alert_id, incident_id)
    select v_alert_id, unnest(v_matches);
  end if;

  return jsonb_build_object(
    'check_id', v_check_id,
    'alert_id', v_alert_id,
    'incident_count', cardinality(v_matches),
    'incidents', private.incident_facts(v_matches)
  );
end;
$$;
