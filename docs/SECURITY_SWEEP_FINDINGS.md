# Security sweep findings (April 2026)

This document records the repository-wide security assessment: methodology, API auth matrix, server-action posture, dependency and static analysis results, and prioritized findings with remediation guidance.

**Scope:** Application code under `src/`, `e2e/`, `scripts/`, `supabase/migrations/`, config (`next.config.ts`, `vercel.json`), CI (`.github/workflows/`), and dependency manifests. **Out of scope for pure repo review:** Supabase project dashboard (Auth, Storage buckets, Realtime), Vercel env vars in the console, DNS, Stripe Dashboard webhook configuration.

---

## 1. Automated tooling

| Check | Result | Notes |
|--------|--------|--------|
| `npm audit` | **0 vulnerabilities** | Matches CI (`npm audit --audit-level=high`). |
| ESLint (`npm run lint`) | **Pass** | `src`, `e2e`, config files; `--max-warnings 0`. |
| OSV Scanner | **Run in CI** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`quality_security` job) uses [`google/osv-scanner-action`](https://github.com/google/osv-scanner-action) on `package-lock.json`. |
| Gitleaks | **Run in CI** | Same job; allowlists for Vitest/e2e fixtures are centralized in [`.gitleaks.toml`](.gitleaks.toml) (keep [`.gitleaksignore`](.gitleaksignore) empty to avoid duplicate rules). |
| Semgrep | **Run in CI** | [`semgrep scan --config p/ci --config p/typescript`](.github/workflows/ci.yml) on push/PR. |
| Risky sinks (`dangerouslySetInnerHTML`, `eval`) | **None found** | Grep across `*.{ts,tsx,js,jsx}`. |

---

## 2. Trust boundaries (summary)

- **[`src/proxy.ts`](src/proxy.ts):** Protects UI routes; **`/api/*` is not gated** here. All API handlers must authenticate/authorize themselves.
- **`createAdminClient` (service role):** Bypasses RLS. Org scoping and role checks are **application-enforced** on routes/actions that use the admin client.
- **Session auth:** [`getApiAuthContext`](src/lib/v4/api-auth.ts), [`getAuthContext`](src/lib/supabase/server.ts), or inline `createClient` + `getUser()`.
- **Cron:** [`authorizeCronRequest`](src/lib/security/cron-auth.ts) + `CRON_SECRET`; v5 crons use [`requireV5CronAuth`](src/lib/v5/cron.ts) → [`ensureCronAuthorized`](src/lib/v4/cron.ts).
- **Integration / worker:** `x-api-key` + hashed keys ([`src/app/api/events/route.ts`](src/app/api/events/route.ts)), `INBOUND_AUTOMATION_TOKEN`, `EXTRACTION_WORKER_SECRET`, Stripe webhook signature verification.
- **Capability tokens:** Calendar feed URL token, external action URL token, report engagement tokens (no session; possession of token + optional passcode).

---

## 3. API route matrix (111 `route.ts` files)

Below, **“Session + org”** means the handler establishes the caller via Supabase session and restricts data with `organization_id` / membership (via `getApiAuthContext`, `getUser` + membership, or equivalent). **“Cron”** means `CRON_SECRET` via Bearer or `x-cron-secret`. **“Design: token”** means unauthenticated browser/API user; security relies on unguessable token + rate limits + optional passcode.

### 3.1 Session-backed (`getApiAuthContext` or primary pattern)

V5 relationship, campaigns, decisions, intelligence, maintenance, programs, renewals, report-packs, simulations, capacity, command-centers, policy/simulate, Slack renewal-summary, exceptions, evidence (authenticated paths), import POST, integrations OAuth **start** (POST), Stripe checkout/portal (POST), templates preview, attestations, approvals.

**Pattern:** `getApiAuthContext()` → 401 if null; queries filtered by `ctx.orgId` and feature guards (`requireV5ApiFeature`) where applicable.

### 3.2 Session via `createClient` + `getUser` (not `getApiAuthContext` name)

Examples: [`src/app/api/export/contracts/route.ts`](src/app/api/export/contracts/route.ts), calendar export, import job GET, extract POST (membership on contract). **Org isolation** enforced per route via membership queries.

### 3.3 Dual mode: API key or session

[`src/app/api/events/route.ts`](src/app/api/events/route.ts): `x-api-key` (scoped `events:read`, hashed compare) **or** authenticated user; rate limited.

### 3.4 Cron-only (GET/POST with `CRON_SECRET`)

All `src/app/api/cron/**`, plus operational endpoints: `reminders/send`, `reports/send-summaries`, `reports/capture-metrics`, `contracts/recompute-signals`, `tasks/run-rules`, `notifications/retry-deliveries`, `maintenance/prune-operational-data`, `cron/stripe-webhook-events`, `integrations/calendar/sync`, `integrations/crm/sync`, `integrations/refresh-tokens`, [`src/app/api/webhooks/dispatch/route.ts`](src/app/api/webhooks/dispatch/route.ts) (GET processes queue; POST replay requires cron auth).

**Note:** GET on `webhooks/dispatch` with `?eventId=` returns diagnostics JSON (event + deliveries) — **only** reachable with valid cron secret; treat `CRON_SECRET` as highly sensitive.

### 3.5 Stripe

[`src/app/api/stripe/webhook/route.ts`](src/app/api/stripe/webhook/route.ts): `constructEvent` with `STRIPE_WEBHOOK_SECRET` — **no** session.

### 3.6 Worker

[`src/app/api/extract/run/route.ts`](src/app/api/extract/run/route.ts): Bearer `EXTRACTION_WORKER_SECRET`; body IDs validated as UUIDs. Caller [`src/app/api/extract/route.ts`](src/app/api/extract/route.ts) uses [`isSafeExtractionWorkerOrigin`](src/lib/security/worker-url.ts) for worker base URL (SSRF hardening).

### 3.7 Inbound automation (shared bearer)

[`INBOUND_AUTOMATION_TOKEN`](src/app/api/integrations/actions/callback/route.ts), [`src/app/api/tasks/from-email/route.ts`](src/app/api/tasks/from-email/route.ts), [`src/app/api/tasks/from-slack/route.ts`](src/app/api/tasks/from-slack/route.ts): Bearer compare + rate limit. **Risk:** single long-lived secret; rotation and least-privilege ingestion endpoints should be operational policy.

### 3.8 OAuth callback

[`src/app/api/integrations/oauth/callback/route.ts`](src/app/api/integrations/oauth/callback/route.ts): **No session cookie required.** Security is **OAuth `state` row** in `integration_oauth_states` (one-time, expiry, PKCE verifier) + rate limit + [`validateOutboundHttpUrl`](src/lib/security/url-policy.ts) on token URL.

### 3.9 Design: unguessable URL tokens (no login)

| Route | Controls |
|--------|-----------|
| [`export/calendar/feed/[token]`](src/app/api/export/calendar/feed/[token]/route.ts) | Token hash / legacy compare, rate limit, org-scoped ICS build |
| [`external-actions/[token]/status` & `submit`](src/app/api/external-actions/[token]/submit/route.ts) | Feature flag, link row by token, expiry, optional passcode, submit ticket when `requires_reauth` |
| [`reports/track/click/[token]`](src/app/api/reports/track/click/[token]/route.ts), [`open/[token]`](src/app/api/reports/track/open/[token]/route.ts) | Engagement token; redirect uses same-origin / `NEXT_PUBLIC_APP_URL` origin check |

### 3.10 Gaps / watchlist (not CVEs; defense-in-depth)

1. **API breadth:** Manual review of every handler for **consistent** `organization_id` filtering on **all** code paths (including error branches) is recommended as ongoing practice; automated tests per sensitive route help.
2. **Inbound token:** Anyone with `INBOUND_AUTOMATION_TOKEN` can act on **any** `organizationId` unless **`INBOUND_AUTOMATION_ORG_ALLOWLIST`** is set (comma-separated org UUIDs) — see [`src/lib/security/inbound-org-allowlist.ts`](src/lib/security/inbound-org-allowlist.ts). Optional per-route secrets (`INBOUND_EMAIL_AUTOMATION_TOKEN`, `INBOUND_SLACK_AUTOMATION_TOKEN`, `INBOUND_INTEGRATIONS_CALLBACK_TOKEN`) are resolved in [`src/lib/security/inbound-automation-token.ts`](src/lib/security/inbound-automation-token.ts). Also use network restrictions, secret rotation, and monitoring (401/403 spikes on inbound routes).
3. **Default dev crypto (v5 external actions):** Previously, missing env vars fell back to a fixed dev string — **addressed in code** (see §5): production now throws if no secret is configured.

---

## 4. Server actions (`src/actions/`)

- **Auth patterns:** Mixed helpers — e.g. [`src/actions/v4.ts`](src/actions/v4.ts) uses `getContext()` with membership + `hasRoleCapability`; [`src/actions/contracts.ts`](src/actions/contracts.ts) uses `verifyOrgMembership`, `requireWriteAccess`, and contract-scoped queries.
- **Public auth surface:** [`src/actions/auth.ts`](src/actions/auth.ts) (sign-in, password reset) uses rate limiting where applicable.
- **Demo:** [`src/actions/demo.ts`](src/actions/demo.ts): gated by `ENABLE_DEMO_SEED` and **admin** role only.
- **Assessment:** Sampled high-risk file `contracts.ts` — consistent membership and write checks before mutations. **Recommendation:** For new actions, require the same pattern (never trust client-supplied `organizationId` without membership check).

---

## 5. Secrets and crypto (hotspots)

| Topic | Finding | Severity | Remediation |
|--------|---------|----------|-------------|
| V5 external action pepper | Fallback `"oblixa-dev-external-pepper"` when env unset | **High** (prod) | **Fixed:** production-like environments now **throw** if required secrets are unset (see [`src/lib/v5/api.ts`](src/lib/v5/api.ts); submit-ticket chain vs passcode-only chain documented in code). |
| Cron healthcheck URL | `CRON_HEALTHCHECK_URL` passed raw to `fetch` | **Medium** | **Fixed:** URL validated with [`validateOutboundHttpUrl`](src/lib/security/url-policy.ts) before `fetch` ([`src/lib/observability/cron-healthcheck.ts`](src/lib/observability/cron-healthcheck.ts)). |
| Integration encryption | `INTEGRATION_TOKEN_ENCRYPTION_KEY` required when encrypting tokens | **Ops** | Document in runbook; ensure set in all envs that store integration secrets. |
| Timing-safe compare | API keys, cron, inbound use `secureCompareUtf8` / `timingSafeEqual` | **Good** | Maintain for new secret comparisons. |

---

## 6. SSRF and outbound `fetch`

| Location | Validation |
|----------|------------|
| [`webhooks/dispatch`](src/app/api/webhooks/dispatch/route.ts) | `validateOutboundHttpUrl(sub.url)` before POST |
| OAuth start/callback | `validateOutboundHttpUrl` on authorize/token URLs |
| CRM / calendar sync / refresh-tokens | `validateOutboundHttpUrl` on configured endpoints |
| [`notification-delivery.ts`](src/lib/notification-delivery.ts), [`slack.ts`](src/lib/integrations/slack.ts) | Webhook URL validated before fetch |
| [`cron-healthcheck.ts`](src/lib/observability/cron-healthcheck.ts) | Validated after hardening |
| [`extract/route.ts`](src/app/api/extract/route.ts) worker | Fixed origin via `resolveExtractionWorkerOrigin` + [`isSafeExtractionWorkerOrigin`](src/lib/security/worker-url.ts) |
| Client components | `fetch` to same-origin `/api/...` only — no user-controlled full URL to server fetch |

**Residual:** [`pingCronHealthcheck`](src/lib/observability/cron-healthcheck.ts) skips ping if URL invalid (silent) — acceptable; monitor if healthchecks disappear after misconfiguration.

---

## 7. Database: RLS vs service role

- **RLS:** Present across many migrations (`001`–`044` and others); policies typically scope by `organization_id` and membership.
- **Service role:** Application uses `createAdminClient()` widely — **RLS does not apply**. Security depends on **route-level org and role checks**.
- **Recommendation:** Periodically audit new migrations for tables that might be exposed via PostgREST anon key; ensure policies exist or access is disabled for those tables.

---

## 8. Web headers, CSP, CSRF

- **[`next.config.ts`](next.config.ts):** CSP (including `script-src 'self' 'unsafe-inline'` in production — common for Next.js), `Content-Security-Policy-Report-Only` stricter variant, HSTS on Vercel, `X-Frame-Options`, COOP/CORP, `Referrer-Policy`, `Permissions-Policy`.
- **CSRF:** JSON API usage and same-site cookies reduce classic CSRF; **browser `fetch` to `/api/*` from the app origin** relies on cookies + SameSite. **Recommendation:** Confirm Supabase cookie `SameSite` settings in project dashboard match product threat model for cross-site scenarios.
- **API routes:** No CSRF token pattern — acceptable for JSON APIs if cookies are `SameSite=Lax` or `Strict` and sensitive actions avoid cross-site form posts.

---

## 9. Operations and supply chain

- **Dependabot:** [`.github/dependabot.yml`](.github/dependabot.yml) — npm weekly, GitHub Actions monthly.
- **CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — `npm audit --audit-level=high`, lint, typecheck, tests, build, Playwright; optional `runtime_comprehensive_pass` when secrets present.
- **Crons:** [`vercel.json`](vercel.json) — paths must stay aligned with handlers that enforce `CRON_SECRET` (or feature-specific cron auth).
- **Scripts:** [`scripts/cron-canary.mjs`](scripts/cron-canary.mjs), [`scripts/comprehensive-pass.mjs`](scripts/comprehensive-pass.mjs) — use env for URLs/secrets; avoid committing credentials.

---

## 10. Infrastructure checklist (outside repo)

Complete the sweep with a short manual pass (copy this list into your release ticket; check off with owner + date):

- [ ] Supabase: Auth redirect URLs, email templates, leaked password protection, MFA policy.
- [ ] Supabase: Storage bucket **public/private** flags and RLS for storage objects.
- [ ] Vercel: Environment variables for production vs preview; secret rotation process; preview envs do not inherit production secrets unintentionally.
- [ ] Stripe: Webhook endpoint URL and signing secret rotation.
- [ ] DNS / TLS: Certificates and HSTS preload eligibility.
- [ ] Inbound automation: `INBOUND_AUTOMATION_ORG_ALLOWLIST` and/or per-route inbound tokens set where multi-tenant risk warrants it.

---

## 11. Prioritized findings register

| ID | Severity | Category | Title | Remediation / tests |
|----|----------|----------|--------|----------------------|
| F1 | High (mitigated) | Secrets | V5 external crypto dev fallback in production | **Code:** fail fast in production-like env when no pepper secrets set. Covered by [`src/lib/v5/api.external.test.ts`](src/lib/v5/api.external.test.ts). |
| F2 | Medium (mitigated) | SSRF | Unvalidated `CRON_HEALTHCHECK_URL` | **Code:** validate URL before `fetch`. |
| F3 | Low (mitigated) | Ops | No OSV/gitleaks in CI | **Addressed:** OSV + Gitleaks + Semgrep in [`ci.yml`](.github/workflows/ci.yml) (`quality_security`). |
| F4 | Medium | AuthZ | Service role bypasses RLS | Ongoing code review + org filters on every admin query; baseline org-scope assertions in [`src/app/api/security-org-scope-queries.test.ts`](src/app/api/security-org-scope-queries.test.ts). |
| F5 | Low (mitigated) | Ops | Single `INBOUND_AUTOMATION_TOKEN` for multiple integrations | **Partially addressed:** optional `INBOUND_AUTOMATION_ORG_ALLOWLIST` + per-route tokens in [`inbound-automation-token.ts`](src/lib/security/inbound-automation-token.ts); still use rotation, IP allowlisting if available, monitoring. |
| F6 | Informational | Web | CSP `unsafe-inline` scripts | Accept Next.js tradeoff; avoid new HTML sinks. |

---

## 12. Test recommendations

- Baseline: external action submit/status, cron unauthorized 401 (e.g. v5 campaign-progress), v5 external crypto production missing-env behavior—see [`api.external.test.ts`](src/lib/v5/api.external.test.ts) and route tests under `src/app/api/`.
- Org isolation: [`security-org-scope-queries.test.ts`](src/app/api/security-org-scope-queries.test.ts) for representative `organization_id`-scoped queries.
- Keep Playwright smoke tests for authenticated flows; ensure secrets stay in CI only.

---

*Generated as part of the comprehensive security sweep implementation.*
