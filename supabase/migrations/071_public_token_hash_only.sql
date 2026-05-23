create extension if not exists pgcrypto;

update public.external_action_links
set
  token_prefix = coalesce(token_prefix, left(token, 12)),
  token_hash = coalesce(token_hash, encode(digest(token, 'sha256'), 'hex'))
where token is not null;

update public.external_action_links
set token = null
where token is not null;

alter table public.external_action_links
  drop constraint if exists external_action_links_plaintext_token_null;

alter table public.external_action_links
  add constraint external_action_links_plaintext_token_null
  check (token is null)
  not valid;

alter table public.external_action_links
  validate constraint external_action_links_plaintext_token_null;

update public.calendar_feeds
set
  token_prefix = coalesce(token_prefix, left(token, 12)),
  token_hash = coalesce(token_hash, encode(digest(token, 'sha256'), 'hex'))
where token is not null;

update public.calendar_feeds
set token = null
where token is not null;

alter table public.calendar_feeds
  drop constraint if exists calendar_feeds_plaintext_token_null;

alter table public.calendar_feeds
  add constraint calendar_feeds_plaintext_token_null
  check (token is null)
  not valid;

alter table public.calendar_feeds
  validate constraint calendar_feeds_plaintext_token_null;
