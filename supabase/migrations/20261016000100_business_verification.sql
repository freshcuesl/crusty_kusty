-- Business verification: contact details, proof documents in private storage,
-- submission for review, moderator decisions and an append-only audit trail.
--
-- Flow: unverified/needs_info/rejected (editable) → submit → pending (locked)
--       → moderator: approve → verified | needs_info | reject

-- ---------------------------------------------------------------------------
-- Business details
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column phone text check (phone ~ '^\+1[2-9][0-9]{9}$'),
  add column address_line1 text check (char_length(address_line1) between 1 and 200),
  add column address_line2 text check (char_length(address_line2) <= 200),
  add column city text check (char_length(city) between 1 and 100),
  add column state text check (state ~ '^[A-Z]{2}$'),
  add column postal_code text check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id),
  add column review_note text check (char_length(review_note) <= 2000);

-- ---------------------------------------------------------------------------
-- Documents and audit trail
-- ---------------------------------------------------------------------------
create type public.document_kind as enum ('business_license', 'ein_letter', 'insurance_certificate');

create table public.business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.document_kind not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  -- SHA-256 of the file, computed at upload. Moderators re-check it to detect tampering.
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references auth.users (id),
  uploaded_at timestamptz not null default now()
);
create index business_documents_business_id on public.business_documents (business_id);

create type public.verification_action as enum (
  'details_updated', 'document_added', 'document_removed',
  'submitted', 'approved', 'rejected', 'needs_info'
);

create table public.verification_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor uuid references auth.users (id),
  action public.verification_action not null,
  note text,
  created_at timestamptz not null default now()
);
create index verification_events_business_id on public.verification_events (business_id, id);

alter table public.business_documents enable row level security;
alter table public.verification_events enable row level security;

-- Read-only for clients. All writes go through the functions below.
grant select on public.business_documents to authenticated;
grant select on public.verification_events to authenticated;

create policy require_two_step_login on public.business_documents
  as restrictive for all to authenticated using (private.is_aal2());
create policy require_two_step_login on public.verification_events
  as restrictive for all to authenticated using (private.is_aal2());

create policy members_read_documents on public.business_documents
  for select to authenticated using (private.my_business_role(business_id) is not null);
create policy platform_staff_read_documents on public.business_documents
  for select to authenticated using (private.is_platform_staff());
create policy members_read_events on public.verification_events
  for select to authenticated using (private.my_business_role(business_id) is not null);
create policy platform_staff_read_events on public.verification_events
  for select to authenticated using (private.is_platform_staff());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.try_uuid(p_text text) returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

create function private.business_is_editable(p_business_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select verification_status in ('unverified', 'needs_info', 'rejected')
  from public.businesses where id = p_business_id;
$$;

/** Raises unless the caller is a two-step-verified owner; returns their business id. */
create function private.require_owner() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  perform private.require_aal2();
  select business_id into v_business_id
  from public.business_members where user_id = auth.uid() and role = 'owner';
  if v_business_id is null then
    raise exception 'Only the business owner can do this' using errcode = '42501';
  end if;
  return v_business_id;
end;
$$;

create function private.require_editable(p_business_id uuid) returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not private.business_is_editable(p_business_id) then
    raise exception 'Your business is being reviewed. Changes are locked until then.'
      using errcode = '55000';
  end if;
end;
$$;

/** For future features (checks, reports): only verified businesses may use them. */
create function private.is_my_business_verified() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select b.verification_status = 'verified'
    from public.business_members m join public.businesses b on b.id = m.business_id
    where m.user_id = auth.uid()
  ), false) and private.is_aal2();
$$;

grant execute on function
  private.try_uuid(text),
  private.business_is_editable(uuid),
  private.is_my_business_verified()
to authenticated;

-- ---------------------------------------------------------------------------
-- Private file storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-documents', 'business-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Files live at <business id>/<random name>. No UPDATE policy: uploaded files can't be replaced.
create policy owners_upload_business_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-documents'
    and private.is_aal2()
    and private.my_business_role(private.try_uuid((storage.foldername(name))[1])) = 'owner'
    and private.business_is_editable(private.try_uuid((storage.foldername(name))[1]))
  );

create policy members_and_moderators_read_business_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-documents'
    and private.is_aal2()
    and (
      private.my_business_role(private.try_uuid((storage.foldername(name))[1])) is not null
      or private.is_platform_staff()
    )
  );

