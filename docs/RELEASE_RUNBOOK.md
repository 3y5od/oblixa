# Release runbook (Oblixa V4)

Operator steps for shipping to production and keeping automation healthy.

## Before you deploy

1. **Migrations**  
   Apply Supabase migrations through the current head (see `supabase/migrations/`). Prefer validating on staging first, especially `041_v4_security_hardening.sql` (storage + RLS).

2. **Environment**  
   Mirror [V4 cutover checklist](V4_CUTOVER_CHECKLIST.md) for domain redirects, Stripe, Resend, Slack OAuth, and app URL. In Vercel (or your host), set at least everything [`.env.example`](../.env.example) marks as required for production, including:
   - `CRON_SECRET` (all cron GET routes, including `/api/cron/v4/*`)
   - `NEXT_PUBLIC_APP_URL`
   - `INTEGRATION_TOKEN_ENCRYPTION_KEY` (if using OAuth integrations)

3. **Local gate**  
   From the repo: `npm run verify`.

4. **Staging gate (recommended)**  
   With staging URL and secrets: `npm run check:comprehensive-pass`  
   This probes cron auth/JSON for legacy and V4 crons and runs a short RLS sanity check.

5. **Full release script (optional)**  
   `npm run release:checklist` runs preflight env checks, verify, e2e, and comprehensive pass (needs all env vars and a reachable base URL for the pass).

## After production cutover

- Confirm Vercel **Cron Jobs** show the schedules in `vercel.json` (including `/api/reports/capture-metrics` and `/api/cron/v4/*`).
- GitHub **Cron Canary** workflow (if enabled) hits the same cron list as `scripts/cron-canary.mjs` against `STAGING_BASE_URL` — keep staging deployed from `main` so canaries stay meaningful.

## Rollback

- **Application**: redeploy the previous Vercel deployment (or previous image/commit).
- **Database**: migration rollback is manual — avoid destructive migrations in production without a written down plan. Prefer forward-fixes when possible.

## Key rotation (high level)

| Secret | Where to update |
|--------|-----------------|
| `CRON_SECRET` | Vercel env + any external schedulers calling cron URLs |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel; avoid exposing in client |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard webhook + Vercel |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Rotating invalidates stored OAuth tokens — plan re-auth for users |

## References

- Product and platform spec: [V4 spec](V4.md)
- Domain and integration cutover: [V4 cutover checklist](V4_CUTOVER_CHECKLIST.md)
