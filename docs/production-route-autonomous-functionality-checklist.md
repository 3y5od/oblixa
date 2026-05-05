# Production Route Autonomous Functionality Checklist

This checklist covers code-only changes that can be implemented autonomously inside the repository to maximize runtime correctness, reduce production 5xx rates, and improve confidence that all API routes work correctly, including routes that are not yet visibly failing.

This checklist intentionally excludes:

- documentation-only work
- dashboard configuration, alert routing, or external monitoring setup outside the repo
- secret provisioning, third-party account setup, DNS, hosting-console configuration, or branch-protection changes outside the repo
- manual data repair, ad hoc SQL console work, or one-off production operator interventions

## Scope

Use this document for changes that can be completed by editing files under:

- `src/`
- `scripts/`
- `artifacts/`
- `.github/workflows/`
- repo-root runtime, test, or scanner config files

## Status Legend

- `[ ]` not implemented
- `[x]` implemented

## 1. Shared Route Failure Contract

- [ ] Harden [src/lib/cron/route-runner.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/cron/route-runner.ts).
Objective: ensure every cron failure returns a typed, support-safe envelope with actionable diagnostics.
Done when: auth failures, admin-client failures, dependency failures, rate-limit failures, duplicate/idempotency failures, partial failures, and unhandled handler failures each return distinct codes and stable `diagnostic_id` values.

- [ ] Add safe error capture to the shared cron runner.
Objective: preserve `error_class`, `phase`, and a redacted `error_message` for operator triage without leaking secrets or PII.
Done when: unhandled cron failures can be distinguished by cause in logs and runtime responses.

- [ ] Add a `dependencyPreflight` hook to the shared cron runner.
Objective: let routes fail early with `503 dependency_blocked` instead of throwing later in business logic.
Done when: routes that require email, canonical app URL, storage, outbound webhooks, or other providers can declare those requirements explicitly.

- [ ] Add a shared non-cron route wrapper for session, external-token, webhook, and internal API handlers.
Objective: standardize failure envelopes, cache headers, rate-limit responses, and safe diagnostics across the whole API surface.
Done when: high-risk non-cron route families stop hand-rolling inconsistent response contracts.

- [ ] Standardize route outcome taxonomy across the repo.
Objective: remove ambiguous blends of `200`, `500`, and silent empty data on failure.
Done when: route handlers consistently use `200 success`, `207 partial`, `401/403 auth`, `409 idempotency`, `429 rate_limited`, `503 dependency_blocked`, and `500 unhandled_internal`.

## 2. Shared Dependency And Provider Contracts

- [ ] Eliminate localhost fallback for server-generated production URLs in [src/lib/app-url.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/app-url.ts).
Objective: ensure routes that emit links never generate `http://localhost:3000` in production.
Done when: server-side link generation requires a canonical production-safe base URL outside a request context.

- [ ] Add a canonical app-URL preflight for routes that emit emails, export links, packet links, or callback links.
Objective: prevent false-success responses that contain broken links.
Done when: routes that need server-side URLs return typed dependency-blocked responses when canonical URL configuration is missing.

- [ ] Expand [src/lib/observability/instrumentation-env-warn.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/observability/instrumentation-env-warn.ts) to include runtime-critical provider warnings.
Objective: surface missing email, canonical URL, or other route-critical provider configuration earlier.
Done when: production startup warns when enabled route families are missing their runtime prerequisites.

- [ ] Add a checked-in provider/route dependency inventory.
Objective: make route prerequisites machine-readable for smoke checks, canaries, and release gates.
Done when: each high-risk route family declares required env, optional env, and degraded behavior policy.

## 3. Batch Completeness And Pagination

- [ ] Replace silent hard caps with pagination or resume logic in scheduled routes and helpers.
Objective: stop returning green responses while processing only the first fixed slice of production data.
Done when: large tenants can be processed completely or the route reports explicit truncation and remaining backlog.

- [ ] Replace organization scanning caps in [src/lib/v6/cron.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/cron.ts).
Objective: prevent V6 cron families from silently ignoring organizations beyond the current cap.
Done when: organization iteration is paginated or resumable and reports truncation when applicable.

- [ ] Replace fixed-limit scans in [src/lib/tasks/run-task-automation-rules-for-org.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/tasks/run-task-automation-rules-for-org.ts).
Objective: ensure task-automation routes evaluate the full eligible dataset.
Done when: contract, field, and audit-event scans no longer depend on fixed `limit()` slices.

