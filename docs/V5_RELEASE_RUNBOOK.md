# Oblixa V5 release and operations runbook

Single operator-facing guide for shipping and running the **V5 control plane** (decisions, campaigns, intelligence, relationship layer, external links, control-room UX) alongside the existing **V4 execution** surface.

## Related documents

| Document | Purpose |
|----------|---------|
| [v5_phase_gated_delivery.md](v5_phase_gated_delivery.md) | Phase-by-phase feature flags, gate checks, rollback |
| [v5_implementation_traceability.md](v5_implementation_traceability.md) | Spec sections mapped to code and tests |
| [v5_api_contract_sequence.md](v5_api_contract_sequence.md) | API path inventory |
| [oblixa_v5_strategy_spec.md](oblixa_v5_strategy_spec.md) | Product and architecture intent |
| [v5_relationship_keys.md](v5_relationship_keys.md) | Populating `account_key` / `counterparty_key` for the relationship layer |
| [v5_spec_backlog.md](v5_spec_backlog.md) | Phased product-depth backlog vs strategy spec §9–§17 |
| [V5_SWEEP_FINDINGS.md](V5_SWEEP_FINDINGS.md) | Latest repo sweep results (migrations, tests, cron/E2E notes) |

## Database migrations

Apply **in numeric order** on every environment (local, staging, production):

1. All prior migrations through `043_*` (or current head before V5).
2. **`044_v5_control_plane_foundation.sql`** — V5 tables, RLS, indexes, additive columns on V4 tables.
3. **`045_v5_external_link_decision_scope.sql`** — external link decision scope + passcode column + backfill.
4. **`046_v5_decision_type_api_alignment.sql`** — backfill legacy `decision_type` values and replace the `decision_workspaces` CHECK constraint to match [`src/lib/v5/decision-types.ts`](../src/lib/v5/decision-types.ts) (API/UI allowlist).
5. **`047_v5_decision_packet_artifacts.sql`** — packet artifact linkage columns.
6. **`048_v5_decision_packet_artifact_depth.sql`** — packet PDF path + report-pack linkage columns.

**Rules:** migrations are additive and idempotent where written that way; do not drop V4 tables or columns during V5 rollout.

**Verify:** `npm run check:migrations` in CI; on staging, run Supabase migration apply and smoke org-scoped reads. `npm run check:comprehensive-pass` also probes member RLS reads on `decision_workspaces` and `portfolio_campaigns` when `COMPREHENSIVE_PASS_*` envs are set.

## Feature flags (`ENABLE_V5_*`)

