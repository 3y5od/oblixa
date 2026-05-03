# Production cron assurance (operator checklist)

Automated gates: `check:vercel-cron-canary-parity`, `check:cron-route-auth`, `check:cron-canary`, `check:comprehensive-pass`, plus CI steps in `.github/workflows/ci.yml`.

## 1. Vercel Production

1. Set **`CRON_SECRET`** in Project → Settings → Environment Variables → **Production** (long random string). Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` only when this variable exists.
2. **Redeploy** Production after secret-only changes if needed.
3. Confirm all paths in `vercel.json` → `crons` return **2xx** on schedule (not sustained 401/503).

## 2. Prove routes after deploy

```bash
export COMPREHENSIVE_PASS_BASE_URL="https://your-deployment.example"
export CRON_SECRET="***"
npm run check:cron-canary
npm run check:comprehensive-pass
```

Unsigned probes may return **401** (`cron_unauthorized`) or **503** (`cron_secret_missing`). Signed requests with Bearer or `x-cron-secret` must return **2xx**.

## 3. GitHub `cron-canary.yml`

Requires repository secrets **`STAGING_BASE_URL`** and **`CRON_SECRET`** (both set), or the workflow **skips** all canary steps. Optional: `HC_CRON_CANARY_PING`.

## 4. Playwright Bearer parity

`e2e/cron-bearer-parity.spec.ts` runs when `CRON_SECRET` is set; it checks both `Authorization: Bearer` and `x-cron-secret` against `/api/reminders/send`.

## 5. Non-cron API smoke (staging)

- Session APIs: `e2e/security-api.spec.ts` (with onboarding deep lane when configured).
- Stripe, extraction worker, internal diag, external-actions tokens, `nav-badges`, `product-telemetry` — exercise after auth changes.

## 6. Server Actions in `startTransition(async …)`

Onboarding “Hide for now” uses try/catch around `completeProductOnboarding`. Audit other mutations: `rg 'startTransition\\(async' src` — prefer try/catch or explicit error UI for user-visible paths.

## 7. Kill switches / feature flags

Confirm Production values for cron-related skips (`kill-switches`, V5/V6 feature guards, calibration stale env) are intentional.

## 8. Storage / Realtime

If used, validate bucket policies and Realtime auth outside cron JSON checks.

## 9. Waivers

Skipped checks need **reason**, **owner**, **compensating control**, **review date**.
