# Oblixa

**Oblixa** is a contract execution platform for post-signature operations: turning signed agreements into tracked work, deadlines, approvals, obligations, evidence, and audit-ready reporting. Built for small B2B teams with tens to a few hundred active contracts.

**V4** is the execution layer in the codebase: tasks, obligations, approvals, renewals, exceptions, programs, report packs, and `/api/cron/v4/*` automation. Module toggles use `ENABLE_V3_*` in [`.env.example`](.env.example) (legacy names); when unset or empty, modules default to **on**.

**V5** adds the control plane: decision workspaces, portfolio campaigns, simulation/intelligence, relationship summaries, external action links, and control-room nav. It uses `ENABLE_V5_*` in [`.env.example`](.env.example) (default **on** when unset).

**V6** adds continuous assurance and adaptive operations: control policies, assurance findings, scorecards, health graph, adaptive playbooks, safe autopilot, review boards, segment rollups, and outcome intelligence. It uses `ENABLE_V6_*` in [`.env.example`](.env.example) (default **on** when unset). Workspace **mode** (Core, Advanced, Assurance) and related org settings live in `organizations.v6_org_settings_json` (see migration `053_v6_workspace_product_mode.sql`).

**Product surfaces (refinement):** Navigation, command palette entries, and dashboard exposure are gated by workspace mode and enforced in code under `src/lib/product-surface/` (including `refinement-contract.test.ts`). Expectations for API security, performance, and UI are summarized in [AGENTS.md](AGENTS.md).

## Tech stack

| Layer | Tool |
|-------|------|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| Hosting | Vercel |
| Auth, database, storage | Supabase |
| Payments | Stripe |
| Email | Resend |
| AI extraction | OpenAI (schema-constrained) |

## Prerequisites

- **Node.js** ≥ 20 LTS (`node --version`)
- **npm** ≥ 10 (`npm --version`)
- Accounts on **Supabase**, **Stripe**, **Resend**, and **Vercel**

## Getting started

```bash
# 1. Clone and enter the repo
git clone https://github.com/3y5od/oblixa.git
cd oblixa

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env.local
# Then open .env.local and fill in real values (see below)

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` → `.env.local` and fill in values from each service dashboard.