Defined in [`.env.example`](../.env.example) and parsed in [`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts).

| Env variable | Phase (see phase-gated doc) |
|--------------|------------------------------|
| `ENABLE_V5_DECISION_FOUNDATION` | 1 |
| `ENABLE_V5_PORTFOLIO_CAMPAIGNS` | 2 |
| `ENABLE_V5_SIMULATION_AND_INTELLIGENCE` | 3 |
| `ENABLE_V5_RELATIONSHIP_LAYER` | 4 |
| `ENABLE_V5_EXTERNAL_COLLABORATION` | 5 |
| `ENABLE_V5_CONTROL_ROOM_UX` | 6 |

**Default:** unset or empty means **on** (same as V3 module flags). Set to `false`, `0`, `no`, or `off` to disable.

**Rollback:** disable the relevant flag; V4 routes and data remain available per [v5_phase_gated_delivery.md](v5_phase_gated_delivery.md).

## Scheduled jobs (Vercel)

V5 cron routes live under `/api/cron/v5/*` and are registered in [`vercel.json`](../vercel.json). Each handler checks the matching flag via `requireV5CronFeature` and returns `{ ok: true, skipped: true }` when disabled.

**Auth:** callers must supply `CRON_SECRET` (see `.env.example`). Before production enablement, run `npm run check:cron-canary` or your staging equivalent against `COMPREHENSIVE_PASS_BASE_URL` with the same secret.

| Path | Typical flag |
|------|----------------|
| `/api/cron/v5/campaign-progress` | Portfolio campaigns |
| `/api/cron/v5/simulation-snapshots` | Simulation and intelligence |
| `/api/cron/v5/capacity-forecast-refresh` | Simulation and intelligence |
| `/api/cron/v5/portfolio-risk-recompute` | Simulation and intelligence |
| `/api/cron/v5/external-followup` | External collaboration |
| `/api/cron/v5/decision-sla-monitor` | Decision foundation |
| `/api/cron/v5/recommendation-refresh` | Simulation and intelligence |
| `/api/cron/v5/relationship-rollups` | Relationship layer |

V4 crons under `/api/cron/v4/*` are unchanged; keep them enabled per your existing operations.

## V5 success metrics in SQL

Aggregated counters are merged into `org_behavior_metrics.v5_signal_quality_json` (numeric keys only, no free-text PII). Rows are keyed by **`metrics_date`** (UTC date). Inspect in the Supabase SQL editor or any read replica:

```sql
select metrics_date, v5_signal_quality_json
from org_behavior_metrics
where organization_id = '<org_uuid>'
order by metrics_date desc
limit 14;
```

Example keys written by the app:

- **User actions:** `v5_recommendation_accepted`, `v5_recommendation_dismissed`, `v5_decisions_closed`, `v5_campaigns_closed`
- **Cron / automation ticks:** `v5_campaign_progress_cron_updates` (count of campaign rows refreshed in that run), `v5_capacity_forecast_cron_runs`, `v5_recommendation_refresh_cron_runs`

Audit trail for recommendation actions also uses `audit_events.action` values `v5.recommendation.accepted` and `v5.recommendation.dismissed`.

## Preflight before each deploy

1. `npm run typecheck`
2. `npm run test` (or focused Vitest for touched V5 routes)
3. `npm run lint` on changed files
4. Confirm `CRON_SECRET` is set in Vercel for environments that receive cron traffic
5. `npm run check:comprehensive-pass` when staging secrets are configured (required for full V5 readiness sign-off)

## CI gates vs production readiness

**What “green CI” means:** the default workflow (`.github/workflows/ci.yml`) runs static checks, Vitest with coverage thresholds, Semgrep, OSV, Gitleaks, production `next build`, and Playwright (with authenticated smoke when `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` repository secrets are set).

**Branch protection:** configure the default branch to **require the `quality` job** (or the full workflow conclusion) so merges cannot bypass the same checks developers see on pull requests.

**Staging comprehensive pass:** a **separate** job `runtime_comprehensive_pass` runs `npm run check:comprehensive-pass` against `STAGING_BASE_URL` only when **all** of these repository secrets are non-empty: `STAGING_BASE_URL`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `COMPREHENSIVE_PASS_EMAIL`, `COMPREHENSIVE_PASS_PASSWORD`. If any are missing, that job is skipped—**treat production cutover as requiring** either a green staging run with those secrets or an equivalent manual smoke of crons, migrations, and org-scoped reads.

**Fork pull requests:** GitHub does not expose repository secrets to workflows from forks, so E2E steps that need `E2E_*` credentials may fail or be skipped depending on your workflow settings. Maintainer policy: run the same checks on an internal branch or re-run CI after merging to `main`.

**Dependency risk:** CI fails on `npm audit` at **high or worse**. For **moderate/low** advisories, review periodically (e.g. `npm run audit:moderate`) and track resolution in your release notes or issue tracker.

**SBOM / compliance:** generate a CycloneDX bill of materials when needed: `npm run sbom` (writes `cyclonedx-sbom.json`, ignored by git).

## Legacy V4 markdown docs

Standalone files such as `docs/V4.md`, `docs/V4_CUTOVER_CHECKLIST.md`, and `docs/RELEASE_RUNBOOK.md` may be removed or renamed over time. **V4 product behavior** remains in the codebase (routes, migrations, `ENABLE_V3_*` where applicable). For historical prose, recover content from git history. This runbook plus [v5_phase_gated_delivery.md](v5_phase_gated_delivery.md) supersede release ordering for the V5 layer.