- [ ] Replace fixed-limit scans in [src/lib/v6/health-graph.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/health-graph.ts).
Objective: ensure health-graph rebuilds are complete for production portfolios.
Done when: scorecard, policy, campaign, contract, owner, and team source rows are paginated or resumable.

- [ ] Replace fixed-limit scans in [src/lib/v6/segments.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/segments.ts).
Objective: ensure segment recomputation handles full production datasets.
Done when: contracts, assignments, and derived entity sources are processed beyond the first bounded slice.

- [ ] Replace fixed-limit scans in [src/lib/v6/outcomes.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/outcomes.ts).
Objective: ensure outcome analytics and effectiveness views are not silently partial.
Done when: outcome analysis reads are paginated or the route reports partial computation.

- [ ] Add shared pagination/completeness helpers for Supabase batch routes.
Objective: keep route-specific pagination code consistent and auditable.
Done when: cron families share one pattern for paging, truncation reporting, and continuation metadata.

## 4. Partial-Failure Semantics

- [ ] Make `partial` a first-class response path for batch routes.
Objective: avoid failing whole routes when only a subset of work items fail.
Done when: routes that process multiple orgs, subscriptions, reminders, packets, or deliveries return `207` with structured `errors_count` and per-scope details.

- [ ] Introduce a shared batch executor helper.
Objective: standardize per-item `try/catch`, error accumulation, processed counts, and partial responses.
Done when: cron families stop reimplementing inconsistent batch loops.

- [ ] Add structured `processed`, `skipped`, `failed`, `remaining`, and `truncated` fields to all batch route responses.
Objective: make route outputs operationally meaningful.
Done when: the main scheduled route families expose enough counts to determine whether they fully completed.

## 5. Database Error Handling Sweep

- [ ] Sweep the API surface for ignored Supabase `error` values.
Objective: remove false-success behavior caused by reading `data ?? []` and ignoring query failures.
Done when: critical queries either branch on `error` explicitly or propagate a typed route failure.

- [ ] Sweep the API surface for unchecked insert/update/delete results.
Objective: stop assuming writes succeeded when the database returned an error.
Done when: mutation and cron handlers explicitly handle write failures and route them into success, partial, or failure outcomes.

- [ ] Add a static check or test pattern for “query result ignored” hotspots.
Objective: keep the repo from reintroducing silent DB error swallowing.
Done when: new risky patterns can be caught before deployment.

## 6. Route Family: Reminders

- [ ] Refactor [src/app/api/reminders/send/route.ts](/Users/dizhou/Documents/Cursor/oblixa/src/app/api/reminders/send/route.ts) to use the shared `admin` client.
Objective: remove duplicate client construction and unify error handling.
Done when: the route no longer creates its own service-role client.

- [ ] Page due reminders instead of stopping at the first 500 rows.
Objective: ensure the route can drain full production backlog.
Done when: due-reminder scanning processes all rows or reports backlog remaining.

- [ ] Isolate each reminder row in `try/catch`.
Objective: prevent one malformed reminder, missing profile, or delivery failure from taking down the entire route.
Done when: row-level failures increment `errors_count` and the route returns partial success when appropriate.

- [ ] Check profile-query failures explicitly.
Objective: avoid silently treating profile lookup failures as missing-recipient cases.
Done when: the route distinguishes “no email found” from “profile query failed”.

- [ ] Check reminder `sent_at` update failures explicitly.
Objective: avoid treating state transitions as completed when they were not persisted.
Done when: reminder write failures are surfaced in the response and logs.

- [ ] Strengthen reminder dedupe.
Objective: avoid duplicate sends caused by bounded prior-delivery scans or concurrent invocations.
Done when: delivery idempotency is enforced by stronger write-time guarantees than the current best-effort scan.

## 7. Route Family: Report Summaries

- [ ] Refactor [src/app/api/reports/send-summaries/route.ts](/Users/dizhou/Documents/Cursor/oblixa/src/app/api/reports/send-summaries/route.ts) to use the shared `admin` client where possible.
Objective: remove a second route-local Supabase client path and unify failure handling.
Done when: the route depends on one primary admin path instead of mixing client construction styles.