| Variable | Where to find it | Client-safe? |
|----------|-----------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page | Yes (with RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page | **No** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys | Yes |
| `STRIPE_SECRET_KEY` | Same page | **No** |
| `STRIPE_PRICE_ID` | Stripe product's recurring price id | **No** |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks | **No** |
| `RESEND_API_KEY` | Resend → API Keys | **No** |
| `EMAIL_FROM` | Verified sender in Resend | N/A |
| `OPENAI_API_KEY` | OpenAI → API keys | **No** |
| `NEXT_PUBLIC_APP_URL` | Your app's base URL | Yes |

## Security

- **Contributor checklist:** [AGENTS.md](AGENTS.md) — authenticate every `route.ts`, scope service-role queries by org, tests for auth/IDOR regressions, inbound automation tokens, Sentry scrubbing.
- **Quarterly / full sweeps:** `npm run security:sweep:quarterly` and `npm run security:sweep:full` (regenerate security reports + static greps; full adds lint, typecheck, and tests).
- **Generated reports:** `npm run report:security-docs` writes Markdown under `docs/` (for example `SECURITY_API_ROUTE_COVERAGE.md`). Run before major reviews or attach artifacts in your release process.
- **Static checks:** `npm run check:security-static` and `:strict` — `npm audit` plus repository greps. `npm run verify:security` runs an extended security-only script chain (cron auth, rate limits, env parity, workflow patterns, etc.).
- **API route tests:** `npm run check:api-route-tests` (also part of `verify`).

## Performance

- **Automation:** `npm run check:performance-static` / `check:performance-static:grep` ([scripts/performance-static-audit.mjs](scripts/performance-static-audit.mjs)); stricter variant `check:performance-static:strict` (used in CI); `npm run perf:sweep:quarterly` / `perf:sweep:full`; bundle review with `npm run analyze`.
- **Custom Semgrep:** [semgrep/oblixa-performance.yml](semgrep/oblixa-performance.yml) alongside [semgrep/oblixa-security.yml](semgrep/oblixa-security.yml) and [semgrep/oblixa-v7-surface.yml](semgrep/oblixa-v7-surface.yml) in CI.

## Available scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checks |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright smoke tests |
| `npm run test:scripts` | Smoke tests for selected `scripts/*.mjs` helpers |
| `npm run check:migrations` | Fail on duplicate migration prefixes |
| `npm run check:security-static` | `npm audit` + risky-pattern greps under `src/` |
| `npm run check:security-static:strict` | Stricter audit level + failing greps |
| `npm run report:security-api-coverage` | Write API route vs test coverage to `docs/SECURITY_API_ROUTE_COVERAGE.md` |
| `npm run report:security-docs` | Regenerate all security Markdown reports under `docs/` |
| `npm run check:cron-canary` | Probe cron routes on `COMPREHENSIVE_PASS_BASE_URL` (needs `CRON_SECRET`) |
| `npm run check:comprehensive-pass` | Staging-style cron + migration + RLS checks (see `.env.example`) |
| `npm run preflight:release` | Validate required release env vars |
| `npm run release:checklist` | Preflight + verify, then `next start` on port 3000 → comprehensive pass (localhost) → Playwright reusing that server |
| `npm run verify` | Migrations, API route tests, server actions, V7 surface suite, Vercel cron alignment, QA/refinement checks, copy/UI audits, lint, typecheck, coverage thresholds, build |
| `npm run verify:security` | Extended security static checks (rate limits, cron auth, env parity, workflows, etc.) + lint, typecheck, tests |
| `npm run check:api-route-tests` | Fail if an API route has no colocated test and is not allowlisted |
| `npm run test:coverage` | Vitest with coverage thresholds on selected libraries (see `vitest.config`) |
| `npm run audit:moderate` | Full `npm audit` (includes moderate/low; CI only fails high+) — use for periodic review |
| `npm run sbom` | Write CycloneDX `cyclonedx-sbom.json` from the lockfile (gitignored). May print `npm ls` peer warnings; the generator uses `--ignore-npm-errors` so a typical tree still produces a file. |
| `npm run check:performance-static` | Performance-oriented greps under `src/` |
| `npm run check:performance-static:strict` | Stricter performance static audit (CI) |
| `npm run check:performance-static:grep` | WARN-only optional fast path |
| `npm run perf:sweep:quarterly` | Full performance static audit + production `build` |
| `npm run perf:sweep:full` | Quarterly sweep + `lint` + `typecheck` + `test` + `analyze` |
| `npm run analyze` | Webpack bundle analyzer report (`ANALYZE=true next build`) |

## CI quality gate

CI splits work across parallel jobs; the **`quality`** job passes only when all of them succeed:

1. **`quality_static`** — `npm audit` (high+), strict security greps (no full audit in this step), workflow and PWA checks, env parity, onboarding matrix, server-admin allowlist, secrets hygiene, **strict** performance static audit, QA loading/route/bug-log checks, refinement acceptance commands, migrations, API route tests, server action exports, rate-limit and cron-auth checks, workspace API eligibility, V7 href and vocabulary audits, route inventory, plan IA, refinement API coverage, outbound/copy audits, Vercel cron alignment, ESLint, TypeScript.
2. **`quality_unit`** — `npm run test:coverage`
3. **`quality_security`** — Semgrep (including Oblixa rule packs), OSV scanner, Gitleaks
4. **`quality_build_e2e`** — `npm run build` and `npm run test:e2e` (requires `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` repository secrets; includes accessibility checks)

Optional jobs: **`runtime_comprehensive_pass`** against staging when the relevant GitHub secrets are set; **`quality_e2e_onboarding_full`** when `E2E_ONBOARDING_FULL` is set (deeper onboarding + multi-browser).

**GitHub green is not the same as production-ready:** `preflight:release` and a staging comprehensive pass use real secrets and are still manual steps before a sensitive cutover. Dependency updates are proposed weekly via Dependabot (`.github/dependabot.yml`).

**Branch protection:** require the workflow’s **`quality`** job (or equivalent) on the default branch so CI matches what you merge. **Fork PRs** often cannot use E2E secrets—plan reviews accordingly.

## Release operations

See [CHANGELOG.md](CHANGELOG.md) for user-facing release notes. Long-form runbooks that used to live under `docs/` may be recovered from git history if you still need them.

Playwright e2e expects a stable deployment target (`PLAYWRIGHT_BASE_URL`) when not running against a local preview.

Authenticated e2e smoke uses repository secrets (not available to workflows from forked PRs in the default GitHub security model):

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

Optional refinement and multi-workspace scenarios are documented in `.env.example` and [AGENTS.md](AGENTS.md) (for example `E2E_REFINEMENT_*`, `E2E_ADVANCED_*`, `E2E_ASSURANCE_*`).

## Project structure

```
src/
└── app/          # Next.js App Router pages, layouts, and route handlers
e2e/             # Playwright specs and shared path matrices
public/          # Static assets (including `.well-known` where applicable)
scripts/         # CI helpers, audits, and release checks
semgrep/         # Custom Semgrep rules (security, performance, V7 surface)
supabase/        # Migrations and local Supabase config
docs/            # Optional generated reports (e.g. security coverage) or local notes
```

## Deployment (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in Vercel → Settings → Environment Variables.
4. Deploy.
5. Add the production URL to Supabase Auth redirect URLs and Stripe webhook endpoints (match dashboard settings to your deployment URL).
