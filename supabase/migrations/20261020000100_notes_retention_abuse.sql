-- Private customer notes, retention cleanup, and abuse flags.
--
-- Notes belong to a business's private workspace: never shared, never matched,
-- not even visible to moderators. Retention rules decide how long verified
-- incidents count; a nightly job then scrubs expired records and queues their
-- evidence files for deletion. Abuse flags tell moderators when a business uses
-- ClientShield far more than normal (a sign of people search or revenge reports).

-- ---------------------------------------------------------------------------
-- Private notes
-- ---------------------------------------------------------------------------
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index customer_notes_customer on public.customer_notes (customer_id, created_at desc);

alter table public.customer_notes enable row level security;
grant select on public.customer_notes to authenticated;
create policy require_two_step_login on public.customer_notes
  as restrictive for all to authenticated using (private.is_aal2());
create policy members_read on public.customer_notes
  for select to authenticated using (private.my_business_role(business_id) is not null);

/** The caller's business for one of its customers, or "Customer not found". */
create function private.my_customer_business(p_customer_id uuid) returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  perform private.require_aal2();
  select c.business_id into v_business_id
  from public.customers c
  where c.id = p_customer_id and private.my_business_role(c.business_id) is not null;
  if v_business_id is null then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  return v_business_id;
end;
$$;

