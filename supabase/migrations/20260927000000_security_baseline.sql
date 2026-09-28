-- Deny by default: new tables, sequences and functions in the public schema are
-- not reachable through the API until a migration grants access explicitly
-- (and, for tables, adds row-level security policies).

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