- [ ] Page due subscriptions instead of truncating at `MAX_DUE_SUBSCRIPTIONS`.
Objective: ensure all due summary runs can be processed.
Done when: the route either drains backlog or reports remaining work.

- [ ] Replace fixed recipient truncation with chunked or paged recipient delivery.
Objective: ensure large subscriptions are processed completely.
Done when: recipient fanout is not capped silently at the current maximum.

- [ ] Wrap each subscription in `try/catch`.
Objective: prevent a single bad saved view, query, or org settings failure from taking down the entire route.
Done when: subscription-level failures produce partial success instead of route-wide failure.

- [ ] Wrap each recipient send/update sequence in `try/catch`.
Objective: isolate email, recipient-row update, and token-tracking failures.
Done when: a failing recipient does not abort the rest of the subscription or batch.

- [ ] Check every write path in the route.
Objective: ensure `report_runs`, `report_run_recipients`, `report_subscriptions`, audit events, and telemetry writes are not silently assumed successful.
Done when: all critical writes branch on their DB result.

- [ ] Move or defer heavyweight V10 read-model refresh from the request path.
Objective: remove a major synchronous failure amplifier from report delivery.
Done when: report delivery can succeed even if refresh scheduling or execution degrades.

## 8. Route Family: Notification Retry

- [ ] Harden [src/app/api/notifications/retry-deliveries/route.ts](/Users/dizhou/Documents/Cursor/oblixa/src/app/api/notifications/retry-deliveries/route.ts) with explicit phase isolation.
Objective: distinguish retry processing failure, fallback-org lookup failure, and heartbeat-audit failure.
Done when: route output identifies which stage degraded and returns partial success when appropriate.

- [ ] Replace the current fixed retry batch size with pagination or repeated draining.
Objective: ensure retry backlog is processed beyond the first `limit`.
Done when: the route can process all due retries or reports remaining backlog.

- [ ] Surface query and update failures from [src/lib/notification-delivery.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/notification-delivery.ts).
Objective: stop masking retry-queue failures as empty or skipped work.
Done when: caller routes can distinguish “nothing due” from “retry queue query failed”.

- [ ] Add stronger delivery status transition guarantees.
Objective: reduce the chance of stuck `retrying` rows or lost post-send state transitions.
Done when: failed updates on retry state transitions are surfaced and recoverable.

## 9. Route Family: Task Automation Rules

- [ ] Harden [src/app/api/tasks/run-rules/route.ts](/Users/dizhou/Documents/Cursor/oblixa/src/app/api/tasks/run-rules/route.ts) so pagination truncation is reported.
Objective: avoid route success when only a subset of organizations was scanned.
Done when: route output indicates whether the org scan hit a configured cap.

- [ ] Harden [src/lib/tasks/run-task-automation-rules-for-org.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/tasks/run-task-automation-rules-for-org.ts) against source query failures.
Objective: stop treating missing data and query failure as equivalent.
Done when: rule evaluation surfaces field, contract, and event query errors explicitly.

- [ ] Add stronger task-creation idempotency.
Objective: avoid duplicate tasks under concurrent or repeated cron invocations.
Done when: rule-triggered task creation is protected by more than the current best-effort “existing open task” check.

## 10. Route Family: V4 Report Packs

- [ ] Isolate each pack in [src/app/api/cron/v4/report-packs-generate/route.ts](/Users/dizhou/Documents/Cursor/oblixa/src/app/api/cron/v4/report-packs-generate/route.ts).
Objective: prevent one failing report pack from aborting the entire cron run.
Done when: pack-level failure becomes partial success unless the whole route is blocked.

- [ ] Check all `report_runs` and `report_pack_runs` write results.
Objective: prevent false-success status when persistence failed.
Done when: failed writes are reflected in route output and audit.

- [ ] Decouple subscription email sending from pack generation success.
Objective: allow pack generation to succeed even if notification delivery degrades.
Done when: delivery failures are reported separately from generation failures.

- [ ] Ensure generated pack links use canonical production-safe URLs.
Objective: prevent “successful” report pack generation that yields broken links.
Done when: the route no longer depends on localhost fallback behavior.

## 11. Route Family: V6 Cron Jobs

- [ ] Stop listing organizations twice between [src/lib/v6/cron-route-runner.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/cron-route-runner.ts) and [src/lib/v6/cron-jobs.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/cron-jobs.ts).
Objective: reduce load and align route metadata with actual execution scope.
Done when: `orgIds` are discovered once and passed through the execution path.

