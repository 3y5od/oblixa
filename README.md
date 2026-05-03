# Oblixa

Oblixa is a contract operations platform for turning signed agreements into tracked work, deadlines, approvals, evidence, and audit-ready reporting.

## Platform layers

- **V4** is the execution layer: tasks, obligations, approvals, renewals, exceptions, programs, report packs, and `/api/cron/v4/*` automation.
- **V5** adds decision and collaboration controls: decisions, campaigns, simulations, relationships, external action links, and control-room workflows.
- **V6** adds assurance and adaptive operations: control policies, findings, scorecards, health graphs, playbooks, safe autopilot, review boards, segments, and outcome intelligence.
- **Workspace mode** governs discoverability across Core, Advanced, and Assurance. The setting lives in `organizations.v6_org_settings_json`.

## Tech stack

| Layer | Tooling |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Auth, database, storage | Supabase |
| Payments | Stripe |
| Email | Resend |
| AI extraction | OpenAI |
| Hosting | Vercel |
| Tests | Vitest, Playwright, Semgrep |

## Quick start

1. Install Node.js 20+ and npm 10+.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill in the provider keys needed for your workflow.
5. Start the app with `npm run dev`.
6. Run `npm run check:quick` before opening a PR.

The local app runs on [http://localhost:3000](http://localhost:3000) by default.

## Environment notes

- `NEXT_PUBLIC_*` values are embedded in the client bundle. Never put secrets there.
- Release-style validation additionally requires `CRON_SECRET`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `OPENAI_API_KEY`.
- Authenticated Playwright lanes use `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`.
- The authoritative reference for local, CI, and staging variables is `.env.example` at the repository root.

## Common commands

| Command | Use |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run check:quick` | Fast local gate: migrations, API route coverage, lint, typecheck, tests |
| `npm run verify` | Full verification pipeline used before higher-confidence merges |
| `npm run verify:security` | Security-focused pipeline and reports |
| `npm run check:v8-suite` | Product-surface, routing, vocabulary, and eligibility suite |
| `npm run test:e2e:smoke` | Fast authenticated/public Playwright smoke |
| `npm run test:e2e:a11y` | Playwright accessibility lanes |
| `npm run test:e2e:visual:full:update` | First-time or OS-specific visual baselines: public + authenticated surfaces with `--update-snapshots` (needs `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` for the second half) |
| `npm run test:e2e:visual:full:continue` | Run authenticated visual specs even when the public phase fails (baseline drift); exit status follows the second phase |
| `npm run check:comprehensive-pass` | Runtime cron, migration, and RLS checks against a target environment |
| `npm run preflight:release` | Validate release env and run release-adjacent static gates |
| `npm run release:checklist` | Preflight, verify, runtime comprehensive pass, and Playwright |

## Contributing

- Automation and agent contributors should follow the Cursor rules under `.cursor/rules/`.
- Human contributors should run `npm run check:quick` before opening a PR and `npm run verify` when the change touches routing, security-sensitive code, or release paths.

## CI

GitHub Actions fans out into:

- `quality_static_security`
- `quality_static_surface`
- `quality_static_governance`
- `quality_static_codehealth`
- `quality_unit`
- `quality_security`
- `quality_build_e2e`

The aggregate `quality` job is the branch-protection target. Optional jobs such as `runtime_comprehensive_pass` and `quality_e2e_onboarding_full` run only when the required secrets are present.

## Project structure

```text
src/         Next.js app, route handlers, UI, and domain logic
e2e/         Playwright specs, fixtures, and route matrices
scripts/     CI pipelines, audits, reports, and release helpers
semgrep/     Custom Semgrep rules for security, performance, and surface policies
supabase/    Migrations and local Supabase configuration
public/      Static assets and well-known files
```

## Deployment

1. Push the branch to GitHub.
2. Import the repo into Vercel.
3. Add the required environment variables from `.env.example`.
4. Deploy.
5. Update Supabase auth redirects, Stripe webhooks, and any cron/callback destinations to match the deployed URL.

Contributors touching dashboard composition, navigation, command palette behavior, or workspace visibility should align with the team's surface conventions and run `npm run check:v8-suite`.
