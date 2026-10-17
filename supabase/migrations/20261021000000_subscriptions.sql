-- Plans and Stripe subscriptions.
--
-- Free: 10 checks a month, 1 user. Pro: unlimited checks (the 300-a-day fair-use
-- limit still applies), 3 users. Team: 15 users. Business: set up by hand for
-- CRM and API customers. Verification starts a 14-day Pro trial with no card.
-- Stripe is the source of truth for payments: the webhook copies each
-- subscription's state here, and the database enforces the plan's limits.

create type public.plan_tier as enum ('free', 'pro', 'team', 'business');

create table public.plans (
  tier public.plan_tier primary key,
  name text not null,
  monthly_checks integer check (monthly_checks > 0), -- null means unlimited
  max_members integer not null check (max_members > 0)
);
insert into public.plans (tier, name, monthly_checks, max_members) values
  ('free', 'Free', 10, 1),
  ('pro', 'Pro', null, 3),
  ('team', 'Team', null, 15),
  ('business', 'Business', null, 100);

create table public.subscriptions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  tier public.plan_tier not null default 'free',
  -- Stripe's subscription status, or 'none' before the first subscription.
  status text not null default 'none' check (status in (
    'none', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete',
    'incomplete_expired', 'paused'
  )),
  billing_interval text check (billing_interval in ('month', 'year')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
grant select on public.plans to authenticated;
grant select on public.subscriptions to authenticated;

create policy require_two_step_login on public.plans
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.subscriptions
  as restrictive for all to authenticated using (private.is_aal2());
create policy everyone_reads on public.plans for select to authenticated using (true);
create policy members_and_staff_read on public.subscriptions
  for select to authenticated
  using (private.my_business_role(business_id) is not null or private.is_platform_staff());

-- Every business has a billing record. The trial starts when it is first verified.
insert into public.subscriptions (business_id, trial_ends_at)
select id, case when verification_status = 'verified' then now() + interval '14 days' end
from public.businesses;

create function private.create_subscription_record() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (business_id, trial_ends_at)
  values (
    new.id,
    case when new.verification_status = 'verified' then now() + interval '14 days' end
  )
  on conflict do nothing;
  return null;
end;
$$;
create trigger create_subscription_record after insert on public.businesses
  for each row execute function private.create_subscription_record();

create function private.start_trial() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set trial_ends_at = now() + interval '14 days', updated_at = now()
  where business_id = new.id and trial_ends_at is null;
  return null;
end;
$$;
create trigger start_trial after update of verification_status on public.businesses
  for each row when (new.verification_status = 'verified')
  execute function private.start_trial();

/**
 * The plan in force: a live Stripe subscription, else the trial (also before it
 * starts, so a new business can set up its team), else Free.
 */
create function private.effective_tier(p_business_id uuid) returns public.plan_tier
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.status in ('active', 'trialing', 'past_due') then s.tier
      when s.trial_ends_at is null or s.trial_ends_at > now() then 'pro'::public.plan_tier
      else 'free'::public.plan_tier
    end
    from public.subscriptions s where s.business_id = p_business_id
  ), 'pro'::public.plan_tier);
$$;

create function private.plan_for(p_business_id uuid) returns public.plans
language sql stable security definer
set search_path = ''
as $$
  select p.* from public.plans p where p.tier = private.effective_tier(p_business_id);
$$;

-- ---------------------------------------------------------------------------
-- Plan limits, enforced where the rows are written
-- ---------------------------------------------------------------------------
create function private.enforce_monthly_checks() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_plan public.plans := private.plan_for(new.business_id);
begin
  if v_plan.monthly_checks is not null and (
    select count(*) from public.customer_checks
    where business_id = new.business_id and created_at >= date_trunc('month', now())
  ) >= v_plan.monthly_checks then
    raise exception 'You have used all % checks on the % plan this month. Upgrade in Plan and billing to keep checking.',
      v_plan.monthly_checks, v_plan.name
      using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger enforce_monthly_checks before insert on public.customer_checks
  for each row execute function private.enforce_monthly_checks();