- [ ] Check initial query errors in every V6 cron helper.
Objective: stop returning success when the real failure happened before the per-org loop.
Done when: each helper explicitly handles its first query/result set failure.

- [ ] Harden `runAssuranceChecksForAllOrgs`.
Objective: distinguish “org processed with findings” from “org scan failed”.
Done when: route output and logs show real success/failure counts.

- [ ] Harden `refreshFindingsAging`.
Objective: stop silent partial refresh when finding reads or updates fail.
Done when: per-org and per-finding failures are surfaced in a consistent shape.

- [ ] Harden `runAutopilotDryRun`.
Objective: isolate rule-read, execution, and log-insert failures.
Done when: a failing rule or log insert no longer makes the route operationally opaque.

- [ ] Harden `runAutopilotExecution`.
Objective: isolate finding lookup, rule lookup, executor failure, and log persistence failure.
Done when: scheduled autopilot execution exposes meaningful success/blocked/failure counts.

- [ ] Harden `recomputeScorecardsForAllOrgs`.
Objective: distinguish orgs updated, orgs skipped, and orgs failed.
Done when: scorecard recompute output reports these states explicitly.

- [ ] Harden `rebuildHealthGraph`.
Objective: ensure node and edge rebuild failures are surfaced and not mistaken for success.
Done when: route output distinguishes rows processed from rows intended.

- [ ] Harden `reevaluateControlPolicies`.
Objective: make policy-evaluation failure observable per org.
Done when: route output reports evaluation success and failure counts separately.

- [ ] Harden `scanExternalWorkflowDeadlines`.
Objective: distinguish no overdue links from deadline scan query failure.
Done when: escalation counts are not the only signal returned.

- [ ] Harden `recomputeOutcomeEffectiveness`.
Objective: isolate snapshot backfill failure from outcome-view failure.
Done when: route output shows which outcome phase degraded.

- [ ] Harden `generateReviewBoardPackets`.
Objective: isolate board scan, packet assembly, run persistence, and notification delivery failures.
Done when: one bad board cannot sink the full route.

- [ ] Harden `recomputeSegmentMembershipsForAll`.
Objective: distinguish “no active segments” from segment read or recompute failure.
Done when: the route reports recompute attempts, successes, and failures.

- [ ] Harden `runPlaybookFollowUpAssurancePasses`.
Objective: isolate playbook lookup, run lookup, and assurance execution failures.
Done when: route output shows whether follow-up assurance was skipped, successful, or degraded.

## 12. V6 Supporting Libraries

- [ ] Harden [src/lib/v6/health-graph.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/health-graph.ts).
Objective: check every node/edge upsert result and page large source tables.
Done when: graph rebuild cannot silently succeed with incomplete writes.

- [ ] Harden [src/lib/v6/segments.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/segments.ts).
Objective: ensure segment recompute handles complete source data and reports insert failures.
Done when: recompute returns explicit completeness/failure metadata.

- [ ] Harden [src/lib/v6/outcomes.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/outcomes.ts).
Objective: prevent silent partial analytics from being returned as full truth.
Done when: callers can distinguish fully computed results from degraded results.

- [ ] Harden [src/lib/v6/review-boards.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/review-boards.ts).
Objective: separate packet generation correctness from notification side effects.
Done when: review board run creation remains successful even when notifications degrade.

- [ ] Harden [src/lib/v6/review-board-notifications.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v6/review-board-notifications.ts).
Objective: make email/slack delivery degradation visible without taking down packet generation.
Done when: notification outcomes are reported independently and URLs are canonical.

## 13. Non-Cron Route Surface Sweep

- [ ] Sweep export/import routes for ignored DB errors and partial-completeness issues.
Objective: prevent background job APIs from reporting success while persistence or progress tracking failed.
Done when: export/import route handlers check all critical writes and report degraded states consistently.

- [ ] Sweep integrations routes for provider failure isolation.
Objective: keep OAuth, CRM sync, calendar sync, token refresh, and callback routes from hiding upstream/provider errors.
Done when: upstream failures become typed route outcomes rather than generic throws or silent skips.

- [ ] Sweep Stripe and billing routes for dependency-blocked preflight behavior.
Objective: ensure missing Stripe provider config produces typed degraded responses instead of opaque failures.
Done when: checkout, portal, and webhook flows distinguish provider configuration failure clearly.

