-- Add tenant-scoped uniqueness for public token and idempotency lookup values.

create unique index if not exists idx_calendar_feeds_org_token_hash_unique
  on public.calendar_feeds (organization_id, token_hash)
  where token_hash is not null;

create unique index if not exists idx_external_action_links_org_token_hash_unique
  on public.external_action_links (organization_id, token_hash)
  where token_hash is not null;

create unique index if not exists idx_integration_api_keys_org_key_hash_unique
  on public.integration_api_keys (organization_id, key_hash);

create unique index if not exists idx_integration_oauth_states_org_state_unique
  on public.integration_oauth_states (organization_id, state);

create unique index if not exists idx_v10_mutation_idempotency_org_key_unique
  on public.v10_mutation_idempotency (
    organization_id,
    actor_user_id,
    mutation_name,
    target_type,
    target_id,
    idempotency_key
  );
