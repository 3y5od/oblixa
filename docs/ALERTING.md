# Alerting Baseline

Use this baseline for production alerting before GA.

## Cron alerts

Each cron endpoint emits a heartbeat payload with `route`, `ok`, and `durationMs`.

Alert conditions:

1. No heartbeat for 2 scheduled intervals.
2. `ok: false` on any cron run.
3. `durationMs` above 2x baseline for 3 consecutive runs.

Covered routes:

- `/api/reminders/send`
- `/api/reports/send-summaries`
- `/api/webhooks/dispatch`
- `/api/tasks/run-rules`
- `/api/contracts/recompute-signals`
- `/api/integrations/calendar/sync`
- `/api/integrations/crm/sync`
- `/api/integrations/refresh-tokens`
- `/api/cron/stripe-webhook-events`

## Queue / backlog alerts

Track and alert on:

- `outbound_event_deliveries` pending growth over 30m.
- stale extraction jobs in `contract_extraction_jobs`.
- repeated CRM/calendar sync failures in `integration_connections`.

## Security alerts

- repeated 401/429 spikes on:
  - `/api/events`
  - `/api/tasks/from-email`
  - `/api/tasks/from-slack`
  - `/api/export/calendar/feed/[token]`
- key revocation events and expired key access attempts.

