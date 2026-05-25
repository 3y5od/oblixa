-- Ensure OAuth callback state retention cleanup can use the expiration predicate.

create index if not exists idx_integration_oauth_states_expires_at
  on public.integration_oauth_states (expires_at)
  where expires_at is not null;
