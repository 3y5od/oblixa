create extension if not exists pgcrypto;

alter table public.external_action_links
  alter column token drop not null;

alter table public.external_action_links
  add column if not exists token_prefix text,
  add column if not exists token_hash text;

update public.external_action_links
set
  token_prefix = left(token, 12),
  token_hash = encode(digest(token, 'sha256'), 'hex')
where token is not null
  and token_hash is null;

create unique index if not exists idx_external_action_links_token_hash_unique
  on public.external_action_links (token_hash)
  where token_hash is not null;

create index if not exists idx_external_action_links_prefix_status_expiry
  on public.external_action_links (token_prefix, status, expires_at)
  where token_prefix is not null;
