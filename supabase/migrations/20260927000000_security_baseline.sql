-- Deny by default: new tables, sequences and functions in the public schema are
-- not reachable through the API until a migration grants access explicitly
-- (and, for tables, adds row-level security policies).

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Postgres grants EXECUTE on every new function to PUBLIC (every role, including
-- anon) as a database-wide default. A per-schema rule can't remove a
-- database-wide one, so this revoke must be global. Migrations that add a
-- function, or an extension whose functions the API needs, must GRANT EXECUTE
-- explicitly.
alter default privileges for role postgres
  revoke execute on functions from public;
