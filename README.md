# Contract Operations Tracker

Centralizes client agreements, extracts key operational fields with source citations, and surfaces upcoming actions through dashboards and email reminders. Built for small B2B service firms with 20–200 active contracts.

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
git clone https://github.com/3y5od/contract-operations-tracker.git
cd contract-operations-tracker

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
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checks |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright smoke tests |
| `npm run check:migrations` | Fail on duplicate migration prefixes |
| `npm run preflight:release` | Validate required release env vars |
| `npm run release:checklist` | Run preflight + verify + e2e |
| `npm run verify` | Run migration check + lint + typecheck + tests + production build |

## CI quality gate

The default CI workflow runs:

1. `npm run check:migrations`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `npm run test:e2e` (includes accessibility checks)

## Release operations

Use `docs/RELEASE_RUNBOOK.md` for release, rollback, and key-rotation procedures.

Playwright e2e still expects a stable deployment target (`PLAYWRIGHT_BASE_URL`) when not running against a local preview.

Optional authenticated e2e smoke uses:

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

## Project structure

```
src/
└── app/          # Next.js App Router pages, layouts, and route handlers
public/           # Static assets
```

## Deployment (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in Vercel → Settings → Environment Variables.
4. Deploy.
5. Add the production URL to Supabase Auth redirect URLs and Stripe webhook endpoints.
