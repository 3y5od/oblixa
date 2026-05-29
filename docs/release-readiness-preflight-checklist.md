# Release Readiness Preflight Checklist

Use this checklist before promoting staging to production or making a production release. It is intentionally operational: every item should be easy to answer without reading source code.

Do not paste secrets into chat, tickets, screenshots, or docs. Confirm that a secret exists and belongs to the right environment, but do not copy the value anywhere except the provider dashboard that needs it.

## Stop Immediately If

- [ ] Staging is not working end to end.
- [ ] Production migration history does not match local migration files.
- [ ] A production Supabase dry run shows unexpected pending migrations.
- [ ] Vercel production env vars are incomplete or mixed with staging/test credentials.
- [ ] Stripe live keys are mixed with Stripe test prices, or test keys are mixed with live prices.
- [ ] Required GitHub status checks are not enforced on `main`.
- [ ] You do not know how to roll back the Vercel production deployment.

## Branch And Pull Request

- [ ] Current work is on `staging` or a feature branch, not directly on `main`.
- [ ] The `staging` branch has been deployed successfully in Vercel Preview.
- [ ] A pull request exists from `staging` to `main`.
- [ ] GitHub required checks are enabled for `main`:
  - [ ] `quality`
  - [ ] `quality_build_e2e`
  - [ ] `dependency-review`
  - [ ] `analyze (javascript-typescript)`
- [ ] Branch protection/ruleset enforcement is active.
- [ ] Force pushes and branch deletion are blocked for `main`.

## Local Static Checks

Run these locally before merging:

```bash
npm run check:quick
npm run preflight:release
npm run check:integration-contract-resilience
npm run check:vercel-cron
npm run check:cron-route-auth
npm run check:runtime-health-probe-contracts
npm run check:supabase:config
npm run check:supabase:seed-safety
git diff --check
```

- [ ] All commands above pass.
- [ ] Any failure is fixed or deliberately deferred with a written reason.
- [ ] No command requiring production credentials was run accidentally.
- [ ] `npm run test:supabase:local-reset` was not run unless explicitly intended.

## Staging Environment

- [ ] Vercel Preview/Staging has its own environment variables.
- [ ] Staging uses the staging Supabase project.
- [ ] Staging uses Stripe test mode keys and test prices.
- [ ] Staging uses a staging Upstash Redis database.
- [ ] Staging uses staging-safe callback URLs.
- [ ] Staging does not use production service-role keys.
- [ ] Staging does not use production Stripe live keys.

## Staging Smoke Test

Open the Vercel staging URL and confirm:

- [ ] Landing page loads and visually matches local expectations.
- [ ] `/login` loads.
- [ ] `/signup` loads.
- [ ] New account creation works.
- [ ] Email confirmation or password reset email works if enabled.
- [ ] Sign-in works.
- [ ] Dashboard loads.
- [ ] Core pages load:
  - [ ] `/dashboard`
  - [ ] `/contracts`
  - [ ] `/settings`
  - [ ] `/reports`
- [ ] At least one safe write action works, such as creating/importing a test contract.
- [ ] At least one safe read/export path works.
- [ ] Vercel staging logs show no repeated runtime errors.
- [ ] Supabase staging logs show no auth, RLS, or SQL errors for the smoke test.

## Production Environment Variables

In Vercel Production, confirm the following are present and production-specific:

- [ ] `NEXT_PUBLIC_APP_URL` or equivalent canonical app URL.
- [ ] `APP_BASE_URL`.
- [ ] `OBLIXA_TRUSTED_APP_ORIGINS`.
- [ ] Production `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Production `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Production `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Production `UPSTASH_REDIS_REST_URL`.
- [ ] Production `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Production `CRON_SECRET`.
- [ ] Production `INTEGRATION_TOKEN_ENCRYPTION_KEY`.
- [ ] Production `OBLIXA_INTERNAL_HMAC_SECRET`.
- [ ] Production `OBLIXA_STEP_UP_SECRET`.
- [ ] Production `RESEND_API_KEY`.
- [ ] Production `EMAIL_FROM`.
- [ ] Production Stripe live publishable key.
- [ ] Production Stripe live secret key.
- [ ] Production Stripe live price IDs.
- [ ] Production Stripe webhook secret.
- [ ] Sentry DSNs and sample rates, if Sentry is enabled.
- [ ] CSP rollback env vars are intentionally set or intentionally absent:
  - [ ] `OBLIXA_CSP_STRICT_ENFORCING_SCRIPT`
  - [ ] `OBLIXA_CSP_STRICT_ENFORCING_STYLE`

