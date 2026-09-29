-- Server-side tools (never browsers) use the service_role, which must keep access.
begin;
select plan(2);

select ok(
  has_table_privilege('service_role', 'public.platform_roles', 'insert'),
  'server-side admin tools can grant moderator and admin roles'
);
select ok(
  not has_table_privilege('authenticated', 'public.platform_roles', 'insert'),
  'signed-in users still cannot grant roles'
);

select * from finish();
rollback;
