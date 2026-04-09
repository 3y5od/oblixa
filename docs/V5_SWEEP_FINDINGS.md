# V5 implementation sweep — findings (2026-04-09)

Operator summary of the repo sweep against [v5_implementation_traceability.md](v5_implementation_traceability.md) and the attached sweep plan. Re-run after major V5 changes.

## Migrations

- Local check: `npm run check:migrations` — **passed** (48 migration files, ordered).
- Apply order for V5: `044_v5_control_plane_foundation.sql` → `045_v5_external_link_decision_scope.sql` → `046_v5_decision_type_api_alignment.sql`.
- [V5_RELEASE_RUNBOOK.md](V5_RELEASE_RUNBOOK.md) updated to include **046** (decision_type backfill + CHECK alignment with `src/lib/v5/decision-types.ts`).
- Remote environments (staging/production): confirm applied via Supabase migration history; this document does not replace that check.

## Feature flag matrix (automated)

- New test: [src/lib/v5/v5-flag-matrix.test.ts](../src/lib/v5/v5-flag-matrix.test.ts) — for each `ENABLE_V5_*`, with all others stubbed to on, asserts `isFeatureEnabled` off for that key, `requireV5ApiFeature` → 403 for API-guarded keys, and `requireV5CronFeature` → `{ ok: true, skipped: true }` for each cron-used flag.
- `v5ControlRoomUx` is not checked by `requireV5ApiFeature` in app code (dashboard + page asserts only); the matrix still verifies env parsing for that key.
- External token routes now use `requireV5ApiFeature("v5ExternalCollaboration")` for the same 403 body as other V5 APIs.

## API walkthrough (automated)

- Vitest bundles for decisions, campaigns, simulations, intelligence, external-actions, accounts/counterparties summaries, capacity: **66 tests passed** in the sweep run (plus additional files when running full `npm run test`).
- `GET /api/intelligence/recommendations` is covered in [src/app/api/intelligence/v5-intelligence-routes.test.ts](../src/app/api/intelligence/v5-intelligence-routes.test.ts) (403 + shape normalization).

## Cron canary and comprehensive pass

- Both scripts require **`COMPREHENSIVE_PASS_BASE_URL`**, **`CRON_SECRET`**, and (for comprehensive-pass) Supabase keys per script. [scripts/cron-canary.mjs](../scripts/cron-canary.mjs) loads `.env.local` via `loadEnvConfig` (same as comprehensive-pass). Latest run: see **Deep debugging sweep** below.
- When staging credentials exist, run both scripts; cron JSON shape expectations live in a single module: [scripts/cron-route-expected-keys.mjs](../scripts/cron-route-expected-keys.mjs) (imported by comprehensive-pass and cron-canary).
- After exercising closes, recommendation PATCH, and crons, validate `org_behavior_metrics.v5_signal_quality_json` keys per [V5_RELEASE_RUNBOOK.md](V5_RELEASE_RUNBOOK.md).

## UI / IA

- **Public external page:** [`src/proxy.ts`](../src/proxy.ts) now treats `/external/*` like other unauthenticated-safe surfaces so anonymous participants are not redirected to `/login`. This fixes the “V5 external page” Playwright check.
- **Automated:** `npx playwright test e2e/v5-surfaces.spec.ts` — external form test **passed** in sweep; authenticated blocks still skip without `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; optional `E2E_ACCOUNT_KEY` / `E2E_COUNTERPARTY_KEY` for relationship detail smoke.
- **Manual (staging):** confirm sidebar + command palette respect `v5FlagsAnyOf`, control-room strip on `/dashboard` with `ENABLE_V5_CONTROL_ROOM_UX`, contract detail relationship links when keys are populated.

## Test coverage additions

- [src/app/api/campaigns/[id]/lifecycle-routes.test.ts](../src/app/api/campaigns/[id]/lifecycle-routes.test.ts) — feature-off **403** for `preview`, `start`, `pause`, `resume`, `close` (parity with rollback/export guard tests).

## Documentation drift resolved

- Traceability §9.7: replaced “packet refresh cron” with on-demand `POST /api/decisions/[id]/packet` wording in [v5_implementation_traceability.md](v5_implementation_traceability.md).
- Phase 6 gate: nav expectations updated for flag-gated **Relationships** in [v5_phase_gated_delivery.md](v5_phase_gated_delivery.md).

## §9–11 full alignment sweep (implementation pass)

- Trace matrix: [v5_strategy_9_11_matrix.md](v5_strategy_9_11_matrix.md) (strategy §9–11 ↔ code).
- Local: `npm run typecheck` and `npm run test` — run after changes; comprehensive-pass/cron-canary still need `COMPREHENSIVE_PASS_BASE_URL` + secrets when available.

## Deep debugging sweep (CI + audit, 2026-04-09)

- **Automated gates:** `npm run check:migrations`, `lint`, `typecheck`, `vitest` (123 files / 358 tests), `next build`, and Playwright — **all passed**. E2E specs that require `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` were **skipped** (expected when those are unset).
- **npm audit** (`--audit-level=high`): **0 vulnerabilities**.
- **Structured audit:** Every V5 cron route under `src/app/api/cron/v5/` uses `requireV5CronAuth`; external-actions routes use `requireV5ApiFeature("v5ExternalCollaboration")` plus session or token validation as designed. `CRON_ROUTE_EXPECTED_KEYS` is defined once in [scripts/cron-route-expected-keys.mjs](../scripts/cron-route-expected-keys.mjs).
- **Change in this sweep:** [scripts/cron-canary.mjs](../scripts/cron-canary.mjs) loads env via `@next/env` `loadEnvConfig` (same pattern as comprehensive-pass). [scripts/cron-route-expected-keys.mjs](../scripts/cron-route-expected-keys.mjs) holds the shared `CRON_ROUTE_EXPECTED_KEYS` map so comprehensive-pass and cron-canary cannot drift.
- **Runtime scripts:** `npm run check:cron-canary` and `npm run check:comprehensive-pass` completed successfully against the configured `COMPREHENSIVE_PASS_BASE_URL`. V5 cron paths logged **WARN** (route unavailable / 404 on target) while legacy crons passed — treat as **deployment surface** (e.g. target not yet serving V5 cron routes). Comprehensive pass also **WARN** on remote migration head when Supabase schema introspection fails; local migration head was **48**.

## Deferred product depth (not bugs)

- Per [v5_spec_backlog.md](v5_spec_backlog.md): PDF/signed packet export, richer manager-review flows, etc., remain future scope; JSON packet download is v1.
