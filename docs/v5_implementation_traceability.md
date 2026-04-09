# Oblixa V5 Implementation Traceability

This checklist maps each V5 spec chapter to concrete implementation outputs in code, database, API, UI, automation, and tests.

Source spec: `docs/oblixa_v5_strategy_spec.md`

## Section 9.1 Decision Workspaces
- Schema: `decision_workspaces`, `decision_workspace_events`, `decision_workspace_stakeholders`, `decision_recommendations`.
- `decision_type` CHECK aligned with API/UI via migration `046_v5_decision_type_api_alignment.sql` and [`src/lib/v5/decision-types.ts`](../src/lib/v5/decision-types.ts) (Vitest guards drift).
- API: `/api/decisions`, `/api/decisions/[id]`, `/api/decisions/[id]/recommend`, `/api/decisions/[id]/approve`, `/api/decisions/[id]/close`, `/api/decisions/[id]/stakeholders`, `/api/decisions/[id]/packet`, `/api/decisions/packet-templates`, `/api/decisions/packet-templates/[id]`.
- UI: `/decisions`, `/decisions/[id]` — detail page surfaces required inputs, stakeholder list, recommendations, final disposition JSON, post-close action plan, and event log for QA traceability (create → inputs → recommend → approve → close).
- Cron: decision SLA monitor job under `/api/cron/v5/decision-sla-monitor`.
- Tests: `decisions/route` (decisionType allowlist), `decisions/[id]/route` (PATCH merge + invalid type), `decisions/[id]/close`, `decisions/[id]/recommend`, `decisions/[id]/approve`, `decisions/packet-templates`, `decisions/[id]/packet`, `decisions/[id]/packet-runs/[runId]`, feature-guard 403 coverage; manager-review actions via `POST /api/decisions/[id]/review`.

### Post-close actions vs `decision_type` ([`src/lib/v5/post-decision-actions.ts`](../src/lib/v5/post-decision-actions.ts))

On first close, if the request omits `postActions`, the API applies `suggestDefaultPostDecisionActions(decision_type, linked_contract_ids)` (grounded `create_task` hints for renewal/amendment/remediation types when a linked contract exists). Explicit `postActions` in the body still override this by replacing the list entirely.

| `decision_type` | Suggested post-close when `postActions` omitted (first close) |
|-----------------|--------------------------------------------------------------|
| `renewal`, `renewal_recommendation` | `create_task` on first linked contract (ops follow-up). |
| `amendment_request` | `create_task` on first linked contract (legal follow-up). |
| `remediation_acceptance`, `waiver_exception` | `create_task` on first linked contract (ops follow-up). |
| Other types | No suggestion unless operators send `postActions`. |
| Any | Shapes supported at execution: `{ type: "create_task", contractId, title, ... }`, `{ type: "link_exception", exceptionId }`. |

## Section 9.2 Portfolio Campaigns
- Schema: `portfolio_campaigns`, `portfolio_campaign_contracts`, `portfolio_campaign_events`.
- `campaign_type` allowlist and strategy-spec §9.2 mapping: [`src/lib/v5/campaign-types.ts`](../src/lib/v5/campaign-types.ts) (`CAMPAIGN_TYPES`, `CAMPAIGN_TYPE_STRATEGY_HINTS`, `CAMPAIGN_TYPE_LABELS`).
- `assignment_json` validation and task routing: [`src/lib/v5/campaign-assignment.ts`](../src/lib/v5/campaign-assignment.ts); GET/PATCH on [`/api/campaigns/[id]`](../src/app/api/campaigns/[id]/route.ts) includes `assignment_json` (and optional `eligibility_json` PATCH); [`PATCH /api/campaigns/[id]/contracts/[rowId]`](../src/app/api/campaigns/[id]/contracts/[rowId]/route.ts) for `segment_key` / `assigned_team`; start route applies routing to `contract_tasks`.
- API: `/api/campaigns`, `/api/campaigns/[id]`, `/api/campaigns/[id]/preview`, `/api/campaigns/[id]/start`, `/api/campaigns/[id]/pause`, `/api/campaigns/[id]/resume`, `/api/campaigns/[id]/close`, `/api/campaigns/[id]/rollback`, `/api/campaigns/[id]/export`.
- UI: `/campaigns` (status/type filters, simulation studio block when intelligence flag on), `/campaigns/[id]` ([`CampaignAssignmentPanel`](../src/components/campaigns/campaign-assignment-panel.tsx)), `/campaigns/compare`.
- UI depth: compare page includes normalized deltas (pending/processed), simulation eligibility context, and side-by-side structured summaries before JSON payload review.
- Cron: campaign progression/reconciliation under `/api/cron/v5/campaign-progress`.
- Tests: `campaigns/route` (campaignType allowlist), `cron/v5/campaign-progress` (progress_summary_json shape), feature-guard 403; rollback/export payloads documented in [v5_api_contract_sequence.md](v5_api_contract_sequence.md) Slice B.

