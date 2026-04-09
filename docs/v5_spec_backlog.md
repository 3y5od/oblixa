# V5 spec depth backlog (vertical slices)

This backlog turns gaps between the current **control-plane skeleton** and the fuller product described in [oblixa_v5_strategy_spec.md](oblixa_v5_strategy_spec.md) into phased work with testable acceptance criteria. Order is a recommendation; adjust per roadmap.

**Implementation status (2026-04-09):** Slices A–H are **implemented in code** (UI/API/tests/telemetry) per [v5_implementation_traceability.md](v5_implementation_traceability.md), including `046_v5_decision_type_api_alignment.sql` (API/DB `decision_type` parity), V5 cron probes in `check:comprehensive-pass` / `check:cron-canary`, expanded `campaign_type` / packet / external-action / simulation allowlists, nine-row `portfolio-signals`, `/relationship-workspaces` + contract key links, `/external/[token]` for participants, packet JSON+PDF artifact linkage, manager-review actions, and capacity reassignment planning.

Source mapping: strategy spec sections **9.1–9.10**, **17** (metrics).

---

## Slice A — Decision types and workspace richness (§9.1)

**Goal:** Align `decision_type` and workspace data with the spec’s decision taxonomy and required contents.

**Acceptance criteria**

- Server validates `decision_type` against an allowlist (or DB check) covering at minimum: renewal, amendment, waiver/exception, obligation extension, ownership transfer, policy exception, termination, remediation acceptance.
- API and UI expose `required_inputs_json`, stakeholder states, and disposition in a way QA can trace from create → recommend → approve → close.
- Post-close actions from [post-decision-actions](../src/lib/v5/post-decision-actions.ts) are documented per decision type in traceability doc.

**Tests:** API rejects unknown `decisionType`; at least one happy-path E2E or integration test per primary type.

---

## Slice B — Campaign operations depth (§9.2)

**Goal:** Move from draft/preview/start to spec’d campaign capabilities (assignment, segment progress, richer work linkage).

**Acceptance criteria**

- Campaign supports documented `campaign_type` values or a validated subset with migration path.
- Progress views show segment or cohort breakdown when `progress_summary_json` (or successor fields) is populated by jobs.
- Rollback/export behaviors are documented in [v5_api_contract_sequence.md](v5_api_contract_sequence.md) with expected payload shapes.

**Tests:** Preview/start/rollback/export integration tests with mocked org data; cron `campaign-progress` updates summary deterministically for a fixture org.

---

## Slice C — Intelligence narratives (§9.5, §16)

**Goal:** Expand `/api/intelligence/*` beyond counts to structured drivers and linked objects for each signal class in the spec.

**Acceptance criteria**

- Each signal in `portfolio-signals` includes `reason` or `reason_json` and a machine-readable `linked_object` or ref list where applicable.
- `decision-queue` supports priority/SLA fields aligned with `decision_workspaces.due_at` and SLA monitor output.
- Recommendation rows always include explainable `reason_json` and target refs (already partially required; enforce in schema + tests).

**Tests:** Snapshot or contract tests on JSON shape; flag-off behavior already covered in Vitest.

---

## Slice D — Simulation metrics (§9.6)

**Goal:** Simulation run results include the metric matrix from the spec (affected contracts, estimated load, segment breakdown).

**Acceptance criteria**

- `change_simulation_runs` (or API response) returns documented fields for at least one simulation kind (e.g. `campaign_eligibility_impact`).
- Promote-to-campaign preserves traceability from simulation id to new campaign id in events.

**Tests:** POST `/api/simulations/run` returns non-empty metrics for a seeded org fixture; promote path test with mocks.

---

## Slice E — Decision packets 2.0 (§9.7)

**Goal:** Multiple packet types, export/share formats, and manager-review flows.

**Acceptance criteria**

- `packet_type` on runs supports multiple values from the spec (renewal, amendment, exception, campaign summary, etc.) with template mapping.
- Generated artifact is downloadable or exportable (file URL, signed storage link, or report pack linkage) with audit row in `decision_packet_runs`.

**Tests:** POST `/api/decisions/[id]/packet` with template id creates run row and returns stable metadata; template CRUD tests.

---

## Slice F — Capacity and recommendations depth (§9.8–9.9)

**Goal:** Team/role-aware forecasts and recommendation acceptance loops in UI.

**Acceptance criteria**

- `capacity_forecasts.forecast_json` documents team/role keys when available from execution data.
- Reports page and/or dashboard surface forecast deltas after cron refresh.
- PATCH recommendation (accept/dismiss) updates `operational_recommendations` and emits an event or audit trail.

**Tests:** Forecast GET shape test; recommendation PATCH idempotency.

---

## Slice G — Relationship timeline coverage (§9.10)

**Goal:** Timeline widgets and rollups consistently appear where spec implies relationship context.

**Acceptance criteria**

- Decisions and campaigns UIs load timeline slices from account/counterparty summary or dedicated API when keys are set.
- Rollup cron documents idempotency and org isolation.

**Tests:** Summary API includes `timelineEvents` (or equivalent) array with schema contract test.

---

## Slice H — Success metrics and telemetry (§17)

**Goal:** Use `v5_signal_quality_json`, recommendation acceptance rates, and campaign/decision throughput for internal dashboards.

**Acceptance criteria**

- Cron or API writes incremental metrics to `org_behavior_metrics.v5_signal_quality_json` (or documented alternative).
- Runbook describes which fields operators can inspect in SQL or admin tools.

**Tests:** Unit test for metric merge logic; no PII in logged payloads.

---

## How to use this document

Pick one slice per sprint or milestone; update [v5_implementation_traceability.md](v5_implementation_traceability.md) when a slice is “done” for launch purposes. Keep [v5_phase_gated_delivery.md](v5_phase_gated_delivery.md) as the **flag and gate** authority; this file is **product depth** only.
