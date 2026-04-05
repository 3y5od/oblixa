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

- **Node.js** ≥ 22 LTS (`node --version`)
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
