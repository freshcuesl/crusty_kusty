-- Owner identity checks through Stripe Identity.
--
-- Stripe hosts the ID photo and selfie capture. We keep only the session id, the
-- outcome and Stripe's error code: never ID images, numbers or birth dates.
-- Rows are written only by server code (Edge Functions using the service role).

create type public.identity_status as enum ('requires_input', 'processing', 'verified', 'canceled');

create table public.owner_identity_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_session_id text not null unique check (stripe_session_id ~ '^vs_[A-Za-z0-9_]+$'),
  status public.identity_status not null default 'requires_input',
  last_error_code text check (char_length(last_error_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index owner_identity_checks_business on public.owner_identity_checks (business_id, user_id);

alter table public.owner_identity_checks enable row level security;
grant select on public.owner_identity_checks to authenticated;

create policy require_two_step_login on public.owner_identity_checks
  as restrictive for all to authenticated using (private.is_aal2());
create policy members_read_identity on public.owner_identity_checks
  for select to authenticated using (private.my_business_role(business_id) is not null);
create policy platform_staff_read_identity on public.owner_identity_checks
  for select to authenticated using (private.is_platform_staff());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
/** True when the business's current owner has a verified identity check. */
create function private.owner_identity_verified(p_business_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_identity_checks c
    join public.business_members m
      on m.business_id = c.business_id and m.user_id = c.user_id and m.role = 'owner'
    where c.business_id = p_business_id and c.status = 'verified'
  );
$$;

/** The caller's identity status: verified if any check passed, else the latest attempt. */
create function public.my_identity_status() returns public.identity_status
language sql stable security definer
set search_path = ''
as $$
  select case
    when bool_or(status = 'verified') then 'verified'::public.identity_status
    else (array_agg(status order by updated_at desc))[1]
  end
  from public.owner_identity_checks
  where user_id = auth.uid() and private.is_aal2();
$$;

/** Server-only: records Stripe's outcome for a session (called by the webhook). */
create function public.record_identity_result(
  p_stripe_session_id text,
  p_status public.identity_status,
  p_error_code text
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.owner_identity_checks
  set status = p_status,
      last_error_code = left(p_error_code, 100),
      updated_at = now()
  where stripe_session_id = p_stripe_session_id
    -- A verified result is final; late or replayed events can't undo it.
    and status <> 'verified';

  if not found and not exists (
    select 1 from public.owner_identity_checks where stripe_session_id = p_stripe_session_id
  ) then
    raise exception 'Unknown identity session' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function private.owner_identity_verified(uuid) to authenticated;
grant execute on function public.my_identity_status() to authenticated;
grant execute on function public.record_identity_result(text, public.identity_status, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Submission and approval now require a verified owner
-- ---------------------------------------------------------------------------
create or replace function public.submit_for_verification() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_owner();
  v_business public.businesses;
begin
  perform private.require_editable(v_business_id);
  select * into v_business from public.businesses where id = v_business_id;

  -- Same order as the screen: details, documents, identity.
  if v_business.phone is null or v_business.address_line1 is null or v_business.city is null
     or v_business.state is null or v_business.postal_code is null then
    raise exception 'Add your business phone and address first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.business_documents where business_id = v_business_id) then
    raise exception 'Add at least one document' using errcode = '22023';
  end if;
  if not private.owner_identity_verified(v_business_id) then
    raise exception 'Verify your identity first' using errcode = '22023';
  end if;

  update public.businesses
  set verification_status = 'pending', submitted_at = now()
  where id = v_business_id;

  insert into public.verification_events (business_id, actor, action)
  values (v_business_id, auth.uid(), 'submitted');
end;
$$;

create or replace function public.review_business(
  p_business_id uuid,
  p_decision text,
  p_note text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_status public.verification_status;
begin
  perform private.require_aal2();
  if not private.is_platform_staff() then
    raise exception 'Only moderators can review businesses' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject', 'needs_info') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
  if p_decision <> 'approve' and v_note is null then
    raise exception 'Add a note explaining the decision' using errcode = '22023';
  end if;

  select verification_status into v_status
  from public.businesses where id = p_business_id for update;
  if v_status is distinct from 'pending' then
    raise exception 'Only businesses waiting for review can be decided' using errcode = '55000';
  end if;
  if p_decision = 'approve' and not private.owner_identity_verified(p_business_id) then
    raise exception 'The owner''s identity is not verified' using errcode = '55000';
  end if;

  update public.businesses
  set verification_status = case p_decision
        when 'approve' then 'verified'::public.verification_status
        when 'reject' then 'rejected'::public.verification_status
        else 'needs_info'::public.verification_status
      end,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_note = v_note
  where id = p_business_id;

  insert into public.verification_events (business_id, actor, action, note)
  values (
    p_business_id,
    auth.uid(),
    case p_decision
      when 'approve' then 'approved'::public.verification_action
      when 'reject' then 'rejected'::public.verification_action
      else 'needs_info'::public.verification_action
    end,
    v_note
  );
end;
$$;
