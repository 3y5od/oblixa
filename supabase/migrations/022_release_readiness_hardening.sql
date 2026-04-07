-- Release readiness hardening:
-- - calendar feed token hashing + expiry metadata
-- - API key revocation reason for auditability

create extension if not exists pgcrypto;

alter table public.calendar_feeds
  alter column token drop not null;

alter table public.calendar_feeds
  add column if not exists token_prefix text,
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz not null default (now() + interval '180 days'),
  add column if not exists revoked_at timestamptz;

update public.calendar_feeds
set
  token_prefix = left(token, 12),
  token_hash = encode(digest(token, 'sha256'), 'hex')
where token is not null and token_hash is null;

create unique index if not exists idx_calendar_feeds_token_hash_unique
  on public.calendar_feeds (token_hash)
  where token_hash is not null;

create index if not exists idx_calendar_feeds_prefix_active_expiry
  on public.calendar_feeds (token_prefix, active, expires_at)
  where token_prefix is not null;

alter table public.integration_api_keys
  add column if not exists revoked_reason text;