## Supabase Production

- [ ] Supabase Auth Site URL points to the production app URL.
- [ ] Supabase Auth redirect URLs include:
  - [ ] `https://YOUR_DOMAIN/auth/callback`
  - [ ] `https://YOUR_DOMAIN/reset-password`
  - [ ] `https://YOUR_DOMAIN/api/integrations/oauth/callback`
- [ ] Production migration history contains every local migration version.
- [ ] Production migration dry run is clean:

```bash
supabase db push --dry-run --linked
```

- [ ] The linked project ref was confirmed to be production before running the dry run.
- [ ] No real production migration push is run unless the dry run output is expected.
- [ ] No seed data is applied to production.

## Stripe

- [ ] Production app uses Stripe live mode keys.
- [ ] Production price IDs start with `price_`, not `prod_`.
- [ ] Annual and monthly prices are correct.
- [ ] Customer Portal is configured.
- [ ] Webhook endpoint exists:
  - [ ] `https://YOUR_DOMAIN/api/stripe/webhook`
- [ ] Webhook events include:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_failed`
- [ ] A Stripe test-mode checkout was completed successfully on staging.
- [ ] No live checkout is tested with a real customer unless intentionally doing a final production smoke.

## Email

- [ ] Email sending provider domain is verified.
- [ ] SPF/DKIM/DMARC records are present.
- [ ] `EMAIL_FROM` uses the verified sending domain.
- [ ] Staging password reset email works.
- [ ] Production password reset email has been tested with an internal account after deployment.
- [ ] Invite/sign-in email paths work if they are part of the release.

## Cron And Monitoring

- [ ] Vercel cron schedules are present.
- [ ] `CRON_SECRET` is set in production.
- [ ] `CRON_HEALTHCHECK_URL` is configured if app cron health pings are expected.
- [ ] GitHub `HC_SLO_MONITOR_PING` is configured if the SLO workflow is enabled.
- [ ] Better Stack/Healthchecks monitors show recent successful pings after staging test.
- [ ] No cron route returns repeated 401, 403, 429, or 500 responses.

## Slack And External Integrations

If Slack is not being launched, mark it intentionally deferred.

- [ ] Slack launch status is one of:
  - [ ] Live
  - [ ] Staging only
  - [ ] Deferred
- [ ] If live, Slack app redirect URL is:
  - [ ] `https://YOUR_DOMAIN/api/integrations/oauth/callback`
- [ ] If live, Slack OAuth env vars are set.
- [ ] If live, Slack signing secret is set.
- [ ] If live, Slack OAuth install flow works on staging.
- [ ] Inbound automation tokens are scoped and production-specific.

## Observability

- [ ] Sentry project receives staging errors from a deliberate test or known non-sensitive test path.
- [ ] Sentry release value matches the deployed commit, if release tracking is enabled.
- [ ] Vercel logs are reviewed after staging smoke.
- [ ] Supabase logs are reviewed after staging smoke.
- [ ] Stripe webhook delivery logs show success for staging checkout.
- [ ] No secret values appear in logs.

## Production Release

- [ ] Merge `staging` to `main` only after all required checks pass.
- [ ] Wait for Vercel production deployment to complete.
- [ ] Run production smoke test:
  - [ ] Landing page loads.
  - [ ] `/login` loads.
  - [ ] `/signup` loads.
  - [ ] Internal/admin sign-in works.
  - [ ] Dashboard loads.
  - [ ] Settings page loads.
  - [ ] One safe read-only product page loads.
- [ ] Check Vercel production logs.
- [ ] Check Supabase production logs.
- [ ] Check Sentry.
- [ ] Check Stripe webhook delivery health.
- [ ] Check cron/health monitor status.

## Rollback Plan

- [ ] The previous Vercel production deployment is known.
- [ ] The team knows how to use Vercel rollback.
- [ ] Any database migration applied in production has a written forward-fix plan.
- [ ] No destructive SQL migration is released without a separate rollback/fix-forward plan.
- [ ] If production smoke fails, rollback Vercel first and investigate before changing database state.

## Release Decision

- [ ] Release approved.
- [ ] Release blocked.
- [ ] Blocker owner:
- [ ] Blocker summary:
- [ ] Next review time:
