-- Codify production retention indexes added during incident recovery.
-- These indexes support cleanup scans for code-owned transient records.

create index if not exists idx_calendar_feeds_retention
  on public.calendar_feeds (retention_expires_at)
  where retention_expires_at is not null;

create index if not exists idx_contract_extraction_jobs_retention
  on public.contract_extraction_jobs (retention_expires_at)
  where retention_expires_at is not null;

create index if not exists idx_contract_import_job_rows_retention
  on public.contract_import_job_rows (retention_expires_at)
  where retention_expires_at is not null;

create index if not exists idx_contract_import_jobs_retention
  on public.contract_import_jobs (retention_expires_at)
  where retention_expires_at is not null;

create index if not exists idx_external_action_events_payload_retention
  on public.external_action_events (created_at)
  where payload_redacted_at is null;

create index if not exists idx_external_action_links_retention
  on public.external_action_links (retention_expires_at)
  where retention_expires_at is not null;

create index if not exists idx_report_run_recipients_tracking_retention
  on public.report_run_recipients (tracking_retention_expires_at)
  where tracking_retention_expires_at is not null;
