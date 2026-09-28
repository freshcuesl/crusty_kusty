-- Security guardrails that every future migration must keep true.
begin;
select plan(5);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every table in the public schema has row-level security enabled'
);

-- Tables and functions created later must be locked down until a feature grants access on purpose.
create table public.__probe_table (id int);
create function public.__probe_fn() returns int language sql as 'select 1';

select ok(
  not has_table_privilege('anon', 'public.__probe_table', 'select'),
  'anonymous visitors get no access to new tables by default'
);
select ok(
  not has_table_privilege('authenticated', 'public.__probe_table', 'select'),
  'signed-in users get no access to new tables by default'
);
select ok(
  not has_function_privilege('anon', 'public.__probe_fn()', 'execute'),
  'anonymous visitors cannot call new functions by default'
);
select ok(
  not has_function_privilege('authenticated', 'public.__probe_fn()', 'execute'),
  'signed-in users cannot call new functions by default'
);

select * from finish();
rollback;