create function public.add_customer_note(p_customer_id uuid, p_body text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.my_customer_business(p_customer_id);
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_body = '' then
    raise exception 'Write a note first' using errcode = '22023';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Keep notes under 2,000 characters' using errcode = '22023';
  end if;
  insert into public.customer_notes (business_id, customer_id, author_id, body)
  values (v_business_id, p_customer_id, auth.uid(), v_body)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.delete_customer_note(p_note_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_note public.customer_notes;
begin
  perform private.require_aal2();
  select n.* into v_note from public.customer_notes n
  where n.id = p_note_id and private.my_business_role(n.business_id) is not null;
  if v_note.id is null then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;
  if v_note.author_id <> auth.uid() and private.my_business_role(v_note.business_id) <> 'owner' then
    raise exception 'Only the person who wrote a note, or the owner, can delete it'
      using errcode = '42501';
  end if;
  delete from public.customer_notes where id = p_note_id;
end;
$$;

/** Checks a saved customer again, for example before a repeat booking. */
create function public.recheck_customer(p_customer_id uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.require_verified_checker();
  v_customer jsonb;
begin
  select to_jsonb(c) into v_customer from public.customers c
  where c.id = p_customer_id and c.business_id = v_business_id;
  if v_customer is null then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  return private.run_check(v_business_id, v_customer, p_customer_id);
end;
$$;

/** Removes a customer record and its notes (for example, at the customer's request). */
create function public.delete_customer(p_customer_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_business_id uuid := private.my_customer_business(p_customer_id);
begin
  if private.my_business_role(v_business_id) <> 'owner' then
    raise exception 'Only the owner can delete customer records' using errcode = '42501';
  end if;
  delete from public.customers where id = p_customer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention rules
-- ---------------------------------------------------------------------------
create table public.retention_rules (
  category public.incident_category primary key,
  months smallint not null check (months between 6 and 60),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
insert into public.retention_rules (category, months)
select c, case when c in ('chargeback', 'fraud') then 60 else 24 end
from unnest(enum_range(null::public.incident_category)) c;

alter table public.retention_rules enable row level security;
grant select on public.retention_rules to authenticated;
create policy require_two_step_login on public.retention_rules
  as restrictive for all to authenticated using (private.is_aal2());
create policy staff_read on public.retention_rules
  for select to authenticated using (private.is_platform_staff());

/** How long a newly verified incident counts, from the admin's retention rules. */
create or replace function private.incident_expiry(
  p_category public.incident_category,
  p_service_date date
) returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select (p_service_date + make_interval(months => coalesce(
    (select r.months from public.retention_rules r where r.category = p_category),
    case when p_category in ('chargeback', 'fraud') then 60 else 24 end
  )))::timestamptz;
$$;

/** Admins only. Applies to incidents verified from now on. */
create function public.set_retention_months(
  p_category public.incident_category,
  p_months integer
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.require_aal2();
  if not exists (
    select 1 from public.platform_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admins can change how long records are kept' using errcode = '42501';
  end if;
  if p_months is null or p_months not between 6 and 60 then
    raise exception 'Keep records between 6 and 60 months' using errcode = '22023';
  end if;
  update public.retention_rules
  set months = p_months, updated_by = auth.uid(), updated_at = now()
  where category = p_category;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cleanup of expired records
-- ---------------------------------------------------------------------------
/**
 * Evidence files waiting to be deleted. Storage files can only be removed
 * through the Storage API, so the purge-expired-files Edge Function empties this.
 */
create table private.storage_purge_queue (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (bucket, path)
);

create function private.purge_expired() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_scrub uuid[];
  v_drafts uuid[];
  v_checks integer;
begin
  -- Verified incidents past their retention period, and rejected reports a year after the decision.
  select coalesce(array_agg(id), '{}') into v_scrub from public.incidents
  where (status = 'evidence_verified' and expires_at <= now())
     or (status = 'rejected' and reviewed_at <= now() - interval '12 months');

  -- Drafts and unanswered "needs more information" reports left alone for a year.
  select coalesce(array_agg(id), '{}') into v_drafts from public.incidents
  where status in ('draft', 'needs_info') and updated_at <= now() - interval '12 months';

  insert into private.storage_purge_queue (bucket, path)
  select 'incident-evidence', e.storage_path from public.incident_evidence e
  where e.incident_id = any (v_scrub || v_drafts)
  on conflict do nothing;

  delete from public.incidents where id = any (v_drafts);

  delete from public.incident_evidence where incident_id = any (v_scrub);
  delete from public.incident_identifiers where incident_id = any (v_scrub);
  delete from public.incident_customers where incident_id = any (v_scrub);
  update public.incident_events set note = null where incident_id = any (v_scrub);
  update public.incidents set
    status = 'expired',
    description = 'Details removed when this record expired.',
    invoice_number = null,
    review_url = null,
    review_text = null,
    review_note = null,
    updated_at = now()
  where id = any (v_scrub);
  insert into public.incident_events (incident_id, action, note)
  select unnest(v_scrub), 'expired', 'Customer details and evidence removed (retention policy)';

  -- Check logs (and the alerts they created) after 24 months.
  delete from public.customer_checks where created_at < now() - interval '24 months';
  get diagnostics v_checks = row_count;

  return jsonb_build_object(
    'expired_incidents', cardinality(v_scrub),
    'deleted_drafts', cardinality(v_drafts),
    'deleted_checks', v_checks
  );
end;
$$;

/** For the purge-expired-files Edge Function (service role only). */
create function public.claim_storage_purge(p_limit integer default 100)
returns table (id bigint, bucket text, path text)
language sql security definer
set search_path = ''
as $$
  update private.storage_purge_queue q set claimed_at = now()
  where q.id in (
    select x.id from private.storage_purge_queue x
    where x.claimed_at is null or x.claimed_at < now() - interval '1 hour'
    order by x.id
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
  )
  returning q.id, q.bucket, q.path;
$$;

create function public.confirm_storage_purge(p_ids bigint[]) returns void
language sql security definer
set search_path = ''
as $$
  delete from private.storage_purge_queue where id = any (p_ids);
$$;

grant execute on function public.claim_storage_purge(integer), public.confirm_storage_purge(bigint[])
  to service_role;

/**
 * Asks the Edge Function to delete queued files. Does nothing until the hosted
 * project stores `project_url` and `purge_files_secret` in Vault (launch guide).
 */
create function private.request_file_purge() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'purge_files_secret';
  if v_url is null or v_secret is null
     or not exists (select 1 from private.storage_purge_queue) then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/purge-expired-files',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-purge-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

select cron.schedule('purge-expired-records', '17 3 * * *', 'select private.purge_expired()');
select cron.schedule('purge-expired-files', '47 3 * * *', 'select private.request_file_purge()');

-- ---------------------------------------------------------------------------
-- Abuse flags
-- ---------------------------------------------------------------------------
create type public.abuse_flag_kind as enum (
  'high_check_volume', 'many_unsaved_checks', 'high_report_volume', 'repeated_rejections'
);

create table public.abuse_flags (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.abuse_flag_kind not null,
  detail text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  resolution_note text check (char_length(resolution_note) <= 2000)
);
-- One open flag per business and kind; repeats while it is open add nothing.
create unique index abuse_flags_one_open on public.abuse_flags (business_id, kind)
  where resolved_at is null;
create index abuse_flags_created on public.abuse_flags (created_at desc);

alter table public.abuse_flags enable row level security;
grant select on public.abuse_flags to authenticated;
create policy require_two_step_login on public.abuse_flags
  as restrictive for all to authenticated using (private.is_aal2());
create policy staff_read on public.abuse_flags
  for select to authenticated using (private.is_platform_staff());

create function private.raise_abuse_flag(
  p_business_id uuid,
  p_kind public.abuse_flag_kind,
  p_detail text
) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.abuse_flags (business_id, kind, detail)
  values (p_business_id, p_kind, p_detail)
  on conflict (business_id, kind) where resolved_at is null do nothing;
$$;

-- Thresholds sit well below the hard limits (300 checks a day, 50 reports a month),
-- so moderators hear about unusual use before it hits a wall.
create function private.watch_customer_checks() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_unsaved integer;
begin
  select count(*), count(*) filter (where customer_id is null)
  into v_total, v_unsaved
  from public.customer_checks
  where business_id = new.business_id and created_at > now() - interval '1 day';

  if v_total >= 100 then
    perform private.raise_abuse_flag(new.business_id, 'high_check_volume',
      format('%s customer checks in 24 hours', v_total));
  end if;
  -- Checks of people never saved as customers are how "people search" would look.
  if v_unsaved >= 40 then
    perform private.raise_abuse_flag(new.business_id, 'many_unsaved_checks',
      format('%s checks in 24 hours for people not saved as customers', v_unsaved));
  end if;
  return null;
end;
$$;

create trigger watch_customer_checks after insert on public.customer_checks
  for each row execute function private.watch_customer_checks();

create function private.watch_incidents() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.status = 'submitted' then
    select count(*) into v_count from public.incidents
    where business_id = new.business_id and submitted_at > now() - interval '7 days';
    if v_count >= 10 then
      perform private.raise_abuse_flag(new.business_id, 'high_report_volume',
        format('%s incident reports submitted in 7 days', v_count));
    end if;
  elsif new.status = 'rejected' then
    select count(*) into v_count from public.incidents
    where business_id = new.business_id and status = 'rejected'
      and reviewed_at > now() - interval '90 days';
    if v_count >= 3 then
      perform private.raise_abuse_flag(new.business_id, 'repeated_rejections',
        format('%s incident reports rejected in 90 days', v_count));
    end if;
  end if;
  return null;
end;
$$;

create trigger watch_incidents after update of status on public.incidents
  for each row when (old.status is distinct from new.status)
  execute function private.watch_incidents();

create function public.resolve_abuse_flag(p_flag_id uuid, p_note text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_flag public.abuse_flags;
begin
  perform private.require_aal2();
  if not private.is_platform_staff() then
    raise exception 'Only moderators can resolve flags' using errcode = '42501';
  end if;
  if v_note is null then
    raise exception 'Add a note explaining what you found' using errcode = '22023';
  end if;
  select * into v_flag from public.abuse_flags where id = p_flag_id for update;
  if v_flag.id is null then
    raise exception 'Flag not found' using errcode = 'P0002';
  end if;
  if v_flag.resolved_at is not null then
    raise exception 'This flag is already resolved' using errcode = '55000';
  end if;
  update public.abuse_flags
  set resolved_at = now(), resolved_by = auth.uid(), resolution_note = left(v_note, 2000)
  where id = p_flag_id;
end;
$$;

grant execute on function
  public.add_customer_note(uuid, text),
  public.delete_customer_note(uuid),
  public.recheck_customer(uuid),
  public.delete_customer(uuid),
  public.set_retention_months(public.incident_category, integer),
  public.resolve_abuse_flag(uuid, text)
to authenticated;
