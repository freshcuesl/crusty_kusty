-- Blind customer matching.
--
-- A verified business checks a customer it already has (a new booking or an
-- existing customer). The database fingerprints what was entered, compares with
-- fingerprints of verified, unexpired incidents, and alerts only when at least
-- two details agree. Results reveal facts (dispute type, month, evidence count,
-- review rating) and never the customer, the reporting business or the incident.
-- There is no way to browse or search people.

create type public.alert_decision as enum ('continue_booking', 'require_authorization', 'decline_job');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
/** The business's own customer records (its private workspace). */
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (phone ~ '^\+1[2-9][0-9]{9}$'),
  email text check (char_length(email) <= 254),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text check (char_length(city) <= 100),
  state text check (state ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  created_at timestamptz not null default now()
);
create index customers_business on public.customers (business_id, created_at desc);

/** Audit log of every check, for abuse detection. Stores no customer details. */
create table public.customer_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  customer_id uuid references public.customers (id) on delete set null,
  provided public.identifier_kind[] not null,
  incident_count integer not null,
  created_at timestamptz not null default now()
);
create index customer_checks_business on public.customer_checks (business_id, created_at desc);

create table public.match_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  check_id uuid not null references public.customer_checks (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  -- The name the business itself typed, shown only back to that business.
  customer_label text not null check (char_length(customer_label) <= 120),
  incident_count integer not null check (incident_count > 0),
  decision public.alert_decision,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index match_alerts_business on public.match_alerts (business_id, created_at desc);

/** Which incidents an alert matched. Never exposed: it would reveal incident ids. */
create table public.match_alert_incidents (
  alert_id uuid not null references public.match_alerts (id) on delete cascade,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  primary key (alert_id, incident_id)
);

alter table public.customers enable row level security;
alter table public.customer_checks enable row level security;
alter table public.match_alerts enable row level security;
alter table public.match_alert_incidents enable row level security;

grant select on public.customers to authenticated;
grant select on public.customer_checks to authenticated;
grant select on public.match_alerts to authenticated;

create policy require_two_step_login on public.customers
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.customer_checks
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.match_alerts
  as restrictive for all to authenticated using (private.is_aal2());

create policy members_read on public.customers
  for select to authenticated using (private.my_business_role(business_id) is not null);
create policy members_read on public.customer_checks
  for select to authenticated using (private.my_business_role(business_id) is not null);
create policy members_read on public.match_alerts
  for select to authenticated using (private.my_business_role(business_id) is not null);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.require_verified_checker() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  perform private.require_aal2();
  select m.business_id into v_business_id
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid() and b.verification_status = 'verified';
  if v_business_id is null then
    raise exception 'Only verified businesses can check customers' using errcode = '42501';
  end if;
  return v_business_id;
end;
$$;

/** Fingerprints of the details entered for a customer (only the ones present). */
create function private.customer_hashes(p_customer jsonb)
returns table (kind public.identifier_kind, hash bytea)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_value text;
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
      hash := private.identifier_hash(v_kind, v_value);
      return next;
    end if;
  end loop;
end;
$$;

/** Facts other businesses may see about verified, unexpired incidents. */
create function private.incident_facts(p_incident_ids uuid[]) returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(f order by f ->> 'service_month' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'category', i.category,
      'service_month', to_char(i.service_date, 'YYYY-MM'),
      'evidence_count', (select count(*) from public.incident_evidence e where e.incident_id = i.id),
      'evidence_kinds', (
        select coalesce(jsonb_agg(distinct e.kind), '[]'::jsonb)
        from public.incident_evidence e where e.incident_id = i.id
      ),
      'review_rating', i.review_rating,
      'outcome', 'evidence_verified',
      'customer_response', null,
      'expires_month', to_char(i.expires_at, 'YYYY-MM')
    ) as f
    from public.incidents i
    where i.id = any (p_incident_ids)
      and i.status = 'evidence_verified'
      and i.expires_at > now()
  ) facts;
$$;

create function private.run_check(
  p_business_id uuid,
  p_customer jsonb,
  p_customer_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_provided public.identifier_kind[];
  v_matches uuid[];
  v_check_id uuid;
  v_alert_id uuid;
begin
  select coalesce(array_agg(h.kind), '{}') into v_provided from private.customer_hashes(p_customer) h;
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
    join private.customer_hashes(p_customer) h on h.kind = ii.kind and h.hash = ii.hash
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

-- ---------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------
/** Checks a customer the business already has, without saving them. */
create function public.check_customer(p_customer jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.run_check(private.require_verified_checker(), p_customer, null);
end;
$$;

/** Saves a new customer in the business's records and checks them automatically. */
create function public.add_customer(p_customer jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_verified_checker();
  v_name text := btrim(coalesce(p_customer ->> 'full_name', ''));
  v_phone text := private.normalize_identifier('phone', p_customer ->> 'phone');
  v_email text := nullif(lower(btrim(coalesce(p_customer ->> 'email', ''))), '');
  v_zip text := nullif(btrim(coalesce(p_customer ->> 'postal_code', '')), '');
  v_customer_id uuid;
begin
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Enter the customer''s name' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_customer ->> 'phone', '')), '') is not null and v_phone is null then
    raise exception 'Enter a 10-digit US phone number for the customer' using errcode = '22023';
  end if;
  if v_zip is not null and v_zip !~ '^[0-9]{5}(-[0-9]{4})?$' then
    raise exception 'Enter a 5-digit ZIP code' using errcode = '22023';
  end if;

  insert into public.customers (
    business_id, created_by, full_name, phone, email, address_line1, address_line2, city, state,
    postal_code
  ) values (
    v_business_id, auth.uid(), v_name,
    case when v_phone is not null then '+1' || v_phone end,
    v_email,
    nullif(btrim(coalesce(p_customer ->> 'address_line1', '')), ''),
    nullif(btrim(coalesce(p_customer ->> 'address_line2', '')), ''),
    nullif(btrim(coalesce(p_customer ->> 'city', '')), ''),
    nullif(upper(btrim(coalesce(p_customer ->> 'state', ''))), ''),
    v_zip
  )
  returning id into v_customer_id;

  return private.run_check(v_business_id, p_customer, v_customer_id)
    || jsonb_build_object('customer_id', v_customer_id);
end;
$$;

/** Re-opens an alert: current facts only (expired incidents drop out). */
create function public.alert_details(p_alert_id uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_alert public.match_alerts;
begin
  perform private.require_aal2();
  select a.* into v_alert
  from public.match_alerts a
  where a.id = p_alert_id and private.my_business_role(a.business_id) is not null;
  if v_alert.id is null then
    raise exception 'Alert not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'alert_id', v_alert.id,
    'customer_label', v_alert.customer_label,
    'decision', v_alert.decision,
    'created_at', v_alert.created_at,
    'incidents', private.incident_facts(array(
      select incident_id from public.match_alert_incidents where alert_id = v_alert.id
    ))
  ) || jsonb_build_object(
    'incident_count', jsonb_array_length(private.incident_facts(array(
      select incident_id from public.match_alert_incidents where alert_id = v_alert.id
    )))
  );
end;
$$;

create function public.respond_to_alert(p_alert_id uuid, p_decision public.alert_decision)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_aal2();
  update public.match_alerts
  set decision = p_decision, decided_by = auth.uid(), decided_at = now()
  where id = p_alert_id and private.my_business_role(business_id) is not null;
  if not found then
    raise exception 'Alert not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function
  public.check_customer(jsonb),
  public.add_customer(jsonb),
  public.alert_details(uuid),
  public.respond_to_alert(uuid, public.alert_decision)
to authenticated;
