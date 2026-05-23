alter table public.report_run_recipients
  add column if not exists engagement_revoked_at timestamptz;

create index if not exists idx_report_run_recipients_engagement_revoked
  on public.report_run_recipients (engagement_revoked_at)
  where engagement_revoked_at is not null;
