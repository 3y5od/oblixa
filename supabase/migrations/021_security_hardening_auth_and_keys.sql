-- Security hardening: OAuth PKCE state metadata, API key scoping/expiry.

alter table public.integration_oauth_states
  add column if not exists redirect_uri text,
  add column if not exists code_verifier text,
  add column if not exists code_challenge_method text
    check (code_challenge_method in ('S256', 'plain'));

alter table public.integration_api_keys
  add column if not exists scopes text[] not null default '{"events:read"}',
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz;

create index if not exists idx_integration_api_keys_active_expiry
  on public.integration_api_keys (organization_id, active, expires_at);
