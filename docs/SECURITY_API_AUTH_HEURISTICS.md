# API route auth heuristics

Generated: 2026-05-02T01:16:17.111Z

**Disclaimer:** Substring matches only. They do **not** prove authentication or authorization is correct. Use for inventory and review prompts.

Regenerate:

```bash
npm run report:security-api-auth-heuristics
```

**Total routes:** 182

| Route | Detected signals |
|-------|------------------|
| `accounts/[key]/summary/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `approvals/[id]/[action]/route.ts` | getApiAuthContext, canManageCapability, segment_id_param |
| `approvals/sla-metrics/route.ts` | getApiAuthContext, NextResponse_401_403 |
| `assurance/analytics/summary/route.ts` | requireV6ApiFeature |
| `assurance/check-runs/[id]/route.ts` | requireV6ApiFeature, segment_id_param |
| `assurance/check-runs/route.ts` | requireV6ApiFeature |
| `assurance/checks/run/route.ts` | requireV6ApiFeature |
| `assurance/external-links/[id]/response-pack/route.ts` | requireV6ApiFeature, segment_id_param |
| `assurance/findings/[id]/events/route.ts` | requireV6ApiFeature, segment_id_param |
| `assurance/findings/[id]/resolve/route.ts` | requireV6ApiFeature, segment_id_param |
| `assurance/findings/route.ts` | requireV6ApiFeature |
| `assurance/health-graph/route.ts` | requireV6ApiFeature |
| `assurance/scorecards/[id]/snapshots/route.ts` | requireV6ApiFeature, segment_id_param |
| `assurance/scorecards/route.ts` | requireV6ApiFeature |
| `assurance/workflows/run-all/route.ts` | requireV6ApiFeature |
| `attestations/[id]/respond/route.ts` | getApiAuthContext, canManageCapability, segment_id_param, NextResponse_401_403 |
| `attestations/run/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `auth/post-sign-out/route.ts` | — |
| `autopilot/rules/[id]/dry-run/route.ts` | requireV6ApiFeature, segment_id_param |
| `autopilot/rules/[id]/enable/route.ts` | requireV6ApiFeature, segment_id_param |
| `autopilot/rules/[id]/route.ts` | requireV6ApiFeature, segment_id_param |
| `autopilot/rules/route.ts` | requireV6ApiFeature |
| `autopilot/run-logs/[id]/revert/route.ts` | requireV6ApiFeature, segment_id_param |
| `autopilot/runs/route.ts` | requireV6ApiFeature |
| `campaigns/[id]/close/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/contracts/[rowId]/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/export/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/pause/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/preview/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/resume/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/rollback/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/[id]/start/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `campaigns/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, NextResponse_401_403 |
| `capacity/forecast/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `capacity/reassignment-plan/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, NextResponse_401_403 |
| `command-centers/preferences/route.ts` | getApiAuthContext, NextResponse_401_403 |
| `command-palette/contracts/route.ts` | NextResponse_401_403 |
| `contracts/recompute-signals/route.ts` | createAdminClient |
| `control-policies/[id]/assign/route.ts` | requireV6ApiFeature, segment_id_param |
| `control-policies/[id]/publish/route.ts` | requireV6ApiFeature, segment_id_param |
| `control-policies/[id]/route.ts` | requireV6ApiFeature, segment_id_param |
| `control-policies/[id]/simulate/route.ts` | requireV6ApiFeature, segment_id_param |
| `control-policies/route.ts` | requireV6ApiFeature |
| `counterparties/[key]/summary/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `cron/stripe-webhook-events/route.ts` | CRON_SECRET, createServerClient, NextResponse_401_403 |
| `cron/v10/idempotency-cleanup/route.ts` | createAdminClient |
| `cron/v10/read-model-refresh/route.ts` | createAdminClient |
| `cron/v10/runtime-artifact-cleanup/route.ts` | createAdminClient |
| `cron/v4/approvals-sla/route.ts` | createAdminClient |
| `cron/v4/attestations-issue/route.ts` | createAdminClient |
| `cron/v4/escalations-dispatch/route.ts` | createAdminClient |
| `cron/v4/evidence-followup/route.ts` | createAdminClient |
| `cron/v4/exceptions-detect/route.ts` | createAdminClient |
| `cron/v4/programs-reconcile/route.ts` | createAdminClient |
| `cron/v4/renewals-recompute-signals/route.ts` | createAdminClient |
| `cron/v4/report-packs-generate/route.ts` | createAdminClient |
| `cron/v5/campaign-progress/route.ts` | createAdminClient |
| `cron/v5/capacity-forecast-refresh/route.ts` | createAdminClient |
| `cron/v5/decision-sla-monitor/route.ts` | createAdminClient |
| `cron/v5/external-followup/route.ts` | createAdminClient |
| `cron/v5/portfolio-risk-recompute/route.ts` | createAdminClient |
| `cron/v5/recommendation-refresh/route.ts` | createAdminClient |
| `cron/v5/relationship-rollups/route.ts` | createAdminClient |
| `cron/v5/simulation-snapshots/route.ts` | createAdminClient |
| `cron/v6/assurance-checks/route.ts` | createAdminClient |
| `cron/v6/autopilot-dry-run/route.ts` | createAdminClient |
| `cron/v6/autopilot-execution/route.ts` | createAdminClient |
| `cron/v6/control-policy-reevaluation/route.ts` | createAdminClient |
| `cron/v6/external-workflow-deadlines/route.ts` | createAdminClient |
| `cron/v6/finding-refresh/route.ts` | createAdminClient |
| `cron/v6/health-graph-rollups/route.ts` | createAdminClient |
| `cron/v6/onboarding-calibration-stale/route.ts` | createAdminClient |
| `cron/v6/outcome-effectiveness/route.ts` | createAdminClient |
| `cron/v6/playbook-follow-up-assurance/route.ts` | createAdminClient |
| `cron/v6/review-board-packet-generation/route.ts` | createAdminClient |
| `cron/v6/scorecard-recompute/route.ts` | createAdminClient |
| `cron/v6/segment-recompute/route.ts` | createAdminClient |
| `decisions/[id]/approve/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/close/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/context/route.ts` | getApiAuthContext, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/packet-runs/[runId]/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/packet/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/recommend/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/review/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/[id]/stakeholders/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/packet-templates/[id]/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `decisions/packet-templates/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, NextResponse_401_403 |
| `decisions/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, NextResponse_401_403 |
| `events/route.ts` | createAdminClient, createClient_supabase, getUser, x_api_key, secureCompare, NextResponse_401_403 |
| `evidence/[id]/[action]/route.ts` | getApiAuthContext, canManageCapability, segment_id_param |
| `evidence/export/[contractId]/route.ts` | getApiAuthContext, NextResponse_401_403 |
| `evidence/requests/route.ts` | getApiAuthContext, canManageCapability |
| `evidence/submit/route.ts` | getApiAuthContext, canManageCapability, createAdminClient, secureCompare |
| `exceptions/[id]/[action]/route.ts` | getApiAuthContext, canManageCapability, segment_id_param |
| `exceptions/route.ts` | getApiAuthContext, NextResponse_401_403 |
| `exceptions/run-detection/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `export/calendar/feed/[token]/route.ts` | createAdminClient, secureCompare, segment_token_param |
| `export/calendar/feed/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `export/calendar/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `export/contracts/[jobId]/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `export/contracts/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `export/review-packet/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `external-actions/[token]/participant/workflow-step/route.ts` | requireV5ApiFeature, createAdminClient, segment_token_param, NextResponse_401_403 |
| `external-actions/[token]/status/route.ts` | requireV5ApiFeature, createAdminClient |
| `external-actions/[token]/submit/route.ts` | requireV5ApiFeature, createAdminClient, NextResponse_401_403 |
| `external-actions/[token]/workflow-step/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_token_param, NextResponse_401_403 |
| `external-actions/create-link/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, NextResponse_401_403 |
| `extract/route.ts` | createAdminClient, createClient_supabase, getUser, EXTRACTION_WORKER_SECRET, NextResponse_401_403 |
| `extract/run/route.ts` | parseBearerToken, EXTRACTION_WORKER_SECRET, secureCompare, NextResponse_401_403 |
| `import/contracts/[jobId]/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `import/contracts/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `integrations/actions/callback/route.ts` | inbound_automation, createAdminClient, NextResponse_401_403 |
| `integrations/calendar/sync/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `integrations/crm/sync/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `integrations/oauth/callback/route.ts` | createAdminClient |
| `integrations/oauth/start/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `integrations/refresh-tokens/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `integrations/slack/renewal-summary/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `intelligence/decision-queue/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `intelligence/portfolio-by-counterparty/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `intelligence/portfolio-by-program/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `intelligence/portfolio-signals/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `intelligence/recommendations/[id]/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `intelligence/recommendations/route.ts` | getApiAuthContext, requireV5ApiFeature, NextResponse_401_403 |
| `internal/debugging-sweep/route.ts` | createAdminClient, parseBearerToken, secureCompare, export_dynamic |
| `maintenance/campaigns/[id]/preview/route.ts` | getApiAuthContext, canManageCapability, segment_id_param, NextResponse_401_403 |
| `maintenance/campaigns/[id]/rollback/route.ts` | getApiAuthContext, canManageCapability, segment_id_param, NextResponse_401_403 |
| `maintenance/campaigns/[id]/route.ts` | getApiAuthContext, canManageCapability, segment_id_param, NextResponse_401_403 |
| `maintenance/campaigns/[id]/run/route.ts` | getApiAuthContext, canManageCapability, segment_id_param, NextResponse_401_403 |
| `maintenance/campaigns/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `maintenance/prune-operational-data/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `me/account/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `me/export/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `notifications/retry-deliveries/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `outcomes/control-effectiveness/route.ts` | requireV6ApiFeature |
| `outcomes/interventions/route.ts` | requireV6ApiFeature |
| `outcomes/program-effectiveness/route.ts` | requireV6ApiFeature |
| `playbooks/[id]/preview/route.ts` | requireV6ApiFeature, segment_id_param |
| `playbooks/[id]/run/route.ts` | requireV6ApiFeature, segment_id_param |
| `playbooks/route.ts` | requireV6ApiFeature |
| `playbooks/runs/[id]/approve/route.ts` | requireV6ApiFeature, segment_id_param |
| `playbooks/runs/[id]/route.ts` | requireV6ApiFeature, segment_id_param |
| `policy/simulate/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `product-telemetry/page-load/route.ts` | — |
| `program-evolution/experiments/[id]/advance-rollout/route.ts` | requireV6ApiFeature, segment_id_param |
| `program-evolution/experiments/[id]/results/route.ts` | requireV6ApiFeature, segment_id_param |
| `program-evolution/experiments/[id]/simulate/route.ts` | requireV6ApiFeature, segment_id_param |
| `program-evolution/experiments/route.ts` | requireV6ApiFeature |
| `programs/[id]/[action]/route.ts` | getApiAuthContext, canManageCapability, segment_id_param, NextResponse_401_403 |
| `programs/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `reminders/send/route.ts` | createAdminClient, createServerClient, export_dynamic |
| `renewals/[id]/[action]/route.ts` | getApiAuthContext, canManageCapability, segment_id_param |
| `renewals/portfolio-signals/route.ts` | getApiAuthContext, NextResponse_401_403 |
| `report-packs/[id]/runs/route.ts` | getApiAuthContext, segment_id_param, NextResponse_401_403 |
| `report-packs/route.ts` | getApiAuthContext, canManageCapability, NextResponse_401_403 |
| `reports/capture-metrics/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `reports/send-summaries/route.ts` | CRON_SECRET, createAdminClient, createServerClient, NextResponse_401_403 |
| `reports/track/click/[token]/route.ts` | createAdminClient |
| `reports/track/open/[token]/route.ts` | createAdminClient |
| `review-boards/[id]/generate-run/route.ts` | requireV6ApiFeature, segment_id_param |
| `review-boards/[id]/route.ts` | requireV6ApiFeature, segment_id_param |
| `review-boards/[id]/runs/route.ts` | requireV6ApiFeature, segment_id_param |
| `review-boards/route.ts` | requireV6ApiFeature |
| `review-boards/runs/[id]/route.ts` | requireV6ApiFeature, segment_id_param |
| `segments/[id]/recompute/route.ts` | requireV6ApiFeature, segment_id_param |
| `segments/route.ts` | requireV6ApiFeature |
| `settings/step-up/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `simulations/[id]/promote-to-campaign/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `simulations/[id]/route.ts` | getApiAuthContext, requireV5ApiFeature, segment_id_param, NextResponse_401_403 |
| `simulations/run/route.ts` | getApiAuthContext, canManageCapability, requireV5ApiFeature, NextResponse_401_403 |
| `stripe/checkout/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `stripe/portal/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `stripe/webhook/route.ts` | stripe_constructEvent, stripe_signature_header, createAdminClient |
| `tasks/from-email/route.ts` | isAuthorized, inbound_automation, createAdminClient, NextResponse_401_403 |
| `tasks/from-slack/route.ts` | isAuthorized, inbound_automation, createAdminClient, NextResponse_401_403 |
| `tasks/run-rules/route.ts` | CRON_SECRET, isAuthorized, createAdminClient, NextResponse_401_403 |
| `templates/preview/route.ts` | createAdminClient, createClient_supabase, getUser, NextResponse_401_403 |
| `webhooks/dispatch/route.ts` | CRON_SECRET, createAdminClient, NextResponse_401_403 |
| `workspace/nav-badges/route.ts` | NextResponse_401_403 |
| `workspace/v6-settings/route.ts` | requireV6ApiFeature |