create function private.raise_member_limit(p_plan public.plans) returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Your plan includes % %. Upgrade in Plan and billing to add more.',
    p_plan.max_members, case when p_plan.max_members = 1 then 'user' else 'users' end
    using errcode = '54000';
end;
$$;

create function private.enforce_member_limit() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_plan public.plans := private.plan_for(new.business_id);
begin
  if (select count(*) from public.business_members where business_id = new.business_id)
     >= v_plan.max_members then
    perform private.raise_member_limit(v_plan);
  end if;
  return new;
end;
$$;
create trigger enforce_member_limit before insert on public.business_members
  for each row execute function private.enforce_member_limit();

-- Pending invites hold a place, so a business can't invite past its limit.
create function private.enforce_invite_limit() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_plan public.plans := private.plan_for(new.business_id);
begin
  if (select count(*) from public.business_members where business_id = new.business_id)
     + (select count(*) from public.business_invites
        where business_id = new.business_id and accepted_at is null and expires_at > now())
     >= v_plan.max_members then
    perform private.raise_member_limit(v_plan);
  end if;
  return new;
end;
$$;
create trigger enforce_invite_limit before insert on public.business_invites
  for each row execute function private.enforce_invite_limit();

-- ---------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------
/** The caller's plan, usage and billing state for the Plan and billing page. */
create function public.my_subscription() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_role public.business_role;
  v_plan public.plans;
  v_sub public.subscriptions;
begin
  perform private.require_aal2();
  select business_id, role into v_business_id, v_role
  from public.business_members where user_id = auth.uid();
  if v_business_id is null then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  v_plan := private.plan_for(v_business_id);
  select * into v_sub from public.subscriptions where business_id = v_business_id;

  return jsonb_build_object(
    'tier', v_plan.tier,
    'plan_name', v_plan.name,
    'monthly_checks', v_plan.monthly_checks,
    'max_members', v_plan.max_members,
    'checks_used', (
      select count(*) from public.customer_checks
      where business_id = v_business_id and created_at >= date_trunc('month', now())
    ),
    'members', (select count(*) from public.business_members where business_id = v_business_id),
    'status', coalesce(v_sub.status, 'none'),
    'billing_interval', v_sub.billing_interval,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', coalesce(v_sub.cancel_at_period_end, false),
    'trial_ends_at', v_sub.trial_ends_at,
    'has_billing_account', v_sub.stripe_customer_id is not null,
    'can_manage', v_role = 'owner'
  );
end;
$$;

/** Server only (webhook): copies a Stripe subscription's state. */
create function public.record_subscription(
  p_business_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_tier public.plan_tier,
  p_status text,
  p_interval text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.subscriptions set
    tier = p_tier,
    status = p_status,
    billing_interval = p_interval,
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    stripe_subscription_id = p_subscription_id,
    current_period_end = p_period_end,
    cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
    updated_at = now()
  where business_id = p_business_id;
  if not found then
    raise exception 'Unknown business' using errcode = 'P0002';
  end if;
end;
$$;

/** Server only (checkout): remembers the Stripe customer created for a business. */
create function public.set_stripe_customer(p_business_id uuid, p_customer_id text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set stripe_customer_id = p_customer_id, updated_at = now()
  where business_id = p_business_id;
  if not found then
    raise exception 'Unknown business' using errcode = 'P0002';
  end if;
end;
$$;

/** Server only (webhook): the business a Stripe customer belongs to. */
create function public.business_for_stripe_customer(p_customer_id text) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select business_id from public.subscriptions where stripe_customer_id = p_customer_id;
$$;

grant execute on function public.my_subscription() to authenticated;
grant execute on function
  public.record_subscription(uuid, text, text, public.plan_tier, text, text, timestamptz, boolean),
  public.set_stripe_customer(uuid, text),
  public.business_for_stripe_customer(text)
to service_role;
