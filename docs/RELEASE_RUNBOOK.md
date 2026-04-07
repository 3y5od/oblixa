# Release Runbook

This runbook is the operational checklist for production releases.

## Pre-release checks

1. Verify environment variables are set in production:
   - `CRON_SECRET`
   - `INTEGRATION_TOKEN_ENCRYPTION_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_*`, `RESEND_API_KEY`, `OPENAI_API_KEY`
2. Run local verification:
   - `npm run check:migrations`
   - `npm run verify`
   - `npm run test:e2e`
   - (optional single command) `npm run release:checklist`
3. Confirm migration ordering:
   - No duplicate numeric prefixes in `supabase/migrations`
4. Validate staging smoke:
   - Login
   - Dashboard loads
   - Contracts list loads
   - Contract detail loads

## Database migration procedure

1. Backup the production database snapshot.
2. Apply migrations in staging and validate key workflows.
3. Apply migrations in production.
4. Confirm migration-specific checks:
   - `calendar_feeds` has `token_hash`, `token_prefix`, `expires_at`
   - `integration_api_keys` has `revoked_reason`

## Post-deploy validation

1. Confirm cron endpoints return healthy responses:
   - `/api/reminders/send`
   - `/api/reports/send-summaries`
   - `/api/webhooks/dispatch`
   - `/api/tasks/run-rules`
   - `/api/contracts/recompute-signals`
   - `/api/integrations/calendar/sync`
   - `/api/integrations/crm/sync`
   - `/api/integrations/refresh-tokens`
2. Confirm healthcheck monitor receives payloads with `route` and `durationMs`.
   - Alerting thresholds are documented in `docs/ALERTING.md`.
3. Validate one API key lifecycle end-to-end:
   - create
   - update scopes/expiry
   - revoke
4. Validate calendar feed token behavior:
   - token issuance
   - feed retrieval
   - expiry metadata present

## Rollback plan

1. If app-only regression:
   - rollback deployment to last known good version
2. If migration regression:
   - restore DB snapshot
   - deploy last known good app version
3. If cron misbehavior:
   - temporarily disable affected cron in platform settings
   - re-enable after fix

## Secret rotation SOP

1. Rotate `CRON_SECRET` and update all cron callers.
2. Rotate `INBOUND_AUTOMATION_TOKEN` and integration senders.
3. Rotate API keys in Operations settings and revoke old keys.
4. Rotate `INTEGRATION_TOKEN_ENCRYPTION_KEY` only with a re-encryption migration plan.