## Section 9.3 Account and Counterparty Workspaces
- Schema: `account_workspaces`, `counterparty_workspaces`.
- API: `/api/accounts/[key]/summary`, `/api/counterparties/[key]/summary` (`[key]` matches `contracts.account_key` / `counterparty_key`).
- UI: `/accounts/[key]`, `/counterparties/[key]`, [`/relationship-workspaces`](../src/app/(dashboard)/relationship-workspaces/page.tsx) (nav + command palette when relationship flag on), relationship links on contract detail when keys are set.
- Cron: relationship rollups under `/api/cron/v5/relationship-rollups`.
- Tests: `accounts/[key]/summary`, `counterparties/[key]/summary` feature-guard 403; full context tests with seeded keys per [v5_relationship_keys.md](v5_relationship_keys.md).

## Section 9.4 Limited External Workspaces
- Schema: `external_action_links`, `external_action_events`.
- API: `/api/external-actions/create-link`, `/api/external-actions/[token]/submit`, `/api/external-actions/[token]/status`.
- UI: external action panel on decision detail; human-facing submit page [`/external/[token]`](../src/app/external/[token]/page.tsx) posts JSON to the submit API.
- `action_type` allowlist: [`src/lib/v5/external-action-types.ts`](../src/lib/v5/external-action-types.ts).
- Cron: external follow-up under `/api/cron/v5/external-followup`.
- Tests: token creation and scoped token status path.

## Section 9.5 Operational Intelligence Layer
- Schema: `operational_recommendations`, `capacity_forecasts`.
- API: `/api/intelligence/portfolio-signals`, `/api/intelligence/decision-queue`, `/api/intelligence/recommendations`, `/api/intelligence/portfolio-by-program`, `/api/intelligence/portfolio-by-counterparty` (shared queries in [`src/lib/v5/portfolio-analytics.ts`](../src/lib/v5/portfolio-analytics.ts)).
- `portfolio-signals` includes nine grounded rows (exceptions, decisions, campaigns, approvals, attestations, open tasks, pending external links, unsatisfied evidence requirements, obligations due within 30 days) with `reason_json` / `linked_refs`.
- UI: home control-room summary and decisions queue indicators; `/reports` surfaces program/counterparty analytics tables and raw JSON disclosure.
- Cron: recommendation refresh and portfolio risk recomputation.
- Tests: `intelligence/v5-intelligence-routes.test.ts` (403 guards + portfolio-signals/decision-queue shape + recommendations `reason_json` / `target_refs` normalization), `recommendations/[id]` (accept idempotency + audit); portfolio-signals includes `reason_json` per signal row; decision-queue SLA enrichment unchanged and now gates on decision foundation.

## Section 9.6 Change Simulation Studio
- Schema: `change_simulations`, `change_simulation_runs`.
- API: `/api/simulations/run`, `/api/simulations/[id]`, `/api/simulations/[id]/promote-to-campaign`.
- `simulationType` allowlist: [`src/lib/v5/simulation-types.ts`](../src/lib/v5/simulation-types.ts); `metric_matrix.simulation_focus` documents intent per kind.
- UI: simulation panel in campaign center and promotion action.
- Cron: simulation snapshot capture.
- Tests: `simulations/run` (metric_matrix in `result_json`), `simulations/[id]/promote-to-campaign` (campaign event + trace ids); Slice D promote event `campaign.promoted_from_simulation`.

## Section 9.7 Decision Packets 2.0
- Schema: `decision_packet_templates`, `decision_packet_runs` + artifact depth columns via migrations `047_v5_decision_packet_artifacts.sql` and `048_v5_decision_packet_artifact_depth.sql`.
- API: decision detail references packet metadata.
- UI: packet export and packet history sections in decision pages.
- Generation: packet runs are created on demand via `POST /api/decisions/[id]/packet` (there is no separate packet-refresh cron).
- Tests: packet `packetType` allowlist, template CRUD allowlist, GET packet-run JSON/PDF download + signed JSON/PDF URL generation; packet generation metadata included in decision output.
- Export: every run generates JSON payload plus server PDF (`@react-pdf/renderer`), with optional object-storage persistence (`V5_DECISION_PACKET_BUCKET`) for both artifact types. `GET /api/decisions/[id]/packet-runs/[runId]?signed=1` returns signed JSON URL; `?signed=1&artifact=pdf` returns signed PDF URL. Each run persists report-pack linkage metadata when provided.

