-- A moderator can ask a business for more information instead of rejecting it.
-- Separate migration: Postgres can't use a new enum value in the transaction that adds it.
alter type public.verification_status add value if not exists 'needs_info' after 'pending';
