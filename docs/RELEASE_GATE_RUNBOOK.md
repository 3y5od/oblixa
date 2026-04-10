# Release gate runbook

Use this checklist before merging risky changes or tagging a release. Commands assume repository root.

## Standard local gate (`npm run verify`)

Runs, in order:

1. `npm run check:migrations` — migration filename prefix consistency  
2. `npm run check:api-route-tests` — every `route.ts` has a test or allowlist entry  
3. `npm run check:vercel-cron` — scheduled paths match documented cron routes  
4. `npm run lint`  
5. `npm run typecheck`  
6. `npm run test:coverage` — Vitest with coverage  
7. `npm run build` — production Next.js build  

**When to use:** Default pre-merge / pre-release gate for application code.

## Security pass (full checklist + automation)

- **Human checklist:** [SECURITY_PASS_CHECKLIST.md](./SECURITY_PASS_CHECKLIST.md) (A–U; Owner / Frequency / Evidence).
- **API route test coverage map:** [SECURITY_API_ROUTE_COVERAGE.md](./SECURITY_API_ROUTE_COVERAGE.md) — regenerate with `npm run report:security-api-coverage` before major releases.
- **Static audit (npm audit + risky-pattern greps):**

```bash
npm run check:security-static
npm run check:security-static:strict
```

**When to use:** Security-focused releases, dependency bumps, or before external review. Complements `verify` (still run `check:api-route-tests` via `verify`).

## UI operational audit (strict)

```bash
npm run audit:ui-operational:strict
```

**When to use:** After dashboard or token/layout refactors (complements `verify`, not a substitute for `build`).

## Bundle analysis

```bash
npm run analyze
```

See [BUNDLE_ANALYSIS.md](./BUNDLE_ANALYSIS.md) for interpretation (Turbopack vs webpack analyzer output).

**When to use:** After adding large client dependencies or chart/PDF UI—not every PR.

## End-to-end (credentials required)

```bash
npm run test:e2e
```

Requires a running app (e.g. `npm run dev` or preview URL) and `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` where tests are authenticated.

**When to use:** Before release or after changing auth, navigation, or critical flows covered under `e2e/`.

## Comprehensive pass (staging / production-like)

```bash
npm run check:comprehensive-pass
```

This script expects **real infrastructure**: reachable base URL (`COMPREHENSIVE_PASS_BASE_URL` or fallback), Supabase service role, and related secrets. It probes live routes and migration alignment.

**When to use:** Staging sign-off or post-deploy validation—not typical local dev.

## Release env sanity

```bash
npm run preflight:release
```

Validates required production-style environment variables (Stripe, Resend, cron secret, etc.). See [`scripts/release-preflight.mjs`](../scripts/release-preflight.mjs).

**When to use:** Before production deploy or when debugging “works locally, fails in prod.”

## Sentry releases

Correlate errors with deploys by setting release metadata. See comments in [`.env.example`](../.env.example) (`SENTRY_RELEASE`, `NEXT_PUBLIC_SENTRY_RELEASE`, or rely on `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA`). Server helper: [`getSentryRelease()`](../src/lib/observability/sentry-release.ts).

## Related docs

- [PERFORMANCE_RSC.md](./PERFORMANCE_RSC.md) — server component data-fetch patterns  
- [DB_PERFORMANCE.md](./DB_PERFORMANCE.md) — evidence-driven indexes  
- [AGENTS.md](../AGENTS.md) — API auth and org-scope expectations  
