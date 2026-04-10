# V6 Release Runbook

This runbook is for shipping V6 in a single cutover with rollback safety.

## 1) Preflight

1. Confirm environment variables are set in production/staging:
   - `ENABLE_V6_ASSURANCE_CORE`
   - `ENABLE_V6_CONTROL_POLICIES`
   - `ENABLE_V6_ADAPTIVE_PLAYBOOKS`
   - `ENABLE_V6_AUTOPILOT`
   - `ENABLE_V6_OUTCOME_INTELLIGENCE`
   - `ENABLE_V6_REVIEW_BOARDS`
   - `ENABLE_V6_SEGMENTS`
   - `CRON_SECRET`
2. Confirm Supabase service role and auth settings are unchanged.
3. Confirm Vercel cron schedule update is deployed (`/api/cron/v6/*`).

## 2) Migration rollout

1. Deploy **all** V6 migrations to staging, in order:
   - `049_v6_assurance_adaptive_platform.sql`
   - `050_v6_contract_tags.sql`
   - `051_v6_org_settings_json.sql`
   - `052_v6_analytics_event_indexes.sql`
2. Validate table creation and RLS policies for all V6 entities.
3. Run regression checks:
   - `npm run check:migrations`
   - `npm run check:api-route-tests`
   - `npm run check:vercel-cron`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
4. Deploy migration to production in a controlled window.

## 3) API and UI smoke tests

1. Open `/assurance` and verify all child pages load:
   - `/assurance/findings`
   - `/assurance/control-policies`
   - `/assurance/scorecards`
   - `/assurance/health-graph`
   - `/assurance/review-boards`
   - `/assurance/playbooks`
   - `/assurance/autopilot`
   - `/assurance/segments`
2. Verify core APIs (authenticated):
   - `GET /api/assurance/findings`
   - `POST /api/assurance/checks/run`
   - `GET /api/control-policies`
   - `GET /api/playbooks`
   - `GET /api/autopilot/rules`
   - `GET /api/outcomes/interventions`
   - `GET /api/review-boards`
   - `GET /api/segments`

### Section 10 reference workflows (staging)

After auth as a user with `maintenance_manage`, call `POST /api/assurance/workflows/run-all` once and confirm each block in `workflows` has expected primary rows (HTTP 200, `ok: true`):

| # | Response key | Spot-check |
|---|----------------|------------|
| 1 | `findingToIntervention` | `finding` and `playbookRun` ids present; run status completed |
| 2 | `policyBreachRemediation` | `simulation`, `run`, `campaign` ids present |
| 3 | `externalEvidenceRefresh` | `link` with `token` and future `expires_at` |
| 4 | `programPerformanceTuning` | `experiment` row with `status` running |
| 5 | `portfolioBoardReview` | `board` and `run` ids; run `status` generated |

## 4) Cron activation order

After deployment, verify each endpoint returns `ok: true` with expected keys (responses may also include `duration_ms`, `orgs_processed`, and `errors_count` for operators):

1. `/api/cron/v6/assurance-checks`
2. `/api/cron/v6/finding-refresh`
3. `/api/cron/v6/autopilot-dry-run`
4. `/api/cron/v6/autopilot-execution`
5. `/api/cron/v6/scorecard-recompute`
6. `/api/cron/v6/health-graph-rollups`
7. `/api/cron/v6/control-policy-reevaluation`
8. `/api/cron/v6/outcome-effectiveness`
9. `/api/cron/v6/review-board-packet-generation`
10. `/api/cron/v6/segment-recompute`
11. `/api/cron/v6/playbook-follow-up-assurance`
12. `/api/cron/v6/external-workflow-deadlines`

## 5) Operational checks (first 24 hours)

- Track open findings creation rate and false-positive trend.
- Verify autopilot run logs remain bounded and reversible.
- Verify review board packet generation produces actionable output.
- Confirm outcome-intelligence endpoints show intervention records.

## 6) Rollback plan

If severe regression is detected:

1. Disable all V6 flags (`ENABLE_V6_* = false`) in runtime env.
2. Keep migration in place (additive schema) and stop writing V6 data.
3. Pause V6 cron execution (remove/disable paths in Vercel project settings).
4. Revert application deployment to last known V5-stable build.
5. Keep `CRON_SECRET` unchanged unless compromise is suspected.

## 7) Post-cutover checklist

- [ ] V6 nav visible to intended roles
- [ ] V6 APIs return organization-scoped results
- [ ] V6 cron routes pass canary checks
- [ ] No critical errors in logs
- [ ] Dashboard and reports show V6 assurance/outcome sections
- [ ] Stakeholder sign-off completed

## 8) Optional end-to-end smoke (manual)

1. Create a control policy (`POST /api/control-policies`) and open its detail page under `/assurance/control-policies/[id]`.
2. Run **Publish** and **Simulation** from the detail actions; confirm `assurance_check_runs` and findings update after publish.
3. Open `/assurance/findings`, pick a finding, run **Preview** / **Run** on the recommended playbook when present.
4. Trigger `POST /api/autopilot/rules/[id]/dry-run` and confirm `output_json` on the new log row reflects simulated guardrails.
5. `POST /api/review-boards/[id]/generate-run` then `PATCH /api/review-boards/runs/[id]` with `{ "status": "reviewed" }` when testing board lifecycle.
6. After `GET /api/cron/v6/outcome-effectiveness` (with `CRON_SECRET`), confirm new `outcome_intervention_analyses` rows for completed playbook runs with stored before/after metrics.
