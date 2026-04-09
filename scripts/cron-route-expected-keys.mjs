/**
 * Single source of truth for cron route JSON shape checks.
 * Used by scripts/comprehensive-pass.mjs and scripts/cron-canary.mjs.
 */
export const CRON_ROUTE_EXPECTED_KEYS = new Map([
  ["/api/reminders/send", ["sent", "candidates", "skipped_no_email"]],
  ["/api/reports/send-summaries", ["durationMs"]],
  ["/api/reports/capture-metrics", ["durationMs", "updated"]],
  ["/api/webhooks/dispatch", ["durationMs"]],
  ["/api/tasks/run-rules", ["durationMs"]],
  ["/api/contracts/recompute-signals", ["durationMs"]],
  ["/api/integrations/calendar/sync", ["durationMs"]],
  ["/api/integrations/crm/sync", ["durationMs"]],
  ["/api/integrations/refresh-tokens", ["durationMs"]],
  ["/api/notifications/retry-deliveries", ["durationMs", "scanned"]],
  ["/api/maintenance/prune-operational-data", ["durationMs"]],
  ["/api/cron/stripe-webhook-events", ["durationMs"]],
  ["/api/cron/v4/approvals-sla", ["durationMs", "evaluated", "breaches"]],
  ["/api/cron/v4/attestations-issue", ["durationMs", "issued"]],
  ["/api/cron/v4/escalations-dispatch", ["durationMs", "dispatched"]],
  ["/api/cron/v4/evidence-followup", ["durationMs", "reviewed", "exceptionsCreated"]],
  ["/api/cron/v4/exceptions-detect", ["durationMs", "detected"]],
  ["/api/cron/v4/programs-reconcile", ["durationMs", "reconciledPrograms"]],
  ["/api/cron/v4/renewals-recompute-signals", ["durationMs", "updatedSignals"]],
  ["/api/cron/v4/report-packs-generate", ["durationMs", "generated"]],
  ["/api/cron/v5/campaign-progress", ["ok", "campaignsUpdated"]],
  ["/api/cron/v5/simulation-snapshots", ["ok", "snapshotRunsCreated"]],
  ["/api/cron/v5/capacity-forecast-refresh", ["ok", "forecastsGenerated"]],
  ["/api/cron/v5/portfolio-risk-recompute", ["ok", "riskSnapshotsUpserted"]],
  ["/api/cron/v5/external-followup", ["ok", "expiredLinks"]],
  ["/api/cron/v5/decision-sla-monitor", ["ok", "slaBreachesDetected"]],
  ["/api/cron/v5/recommendation-refresh", ["ok", "recommendationsCreated"]],
  ["/api/cron/v5/relationship-rollups", ["ok", "rollupsRecorded"]],
]);
