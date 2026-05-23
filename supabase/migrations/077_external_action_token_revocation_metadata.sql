-- Add explicit revocation metadata for external-action public tokens.
alter table public.external_action_links
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_reason text;

update public.external_action_links
set revoked_at = coalesce(revoked_at, updated_at, now())
where status = 'revoked'
  and revoked_at is null;

create index if not exists idx_external_action_links_token_revoked
  on public.external_action_links (revoked_at)
  where revoked_at is not null;

alter table public.external_action_links
  drop constraint if exists external_action_links_revoked_metadata_consistency;

alter table public.external_action_links
  add constraint external_action_links_revoked_metadata_consistency
  check (status <> 'revoked' or revoked_at is not null)
  not valid;

alter table public.external_action_links
  validate constraint external_action_links_revoked_metadata_consistency;
