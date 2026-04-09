-- V4 follow-up hardening:
-- 1) make automated exception detection idempotent via fingerprint
-- 2) keep inserts backward compatible for manual exceptions

alter table public.exceptions
  add column if not exists fingerprint text;

create unique index if not exists idx_exceptions_org_fingerprint_unique
  on public.exceptions(organization_id, fingerprint)
  where fingerprint is not null and length(fingerprint) > 0;
