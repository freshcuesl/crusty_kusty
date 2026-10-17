-- Incident reports with evidence, moderator review, expiry, and private matching
-- fingerprints for customer details.
--
-- Flow: draft → submit → submitted (locked) → moderator: verify → evidence_verified
--                                                      | needs_info → edit → submit again
--                                                      | reject → rejected
--
-- Privacy:
--   * Customer details live in incident_customers: readable only by the reporting
--     business and moderators.
--   * Matching uses HMAC-SHA256 fingerprints of normalized details, keyed with a
--     secret stored in Supabase Vault. Fingerprints exist only for verified
--     incidents and are never readable through the API.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.incident_category as enum (
  'false_workmanship_complaint',
  'refund_after_completed_service',
  'chargeback',
  'threatened_bad_review',
  'repeated_callbacks_no_defect',
  'fraud',
  'other_documented_dispute'
);
create type public.incident_status as enum (
  'draft', 'submitted', 'needs_info', 'evidence_verified', 'rejected'
);
create type public.evidence_kind as enum (
  'before_after_photo', 'invoice', 'work_authorization', 'customer_messages',
  'technician_notes', 'inspection_results', 'refund_documentation', 'review_screenshot', 'other'
);
create type public.identifier_kind as enum ('name', 'phone', 'email', 'address');
create type public.incident_action as enum (
  'created', 'updated', 'evidence_added', 'evidence_removed',
  'submitted', 'evidence_verified', 'needs_info', 'rejected'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  status public.incident_status not null default 'draft',
  category public.incident_category not null,
  service_date date not null,
  service_type text not null check (char_length(service_type) between 1 and 100),
  invoice_number text check (char_length(invoice_number) <= 60),
  description text not null check (char_length(description) between 20 and 5000),
  review_url text check (char_length(review_url) <= 500),
  review_rating smallint check (review_rating between 1 and 5),
  review_date date,
  review_text text check (char_length(review_text) <= 5000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  review_note text check (char_length(review_note) <= 2000),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index incidents_business on public.incidents (business_id, created_at desc);
create index incidents_status on public.incidents (status, submitted_at);

create table public.incident_customers (
  incident_id uuid primary key references public.incidents (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (phone ~ '^\+1[2-9][0-9]{9}$'),
  email text check (char_length(email) <= 254),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text check (char_length(city) <= 100),
  state text check (state ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$')
);

create table public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  kind public.evidence_kind not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references auth.users (id),
  uploaded_at timestamptz not null default now()
);
create index incident_evidence_incident on public.incident_evidence (incident_id);

create table public.incident_events (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  actor uuid references auth.users (id),
  action public.incident_action not null,
  note text,
  created_at timestamptz not null default now()
);
create index incident_events_incident on public.incident_events (incident_id, id);

create table public.incident_identifiers (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  kind public.identifier_kind not null,
  hash bytea not null,
  primary key (incident_id, kind)
);
create index incident_identifiers_lookup on public.incident_identifiers (kind, hash);

alter table public.incidents enable row level security;
alter table public.incident_customers enable row level security;
alter table public.incident_evidence enable row level security;
alter table public.incident_events enable row level security;
-- No grants and no policies: fingerprints are only used inside the database.
alter table public.incident_identifiers enable row level security;

grant select on public.incidents to authenticated;
grant select on public.incident_customers to authenticated;
grant select on public.incident_evidence to authenticated;
grant select on public.incident_events to authenticated;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create function private.incident_business(p_incident_id uuid) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select business_id from public.incidents where id = p_incident_id;
$$;

create function private.can_read_incident(p_incident_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_aal2() and (
    private.my_business_role(private.incident_business(p_incident_id)) is not null
    or private.is_platform_staff()
  );
$$;

grant execute on function private.incident_business(uuid), private.can_read_incident(uuid)
  to authenticated;

create policy require_two_step_login on public.incidents
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.incident_customers
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.incident_evidence
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.incident_events
  as restrictive for all to authenticated using (private.is_aal2());

create policy reporters_and_moderators_read on public.incidents
  for select to authenticated
  using (private.my_business_role(business_id) is not null or private.is_platform_staff());
create policy reporters_and_moderators_read on public.incident_customers
  for select to authenticated using (private.can_read_incident(incident_id));
create policy reporters_and_moderators_read on public.incident_evidence
  for select to authenticated using (private.can_read_incident(incident_id));
create policy reporters_and_moderators_read on public.incident_events
  for select to authenticated using (private.can_read_incident(incident_id));

/** Two-step login, membership of a verified business; returns that business. */
create function private.require_verified_member() returns uuid
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
    raise exception 'Only verified businesses can report incidents' using errcode = '42501';
  end if;
  return v_business_id;
end;
$$;

/** The caller's business must own the incident, and it must still be editable. */
create function private.require_editable_incident(p_incident_id uuid) returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_verified_member();
  v_status public.incident_status;
begin
  select status into v_status
  from public.incidents where id = p_incident_id and business_id = v_business_id;
  if v_status is null then
    raise exception 'Incident not found' using errcode = 'P0002';
  end if;
  if v_status not in ('draft', 'needs_info') then
    raise exception 'This incident is being reviewed. Changes are locked until then.'
      using errcode = '55000';
  end if;
  return v_business_id;
end;
$$;

create function private.incident_editable(p_incident_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select status in ('draft', 'needs_info') from public.incidents where id = p_incident_id;
$$;
grant execute on function private.incident_editable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Matching fingerprints
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'identifier_pepper') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'identifier_pepper',
      'HMAC key for customer identifier fingerprints. Rotating it invalidates all matches.'
    );
  end if;
end;
$$;

/** Puts a customer detail in one standard form so different spellings match. */
create function private.normalize_identifier(p_kind text, p_value text) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_value, '')));
  w text[] := array[
    'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln',
    'boulevard', 'blvd', 'court', 'ct', 'place', 'pl', 'circle', 'cir', 'highway', 'hwy',
    'parkway', 'pkwy', 'apartment', 'apt', 'suite', 'ste', 'north', 'n', 'south', 's',
    'east', 'e', 'west', 'w'
  ];
  i int;