- [ ] Sweep external-token and public link routes for full route-contract consistency.
Objective: ensure public surfaces return stable auth, expiry, revocation, and dependency outcomes.
Done when: these routes use the same failure taxonomy as the rest of the surface.

- [ ] Sweep report-tracking routes for explicit write and redirect failure behavior.
Objective: avoid broken open/click instrumentation paths producing opaque failures.
Done when: track/open and track/click routes handle persistence failure safely and predictably.

## 14. Idempotency And Duplicate-Work Controls

- [ ] Add stronger idempotent guarantees for scheduled routes that insert runs, deliveries, packets, tasks, or findings.
Objective: prevent duplicate work under retries, race conditions, or overlapping schedule execution.
Done when: key scheduled routes rely on stronger uniqueness or claim semantics than best-effort scans.

- [ ] Add shared retry-safe claim helpers for cron job rows.
Objective: make “claim due work, mark in progress, complete or retry” reusable and auditable.
Done when: routes that process queues or backlogs share one hardened claim/write pattern.

## 15. Route Verification And Runtime Tests

- [ ] Expand [scripts/api-runtime-smoke.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/api-runtime-smoke.mjs) from unsigned-auth smoke to signed functional smoke.
Objective: verify that routes do more than reject unauthorized callers.
Done when: smoke can assert dependency-blocked, healthy, partial, and public-surface behavior classes.

- [ ] Expand [artifacts/assurance/api-runtime-smoke-registry.json](/Users/dizhou/Documents/Cursor/oblixa/artifacts/assurance/api-runtime-smoke-registry.json) with provider/env expectations and route outcome hints.
Objective: make runtime smoke generation semantically meaningful.
Done when: the registry can drive richer route probes than “unsigned reject” only.

- [ ] Expand [scripts/cron-canary.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/cron-canary.mjs) to assert route semantics, not just JSON shape and `ok`.
Objective: catch “route returned JSON but did not actually do its job”.
Done when: cron canary validates business-level signals or expected side effects for key scheduled routes.

- [ ] Expand [scripts/comprehensive-pass.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/comprehensive-pass.mjs) to cover scheduled-route side effects more deeply.
Objective: improve staging/runtime verification for the routes most likely to fail in production.
Done when: the comprehensive pass proves more than reachability and unsigned auth behavior.

- [ ] Add route-family regression tests for business failures, not just auth contracts.
Objective: cover provider failures, DB failures, write failures, and partial-success paths.
Done when: red-route families have targeted tests for realistic degraded scenarios.

- [ ] Add completeness tests for paginated batch helpers.
Objective: prevent future regressions to fixed hard caps or silent truncation.
Done when: test coverage fails if a helper processes only the first slice of a larger dataset.

- [ ] Add route-catalog assertions that high-risk routes declare provider prerequisites and failure classes.
Objective: make runtime expectations enforceable from code.
Done when: route inventory drift is caught automatically when new routes are added.

## 16. Observability And Support-Safe Diagnostics

- [ ] Add stable `diagnostic_id` coverage across high-risk route families.
Objective: ensure operators can group failures by known failure class instead of matching ad hoc messages.
Done when: high-risk scheduled and external routes emit stable machine-readable diagnostics.

- [ ] Add safe route-phase telemetry tags.
Objective: distinguish failures during `preflight`, `source_query`, `transform`, `persist`, `notify`, and `refresh` phases.
Done when: route failures can be bucketed by execution phase without leaking sensitive data.

- [ ] Add route-family dashboards or machine-readable runtime summary artifacts in code.
Objective: give runtime checks and support tooling a stable view of production route health classifications.
Done when: checks can distinguish auth failures, dependency blocks, partial runs, and unhandled errors automatically.

## 17. Completion Condition

This checklist is complete when all of the following are true:

- shared route wrappers provide typed, support-safe failure contracts
- route families that currently fail in production isolate per-item failures instead of failing whole batches
- hard scan caps and silent truncation are replaced with pagination, continuation, or explicit degraded reporting
- ignored Supabase query/write errors are eliminated from high-risk runtime paths
- provider and canonical-URL prerequisites are explicit and machine-readable
- runtime smoke, cron canary, and comprehensive-pass checks validate functional behavior instead of auth shape only
- high-risk route families have business-failure regression coverage for degraded scenarios
