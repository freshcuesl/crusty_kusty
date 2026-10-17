-- Incidents past their retention period are scrubbed and marked `expired`.
-- Separate migration: Postgres can't use a new enum value in the transaction that adds it.
alter type public.incident_status add value if not exists 'expired';
alter type public.incident_action add value if not exists 'expired';