-- Owners may delete a file only while editable and only once it's no longer a recorded document.
create policy owners_delete_unrecorded_business_documents on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-documents'
    and private.is_aal2()
    and private.my_business_role(private.try_uuid((storage.foldername(name))[1])) = 'owner'
    and private.business_is_editable(private.try_uuid((storage.foldername(name))[1]))
    and not exists (
      select 1 from public.business_documents d where d.storage_path = storage.objects.name
    )
  );

-- ---------------------------------------------------------------------------
-- Owner actions
-- ---------------------------------------------------------------------------
create function public.update_business_details(
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_postal_code text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_owner();
  v_state text := upper(btrim(coalesce(p_state, '')));
  v_line1 text := btrim(coalesce(p_address_line1, ''));
  v_line2 text := nullif(btrim(coalesce(p_address_line2, '')), '');
  v_city text := btrim(coalesce(p_city, ''));
  v_zip text := btrim(coalesce(p_postal_code, ''));
begin
  perform private.require_editable(v_business_id);

  if coalesce(p_phone, '') !~ '^\+1[2-9][0-9]{9}$' then
    raise exception 'Enter a 10-digit US phone number' using errcode = '22023';
  end if;
  if char_length(v_line1) not between 1 and 200 or char_length(v_city) not between 1 and 100 then
    raise exception 'Enter the street address and city' using errcode = '22023';
  end if;
  if v_state <> all (array[
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
    'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
    'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  ]) then
    raise exception 'Choose a US state' using errcode = '22023';
  end if;
  if v_zip !~ '^[0-9]{5}(-[0-9]{4})?$' then
    raise exception 'Enter a 5-digit ZIP code' using errcode = '22023';
  end if;

  update public.businesses
  set phone = p_phone, address_line1 = v_line1, address_line2 = v_line2,
      city = v_city, state = v_state, postal_code = v_zip
  where id = v_business_id;

  insert into public.verification_events (business_id, actor, action)
  values (v_business_id, auth.uid(), 'details_updated');
end;
$$;

create function public.add_business_document(
  p_kind public.document_kind,
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
  v_business_id uuid := private.require_owner();
  v_document_id uuid;
begin
  perform private.require_editable(v_business_id);

  if private.try_uuid(split_part(coalesce(p_storage_path, ''), '/', 1)) is distinct from v_business_id then
    raise exception 'That file is not in your business folder' using errcode = '42501';
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'business-documents' and name = p_storage_path
  ) then
    raise exception 'Upload the file first' using errcode = 'P0002';
  end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid file fingerprint' using errcode = '22023';
  end if;

  insert into public.business_documents
    (business_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, uploaded_by)
  values
    (v_business_id, p_kind, p_storage_path, left(btrim(p_file_name), 255), p_mime_type,
     p_size_bytes, p_sha256, auth.uid())
  returning id into v_document_id;

  insert into public.verification_events (business_id, actor, action, note)
  values (v_business_id, auth.uid(), 'document_added', p_kind::text);

  return v_document_id;
end;
$$;

/** Removes the document record and returns the storage path, so the app can delete the file. */
create function public.remove_business_document(p_document_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_owner();
  v_path text;
begin
  perform private.require_editable(v_business_id);

  delete from public.business_documents
  where id = p_document_id and business_id = v_business_id
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  insert into public.verification_events (business_id, actor, action)
  values (v_business_id, auth.uid(), 'document_removed');

  return v_path;
end;
$$;

create function public.submit_for_verification() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_owner();
  v_business public.businesses;
begin
  perform private.require_editable(v_business_id);
  select * into v_business from public.businesses where id = v_business_id;

  -- Same order as the screen: details (step 1), then documents (step 2).
  if v_business.phone is null or v_business.address_line1 is null or v_business.city is null
     or v_business.state is null or v_business.postal_code is null then
    raise exception 'Add your business phone and address first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.business_documents where business_id = v_business_id) then
    raise exception 'Add at least one document' using errcode = '22023';
  end if;

  update public.businesses
  set verification_status = 'pending', submitted_at = now()
  where id = v_business_id;

  insert into public.verification_events (business_id, actor, action)
  values (v_business_id, auth.uid(), 'submitted');
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderator decision
-- ---------------------------------------------------------------------------
create function public.review_business(
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

grant execute on function
  public.update_business_details(text, text, text, text, text, text),
  public.add_business_document(public.document_kind, text, text, text, integer, text),
  public.remove_business_document(uuid),
  public.submit_for_verification(),
  public.review_business(uuid, text, text)
to authenticated;
