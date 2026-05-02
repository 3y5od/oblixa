# V10 Operations Runbook

This runbook is the operator handoff for V10 runtime recovery, rollout, rollback, and post-GA drift review. It is intentionally support-safe: do not paste raw contract text, signed URLs, provider credentials, customer emails, or external evidence tokens into diagnostics or release evidence.

## Recovery Paths

- Data freshness drift or partial refresh: open `/settings/health#read-models`, run `node scripts/rebuild-v10-read-models.mjs --dry-run`, then run a scoped repair from the health surface or cron endpoint. Completion proof is a `v10_read_models.scheduled_refresh` audit event plus a fresh `v10_read_model_refresh_jobs` row.
- Stuck idempotency claims: open `/settings/health#mutations`, run `npm run check:v10-suite`, then trigger `/api/cron/v10/idempotency-cleanup` with cron authorization. Completion proof is a successful cleanup response and no expired `in_progress` claims.
- Support artifact backlog: open `/settings/health#artifacts`, run `npm run check:v10-release-evidence`, then trigger `/api/cron/v10/runtime-artifact-cleanup`. Completion proof is artifact rows with `revoked_at` set or non-expired `expires_at`.
- Failed retryable jobs: open `/work?lens=failed_jobs`, retry from the job-specific recovery action, and verify `v10_job_run_visibility.retry_action` clears after success.

## UI Operating Model

- Exceptions earn space, normalcy compresses, and diagnostics disclose. The first fold should answer what is risky, who owns it, which deadline matters, what changed, and what action is next.
- Default operator surfaces should say "data freshness", "work queue", "renewal risk", and "support artifact" before implementation names. Raw table names, IDs, and failure payloads stay in diagnostics or release evidence.
- Manual QA before promotion: dashboard all-clear, dashboard active-risk, Work high-risk queue, contracts risk row, contract detail immediate action, health failed-job state, reports failure state, command palette action result, forbidden user, mobile dense table, and keyboard-only disclosure/tab/table operation.
- Role and mode QA must cover viewer, editor, manager/admin, legal reviewer, finance reviewer, core, advanced, and assurance. Advanced/assurance modules remain discoverable but cannot outrank active operator work unless they show findings, blockers, failed automation, or decisions.

## Rollout And Rollback

- Before promotion, run `npm run check:v10-suite`, `npm run check:v10-release-evidence`, `npm run check:v10-privacy-scan`, and the strict migration smoke against a disposable database.
- Hold rollout if release evidence is stale, provider readiness is missing, data freshness is not `fresh`, or any P0/P1 acceptance row is descriptor-only.
- Roll back by disabling the V10 rollout flag or workspace mode promotion, preserving source tables and V10 audit/idempotency tables. Do not delete data freshness rows during rollback; mark stale rows through the refresh/visibility path so support can diagnose.
- After rollback, record the reason in release evidence, run a repair refresh, and keep V8/V9 compatibility paths only where the V10 compatibility boundary allows them.

## Post-GA Drift

- Review post-GA SLOs daily for the first week and weekly afterward: activation, command search, report/export reliability, job visibility, data freshness, renewal reminders, evidence follow-up, and recoverability.
- Any SLO miss creates a workspace health diagnostic and an owner assignment. Post-GA misses do not retroactively block GA, but they do block the next promotion until resolved or explicitly accepted by release owners.
- Archive release-candidate fixtures and runtime artifacts according to retention policy; generated-data evidence can be retained, customer payloads cannot.