begin
  if v = '' then
    return null;
  end if;

  case p_kind
    when 'email' then
      v := regexp_replace(v, '^([^@+]+)\+[^@]*@', '\1@');
      return case when v ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v end;
    when 'phone' then
      v := regexp_replace(v, '\D', '', 'g');
      if length(v) = 11 and left(v, 1) = '1' then
        v := substr(v, 2);
      end if;
      return case when v ~ '^[2-9][0-9]{9}$' then v end;
    when 'name' then
      v := btrim(regexp_replace(regexp_replace(v, '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g'));
      return nullif(v, '');
    when 'address' then
      v := ' ' || btrim(regexp_replace(regexp_replace(v, '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) || ' ';
      for i in 1 .. array_length(w, 1) by 2 loop
        v := replace(v, ' ' || w[i] || ' ', ' ' || w[i + 1] || ' ');
      end loop;
      return nullif(btrim(v), '');
    else
      raise exception 'Unknown identifier kind: %', p_kind using errcode = '22023';
  end case;
end;
$$;

/** Keyed one-way fingerprint of a normalized detail. Never exposed to clients. */
create function private.identifier_hash(p_kind text, p_normalized text) returns bytea
language sql stable security definer
set search_path = ''
as $$
  select extensions.hmac(
    p_kind || ':' || p_normalized,
    (select decrypted_secret from vault.decrypted_secrets where name = 'identifier_pepper'),
    'sha256'
  );
$$;

create function private.store_identifiers(p_incident_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.incident_customers;
  v_value text;
  v_kind text;
begin
  select * into c from public.incident_customers where incident_id = p_incident_id;
  delete from public.incident_identifiers where incident_id = p_incident_id;

  foreach v_kind in array array['name', 'phone', 'email', 'address'] loop
    v_value := private.normalize_identifier(
      v_kind,
      case v_kind
        when 'name' then c.full_name
        when 'phone' then c.phone
        when 'email' then c.email
        when 'address' then
          case when c.address_line1 is not null
            then c.address_line1 || ' ' || coalesce(left(c.postal_code, 5), '') end
      end
    );
    if v_value is not null then
      insert into public.incident_identifiers (incident_id, kind, hash)
      values (p_incident_id, v_kind::public.identifier_kind, private.identifier_hash(v_kind, v_value));
    end if;
  end loop;
end;
$$;

/** Minor disputes expire after 24 months; chargebacks and fraud after 60. */
create function private.incident_expiry(
  p_category public.incident_category,
  p_service_date date
) returns timestamptz
language sql stable
set search_path = ''
as $$
  select (p_service_date + case
    when p_category in ('chargeback', 'fraud') then interval '60 months'
    else interval '24 months'
  end)::timestamptz;
$$;

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------
create function private.check_incident_fields(
  p_service_date date,
  p_service_type text,
  p_invoice_number text,
  p_description text,
  p_review jsonb
) returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if p_service_date is null or p_service_date > current_date then
    raise exception 'The service date can''t be in the future' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) < 20 then
    raise exception 'Describe what happened in at least 20 characters' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_service_type, ''))) not between 1 and 100 then
    raise exception 'Enter the type of service' using errcode = '22023';
  end if;
  if char_length(coalesce(p_invoice_number, '')) > 60 then
    raise exception 'The invoice number is too long' using errcode = '22023';
  end if;
  if p_review is not null and jsonb_typeof(p_review) = 'object' then
    if coalesce(p_review ->> 'url', '')
       !~ '^https://((www|maps)\.)?(google\.[a-z.]+|g\.page|maps\.app\.goo\.gl|goo\.gl)/' then
      raise exception 'Use the link to the Google review' using errcode = '22023';
    end if;
    if (p_review ->> 'rating') is null or (p_review ->> 'rating')::int not between 1 and 5 then
      raise exception 'Choose the review''s star rating' using errcode = '22023';
    end if;
    if (p_review ->> 'date') is not null and (p_review ->> 'date')::date > current_date then
      raise exception 'The review date can''t be in the future' using errcode = '22023';
    end if;
  end if;
end;
$$;

create function private.save_incident_customer(p_incident_id uuid, p_customer jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_customer ->> 'full_name', ''));
  v_phone text := nullif(btrim(coalesce(p_customer ->> 'phone', '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_customer ->> 'email', ''))), '');
  v_line1 text := nullif(btrim(coalesce(p_customer ->> 'address_line1', '')), '');
  v_zip text := nullif(btrim(coalesce(p_customer ->> 'postal_code', '')), '');
begin
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Enter the customer''s name' using errcode = '22023';
  end if;
  if v_phone is null and v_email is null and v_line1 is null then
    raise exception 'Add a phone number, email or address for the customer' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+1[2-9][0-9]{9}$' then
    raise exception 'Enter a 10-digit US phone number for the customer' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email for the customer' using errcode = '22023';
  end if;
  if v_line1 is not null and (v_zip is null or v_zip !~ '^[0-9]{5}(-[0-9]{4})?$') then
    raise exception 'Add the 5-digit ZIP code with the customer''s address' using errcode = '22023';
  end if;

  insert into public.incident_customers
    (incident_id, full_name, phone, email, address_line1, address_line2, city, state, postal_code)
  values (
    p_incident_id, v_name, v_phone, v_email, v_line1,
    nullif(btrim(coalesce(p_customer ->> 'address_line2', '')), ''),
    nullif(btrim(coalesce(p_customer ->> 'city', '')), ''),
    nullif(upper(btrim(coalesce(p_customer ->> 'state', ''))), ''),
    v_zip
  )
  on conflict (incident_id) do update set
    full_name = excluded.full_name, phone = excluded.phone, email = excluded.email,
    address_line1 = excluded.address_line1, address_line2 = excluded.address_line2,
    city = excluded.city, state = excluded.state, postal_code = excluded.postal_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private evidence storage: <business id>/<incident id>/<random name>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-evidence', 'incident-evidence', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create function private.can_upload_incident_file(p_name text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_aal2()
    and exists (
      select 1
      from public.incidents i
      join public.business_members m on m.business_id = i.business_id and m.user_id = auth.uid()
      join public.businesses b on b.id = i.business_id and b.verification_status = 'verified'
      where i.business_id = private.try_uuid((storage.foldername(p_name))[1])
        and i.id = private.try_uuid((storage.foldername(p_name))[2])
        and i.status in ('draft', 'needs_info')
    );
$$;
grant execute on function private.can_upload_incident_file(text) to authenticated;

create policy members_upload_incident_evidence on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-evidence' and private.can_upload_incident_file(name));

create policy members_and_moderators_read_incident_evidence on storage.objects
  for select to authenticated
  using (
    bucket_id = 'incident-evidence'
    and private.is_aal2()
    and (
      private.my_business_role(private.try_uuid((storage.foldername(name))[1])) is not null
      or private.is_platform_staff()
    )
  );

create policy members_delete_unrecorded_incident_evidence on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'incident-evidence'
    and private.can_upload_incident_file(name)
    and not exists (
      select 1 from public.incident_evidence e where e.storage_path = storage.objects.name
    )
  );

-- ---------------------------------------------------------------------------
-- Reporter actions
-- ---------------------------------------------------------------------------
create function public.create_incident(
  p_category public.incident_category,
  p_service_date date,
  p_service_type text,
  p_invoice_number text,
  p_description text,
  p_customer jsonb,
  p_review jsonb
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_verified_member();
  v_incident_id uuid;
begin
  perform private.check_incident_fields(
    p_service_date, p_service_type, p_invoice_number, p_description, p_review
  );
  -- Abuse guard: unusually many reports are flagged for a human, not silently accepted.
  if (
    select count(*) from public.incidents
    where business_id = v_business_id and created_at > now() - interval '30 days'
  ) >= 50 then
    raise exception 'Too many reports this month. Contact support.' using errcode = '54000';
  end if;

  insert into public.incidents (
    business_id, created_by, category, service_date, service_type, invoice_number, description,
    review_url, review_rating, review_date, review_text
  ) values (
    v_business_id, auth.uid(), p_category, p_service_date, btrim(p_service_type),
    nullif(btrim(coalesce(p_invoice_number, '')), ''), btrim(p_description),
    p_review ->> 'url', (p_review ->> 'rating')::smallint, (p_review ->> 'date')::date,
    p_review ->> 'text'
  )
  returning id into v_incident_id;

  -- Validated last so an invalid customer rolls back the whole report.
  perform private.save_incident_customer(v_incident_id, p_customer);

  insert into public.incident_events (incident_id, actor, action)
  values (v_incident_id, auth.uid(), 'created');
  return v_incident_id;
end;
$$;

create function public.update_incident(
  p_incident_id uuid,
  p_category public.incident_category,
  p_service_date date,
  p_service_type text,
  p_invoice_number text,
  p_description text,
  p_customer jsonb,
  p_review jsonb
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_editable_incident(p_incident_id);
  perform private.check_incident_fields(
    p_service_date, p_service_type, p_invoice_number, p_description, p_review
  );

  update public.incidents set
    category = p_category,
    service_date = p_service_date,
    service_type = btrim(p_service_type),
    invoice_number = nullif(btrim(coalesce(p_invoice_number, '')), ''),
    description = btrim(p_description),
    review_url = p_review ->> 'url',
    review_rating = (p_review ->> 'rating')::smallint,
    review_date = (p_review ->> 'date')::date,
    review_text = p_review ->> 'text',
    updated_at = now()
  where id = p_incident_id;

  perform private.save_incident_customer(p_incident_id, p_customer);

  insert into public.incident_events (incident_id, actor, action)
  values (p_incident_id, auth.uid(), 'updated');
end;
$$;

create function public.add_incident_evidence(
  p_incident_id uuid,
  p_kind public.evidence_kind,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_sha256 text
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_editable_incident(p_incident_id);
  v_evidence_id uuid;
begin
  if coalesce(p_storage_path, '') not like v_business_id || '/' || p_incident_id || '/%' then
    raise exception 'That file is not in this incident''s folder' using errcode = '42501';
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'incident-evidence' and name = p_storage_path
  ) then
    raise exception 'Upload the file first' using errcode = 'P0002';
  end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid file fingerprint' using errcode = '22023';
  end if;

  insert into public.incident_evidence
    (incident_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by)
  values
    (p_incident_id, p_kind, p_storage_path, left(btrim(p_file_name), 255), p_mime_type,
     p_size_bytes, p_sha256, auth.uid())
  returning id into v_evidence_id;

  insert into public.incident_events (incident_id, actor, action, note)
  values (p_incident_id, auth.uid(), 'evidence_added', p_kind::text);
  return v_evidence_id;
end;
$$;

create function public.remove_incident_evidence(p_evidence_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_incident_id uuid;
  v_path text;
begin
  select incident_id into v_incident_id from public.incident_evidence where id = p_evidence_id;
  if v_incident_id is null then
    raise exception 'Evidence not found' using errcode = 'P0002';
  end if;
  perform private.require_editable_incident(v_incident_id);

  delete from public.incident_evidence where id = p_evidence_id returning storage_path into v_path;
  insert into public.incident_events (incident_id, actor, action)
  values (v_incident_id, auth.uid(), 'evidence_removed');
  return v_path;
end;
$$;

create function public.submit_incident(p_incident_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_editable_incident(p_incident_id);
  if not exists (select 1 from public.incident_evidence where incident_id = p_incident_id) then
    raise exception 'Add at least one piece of evidence' using errcode = '22023';
  end if;

  update public.incidents
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_incident_id;

  insert into public.incident_events (incident_id, actor, action)
  values (p_incident_id, auth.uid(), 'submitted');
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderator decision
-- ---------------------------------------------------------------------------
create function public.review_incident(
  p_incident_id uuid,
  p_decision text,
  p_note text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_incident public.incidents;
begin
  perform private.require_aal2();
  if not private.is_platform_staff() then
    raise exception 'Only moderators can review incidents' using errcode = '42501';
  end if;
  if p_decision not in ('verify', 'needs_info', 'reject') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
  if p_decision <> 'verify' and v_note is null then
    raise exception 'Add a note explaining the decision' using errcode = '22023';
  end if;

  select * into v_incident from public.incidents where id = p_incident_id for update;
  if v_incident.status is distinct from 'submitted' then
    raise exception 'Only incidents waiting for review can be decided' using errcode = '55000';
  end if;

  update public.incidents set
    status = case p_decision
      when 'verify' then 'evidence_verified'::public.incident_status
      when 'reject' then 'rejected'::public.incident_status
      else 'needs_info'::public.incident_status
    end,
    expires_at = case when p_decision = 'verify'
      then private.incident_expiry(v_incident.category, v_incident.service_date) end,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_note = v_note,
    updated_at = now()
  where id = p_incident_id;

  if p_decision = 'verify' then
    perform private.store_identifiers(p_incident_id);
  end if;

  insert into public.incident_events (incident_id, actor, action, note)
  values (
    p_incident_id,
    auth.uid(),
    case p_decision
      when 'verify' then 'evidence_verified'::public.incident_action
      when 'reject' then 'rejected'::public.incident_action
      else 'needs_info'::public.incident_action
    end,
    v_note
  );
end;
$$;

grant execute on function
  public.create_incident(public.incident_category, date, text, text, text, jsonb, jsonb),
  public.update_incident(uuid, public.incident_category, date, text, text, text, jsonb, jsonb),
  public.add_incident_evidence(uuid, public.evidence_kind, text, text, text, integer, text),
  public.remove_incident_evidence(uuid),
  public.submit_incident(uuid),
  public.review_incident(uuid, text, text)
to authenticated;
