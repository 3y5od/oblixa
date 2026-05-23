create extension if not exists pgcrypto;

alter table public.report_run_recipients
  add column if not exists engagement_token_prefix text,
  add column if not exists engagement_token_hash text;

update public.report_run_recipients
set
  engagement_token_prefix = coalesce(engagement_token_prefix, left(engagement_token, 12)),
  engagement_token_hash = coalesce(engagement_token_hash, encode(digest(engagement_token, 'sha256'), 'hex'))
where engagement_token is not null;

create unique index if not exists idx_report_run_recipients_engagement_token_hash_unique
  on public.report_run_recipients (engagement_token_hash)
  where engagement_token_hash is not null;

create index if not exists idx_report_run_recipients_engagement_token_prefix
  on public.report_run_recipients (engagement_token_prefix)
  where engagement_token_prefix is not null;

alter table public.report_run_recipients
  alter column engagement_token drop not null;

update public.report_run_recipients
set engagement_token = null
where engagement_token is not null;

alter table public.report_run_recipients
  drop constraint if exists report_run_recipients_plaintext_engagement_token_null;

alter table public.report_run_recipients
  add constraint report_run_recipients_plaintext_engagement_token_null
  check (engagement_token is null)
  not valid;

alter table public.report_run_recipients
  validate constraint report_run_recipients_plaintext_engagement_token_null;
