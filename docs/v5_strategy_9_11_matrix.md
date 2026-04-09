# V5 strategy §9–11 alignment matrix

Maps [oblixa_v5_strategy_spec.md](oblixa_v5_strategy_spec.md) §9–11 to implementation status. Non-goals (§4/§20) excluded. Updated during §9–11 full alignment delivery.

| Area | Requirement (summary) | Status | Primary code / notes |
|------|----------------------|--------|----------------------|
| **§9.1** | Decision types & workspace | **Done** | `decision-types.ts`, migrations 046, `/api/decisions/*`, `/decisions/*` |
| **§9.1** | Linked tasks/approvals/evidence context | **Done** | `GET /api/decisions/[id]/context`, decision detail UI |
| **§9.1** | Approval path editing | **Done** | PATCH `approval_path_json` + workspace panel |
| **§9.2** | Campaign types & lifecycle | **Done** | `campaign-types.ts`, `/api/campaigns/*`, crons |
| **§9.2** | Segment/assignment (`segment_key`, `assignment_json`) | **Done** | `campaign-assignment.ts`, PATCH rows + campaign, start uses routing, UI panel |
| **§9.3** | Account/counterparty summaries | **Done** | `/api/accounts|counterparties/[key]/summary`, pages, rollups |
| **§9.4** | External action types | **Done** | `external-action-types.ts`, token APIs, structured payloads |
| **§9.4** | Passcode + `requires_reauth` | **Done** | HMAC submit ticket from `GET status` before `POST submit` |
| **§9.5** | Portfolio signals (grounded) | **Done** | `/api/intelligence/portfolio-signals` + extended rows |
| **§9.5** | Extra analytics JSON | **Done** | `/api/intelligence/portfolio-by-program`, `portfolio-by-counterparty` |
| **§9.6** | Simulation types & metrics | **Done** | `simulations/run` per-type grounded `metric_matrix` |
| **§9.7** | Packets JSON/HTML/print | **Done** | packet routes, `decision-packet-html.ts` |
| **§9.7** | Rich payload + report pack ref | **Done** | packet route payload hooks; optional `reportPackId` |
| **§9.7** | Binary PDF | **Done** | Gated by `v5DecisionFoundation` + `ENABLE_V5_PACKET_SERVER_PDF` (`decision-packet-export.ts`) |
| **§9.8** | Capacity forecast depth | **Done** | `capacity/forecast`, cron refresh, deltas, UI |
| **§9.9** | Recommendations | **Done** | intelligence routes + PATCH |
| **§9.10** | Relationship timeline categories | **Done** | rollup events (amendment, renewal, report pack, ownership) |
| **§10** | Major workflows | **Done** | `e2e/v5-workflows.spec.ts` UI traverse + API create→recommend→close; `v5-surfaces` filters |
| **§11** | IA: Decisions/Campaigns/Reports sub-nav | **Done** | `navigation.ts` + sidebar flag-gated items |
| **§16** | Portfolio-native analytics | **Done** | `/reports` tables + APIs; still not a separate BI product |

## Verification

- `npm run typecheck` / `npm run test` — run in CI and locally.
- `COMPREHENSIVE_PASS_BASE_URL` set → `npm run check:comprehensive-pass` / `check:cron-canary`.
