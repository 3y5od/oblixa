# Oblixa

**Oblixa** is a contract execution platform for post-signature operations: turning signed agreements into tracked work, deadlines, approvals, obligations, evidence, and audit-ready reporting. Built for small B2B teams with tens to a few hundred active contracts.

**V4** is the execution layer in the codebase: tasks, obligations, approvals, renewals, exceptions, programs, report packs, and `/api/cron/v4/*` automation. Module toggles use `ENABLE_V3_*` in [`.env.example`](.env.example) (legacy names); when unset or empty, modules default to **on**.

**V5** adds the control plane: decision workspaces, portfolio campaigns, simulation/intelligence, relationship summaries, external action links, and control-room nav. It uses `ENABLE_V5_*` in [`.env.example`](.env.example) (default **on** when unset). Operator steps: [docs/V5_RELEASE_RUNBOOK.md](docs/V5_RELEASE_RUNBOOK.md) and [docs/v5_phase_gated_delivery.md](docs/v5_phase_gated_delivery.md). Product intent: [docs/oblixa_v5_strategy_spec.md](docs/oblixa_v5_strategy_spec.md).

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
| `npm run check:migrations` | Fail on duplicate migration prefixes |
| `npm run check:cron-canary` | Probe cron routes on `COMPREHENSIVE_PASS_BASE_URL` (needs `CRON_SECRET`) |
| `npm run check:comprehensive-pass` | Staging-style cron + migration + RLS checks (see `.env.example`) |
| `npm run preflight:release` | Validate required release env vars |
| `npm run release:checklist` | Preflight + verify, then `next start` on port 3000 → comprehensive pass (localhost, validates V5 crons) → Playwright reusing that server |
| `npm run verify` | Migration + API route test inventory + cron alignment + lint + typecheck + tests + coverage + build |
| `npm run check:api-route-tests` | Fail if an API route has no colocated test and is not allowlisted |
| `npm run test:coverage` | Vitest with coverage thresholds on `src/lib/v5`, `src/lib/security`, `src/lib/observability`, and `src/lib/stripe.ts` |
| `npm run audit:moderate` | Full `npm audit` (includes moderate/low; CI only fails high+) — use for periodic review |
| `npm run sbom` | Write CycloneDX `cyclonedx-sbom.json` from the lockfile (gitignored). May print `npm ls` peer warnings; the generator uses `--ignore-npm-errors` so a typical tree still produces a file. |

## CI quality gate

The default CI workflow runs:

1. `npm run check:migrations` and `npm run check:api-route-tests`
2. `npm run check:vercel-cron`
3. `npm audit` (high or worse fails the job)
4. ESLint and TypeScript
5. `npm run test` and `npm run test:coverage`
6. Semgrep, OSV scanner, and Gitleaks (same gate as unit tests)
7. `npm run build` and `npm run test:e2e` (includes accessibility checks)

An optional job runs `npm run check:comprehensive-pass` against staging when the relevant GitHub secrets are set.

**GitHub green is not the same as production-ready:** `preflight:release` and a staging comprehensive pass use real secrets and are still manual steps before a sensitive cutover. Dependency updates are proposed weekly via Dependabot (`.github/dependabot.yml`).

**Branch protection:** require the workflow’s **`quality`** job (or equivalent) on the default branch so CI matches what you merge. **Fork PRs** often cannot use E2E secrets—see [docs/V5_RELEASE_RUNBOOK.md](docs/V5_RELEASE_RUNBOOK.md) (CI gates vs production readiness).

## Release operations

See [CHANGELOG.md](CHANGELOG.md) for user-facing release notes. Use [docs/V5_RELEASE_RUNBOOK.md](docs/V5_RELEASE_RUNBOOK.md) for V5 migrations, feature flags, cron auth, and rollback. Production cutover checklist prose (DNS, Supabase, Stripe, redirects) may live in your internal wiki; recover retired repo copies from git history if needed.

Playwright e2e expects a stable deployment target (`PLAYWRIGHT_BASE_URL`) when not running against a local preview.

Optional authenticated e2e smoke uses repository secrets (not available to workflows from forked PRs in the default GitHub security model):

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

## Project structure

```
src/
└── app/          # Next.js App Router pages, layouts, and route handlers
public/           # Static assets
docs/             # V5 spec, runbooks, API/traceability docs
```

## Deployment (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in Vercel → Settings → Environment Variables.
4. Deploy.
5. Add the production URL to Supabase Auth redirect URLs and Stripe webhook endpoints (match dashboard settings to your deployment URL).
