# V5 API Contract Sequence

Ordered implementation sequence for the V5 API surface.

Path parameters **`[key]`** for accounts and counterparties are **stable string keys** aligned with `contracts.account_key` and `contracts.counterparty_key` (not UUID primary keys).

## Wave 1: Decision foundation
1. `GET /api/decisions`
2. `POST /api/decisions`
3. `GET /api/decisions/[id]`
4. `PATCH /api/decisions/[id]` (when supported by route)
5. `POST /api/decisions/[id]/recommend`
6. `POST /api/decisions/[id]/approve`
7. `POST /api/decisions/[id]/close`
8. `POST /api/decisions/[id]/review` — manager review actions (`approve`, `reject`, `return_for_revision`) with event logging.
9. `GET/POST/PATCH /api/decisions/[id]/stakeholders` — stakeholder list and updates
10. `GET /api/decisions/packet-templates` / `POST /api/decisions/packet-templates` — template catalog
11. `GET/PATCH/DELETE /api/decisions/packet-templates/[id]` — single template
12. `POST /api/decisions/[id]/packet` — generate a packet run from a decision (metadata + template overlay + JSON/PDF artifacts + report-pack link metadata); `packetType` allowlist in code (`packet-types`).
13. `GET /api/decisions/[id]/packet-runs/[runId]` — download `payload_json` as a `.json` attachment or `format=pdf` for server PDF (org + decision scope check), and `signed=1` for storage-backed signed artifact URLs (`artifact=json|pdf`).

## Wave 2: Campaign orchestration
1. `GET /api/campaigns`
2. `POST /api/campaigns` — body `campaignType` must be one of the values in [`src/lib/v5/campaign-types.ts`](../src/lib/v5/campaign-types.ts) (`CAMPAIGN_TYPES`), including `policy_rollout`, `renewal_wave`, `remediation_push`, `compliance_refresh`, `commercial_change`, `exception_cleanup`, `amendment_campaign`, `data_quality_campaign`, `owner_reassignment_campaign`, `evidence_collection_campaign`, `counterparty_outreach_campaign`, `sla_remediation_campaign` (default `policy_rollout`). Strategy spec §9.2 names map via `CAMPAIGN_TYPE_STRATEGY_HINTS` in that file.
3. `GET /api/campaigns/[id]`
4. `PATCH /api/campaigns/[id]` — optional `name`, `campaignType` (same allowlist); emits `campaign.updated` event.
5. `POST /api/campaigns/[id]/preview`
6. `POST /api/campaigns/[id]/start`
7. `POST /api/campaigns/[id]/pause`
8. `POST /api/campaigns/[id]/resume`
9. `POST /api/campaigns/[id]/close`
10. `POST /api/campaigns/[id]/rollback` — pauses side effects, clears seeded campaign tasks (marker in task details), clears `v5_campaign_id` on program assignments, resets `in_progress` contract rows to `pending`; responds with `{ campaign, tasksRemoved }` or `409` if already rolled back.
11. `GET /api/campaigns/[id]/export` — `?format=json` (default) returns `{ campaign, contracts[], exported_at }`; `?format=csv` returns CSV attachment with columns `contract_id`, `status`, `segment_key`, `assigned_team`, `status_reason`, `updated_at`.

## Wave 3: Simulation and promotion
1. `POST /api/simulations/run` — `simulationType` must be one of `SIMULATION_TYPES` in [`src/lib/v5/simulation-types.ts`](../src/lib/v5/simulation-types.ts) (default `campaign_eligibility_impact`); `result_json.metric_matrix` includes `simulation_focus`.
2. `GET /api/simulations/[id]`
3. `POST /api/simulations/[id]/promote-to-campaign` (requires portfolio campaigns flag as well)

## Wave 4: Relationship summaries
1. `GET /api/accounts/[key]/summary`
2. `GET /api/counterparties/[key]/summary`

## Wave 5: External action layer
1. `POST /api/external-actions/create-link` — `actionType` must be one of `EXTERNAL_ACTION_TYPES` in [`src/lib/v5/external-action-types.ts`](../src/lib/v5/external-action-types.ts) (default `submit_evidence`).
2. `GET /api/external-actions/[token]/status`
3. `POST /api/external-actions/[token]/submit`

## Wave 6: Intelligence and capacity
1. `GET /api/capacity/forecast`
2. `POST /api/capacity/reassignment-plan` — delegation/reassignment recommendation payload with audit event.
3. `GET /api/intelligence/portfolio-signals`
4. `GET /api/intelligence/decision-queue`
5. `GET /api/intelligence/recommendations`
6. `GET/PATCH /api/intelligence/recommendations/[id]` — single recommendation actions

## Contract rules
- All internal endpoints require auth context and org scope.
- Mutating endpoints require capability checks.
- External token endpoints must remain scope-limited and TTL-bound.
- Recommendation payloads must include reasons and linked object references.
