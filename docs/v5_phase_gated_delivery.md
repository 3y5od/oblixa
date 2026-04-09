# Oblixa V5 Phase-Gated Delivery

This runbook turns V5 rollout phases into concrete release gates with exact checks.

## Feature Flags

Use these environment flags to gate each phase:
- `ENABLE_V5_DECISION_FOUNDATION`
- `ENABLE_V5_PORTFOLIO_CAMPAIGNS`
- `ENABLE_V5_SIMULATION_AND_INTELLIGENCE`
- `ENABLE_V5_RELATIONSHIP_LAYER`
- `ENABLE_V5_EXTERNAL_COLLABORATION`
- `ENABLE_V5_CONTROL_ROOM_UX`

Default behavior follows existing flag parsing: unset means enabled unless explicitly set to `false`, `0`, `no`, or `off`.

## Phase 1: Decision foundation
- **Enable:** `ENABLE_V5_DECISION_FOUNDATION`
- **Scope:** decision workspace model, recommendation capture, approve/close flow.
- **Gate checks:**
  - migrations apply cleanly through `044_v5_control_plane_foundation.sql` and `045_v5_external_link_decision_scope.sql` when external links are in use
  - `/api/decisions*` auth and mutation tests pass
  - decision pages render for authenticated users
- **Rollback:** disable flag and keep V4 renewal flow active.

## Phase 2: Portfolio campaigns
- **Enable:** `ENABLE_V5_PORTFOLIO_CAMPAIGNS`
- **Scope:** campaign model, preview/start/pause/resume/close, campaign center pages.
- **Gate checks:**
  - `/api/campaigns*` tests pass
  - preview summary and progress summary update correctly
  - campaign contract rows stay org-scoped under RLS
- **Rollback:** disable flag and route users back to V4 maintenance campaigns.

## Phase 3: Simulation and intelligence
- **Enable:** `ENABLE_V5_SIMULATION_AND_INTELLIGENCE`
- **Scope:** simulation run/promote endpoints, intelligence endpoints, capacity forecast API, v5 cron jobs for simulation/capacity/recommendation/risk.
- **Gate checks:**
  - simulation run and promote-to-campaign flow works end to end
  - intelligence payloads include linked object hints and reasons
  - cron endpoints respond with `ok: true` under authorized secret
- **Rollback:** disable flag and keep V4 policy simulation/reporting routes.

## Phase 4: Relationship layer
- **Enable:** `ENABLE_V5_RELATIONSHIP_LAYER`
- **Scope:** account/counterparty summaries, relationship timelines and rollups.
- **Gate checks:**
  - `/api/accounts/[key]/summary` and `/api/counterparties/[key]/summary` return workspace + contract context (`[key]` = `contracts.account_key` / `counterparty_key`)
  - relationship rollup cron writes timeline events safely
- **Rollback:** disable flag and keep contract-level work as primary navigation.

## Phase 5: Limited external collaboration
- **Enable:** `ENABLE_V5_EXTERNAL_COLLABORATION`
- **Scope:** create-link, submit, status endpoints and follow-up cron.
- **Gate checks:**
  - token TTL enforcement and one-time submission behavior
  - external action events logged for create/submit/expire
  - no broad authenticated data exposure from token endpoints
- **Rollback:** disable flag and revert to internal evidence intake workflows.

## Phase 6: Control-room UX
- **Enable:** `ENABLE_V5_CONTROL_ROOM_UX`
- **Scope:** top-level nav update, home control questions strip, first-class Decisions/Campaigns/Reports surfaces, compare view.
- **Gate checks:**
  - primary nav includes Home, Contracts, Work, More; Decisions, Campaigns, Reports, and **Relationships** appear when their V5 flags are on (see [`src/lib/navigation.ts`](../src/lib/navigation.ts) `v5FlagsAnyOf`)
  - dashboard includes six control-room prompts
  - compare view and report intelligence pages render
- **Rollback:** keep V4 route pages and hide V5-first nav entries behind flags.

## Preflight checks for each phase
- Run `npm run typecheck`
- Run focused API tests for changed endpoints
- Validate no new lint diagnostics in changed files
- Verify RLS behavior by org-scoped reads in staging
- Validate cron auth (`CRON_SECRET`) before enabling scheduled jobs

## Compatibility commitment
- Keep V4 routes and data paths functional through all phases.
- Do not remove V4 tables/columns during V5 rollout.
- Keep all migrations additive and idempotent.

