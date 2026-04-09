-- Operational optimization indexes for retry/dead-letter and observability queries.
-- Apply after 035_fix_rls_recursion_org_members.sql.

create index if not exists idx_notification_deliveries_failed_lookup
  on public.notification_deliveries (organization_id, notification_type, created_at desc)
  where status = 'failed';

create index if not exists idx_notification_deliveries_retry_scan
  on public.notification_deliveries (organization_id, status, next_attempt_at, created_at)
  where status in ('pending', 'retrying');

create index if not exists idx_report_runs_org_status_started
  on public.report_runs (organization_id, status, started_at desc);
