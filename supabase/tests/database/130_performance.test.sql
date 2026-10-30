-- Guards for the performance work: fast security-rule patterns, indexes, and an
-- admin_insights plan mix that matches private.effective_tier() exactly.
begin;
select plan(7);

select is(
  (select count(*)::int from pg_policies
   where schemaname in ('public', 'storage')
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'my_business_role|can_read_incident'),
  0,
  'security rules never call a per-row membership function'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname in ('public', 'storage')
     and (coalesce(qual, '') || coalesce(with_check, ''))
         ~ '(?<!SELECT )private\.(is_aal2|is_platform_staff)\(\)'),
  0,
  'two-step and staff checks run once per query, not once per row'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.uid\(\)'),
  0,
  'auth.uid() in security rules runs once per query'
);
select has_index('public', 'customer_checks', 'customer_checks_customer',
  'deleting a customer does not scan every check');
select has_index('public', 'match_alerts', 'match_alerts_check',
  'the nightly cleanup of old checks does not scan every alert');

-- plan_mix must agree with effective_tier() for every business.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000da1', 'admin@perf13.test');
insert into public.platform_roles (user_id, role) values ('00000000-0000-0000-0000-000000000da1', 'admin');
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000da1', 'aal', 'aal2', 'role', 'authenticated')::text, true);
select is(
  public.admin_insights(4) #> '{finances,plan_mix}',
  (select jsonb_object_agg(t.tier, (select count(*) from public.businesses b where private.effective_tier(b.id) = t.tier))
   from unnest(enum_range(null::public.plan_tier)) t(tier)),
  'the fast plan mix matches effective_tier() for every business'
);

select is(
  (select array_agg(hash order by kind) from private.customer_hashes(
    '{"full_name":"Jordan Demo","phone":"(206) 555-0142","email":"J@Example.com","address_line1":"42 Sample Street","postal_code":"98101"}')),
  array[
    private.identifier_hash('name', private.normalize_identifier('name', 'Jordan Demo')),
    private.identifier_hash('phone', private.normalize_identifier('phone', '(206) 555-0142')),
    private.identifier_hash('email', private.normalize_identifier('email', 'J@Example.com')),
    private.identifier_hash('address', private.normalize_identifier('address', '42 Sample Street 98101'))
  ],
  'the faster fingerprints are identical to the stored incident fingerprints'
);

select * from finish();
rollback;