## Section 9.8 Workload and Capacity Planning
- Schema: `capacity_snapshots`, `capacity_forecasts`.
- API: `/api/capacity/forecast`, `/api/capacity/reassignment-plan`.
- UI: reports capacity view, reassignment planner workflow, and home thin-capacity summary.
- Cron: capacity forecast refresh.
- Tests: `capacity/forecast` (team_key / approval_type breakdown keys in `forecast_json`); recommendation PATCH writes `audit_events` and merges `v5_signal_quality_json`; reports UI shows forecast delta vs previous snapshot.

## Section 9.9 Recommendation Engine
- Schema: `operational_recommendations` and recommendation links in decision records.
- API: `/api/intelligence/recommendations`, `/api/decisions/[id]/recommend`.
- UI: recommendations include explicit reasons and linked objects.
- Cron: recommendation refresh.
- Tests: recommendation output includes reason and confidence fields.

## Section 9.10 Relationship Timeline
- Schema: `relationship_timelines`, `relationship_timeline_events`.
- API: account/counterparty summary endpoints include timeline slices.
- UI: relationship timeline widget on decisions and campaigns.
- Cron: timeline rollups.
- Tests: timeline rows returned in summaries; `RelationshipTimelineCard` on decision/campaign pages; `cron/v5/relationship-rollups` auth test; rollup cron idempotency documented in route header.

## Section 10 Major Workflows
- Policy rollout campaign: simulation -> campaign -> run -> report path.
- Renewal decision orchestration: decision workspace lifecycle.
- External evidence collection: link creation and token submission.
- Capacity-aware approval control: forecast endpoint and capacity signals.
- Amendment decision workflow: decision type `amendment_request` with disposition.

## Section 11 IA Evolution
- Top-level nav includes: Home, Contracts, Work, Decisions, Campaigns, Reports, More.
- Decisions and Campaigns become first-class routes with §11-style `navChildren` (queue filter, campaign status/type shortcuts, report packs / analytics anchors); Contracts and Work include direct sub-links for review/intake/watchlists/tasks/obligations/approvals/renewals/exceptions/evidence.
- Reports area includes analytics and capacity links.

## Section 12 Data Model Expansion
- Migration introduces all listed V5 entities.
- Existing tables are extended additively (no destructive changes).

## Section 13 API and Services
- All endpoint families from the spec are present and feature-flag capable.

## Section 14 Automation Model
- New cron routes under `/api/cron/v5/*` for campaign, simulation, capacity, risk, external, decision SLA, recommendation, relationship rollup.
- All jobs write auditable timestamps and summary metadata.
- Tests: `decision-sla-monitor/route.test.ts` (auth + skip); `campaign-progress/route.test.ts` (progress_summary_json shape); `relationship-rollups/route.test.ts` (cron auth); `v5-crons-feature-skip.test.ts` covers flag-off skip for the other jobs.

## Section 15 UX Direction
- Home evolves into control-room style summary with urgent action, decision queue, spread/risk, and capacity thin areas.
- Side-by-side campaign and simulation context available in campaign views with normalized delta cards.
- Manager-review page supports queue triage, packet export launch, and inline approve/return actions.

## Section 16 Analytics and Intelligence
- Portfolio risk categories surfaced in intelligence endpoints.
- Capacity and recommendation metrics available via reports/intelligence routes.

## Section 17 Success Metrics
- Telemetry: `mergeV5SignalQuality` + `incrementOrgV5SignalQuality` merge into `org_behavior_metrics.v5_signal_quality_json` (user actions on close/recommendation plus **cron ticks** from campaign-progress, capacity-forecast-refresh, recommendation-refresh); see [V5_RELEASE_RUNBOOK.md](V5_RELEASE_RUNBOOK.md) for SQL and key list. Unit tests in `signal-quality-merge.test.ts`.
- Dashboards are surfaced directly in `/reports` and `/dashboard` from `capacity_snapshots`, `capacity_forecasts`, recommendation/campaign states, and control-room signal cards.

## Section 18 Rollout Plan
- Feature flags and phase guardrails are implemented.
- V4 routes remain operational while V5 routes are introduced.

## Section 19 Risks and Failure Modes
- Mitigations embedded:
  - analytics linked to actions,
  - narrow external action scope and TTL,
  - explainable recommendations,
  - additive IA update without removing V4 contract surfaces.

## Section 20 Non-goals
- No e-signature, pre-signature CLM, generic CRM, or open-ended AI assistant implementation is introduced.

