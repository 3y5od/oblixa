-- Retry worker performance and health-observability index tuning.
-- Apply after 033_v3_operational_depth_finalization.sql.

-- Fast due-row scans for retry worker:
--   where status in ('pending','retrying')
--     and (next_attempt_at is null or next_attempt_at <= now())
--   order by created_at asc
create index if not exists idx_notification_deliveries_retry_due
  on public.notification_deliveries (status, next_attempt_at, created_at)
  where status in ('pending', 'retrying');

-- Fast heartbeat reads in Settings > Health by action + recency.
create index if not exists idx_audit_events_org_action_created
  on public.audit_events (organization_id, action, created_at desc);
