# Autonomous Code-Only Operational Hardening Checklist

This document lists operational-hardening work that can be implemented autonomously in code alone. It is a planning and review artifact only. Runtime code, build code, tests, scripts, and CI workflows must not read this file as configuration.

The objective is to convert every automatable operational expectation into executable checks, deterministic generated artifacts, tests, fixtures, local pipelines, or CI gates while leaving production credentials, provider dashboards, live infrastructure, customer data, legal approvals, and release decisions untouched.

## Boundaries

Autonomous code-only work can:

- Add or update tests, static checks, mocked-provider fixtures, generated registries, release manifests, allowlists, baselines, ratchets, and CI workflow wiring.
- Add read-only verification scripts for provider configuration, environment parity, migration state, DNS posture, webhook readiness, and monitoring setup.
- Add local-only or staging-safe smoke tests that require explicit environment variables before making network calls.
- Add fail-closed guards for missing, malformed, mixed-environment, or unsafe configuration.
- Add deterministic reports and evidence bundles that summarize readiness without mutating external systems.
- Add forward-only migration scaffolds, SQL verification scripts, compatibility views, or local Supabase tests that are safe to review.
- Add code that supports safer operations, such as idempotency, lock handling, redaction, feature kill switches, and bounded retries.

Autonomous code-only work cannot directly:

- Use, infer, paste, rotate, or retrieve production secrets.
- Apply linked or production migrations.
- Mutate production data, customer data, provider dashboards, DNS, branch protection, Vercel projects, Supabase projects, Stripe live products, Resend domains, Sentry projects, Upstash databases, Slack apps, or monitoring dashboards.
- Approve releases, accept risk, certify compliance, approve legal positions, or waive findings without an explicit owner.
- Remove public contracts, persisted names, telemetry event names, SQL objects, webhook contracts, route paths, or package-script aliases without compatibility evidence.
- Treat markdown documents as runtime configuration.

For every excluded external action, code-only work should still add at least one of:

- A read-only verification command.
- A mocked-provider test.
- A staging-safe smoke test.
- A generated readiness artifact.
- A fail-closed configuration guard.
- An expiring waiver row with owner, reason, blocker class, validation command, and expiry.

## Checklist Status Key

- [ ] Not started.
- [ ] Implemented locally.
- [ ] Covered by deterministic artifact or ratchet.
- [ ] Wired into package script.
- [ ] Wired into CI or scheduled workflow.
- [ ] Blocked by external or manual boundary.

## 1. Operational Control Registry

- [x] Objective: create a code-owned operational-hardening objective registry.
  - Add a JSON registry under `config/` with objective id, owner area, severity, implementation command, evidence artifact, CI lane, waiver policy, and expiry requirement.
  - Add a schema test that rejects duplicate ids, missing commands, missing owner areas, stale expiry dates, and unknown severity values.
  - Acceptance criteria: every checklist objective that is automatable has a registry row and a deterministic validation command.
  - Completion evidence: added `config/operational-hardening-objectives.json`, `scripts/check-operational-hardening-objectives.mjs`, `check:operational-hardening-objectives`, and `write:operational-hardening-objectives`.

- [x] Objective: generate an operational-hardening closure manifest.
  - Add a script that reads code-owned registries, package scripts, workflows, generated artifacts, and test inventories.
  - Emit a deterministic artifact under `artifacts/` showing complete, partial, waived, and blocked objectives.
  - Acceptance criteria: the check fails when an objective has no validation command, no evidence artifact, or an expired waiver.
  - Completion evidence: generated `artifacts/operational-hardening-closure.json`; verified with `npm run check:operational-hardening-objectives`.

- [x] Objective: add a single operational readiness score.
  - Compute subscores for release, CI, Supabase, security, cron, observability, providers, privacy, dependencies, E2E, and disaster recovery.
  - Ratchet thresholds upward over time.
  - Acceptance criteria: a local check fails when the aggregate score or any required subscore drops below the ratchet.
  - Completion evidence: `artifacts/operational-hardening-closure.json` now reports objective count, implemented count, pending count, readiness score, and status/severity/owner-area counts.

- [x] Objective: make operational hardening discoverable from package scripts.
  - Add canonical scripts for local quick checks, deep operational checks, release readiness, provider readiness, and CI parity.
  - Add command-reference integrity checks for README, docs, workflows, and generated reports.
  - Acceptance criteria: every documented operational command exists and every package-script reference resolves.
  - Completion evidence: added `check:operational-hardening-objectives` and `write:operational-hardening-objectives`; `.github/workflows/ci.yml` runs the check, and `npm run check:hardening-ci-wiring` verifies CI wiring order.

## 2. Release Readiness

- [x] Objective: turn release readiness into executable checks.
  - Add a code-owned release checklist registry with required command, evidence artifact, owner area, and external/manual boundary classification.
  - Generate a release readiness report that does not read markdown as config.
  - Acceptance criteria: release readiness fails when required code-owned evidence is absent or stale.
  - Completion evidence: added `config/operational-release-readiness.json`, `scripts/check-operational-release-readiness.mjs`, `check:operational-release-readiness`, `write:operational-release-readiness`, and `artifacts/operational-release-readiness.json`; verified with `npm run check:operational-release-readiness`.

- [x] Objective: validate release environment contracts.
  - Add checks for local, CI, preview, staging, and production environment variable matrices.
  - Detect missing required variables, malformed URLs, wrong key prefixes, public-secret leakage, mixed staging/production credentials, and callback URL mismatches.
  - Acceptance criteria: production-like validation fails closed on mixed Supabase, Stripe, Upstash, Resend, Sentry, OpenAI, cron, HMAC, or encryption configuration.
  - Completion evidence: `config/operational-release-readiness.json` registers `check:env-example-parity`, `check:env-contract-hygiene`, `check:release-security-required-env`, and `check:callback-destination-integrity`; `scripts/check-release-security-required-env.mjs` now strict-validates provider URLs, key prefixes, mixed live/test/local signals, runtime secret quality, and token-encryption key shape, with negative coverage in `scripts/check-release-security-required-env.test.mjs`.

- [x] Objective: produce deterministic release evidence bundles.
  - Include commit SHA, package-lock hash, SBOM hash, OpenAPI hash, route inventory hash, migration manifest hash, generated artifact hashes, test command results, and Sentry release id when present.
  - Redact secrets and tenant identifiers.
  - Acceptance criteria: the bundle is stable across repeated runs when inputs do not change.
  - Completion evidence: `artifacts/operational-release-readiness.json` records commit SHA, hash-only evidence for package lock, SBOM, OpenAPI, route inventory, migration manifest, QA closure, hardening closure, security report checksums, and the release-readiness config/check/test files; the artifact records a Sentry release-id policy and is drift-checked by `npm run check:operational-release-readiness`.

- [x] Objective: add rollback-readiness code checks.
  - Verify Vercel rollback documentation references have a command/evidence placeholder, previous deployment id field, database forward-fix field, and migration risk classification.
  - Add migration metadata checks for destructive operations and forward-fix notes.
  - Acceptance criteria: a release candidate with destructive migration changes cannot pass without explicit rollback or forward-fix metadata.
  - Completion evidence: `config/operational-release-readiness.json` validates rollback rows for Vercel rollback target and database forward-fix metadata; `npm run report:migration-rollbacks` generates local migration risk, forward-fix, verification-query, and manual-action readiness without executing SQL.

- [x] Objective: add release-blocker taxonomy.
  - Encode blocker classes for migrations, secrets, branch protection, provider config, SLO breach, failing smoke, webhook failure, cron failure, and observability blind spots.
  - Acceptance criteria: release reports classify failures consistently and include next validation command.
  - Completion evidence: `config/operational-release-readiness.json` defines blocker classes for migration history, release env contracts, branch protection, provider callbacks, SLO budget, smoke, webhook delivery, cron health, and observability; `artifacts/operational-release-readiness.json` emits sorted blocker categories and next validation commands.

## 3. CI And Workflow Enforcement

- [x] Objective: make CI fail closed.
  - Audit workflows for secret-gated skips, `continue-on-error`, `|| true`, optional jobs, unchecked matrix exclusions, and missing artifact uploads.
  - Add an allowlist requiring owner, reason, expiry, and validation command.
  - Acceptance criteria: new silent skips or expired skip waivers fail CI.
  - Completion evidence: added `config/operational-ci-enforcement.json`, `scripts/check-operational-ci-enforcement.mjs`, `check:operational-ci-enforcement`, and `artifacts/operational-ci-enforcement.json`; the check governs secret-gated skips, `continue-on-error`, shell error ignores, optional jobs, matrix exclusions, and required artifact uploads with expiring owner/validation metadata.

- [x] Objective: enforce GitHub Actions least privilege.
  - Add static checks for workflow `permissions`, dangerous triggers, unpinned actions, mutable Docker tags, shell injection risks, artifact retention, and secret exposure.
  - Acceptance criteria: every workflow has explicit minimum permissions and third-party actions are pinned or waived.
  - Completion evidence: `check:operational-ci-enforcement` delegates to `check:github-workflows-security`, `check:github-actions-permissions`, `check:github-workflows-yaml`, and `check:workflow-tier-coverage`; CI runs the aggregate check through `.github/workflows/ci.yml`.

- [x] Objective: verify branch-protection expectations in code.
  - Add a read-only script that can compare expected required checks against GitHub branch protection when credentials are available.
  - Add a local static fallback that validates expected required-check names against workflow job names.
  - Acceptance criteria: stale required-check names and missing aggregate jobs fail local checks.
  - Completion evidence: `check:operational-ci-enforcement` requires `check:branch-protection-drift` and validates the CI static fallback jobs `quality_static_security`, `quality_static_surface`, `quality_static_governance`, `quality_static_codehealth`, `quality_unit`, `quality_security`, `quality_build_e2e`, and `quality`.

- [x] Objective: add merge-queue parity checks.
  - Verify merge queue workflows run equivalent gates to PR workflows.
  - Check that merge group events include security, build, E2E, dependency, and release-adjacent jobs.
  - Acceptance criteria: a required PR gate cannot be omitted from merge queue without an active waiver.
  - Completion evidence: `.github/workflows/qa-merge-queue-canary.yml` now runs for `merge_group`; `scripts/check-merge-queue-canary-parity.mjs` and `check:operational-ci-enforcement` require the expected CI checks and security, build, E2E, dependency, and release categories.

- [x] Objective: enforce workflow artifact hygiene.
  - Add checks for artifact names, retention windows, redaction, SARIF upload paths, JUnit merge paths, and report checksums.
  - Acceptance criteria: artifacts containing logs, traces, HAR files, screenshots, or reports pass redaction checks before upload.
  - Completion evidence: `check:operational-ci-enforcement` requires `check:ci-artifact-secret-leakage`, validates configured artifact-producing jobs have uploads, and records artifact governance in `artifacts/operational-ci-enforcement.json`.

## 4. Package Scripts And Local Pipelines

- [x] Objective: make script orchestration explicit.
  - Generate a package-script graph and detect missing scripts, cycles, dead scripts, alias-only scripts, and dangerous shell patterns.
  - Acceptance criteria: every operational script has a registry owner and either a direct test, pipeline inclusion, or waiver.
  - Completion evidence: added `config/operational-package-pipelines.json`, `scripts/check-operational-package-pipelines.mjs`, `check:operational-package-pipelines`, `write:operational-package-pipelines`, and `artifacts/operational-package-pipelines.json`; the artifact records 811 package scripts, 769 operational scripts, graph edges, cycle count, alias-only scripts, workflow references, owner rules, and dangerous shell pattern findings.

- [x] Objective: standardize pipeline tiers.
  - Define quick, static, security, surface, integration, E2E, release, and maximal tiers as code-owned pipelines.
  - Ensure deep pipelines reuse smaller verified units instead of drifting into separate command lists.
  - Acceptance criteria: pipeline parity checks fail when CI and local command sets diverge.
  - Completion evidence: `config/operational-package-pipelines.json` defines quick, static, security, surface, integration, E2E, release, and maximal tiers; `check:operational-package-pipelines` validates package-script existence, QA tier manifest references, workflow references, `check:tier-coverage:strict`, and `check:workflow-tier-coverage:strict`.

- [x] Objective: add deterministic output rules.
  - Require sorted filesystem walks, stable JSON key order, normalized paths, deterministic timestamps, and stable random seeds in operational scripts.
  - Acceptance criteria: running check/write/check cycles twice produces no diff.
  - Completion evidence: `check:operational-package-pipelines` writes and drift-checks `artifacts/operational-package-pipelines.json`, delegates deterministic-script validation to `check:static-check-determinism`, and includes deterministic generated artifacts in `check:generated-artifact-hygiene`.

- [x] Objective: add generated artifact ownership.
  - Maintain a registry of generated artifacts, write commands, check commands, owners, and cleanup policy.
  - Acceptance criteria: generated files cannot drift from their write command without failing a check.
  - Completion evidence: `scripts/check-generated-artifact-hygiene.mjs` now includes operational hardening artifacts with write commands, and `check:operational-package-pipelines` maps generated artifact paths to owner areas and cleanup policy in `artifacts/operational-package-pipelines.json`.

## 5. Supabase And Database Operations

- [x] Objective: harden migration readiness checks.
  - Validate migration naming, ordering, manifest coverage, idempotency, transaction safety, destructive SQL, unsafe grants, unqualified `search_path`, and rollback/fix-forward metadata.
  - Acceptance criteria: every migration has deterministic manifest coverage and unsafe patterns are blocked or explicitly waived.
  - Completion evidence: added `config/operational-supabase-database.json`, `scripts/check-operational-supabase-database.mjs`, `check:operational-supabase-database`, and `artifacts/operational-supabase-database.json`; the aggregate delegates to migration manifest, organization, idempotency, strict security-pattern, and rollback-readiness checks.

- [x] Objective: add linked-project safety guards.
  - Require explicit flags for linked Supabase checks.
  - Print project ref and environment class without secrets.
  - Refuse production-like commands unless running in read-only or dry-run mode.
  - Acceptance criteria: default commands cannot apply linked migrations or mutate linked data.
  - Completion evidence: `scripts/check-supabase-operational-readiness.mjs` now emits a secret-free environment summary with `projectRef`, `environmentClass`, and `mutatingCommandsAllowed: false`; `check:operational-supabase-database` verifies default Supabase commands are not linked/mutating and optional linked commands are read-only.

- [x] Objective: generate RLS and tenant-scope evidence.
  - Inventory tenant tables, policies, views, functions, triggers, storage buckets, and grants.
  - Add local SQL tests for anon, authenticated same-org, authenticated cross-org, wrong-role, and service-role-only paths.
  - Acceptance criteria: every tenant-owned table has RLS evidence or a service-role-only classification.
  - Completion evidence: `check:operational-supabase-database` validates `check:rls-sanity-tables`, `check:tenant-table-schema-constraints`, `check:rls-policy-drift`, `test:rls-smoke`, `check:sql-security-migrations-bundle`, `check:sql-security-automation-coverage`, `artifacts/assurance/rls-sanity-tables.json`, and RLS smoke SQL fixtures.

- [x] Objective: verify security definer and view safety.
  - Detect unsafe `SECURITY DEFINER`, missing `security_invoker`, broad grants, mutable helper functions, and policy recursion hazards.
  - Acceptance criteria: any security-sensitive SQL object has an owner, reason, test, and grant boundary.
  - Completion evidence: `check:operational-supabase-database` validates `check:sql-definer-invoker-inventory`, `check:sql-security-migrations-bundle`, strict migration security patterns, `artifacts/assurance/sql-definer-invoker-inventory.json`, and `supabase/tests/view_invoker_smoke.sql`.

- [x] Objective: add retention and legal-hold checks.
  - Inventory tables containing operational logs, audit events, tokens, webhook events, OAuth states, transient runtime artifacts, uploads, exports, and PII-like fields.
  - Test retention pruning and legal-hold exceptions locally.
  - Acceptance criteria: retention behavior is covered by deterministic SQL or unit tests.
  - Completion evidence: `check:operational-supabase-database` validates `check:supabase:retention-inventory`, `check:retention-policy`, `check:privacy-inventory`, `artifacts/supabase/data-retention-inventory.json`, the legal-hold migration, and DSR export/delete legal-hold guards.

- [x] Objective: add database backup and restore evidence placeholders.
  - Add code-owned DR drill scripts that verify required env presence and produce a redacted drill report, without restoring production data.
  - Acceptance criteria: restore drills are represented by a validation command and manual boundary row.
  - Completion evidence: added `config/database-backup-restore-evidence.json`, `scripts/check-database-backup-restore-evidence.mjs`, `check:database-backup-restore-evidence`, `write:database-backup-restore-evidence`, `artifacts/supabase/database-backup-restore-evidence.json`, and the `manual-database-restore-drill` manual boundary row.

## 6. Cron, Jobs, And Scheduled Work

- [x] Objective: inventory every scheduled route.
  - Generate a registry from `vercel.json`, route files, cron auth helpers, and test coverage.
  - Include schedule, method, auth scheme, owner area, expected duration, idempotency policy, lock policy, retry policy, and SLO.
  - Acceptance criteria: a scheduled route in `vercel.json` without registry and test coverage fails.
  - Completion evidence: added `config/operational-cron-jobs.json`, `scripts/check-operational-cron-jobs.mjs`, `check:operational-cron-jobs`, `write:operational-cron-jobs`, and `artifacts/operational-cron-jobs.json`; the registry is generated from `vercel.json`, route files, route tests, wrapper helpers, max duration exports, expected response keys, and SLO cadence parsing.

- [x] Objective: enforce cron authentication.
  - Add tests for missing secret, wrong secret, valid bearer secret, valid header secret, GET/POST behavior, unexpected method, and strict 404 behavior.
  - Acceptance criteria: every cron route fails closed and returns a consistent error shape.
  - Completion evidence: `check:operational-cron-jobs` validates `check:cron-route-auth`, `check:scheduled-cron-route-wrappers`, `src/lib/security/cron-route-gate.test.ts`, `src/lib/security/cron-auth.test.ts`, `e2e/cron-routes-smoke.spec.ts`, `e2e/cron-bearer-parity.spec.ts`, and `scripts/lib/cron-http-probe.mjs`.

- [x] Objective: add idempotency and lock coverage.
  - Test duplicate cron invocation, retry after timeout, stale lock recovery, partial batch failure, and duplicate durable writes.
  - Acceptance criteria: repeated execution cannot create duplicate durable side effects.
  - Completion evidence: `check:operational-cron-jobs` delegates to `check:idempotency-policy`, `check:job-lock-guards`, and `check:duplicate-execution-policy`, and validates route-runner duplicate execution markers plus single-flight and partial-failure tests.

- [x] Objective: add cron observability contracts.
  - Require structured result fields: route id, job id, started at, duration, processed, skipped, failed, retry count, error class, and `ok`.
  - Acceptance criteria: cron smoke tests fail when a route omits required telemetry fields.
  - Completion evidence: `src/lib/cron/route-runner.ts` now emits the shared cron envelope (`route`, `job_id`, `started_at`, `durationMs`, `processed_count`, `skipped_count`, `failed_count`, `retry_count`, `errors_count`, `ok`) and `src/lib/cron/route-runner.test.ts` asserts the envelope.

- [x] Objective: add schedule drift checks.
  - Compare `vercel.json` schedules with generated cron registry, expected cadence, max duration, and SLO windows.
  - Acceptance criteria: schedule, route, or duration changes require registry updates in the same PR.
  - Completion evidence: `check:operational-cron-jobs` fails on schedule, route, expected-key, test, wrapper, max-duration, cadence, SLO, or artifact drift and is wired into CI hardening.

## 7. Webhooks And External Callbacks

- [x] Objective: branch-cover webhook handlers with fixtures.
  - Add signed fixture corpora for success, duplicate delivery, bad signature, stale timestamp, unknown event, malformed payload, wrong content type, retry, and provider outage.
  - Acceptance criteria: every webhook event family has positive, negative, duplicate, and replay tests.
  - Completion evidence: added `src/lib/security/webhook-callback-fixtures.ts`, `src/lib/security/webhook-callback-fixtures.test.ts`, `config/operational-webhooks-callbacks.json`, `scripts/check-operational-webhooks-callbacks.mjs`, and `artifacts/operational-webhooks-callbacks.json`; Stripe webhook tests now cover duplicate delivery, bad signature, stale timestamp, malformed payload, wrong content type, unknown event, and provider outage, while outbound dispatch, Slack, email, integration callback, OAuth, and auth callback fixtures are validated by the aggregate.

- [x] Objective: enforce webhook idempotency.
  - Require durable event ids, unique constraints, replay-safe handlers, and transaction-safe side effects.
  - Acceptance criteria: duplicate fixture replay produces one durable side effect.
  - Completion evidence: `check:operational-webhooks-callbacks` delegates to `check:duplicate-execution-policy`, `check:idempotency-policy`, `check:webhook-inbound-policy`, and `check:inbound-identity-boundaries`; it validates Stripe durable event claims, outbound delivery upserts, action-callback idempotent updates, OAuth state consumption, and fixture replay-safety markers.

- [x] Objective: validate callback destination integrity.
  - Add tests for OAuth callback state, redirect allowlists, path canonicalization, domain strictness, custom schemes, open redirects, and private-network URLs.
  - Acceptance criteria: callback routes reject untrusted or ambiguous destinations.
  - Completion evidence: `check:operational-webhooks-callbacks` delegates to `check:callback-destination-integrity`, `check:callback-domain-strictness`, `check:auth-callback-guardrails`, `check:oauth-state-integrity`, `check:oauth-pkce-enforcement`, and `check:origin-referrer-enforcement`; the fixture corpus records open-redirect, private-network, and custom-scheme callback abuse cases.

- [x] Objective: add provider callback readiness checks.
  - Validate expected callback URLs for Stripe, Supabase Auth, Slack or other integrations when env variables are present.
  - Acceptance criteria: malformed or mixed-environment callback URLs fail release-adjacent checks.
  - Completion evidence: `config/operational-webhooks-callbacks.json` records expected callback paths and optional provider endpoint env keys; `check:operational-webhooks-callbacks` fail-closes when a present callback URL env value is malformed, mismatched with `NEXT_PUBLIC_APP_URL`, includes query/hash, or points at the wrong callback path, and CI runs the aggregate check.

## 8. Secrets And Configuration Safety

- [x] Objective: enforce secret location boundaries.
  - Check `.env.example`, tests, fixtures, scripts, docs, generated artifacts, logs, and client bundles for secret-like values.
  - Require placeholder allowlists with owner, reason, and expiry.
  - Acceptance criteria: no secret-like value can be committed without classification.
  - Completion evidence: added `config/operational-secrets-configuration.json`, `scripts/check-operational-secrets-configuration.mjs`, `check:operational-secrets-configuration`, `write:operational-secrets-configuration`, and `artifacts/operational-secrets-configuration.json`; the aggregate delegates to tracked-secret, static-secret, fixture-secret, CI artifact, and gitleaks allowlist checks and validates expiring placeholder allowlist metadata.

- [x] Objective: prevent public client secret leakage.
  - Detect sensitive names or values under `NEXT_PUBLIC_*`.
  - Check client bundles and serialized props for secret-like values.
  - Acceptance criteria: secret-like public environment variables fail unless explicitly safe by pattern and owner.
  - Completion evidence: `check:operational-secrets-configuration` validates NEXT_PUBLIC allowlist parity, delegates to `check:next-public-surface`, `check:client-bundle-secret-leakage`, and `check:env-contract-hygiene`, and records client-bundle and public-env boundary coverage in the generated artifact.

- [x] Objective: add token-quality checks.
  - Validate local placeholder length, entropy class, prefix consistency, and rotation metadata for secrets that can be checked without knowing real values.
  - Acceptance criteria: weak placeholder or malformed test credentials fail static checks.
  - Completion evidence: the aggregate requires `check:secrets-env-token-quality`, `check:token-security-quality`, `check:security-env-contract`, and `check:release-security-required-env`; `.env.example` now includes previous-secret expiry metadata for Stripe webhooks and external submit tickets.

- [x] Objective: add secret-rotation readiness.
  - Add code support and tests for dual-read or versioned secrets where applicable, including HMAC, integration token encryption, cron secret, signed links, and provider webhook secrets.
  - Acceptance criteria: rotation-sensitive code paths have tests for current, previous, expired, and invalid secrets.
  - Completion evidence: added shared `rotatingSecretCandidates` coverage, Stripe webhook previous-secret verification, external submit-ticket previous-secret verification, and an operational rotation contract registry covering cron, internal HMAC, Stripe webhooks, external submit tickets, inbound automation tokens, and versioned integration-token encryption.

## 9. Auth, Authorization, And Session Operations

- [x] Objective: generate a role and workspace-mode matrix.
  - Include public, authenticated, owner, admin, member, viewer, external token, service role, Core, Advanced, and Assurance expectations.
  - Acceptance criteria: every protected route and server action has a matrix row and negative test.
  - Completion evidence: `config/operational-authz-session.json` and `artifacts/operational-authz-session.json` now encode principal classes, workspace modes, role capabilities, protected API route rows, server action rows, policy matches, and delegated negative-test gates.

- [x] Objective: enforce deterministic organization resolution.
  - Test missing org, multiple orgs, inactive org, suspended org, stale selected org, and cross-org path parameters.
  - Acceptance criteria: code never falls back to an ambiguous organization for protected reads or writes.
  - Completion evidence: `src/lib/supabase/org-scoped-admin.ts` now fails closed for ambiguous membership and inactive/suspended operational org state, with targeted coverage in `src/lib/supabase/org-scoped-admin.test.ts` and aggregate enforcement via `check:operational-authz-session`.

- [x] Objective: harden session lifecycle behavior.
  - Add tests for sign-in, sign-out, password reset, callback, expired session, stale cookies, session fixation, MFA-required orgs, and account recovery abuse.
  - Acceptance criteria: all auth state transitions have deterministic test evidence.
  - Completion evidence: `check:operational-authz-session` delegates to session lifecycle, session fixation, auth cookie, auth callback, and auth error-shape gates and records the session transition registry in the generated artifact.

- [x] Objective: enforce sensitive-action step-up.
  - Inventory destructive or sensitive actions and require step-up metadata.
  - Test missing, expired, wrong-org, and valid step-up proof.
  - Acceptance criteria: sensitive actions fail closed without recent proof.
  - Completion evidence: `check:operational-authz-session` delegates to `check:sensitive-action-step-up`, records proof scenarios, and verifies step-up source/test markers for session revocation, MFA, account deletion, OAuth start, and maintenance actions.

## 10. API Runtime Contracts

- [x] Objective: generate a complete API route inventory.
  - Include route path, method, auth mode, runtime, cache policy, rate-limit policy, request schema, response schema, owner area, and tests.
  - Acceptance criteria: new `route.ts` files fail checks until inventoried.
  - Completion evidence: `check:operational-api-runtime-contracts` now builds `artifacts/operational-api-runtime-contracts.json` from the route universe, OpenAPI spec, API route test evidence, and runtime smoke registry, and CI runs the aggregate gate.

- [x] Objective: enforce HTTP semantics.
  - Test supported methods, unsupported methods, `OPTIONS`, `Accept`, `Content-Type`, redirects, gzip, cache, and CORS expectations.
  - Acceptance criteria: every API family has consistent status codes and headers.
  - Completion evidence: the aggregate gate delegates to `check:http-method-policy`, `check:api-cors-policy`, `check:sensitive-cache-controls`, and `check:api-route-guard-normalization`, while recording method, cache, rate-limit, body-policy, and expected-status rows for every API route.

- [x] Objective: standardize API error responses.
  - Add schema checks for 400, 401, 403, 404, 405, 409, 413, 415, 422, 429, and 500-class fallbacks where applicable.
  - Acceptance criteria: errors do not leak stack traces, SQL details, secrets, or tenant identifiers.
  - Completion evidence: `src/lib/http/problem.ts` now includes support-safe 422 handling through `jsonUnprocessableEntity`, `check:api-problem-json` requires the full status-helper set, and `check:operational-api-runtime-contracts` verifies required problem statuses and delegated redaction checks.

- [x] Objective: enforce request and response size limits.
  - Add body, header, query, multipart, export, import, and decompression-bomb guards.
  - Acceptance criteria: oversized inputs fail with deterministic status and no excessive memory growth.
  - Completion evidence: the aggregate gate requires `check:json-body-limited-adoption`, `check:request-framing-guards`, `check:response-size-guards`, and `check:decompression-bomb-guards`, and records bounded request/response evidence in the generated artifact.

- [x] Objective: add runtime smoke registry.
  - Generate safe smoke entries for GET, HEAD, OPTIONS, health, public, auth-required, and tokenized routes.
  - Acceptance criteria: every safe route has smoke coverage or an expiring waiver.
  - Completion evidence: `check:operational-api-runtime-contracts` validates `artifacts/assurance/api-runtime-smoke-registry.json` against the route filesystem, verifies required runner categories, and delegates to `check:api-runtime-smoke-registry` and runtime health probe contracts.

## 11. Rate Limits, Abuse Controls, And Resource Bounds

- [x] Objective: inventory rate-limit coverage.
  - Map limits for auth, contact, upload, import, export, search, reports, webhooks, cron, public tokens, and expensive AI paths.
  - Acceptance criteria: every externally reachable mutation has a limit or documented reason.
  - Completion evidence: added `config/operational-rate-limits-abuse-bounds.json`, `scripts/check-operational-rate-limits-abuse-bounds.mjs`, `check:operational-rate-limits-abuse-bounds`, and `artifacts/operational-rate-limits-abuse-bounds.json`; the aggregate records route rate-limit policy counts, surface-category coverage, explicit/special mutation counts, and documented session-mutation rationale.

- [x] Objective: test rate-limit behavior.
  - Cover allowed request, boundary request, exceeded request, distributed key behavior, malformed identity, and provider outage.
  - Acceptance criteria: throttled responses include consistent status, body, and `Retry-After` where required.
  - Completion evidence: added provider-outage coverage in `src/lib/rate-limit.provider-outage.test.ts`; `check:operational-rate-limits-abuse-bounds` verifies rate-limit unit tests, route-level 429 tests, `jsonRateLimited` problem-shape coverage, distributed limiter fallback behavior, and key-cardinality checks.

- [x] Objective: bound expensive operations.
  - Add timeouts, concurrency caps, page-size caps, export-size caps, file-size caps, and provider cost caps.
  - Acceptance criteria: expensive paths cannot run unbounded in tests or production code.
  - Completion evidence: the aggregate delegates to `check:timeout-budget-guards`, `check:concurrency-cap-guards`, `check:pagination-guardrails`, `check:response-size-guards`, and `check:export-security-guards`, and records the passing delegated-check summary in the operational artifact.

- [x] Objective: detect regex and parser DoS risks.
  - Add static scans and adversarial fixtures for hot regexes, parsers, CSV, PDF, DOCX, JSON, URL, and calendar parsing.
  - Acceptance criteria: risky patterns require a bounded alternative or waiver.
  - Completion evidence: replaced `check:regex-dos-risk` with an exported deterministic ReDoS analyzer and fixtures, wired it into CI/security pipeline, and included it with `check:parser-risk-controls`, `check:decompression-bomb-guards`, `check:json-body-limited-adoption`, `check:request-framing-guards`, and `check:callback-destination-integrity` in the operational aggregate.

## 12. Observability And Redaction

- [x] Objective: standardize structured logging.
  - Require request id, route id, operation id, org id hash, user id hash, job id, provider, status, duration, and error class where applicable.
  - Acceptance criteria: core route and job wrappers emit required fields without secrets or raw PII.
  - Completion evidence: added `src/lib/observability/operational-span.ts` with stable span/log attributes, org/user hashing, provider/job/status/duration/error fields, and wrapper tests; `check:operational-observability-redaction` records structured API, route-runner, cron, and span coverage in `artifacts/operational-observability-redaction.json`.

- [x] Objective: enforce telemetry redaction.
  - Test logs, Sentry tags, telemetry events, reports, traces, HAR files, screenshots, and CI artifacts for secret-like and PII-like values.
  - Acceptance criteria: redaction checks run before artifact upload or report publication.
  - Completion evidence: exported and delegated Sentry tag and report-redaction analyzers, wired `check:sentry-tag-banlist` into CI/security pipeline, and aggregated log, Sentry, persistence, report, AI-context, telemetry inventory, CI artifact, and generated-artifact redaction checks.

- [x] Objective: add Sentry release and source-map checks.
  - Verify release id derivation, source map upload settings, DSN presence rules, sample-rate env parsing, and disabled-state behavior.
  - Acceptance criteria: Sentry can be disabled safely, and enabled environments have coherent release metadata.
  - Completion evidence: the aggregate validates server, edge, and client Sentry configs, `getSentryRelease` priority tests, DSN disabled-state tests, and `next.config.ts` source-map upload settings (`silent`, CI-only widened uploads, release env propagation, and Vercel monitor settings).

- [x] Objective: add OpenTelemetry wrapper contracts.
  - Add wrapper tests for API routes, cron routes, webhooks, provider calls, and background jobs.
  - Acceptance criteria: spans include stable names and sanitized attributes.
  - Completion evidence: `src/lib/observability/operational-span.test.ts` covers API route, cron route, webhook, provider call, and background job span names, sanitized attributes, identity hashes, and success/error wrapper emission.

- [x] Objective: generate an alert and SLO readiness report.
  - Produce code-owned expected monitors for login, dashboard, API errors, cron misses, webhook failures, extraction failures, billing failures, and email failures.
  - Acceptance criteria: report identifies which monitors are code-covered, provider-verified, or manual-boundary only.
  - Completion evidence: `config/operational-observability-redaction.json` defines all eight expected monitors with code markers, provider verification state, and manual boundaries; `artifacts/operational-observability-redaction.json` reports code-covered, provider-verified, and manual-boundary counts.

## 13. Security Headers And Browser Isolation

- [x] Objective: enforce security header contracts.
  - Test CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, frame restrictions, COOP, COEP, CORP, and cache controls by route family.
  - Acceptance criteria: public, auth, dashboard, external token, and API surfaces have expected headers.
  - Completion evidence: added `config/operational-browser-security.json`, `scripts/check-operational-browser-security.mjs`, `check:operational-browser-security`, and `artifacts/operational-browser-security.json`; the aggregate records public, auth, dashboard, external-token, and API route-family header contracts and delegates to security-header, browser-isolation, Permissions-Policy, content-sniffing, and sensitive-cache gates.

- [x] Objective: harden CSP rollout.
  - Add checks for nonce/hash consistency, strict script/style enforcement, report-only rollback envs, unsafe-inline regressions, third-party script integrity, and connect/img/font source drift.
  - Acceptance criteria: CSP changes require deterministic test and drift evidence.
  - Completion evidence: `buildSecurityHeaders` now emits `Reporting-Endpoints` plus CSP `report-uri` and `report-to` directives for `/api/security/csp-report`; `check:operational-browser-security` validates CSP rollout markers, `check:csp-nonce-hash-consistency`, `check:unsafe-inline-regressions`, `check:third-party-script-integrity`, `check:next-script-integrity`, and `check:reporting-endpoints`, all wired into CI/security pipeline.

- [x] Objective: prevent client-side data leakage.
  - Add checks for localStorage/sessionStorage sensitivity, URL token propagation, browser cache sensitivity, RSC prop serialization, and client bundle secrets.
  - Acceptance criteria: sensitive values are not persisted or serialized into client-visible surfaces unless explicitly allowed.
  - Completion evidence: the aggregate validates client-storage helper boundaries, client bundle reachability, sensitive URL stripping, JSON-LD serialization, RSC/cache boundary tests, `check:client-storage-sensitivity`, `check:client-cache-sensitivity`, `check:sensitive-url-propagation`, `check:client-bundle-secret-leakage`, `check:xss-client-exposure`, and `check:next-public-surface`.

- [x] Objective: add browser isolation smoke tests.
  - Use Playwright to verify header behavior, blocked framing where applicable, no mixed content, and no unexpected third-party network calls.
  - Acceptance criteria: smoke tests cover public and authenticated representative routes.
  - Completion evidence: `e2e/security-headers-smoke.spec.ts` now verifies CSP reporting directives and explicit clickjacking defenses; `check:operational-browser-security` validates the smoke coverage for public, dashboard, API, and public-token routes and references the advanced browser header smoke bundle.

## 14. Uploads, Files, And Extraction

- [x] Objective: harden upload validation.
  - Test file size, MIME sniffing, extension mismatches, empty files, malformed files, multi-part abuse, path traversal, duplicate uploads, and cross-org storage paths.
  - Acceptance criteria: upload routes reject unsafe files before durable processing.
  - Completion evidence: added `config/operational-uploads-files-extraction.json`, `scripts/check-operational-uploads-files-extraction.mjs`, `check:operational-uploads-files-extraction`, and `artifacts/operational-uploads-files-extraction.json`; server upload paths now use `buildContractStoragePath`, signed downloads parse and compare org/contract path scope, and upload batches de-duplicate valid duplicate files before durable storage.

- [x] Objective: add parser fault corpora.
  - Include malformed PDF, malformed DOCX, oversized document, decompression bomb, embedded script, metadata leakage, Unicode controls, and unsupported encoding fixtures.
  - Acceptance criteria: parser failures are bounded, redacted, and recoverable.
  - Completion evidence: the aggregate delegates to `check:parser-risk-controls`, `check:decompression-bomb-guards`, and `check:regex-dos-risk`, and validates parser fault markers for malformed PDF/DOCX, page/text/buffer caps, unsafe DOCX internal names, compression-ratio bombs, import parser bounds, and script-stripping fallback parsing.

- [x] Objective: harden AI extraction.
  - Add prompt-injection corpora, schema validators, source-citation checks, cost caps, timeout caps, malformed model output tests, and provider outage tests.
  - Acceptance criteria: model output cannot bypass human-review or source-backed field confirmation.
  - Completion evidence: the aggregate delegates to `check:ai-boundary-contract`, `check:ai-prompt-injection-guards`, `check:ai-context-redaction`, `check:ai-tool-call-authz`, `check:timeout-budget-guards`, and `check:concurrency-cap-guards`; it also validates prompt delimiter, strict schema, malformed output, source-citation, grounding, model-context redaction, and provider-failure markers.

- [x] Objective: test generated exports.
  - Cover CSV formula injection, PDF metadata stripping, content-disposition safety, signed-link scope, token expiry, redaction, and large-export limits.
  - Acceptance criteria: exports are safe for cross-org, tokenized, and spreadsheet-opening scenarios.
  - Completion evidence: rewrote `check:binary-metadata-stripping` as a deterministic PDF/export metadata guard, added safe decision-packet PDF metadata defaults and tests, and aggregated CSV formula, filename/content-disposition, private cache, signed-link scope/nonce, response-size, and PDF download controls.

## 15. Provider Integrations

- [x] Objective: harden Stripe integration in code.
  - Add fixture coverage for checkout completed, subscription updated, subscription deleted, invoice failed, portal return, duplicate event, stale signature, bad signature, wrong mode, and missing customer.
  - Acceptance criteria: billing state transitions are deterministic and replay-safe.
  - Completion evidence: added Stripe test/live mode enforcement, webhook livemode rejection, payment-failed billing state/audit handling, provider fixture coverage, and aggregate validation in `check:operational-provider-integrations`.

- [x] Objective: harden email integration in code.
  - Add template rendering, sanitization, sender format, unsubscribe header, delivery failure, retry, bounce-safe, and no-secret tests.
  - Acceptance criteria: all email paths render valid sanitized output from fixture data.
  - Completion evidence: added email provider policy helpers/tests, SPF/DKIM/DMARC/MX/MTA-STS fixture validation, Resend timeout/sender enforcement, provider error redaction, and aggregate provider fixture checks.

- [x] Objective: harden OpenAI integration in code.
  - Add request redaction, timeout, retry, circuit breaker, budget, schema, and refusal/fallback tests.
  - Acceptance criteria: provider errors produce bounded user-facing states and sanitized logs.
  - Completion evidence: added explicit OpenAI attempt timeout budgets for field extraction and PDF OCR, retained structured-output/redaction/fallback checks, and delegated `check:ai-*`, timeout, and circuit-breaker validation through `check:operational-provider-integrations`.

- [x] Objective: harden Redis/rate-limit integration in code.
  - Add Upstash success, outage, timeout, malformed response, latency, and local fallback tests.
  - Acceptance criteria: rate-limit behavior follows the configured fail-open or fail-closed policy explicitly.
  - Completion evidence: added Upstash result normalization, malformed-response fail-safe handling, timeout tests, unsafe key sanitization coverage, and aggregate Redis/rate-limit delegated checks.

- [x] Objective: harden OAuth/integration token storage.
  - Add tests for state integrity, PKCE, token encryption, key versioning, refresh failure, revocation, and token re-encryption tooling.
  - Acceptance criteria: integration tokens are never logged, exposed to client code, or stored unhashed/unencrypted where policy forbids it.
  - Completion evidence: added provider fixture coverage for OAuth state/PKCE/encryption/reencryption, redacted refresh-token provider failures before persistence, and wired token-quality/reencryption evidence into `artifacts/operational-provider-integrations.json`.

## 16. Data Lifecycle, Privacy, And Auditability

- [x] Objective: generate a privacy inventory.
  - Map tables, columns, storage buckets, telemetry events, exports, providers, and retention class.
  - Acceptance criteria: PII-like fields require retention, redaction, access, and deletion classification.
  - Completion evidence: expanded `PRIVACY_SAFE_RECORD_INVENTORY` to include table columns, storage buckets, telemetry events, export surfaces, providers, and PII classification validation, with aggregate evidence in `artifacts/operational-privacy-auditability.json`.

- [x] Objective: test DSAR and export completeness.
  - Add fixtures proving user/org export includes required records and excludes other tenants.
  - Acceptance criteria: DSAR exports are deterministic and tenant-isolated.
  - Completion evidence: added deterministic DSAR fixture builder/tests for user and organization exports, sanitized audit metadata, and tenant-isolation issue detection.

- [x] Objective: test deletion and retention cascades.
  - Cover org deletion, user deletion, token revocation, upload deletion, report deletion, and legal-hold exceptions.
  - Acceptance criteria: deletion behavior is covered locally without production data.
  - Completion evidence: added local-only lifecycle cascade plans/tests for organization deletion, user deletion, token revocation, upload deletion, report deletion, and legal-hold blocking.

- [x] Objective: harden audit events.
  - Inventory sensitive actions requiring audit events.
  - Test event shape, actor, target, org, timestamp source, redaction, append-only constraints, and no update/delete policy where required.
  - Acceptance criteria: sensitive mutations cannot pass tests without audit coverage.
  - Completion evidence: added sensitive audit event policy/tests, expanded audit coverage checks, and required append-only audit table contract markers.

- [x] Objective: add optional tamper-evident audit-chain scaffolding.
  - Add local-only hash-chain utilities and tests without enabling production migration by default.
  - Acceptance criteria: the scaffold is disabled unless explicitly adopted and has no external side effects.
  - Completion evidence: added disabled-by-default audit hash-chain utilities/tests with deterministic hashes, tamper detection, and no external side effects.

## 17. Supply Chain And Dependency Risk

- [x] Objective: generate dual-format SBOM evidence.
  - Produce CycloneDX and SPDX artifacts, validate schema, compare dependency counts, and hash outputs.
  - Acceptance criteria: dependency changes update SBOM evidence or fail checks.
  - Implemented: `check:sbom-dual-format-evidence` generates `artifacts/spdx-sbom.json` and `artifacts/sbom-dual-format-evidence.json`, validates CycloneDX/SPDX shape, compares lockfile/CycloneDX/SPDX counts, records SHA-256 hashes, and fails on artifact drift.

- [x] Objective: enforce dependency policy.
  - Add checks for known vulnerabilities, transitive denylist, license policy, typosquat risk, dependency confusion, install scripts, lockfile integrity, and native/WASM inventory.
  - Acceptance criteria: dependency risk reports block on configured severity thresholds.
  - Implemented: `check:supply-chain-dependency-risk` enforces `config/supply-chain-dependency-risk.json`, npm audit/OSV/dependency-review high thresholds, malicious package denylist, typosquat guards, registry confusion checks, lockfile integrity, license allowlist, install-script allowlist, and native/WASM ownership inventory.

- [x] Objective: harden static-analysis coverage.
  - Enforce CodeQL, Semgrep, Trivy, npm audit, dependency review, OpenSSF Scorecard, and custom security checks through CI parity.
  - Acceptance criteria: each scanner has threshold, SARIF/report output, owner, and waiver policy.
  - Implemented: `config/operational-supply-chain-risk.json` records scanner owner, threshold, output, workflow markers, and waiver policy for CodeQL, Semgrep, Trivy, npm audit, dependency review, OpenSSF Scorecard, and custom checks; `check:operational-supply-chain-risk` enforces CI/pipeline parity.

- [x] Objective: add release provenance checks.
  - Verify reproducible build hash where feasible, release artifact checksums, SLSA/cosign stubs or real verification, and artifact integrity.
  - Acceptance criteria: release evidence includes provenance status and manual boundary classification.
  - Implemented: operational supply-chain evidence delegates to release provenance, reproducible build hash, security report checksums, and SLSA/cosign boundary checks, with manual boundary classification in `artifacts/operational-supply-chain-risk.json`.

- [x] Objective: enforce secret-scan parity.
  - Compare local and CI secret scanning tools, allowlists, and ignored paths.
  - Acceptance criteria: allowlist drift or unowned secret-scan exceptions fail.
  - Implemented: operational supply-chain evidence enforces static secret scanning, Gitleaks allowlist parity, git-history exposure checks, tracked-secret hygiene, fixture-secret checks, and CI artifact leakage checks through CI and the security pipeline.

## 18. Frontend Operational Resilience

- [x] Objective: test route states comprehensively.
  - Cover loading, empty, error, offline, unauthorized, forbidden, not found, conflict, rate limited, stale data, and provider outage states.
  - Acceptance criteria: every product route family has route-state coverage or an expiring waiver.
  - Implemented: `check:operational-frontend-resilience` enforces route-state scenario markers for loading, empty, error, offline, unauthorized, forbidden, not found, conflict, rate-limited, stale-data, and provider-outage coverage, delegates to route-state/generated-matrix checks, and records route-family evidence in `artifacts/operational-frontend-resilience.json`.

- [x] Objective: test critical workflows end to end.
  - Cover sign-in, onboarding, contract upload, field review, owner assignment, renewal checkpoints, obligations, reports, settings, billing, evidence, search, and logout.
  - Acceptance criteria: smoke workflows use local or staging-safe data only.
  - Implemented: the frontend resilience registry maps each critical workflow to existing or expanded local/staging-safe Playwright and UI evidence, including sign-in/logout, onboarding, upload, review, owner assignment, renewals, obligations, reports, settings, billing, evidence, and search.

- [x] Objective: enforce accessibility operations.
  - Add axe, keyboard-only, focus restoration, landmarks, accessible names, reduced motion, timeout hints, skip links, dialogs, forms, tables, and uploads coverage.
  - Acceptance criteria: every route family and interactive primitive has automated accessibility evidence.
  - Implemented: operational frontend evidence enforces axe route states, keyboard tests, focus restoration, shell landmark checks, accessible form names, reduced-motion coverage, timeout hints, skip links, dialogs, forms, tables, and upload access guards.

- [x] Objective: enforce responsive and visual stability.
  - Add visual and layout checks for mobile, tablet, desktop, long text, zoom, dark mode, reduced motion, RTL, pseudo-locale, and authenticated shells.
  - Acceptance criteria: no tested viewport has overlapping text, unreachable controls, or unintentional horizontal scroll.
  - Implemented: operational frontend evidence enforces visual, device-matrix, RTL/pseudo-locale, long-text, theme, reduced-motion, authenticated-shell, and horizontal-scroll contracts through package/CI/QA pipeline parity.

- [x] Objective: add client-side recovery behavior tests.
  - Cover retry buttons, refetch on focus, optimistic update rollback, duplicate submit prevention, and recoverable state copy.
  - Acceptance criteria: client failures have deterministic, accessible recovery paths.
  - Implemented: added external-action recovery behavior for visible retry, background refetch on focus, form-state preservation, duplicate-submit prevention, and conflict recovery copy; `test:e2e:resilience:all` now includes the new frontend operational recovery spec.

## 19. Performance, Load, And Chaos

- [x] Objective: add load smoke coverage.
  - Cover landing, login, dashboard, contracts list, contract detail, upload, search, reports, exports, cron-like endpoints, and provider-mocked paths.
  - Acceptance criteria: load smoke has thresholds for latency, error rate, and resource usage.
  - Implemented: added a code-owned load target registry with thresholds and resource caps for landing, login, dashboard, contracts list/detail, upload, search, reports, exports, cron-like, and provider-mocked paths; `check:operational-performance-load-chaos` records the coverage in `artifacts/operational-performance-load-chaos.json`.

- [x] Objective: add soak and stress scaffolding.
  - Use k6 or existing load tooling with explicit cost caps, target URLs, durations, and environment guards.
  - Acceptance criteria: load tests cannot accidentally target production without explicit opt-in.
  - Implemented: hardened k6 smoke/soak scripts with thresholds, bounded default targets, short durations, `RUN_K6_SOAK` opt-in, and `OBLIXA_ALLOW_PRODUCTION_LOAD` production-target guards.

- [x] Objective: add chaos fixture tests.
  - Simulate Supabase latency, Stripe failure, Resend failure, OpenAI timeout, Upstash outage, webhook duplicate, cron overlap, and DB conflict.
  - Acceptance criteria: critical paths degrade predictably and emit sanitized observability.
  - Implemented: added typed chaos fixtures for Supabase latency, Stripe failure, Resend failure, OpenAI timeout, Upstash outage, webhook duplicate, cron overlap, and DB conflict, with required sanitized observability tags and forbidden raw fields.

- [x] Objective: add cache and consistency tests.
  - Cover stale reads, read-after-write lag, revalidation tags, cache headers, stale mutation guards, and cache poisoning inputs.
  - Acceptance criteria: cache behavior is explicit and covered for sensitive route families.
  - Implemented: added cache consistency contracts for stale reads, read-after-write lag, revalidation tags, cache headers, stale mutation guards, and cache-poisoning inputs, tied to existing cache/header/static guards.

- [x] Objective: add bundle and runtime budgets.
  - Track JS bundle sizes, server build output, route runtime class, max duration, and expensive dependency imports.
  - Acceptance criteria: budget regressions fail or require a ratchet update with owner.
  - Implemented: added bundle/runtime budget contracts for JS bundle budgets, server build output, route runtime class, max duration, and expensive dependency imports, validated by `check:bundle-budget`, `check:route-universe`, `check:timeout-budget-guards`, and `check:performance-static:strict`.

## 20. Disaster Recovery And Incident Readiness

- [x] Objective: add DR drill automation.
  - Create scripts that verify required env presence, dry-run backup metadata collection, restore-runbook completeness, and redacted evidence generation.
  - Acceptance criteria: DR drill commands produce evidence without touching production data.
  - Implemented: added `config/operational-dr-incident-readiness.json`, expanded `check:incident-readiness:strict`, and generated `artifacts/operational-dr-incident-readiness.json` with DR drill rows for env presence, backup metadata, restore-runbook completeness, and redacted evidence.

- [x] Objective: add incident scenario checks.
  - Encode scenarios for bad deploy, bad migration, auth outage, DB outage, provider outage, webhook replay, cron failure, data leak, secret exposure, and elevated 5xx.
  - Acceptance criteria: every scenario has owner area, detection signal, first action, rollback path, and validation command.
  - Implemented: encoded ten required incident scenarios with owner areas, detection signals, first actions, rollback paths, validation commands, and evidence artifacts in the code-owned incident readiness registry.

- [x] Objective: add game-day workflow support.
  - Add scheduled or manual workflows that run mocked incident drills and upload redacted evidence.
  - Acceptance criteria: game-day workflows cannot mutate live systems and fail on missing evidence.
  - Implemented: updated `.github/workflows/qa-game-day.yml` to run strict `check:game-day-exec` evidence validation and upload metadata-only evidence without production secrets or mutation commands.

- [x] Objective: add operational runbook integrity checks.
  - Validate that runbook references point to existing scripts, dashboards placeholders, env names, and rollback validation commands.
  - Acceptance criteria: stale runbook command references fail static checks.
  - Implemented: added runbook reference rows for deploy rollback, migration forward-fix, database restore, provider outage degrade, and security containment; `check:incident-readiness:strict` verifies scripts, env names, dashboard placeholders, source artifacts, and rollback validation commands.

- [x] Objective: add post-incident follow-up artifacts.
  - Generate templates or JSON artifacts for incident id, timeline, affected controls, failed checks, new tests, owners, and due dates.
  - Acceptance criteria: follow-up artifacts are deterministic and do not contain secrets.
  - Implemented: generated `artifacts/operational-incident-follow-up-template.json` with deterministic metadata-only fields for incident id, timeline, affected controls, failed checks, new tests, owners, due dates, validation commands, evidence artifacts, severity, and redaction review.

## 21. Waivers, Exceptions, And Risk Ratchets

- [x] Objective: create a unified waiver schema.
  - Require id, scope, owner, reason, risk, blocker class, expiry, validation command, replacement objective, and last-reviewed date.
  - Acceptance criteria: expired, unowned, duplicated, or unused waivers fail.
  - Implemented: expanded `config/qa-external-waiver-registry.json` to the unified schema and updated `check:qa-waiver-registry` plus `check:operational-waivers-ratchets` to fail expired, unowned, duplicated, missing-reference, or unused waiver rows.

- [x] Objective: add waiver pre-expiry warnings.
  - Generate reports for waivers expiring within 7, 14, and 30 days.
  - Acceptance criteria: CI or scheduled workflow surfaces upcoming expiries.
  - Implemented: added deterministic pre-expiry buckets to `artifacts/operational-waivers-ratchets.json`; CI now runs `check:operational-waivers-ratchets`.

- [x] Objective: ratchet hardening debt downward.
  - Track counts of optional checks, stubs, warn-only scripts, skipped tests, allowlist rows, uncovered routes, and waived objectives.
  - Acceptance criteria: debt counts cannot increase without an explicit ratchet update and owner.
  - Implemented: `config/operational-waivers-ratchets.json` owns Section 21 debt baselines for optional checks, stub workflows, warn-only scripts, skipped tests, allowlist rows, uncovered routes, and waived objectives; the checker fails increases unless the owner-owned ratchet is explicitly updated.

- [x] Objective: classify external/manual boundaries.
  - Distinguish provider-console work, production-credential work, legal approval, release decision, data migration, DNS change, and customer-impacting work.
  - Acceptance criteria: blocked objectives name the smallest external action needed and the code evidence already available.
  - Implemented: `config/operational-manual-boundaries.json` now classifies each manual action by boundary class, and `check:operational-waivers-ratchets` verifies every manual-boundary objective has smallest-action coverage plus package-script or artifact evidence.

## 22. Feature Flags, Kill Switches, And Configuration Rollout

- [x] Objective: inventory every feature flag and operational toggle.
  - Include flag name, legacy aliases, default value by environment, owner, rollout state, expiry, kill-switch behavior, public/private exposure, and validation command.
  - Acceptance criteria: a new flag cannot be added without owner, expiry, default, tests, and cleanup plan.
  - Implemented: added `src/lib/operational-feature-flags.ts`, `config/operational-feature-flags-rollout.json`, and `artifacts/operational-feature-flags-rollout.json` so every `FEATURE_FLAG_ENV_ALIASES` entry has owner, defaults, expiry, cleanup, removal ticket, exposure, tests, and validation command coverage.

- [x] Objective: enforce flag lifecycle hygiene.
  - Detect stale flags, permanently-on flags, permanently-off flags, public flags carrying sensitive semantics, and flags without removal tickets or code-owned cleanup rows.
  - Acceptance criteria: stale or unowned flags fail checks unless covered by an active waiver.
  - Implemented: `check:operational-feature-flags-rollout` validates runtime flag inventory count, metadata key coverage, env/legacy naming, cleanup rows, package-script wiring, artifact drift, and sensitive public flag exposure; `check:feature-flag-lifecycle` delegates to the operational gate.

- [x] Objective: test kill-switch behavior.
  - Cover extraction disablement, outbound email disablement, webhook dispatch pause, cron family pause, billing mutation freeze, import/export disablement, and integration sync pause.
  - Acceptance criteria: kill switches fail closed, surface accessible UI states, and emit sanitized operational telemetry.
  - Implemented: added outbound email, cron-family, import/export, and integration-sync kill-switch wiring and tests; the operational contract verifies extraction, webhook dispatch, billing, import/export, integration sync, cron, and email coverage plus accessible paused state and sanitized telemetry.

- [x] Objective: add rollout safety checks.
  - Test default-off, default-on, partial rollout, org allowlist, workspace-mode interaction, and stale calibration behavior.
  - Acceptance criteria: rollout state cannot bypass auth, tenant scope, billing state, or workspace-mode eligibility.
  - Implemented: `evaluateOperationalRolloutSafety` enforces auth, tenant scope, billing state, workspace-mode, stale calibration, kill-switch, default-off/default-on, partial rollout, and org allowlist behavior; `test:operational-feature-flags` covers the cases.

## 23. Schema Evolution And Contract Compatibility

- [x] Objective: inventory persisted compatibility contracts.
  - Include route paths, query params, request bodies, response fields, CSV headers, PDF fields, email template variables, telemetry event names, SQL objects, storage paths, webhook event fields, env keys, package scripts, and DOM/test selectors.
  - Acceptance criteria: compatibility-sensitive names cannot be removed or renamed without dual-read, alias, migration, or queue evidence.
  - Implemented: `config/operational-schema-compatibility.json` inventories all required persisted contract surfaces with owner, inventory source, validation command, removal protection, and alias/dual-read/dual-write/migration/queue evidence; `scripts/check-operational-schema-compatibility.mjs` validates the registry and writes `artifacts/operational-schema-compatibility.json`.

- [x] Objective: enforce additive-first schema evolution.
  - Add checks for destructive field removals, enum narrowing, response-shape narrowing, SQL column drops, policy changes, and persisted event-name changes.
  - Acceptance criteria: breaking changes require compatibility artifact coverage and manual boundary classification.
  - Implemented: additive guardrails in `config/operational-schema-compatibility.json` cover destructive field removals, enum narrowing, response-shape narrowing, SQL column drops, SQL policy changes, and persisted event-name changes, each with required evidence, validation command, and manual boundary classification.

- [x] Objective: test dual-read and dual-write transitions.
  - Cover old-only data, new-only data, both values present, conflicting values, null values, and backfill-ready state.
  - Acceptance criteria: transition helpers preserve existing persisted data and expose deterministic precedence.
  - Implemented: `src/lib/operational-schema-compatibility.ts` adds deterministic `resolveDualReadValue` and `buildDualWritePayload` helpers; `src/lib/operational-schema-compatibility.test.ts` covers old-only, new-only, both-present, conflicting, null, and backfill-ready states.

- [x] Objective: generate deprecation and sunset evidence.
  - Add machine-readable deprecation metadata for API fields, routes, package-script aliases, telemetry events, env aliases, SQL aliases, and export fields.
  - Acceptance criteria: deprecated contracts include owner, replacement, first deprecated date, earliest removal boundary, validation command, and customer-impact class.
  - Implemented: deprecation metadata in `config/operational-schema-compatibility.json` covers API fields, routes, package-script aliases, telemetry events, env aliases, SQL aliases, and export fields with owner, replacement, first deprecated date, earliest removal boundary, validation command, and customer-impact class.

- [x] Objective: verify OpenAPI and runtime contract parity.
  - Compare OpenAPI paths, methods, schemas, examples, auth notes, error shapes, and deprecation metadata with route inventory and tests.
  - Acceptance criteria: spec drift fails local checks.
  - Implemented: `check:operational-schema-compatibility` compares `openapi.yaml` with `artifacts/routes/compatibility-route-inventory.json`, validates operation metadata for auth notes and error responses, requires OpenAPI path/method/schema/example/auth/error/deprecation comparison coverage, and is wired into package scripts, CI hardening, QA tier coverage, generated artifact hygiene, and objective closure.

## 24. Data Quality, Invariants, And Business Rule Safety

- [x] Objective: encode core domain invariants in tests.
  - Cover contract ownership, renewal dates, notice windows, obligations, evidence requests, approvals, exceptions, reports, billing status, workspace mode, and team membership.
  - Acceptance criteria: domain invariants are enforced by unit tests, DB constraints, or route/action tests.
  - Implemented: added `src/lib/operational-data-quality-invariants.ts`, `src/lib/operational-data-quality-invariants.test.ts`, and `config/operational-data-quality-invariants.json` with executable guards for contract ownership, status transitions, renewal and notice ordering, obligation lifecycle, evidence review, approval quorum, exception states, task dependencies, report scope, billing metadata, workspace mode, team membership, counterparty data, and financial fields.

- [x] Objective: add property-based tests for date, money, status, and workflow transitions.
  - Cover DST, leap years, month end, timezone conversion, fiscal boundaries, rounding, integer overflow, invalid transitions, and terminal states.
  - Acceptance criteria: generated edge cases cannot violate persisted or user-visible invariants.
  - Implemented: `test:operational-data-quality-invariants` uses `fast-check` coverage for UTC date arithmetic, leap/DST/month-end behavior, fiscal boundaries, money parsing and integer bounds, status transitions, pagination, sorting, deduplication, search normalization, CSV escaping, and URL-state serialization.

- [x] Objective: add data-quality dashboards as generated artifacts.
  - Report missing owners, missing key dates, invalid renewal windows, orphaned tasks, orphaned evidence, dangling foreign keys, stale imports, duplicate counterparties, and inconsistent billing metadata.
  - Acceptance criteria: artifacts are deterministic, redacted, and runnable against local or staging-safe fixtures.
  - Implemented: added `check:operational-data-quality-invariants` and `artifacts/operational-data-quality-invariants.json`; the report registry covers missing owners, missing key dates, invalid renewal windows, orphaned tasks/evidence, dangling lineage, stale imports, duplicate counterparties, inconsistent billing metadata, invalid enums, impossible dates, stale derived fields, and broken read models.

- [x] Objective: test import normalization and reconciliation.
  - Cover duplicate files, duplicate contracts, inconsistent counterparty names, bad dates, missing required fields, invalid encodings, and partial import retry.
  - Acceptance criteria: import results are deterministic and idempotent.
  - Implemented: added deterministic import normalization and reconciliation helpers covering duplicate file hashes, duplicate contract keys, counterparty canonicalization, invalid dates, missing required fields, invalid encodings, partial retry rows, and idempotent sorted output.

- [x] Objective: add read-model rebuild safety checks.
  - Test rebuild idempotency, partial rebuild, stale source data, missing source rows, concurrent rebuild, and output drift.
  - Acceptance criteria: read-model rebuilds cannot silently corrupt or duplicate derived state.
  - Implemented: added read-model safety evaluation for idempotency, partial-scope leakage, stale source timestamps, missing source rows, concurrent version lag, output drift, and lineage requirements, plus cache invalidation/fallback-read guards for stale or sensitive cache entries.

## 25. Admin, Support, And Internal Operations

- [x] Objective: inventory admin and support capabilities.
  - Include capability name, route/action, required role, step-up requirement, audit event, tenant boundary, read/write class, and support-safe alternative.
  - Acceptance criteria: admin-like operations cannot exist without auth, audit, and tenant-scope evidence.
  - Implemented: added `config/operational-support-operations.json`, `src/lib/operational-support-operations.ts`, `scripts/check-operational-support-operations.mjs`, and `artifacts/operational-support-operations.json` to inventory admin/support capabilities with role, step-up, audit, tenant-boundary, read/write class, support-safe alternative, and evidence references.

- [x] Objective: add support-safe read-only tooling checks.
  - Prefer read-only snapshots, redacted diagnostics, scoped lookup helpers, and generated support bundles over direct database access.
  - Acceptance criteria: support diagnostics do not expose secrets, raw tokens, private documents, or cross-tenant data.
  - Implemented: the support-operations registry covers diagnostic surfaces, scoped admin helpers, redacted support bundles, and delegated `server-lib-admin`, `role-capability-inventory`, and sensitive-action checks so support diagnostics remain read-only and tenant-scoped.

- [x] Objective: test impersonation and break-glass boundaries if present.
  - Cover disabled-by-default state, explicit enablement, reason capture, expiry, audit events, step-up, and customer-impact warnings.
  - Acceptance criteria: impersonation or break-glass paths cannot be enabled accidentally or silently.
  - Implemented: `src/lib/operational-support-operations.test.ts` covers break-glass disabled-by-default behavior, explicit enablement, reason capture, expiry, audit event, step-up, and customer-impact warning enforcement.

- [x] Objective: harden demo and seed controls.
  - Test demo seed buttons, local seed scripts, fixture data, staging-only controls, and production refusal paths.
  - Acceptance criteria: seed/demo operations are impossible in production-like environments unless explicitly and safely scoped.
  - Implemented: `src/actions/demo.ts` now refuses demo seeding in production-like environments, and `src/actions/demo-action-scope.test.ts` plus the support-operations checker enforce environment flag, admin role, organization scope, production refusal, fixture-only data, audit, seed safety, and fixture PII policies.

- [x] Objective: add customer-support artifact redaction.
  - Redact contract text, uploaded file names where sensitive, email addresses where not needed, tokens, org ids, user ids, provider ids, and billing ids.
  - Acceptance criteria: support bundles pass redaction checks before storage or upload.
  - Implemented: `redactSupportBundle` and `buildSupportBundleReport` redact contract/document text, uploaded file names, email addresses, tokens, org/user/provider/billing ids, cookies, and authorization headers before support artifacts can pass the generated report.

## 26. DNS, TLS, Email Authentication, And Public Edge Readiness

- [x] Objective: add DNS readiness smoke scripts.
  - Verify expected A, AAAA, CNAME, CAA, TXT, SPF, DKIM, DMARC, and verification records when a domain is supplied.
  - Acceptance criteria: scripts are read-only, redacted, timeout-bounded, and classify missing records by provider/manual boundary.
  - Implemented: `scripts/dns-caa-smoke.mjs`, `scripts/dnssec-privacy-smoke.mjs`, `scripts/email-auth-dns-smoke.mjs`, and `src/lib/operational-edge-readiness.ts` now cover read-only, strict-env-gated DNS lookups with timeout bounds, redacted TXT diagnostics, and provider/manual-boundary classification for missing records.

- [x] Objective: add TLS and certificate checks.
  - Verify certificate expiry, issuer, SAN coverage, protocol minimums where observable, redirect behavior, HSTS, and mixed-content risk.
  - Acceptance criteria: TLS checks produce deterministic warnings and fail only under configured strict mode.
  - Implemented: `scripts/cert-expiry-smoke.mjs` checks certificate expiry, issuer, SAN coverage, TLS protocol, HTTP-to-HTTPS redirect, HSTS, and mixed-content signals when `CERT_STRICT` and `PUBLIC_HOSTS` are supplied; unit coverage exercises the same policy model without live network dependency.

- [x] Objective: add email authentication readiness checks.
  - Verify SPF, DKIM, DMARC alignment, sending-domain match, bounce domain, reply-to policy, and staging/production domain separation.
  - Acceptance criteria: email readiness report identifies provider-console gaps without requiring secrets.
  - Implemented: `config/email-auth-dns-fixtures.json`, `check:email-dns-fixtures`, `email-auth-dns-smoke`, and `evaluateEmailAuthReadiness` cover SPF, DKIM, DMARC, MX, MTA-STS, sending/bounce/reply-to alignment, and staging/production separation without storing secrets.

- [x] Objective: add crawler and public metadata checks.
  - Verify robots, sitemap, canonical URLs, Open Graph, Twitter metadata, favicon/icon assets, security.txt if adopted, and no private route leakage.
  - Acceptance criteria: public metadata matches release positioning and does not expose private product surfaces.
  - Implemented: `check:operational-edge-readiness` delegates to `check:public-seo-surface`, validates robots/sitemap/root metadata/security.txt/public-path markers, and records private-prefix coverage so crawler-visible metadata cannot leak dashboard, API, settings, search, or contract surfaces.

- [x] Objective: add CDN and cache readiness checks.
  - Validate cache headers, vary headers, stale-while-revalidate policy, purge hooks if present, and cache poisoning guardrails.
  - Acceptance criteria: public and sensitive routes have explicit edge-cache classification.
  - Implemented: `config/operational-edge-readiness.json` classifies public marketing, metadata asset, private app, and API-sensitive routes; `classifyEdgeCachePolicy` plus existing `check:sensitive-cache-controls`, `check:cache-poisoning-guards`, and `check:client-cache-sensitivity` enforce explicit cache, vary, stale/revalidation, and poisoning guard coverage.

## 27. Legal, Trust, And Compliance Artifacts

- [x] Objective: inventory public trust and legal surfaces.
  - Include terms, privacy, security, subprocessors, DPA references, cookie policy, contact paths, support commitments, and product claims.
  - Acceptance criteria: legal/trust pages and artifacts are mapped to owners and freshness checks without being runtime config.
  - Implemented: `config/operational-legal-trust-compliance.json`, `check:operational-legal-trust-compliance`, and `artifacts/operational-legal-trust-compliance.json` inventory terms, privacy, security, cookies, acceptable-use, accessibility, contact, security.txt, subprocessors, and DPA request paths with owner/freshness metadata; legal pages now use static `LAST_REVIEWED_ISO` constants instead of runtime dates.

- [x] Objective: add claim-to-capability checks.
  - Map public marketing claims to implemented product capabilities, tests, or manual-boundary notes.
  - Acceptance criteria: claims that imply unavailable CLM, legal advice, GRC, autonomous agent, or enterprise assurance capabilities fail static review checks.
  - Implemented: `evaluatePublicClaimText`, public claim rules, and `check:operational-legal-trust-compliance` map claims to capability evidence/manual boundaries and fail affirmative legal-advice, full-CLM, GRC, certification, autonomous-agent, or e-signature overclaims while allowing explicit negated disclaimers.

- [x] Objective: add subprocessor artifact integrity.
  - Track subprocessor entries, purpose, data class, region, owner, change date, checksum, and notification SLA.
  - Acceptance criteria: subprocessor changes produce deterministic diff artifacts.
  - Implemented: expanded `artifacts/subprocessors.json` with owner, region, data classes, change dates, notification SLA, privacy refs, validation commands, and SHA-256 checksums; `check:subprocessors-drift:strict`, `write:subprocessors-drift`, `check:subprocessor-change-sla`, and `check:subprocessors-privacy-alignment` enforce integrity and generate deterministic `artifacts/subprocessors-diff.json` against `scripts/subprocessors-baseline.sha256`.

- [x] Objective: add consent and cookie-readiness checks if tracking is present.
  - Inventory cookies, local storage, analytics events, consent categories, expiry, provider, and opt-out behavior.
  - Acceptance criteria: tracking-like behavior cannot be added without consent classification.
  - Implemented: consent/storage signal scanning in `check:operational-legal-trust-compliance` classifies `window.localStorage`, `window.sessionStorage`, report open tracking pixels, and report click redirects with provider, data class, expiry, consent category, and opt-out behavior; tracking-like observations fail when unclassified or missing revocation/opt-out semantics.

- [x] Objective: add compliance framework traceability stubs.
  - Map implemented controls to SOC 2, ISO 27001, OWASP ASVS, privacy, and internal control ids where useful.
  - Acceptance criteria: mappings are evidence links only and do not claim certification.
  - Implemented: `config/operational-legal-trust-compliance.json` maps SOC 2, ISO 27001, OWASP ASVS, privacy, and internal controls to code evidence with `certificationClaim: false`; `evaluateComplianceFrameworkMappings` and `check:operational-legal-trust-compliance` enforce evidence-only mappings and manual certification boundaries.

## 28. Static Architecture And Code Health

- [x] Objective: enforce import boundaries.
  - Detect server-only imports in client code, client code in server modules, test-only imports in production code, provider SDK leakage, and domain-layer violations.
  - Acceptance criteria: boundary violations fail unless explicitly allowed.
  - Implemented: `check:operational-static-architecture-code-health` enforces client/server/provider/test import boundary rules across `src`, treats `src/test-utils` and test files as test-only, and is wired beside the existing strict `check:import-boundaries` check in package scripts and CI.

- [x] Objective: enforce runtime boundary correctness.
  - Inventory edge and node route runtimes, forbidden APIs, server external packages, dynamic imports, and native dependency usage.
  - Acceptance criteria: edge-marked code cannot import Node-only APIs and Node-only routes are documented.
  - Implemented: the static architecture checker inventories all route handlers, runtime declarations, dynamic imports, native Node imports, edge-forbidden imports, and required `serverExternalPackages`; the generated artifact records 226 route runtime rows and fails any edge route that imports Node-only APIs.

- [x] Objective: add dependency cycle and complexity ratchets.
  - Track cycles, file complexity, script complexity, server action complexity, component complexity, and route-handler complexity.
  - Acceptance criteria: complexity cannot increase beyond ratchets without owner-approved updates.
  - Implemented: `scripts/dependency-cycles-baseline.json`, `scripts/script-complexity-baseline.json`, `scripts/server-action-complexity-baseline.json`, `scripts/frontend-component-complexity-baseline.json`, and `scripts/route-handler-complexity-baseline.json` ratchet existing debt; new alias-aware cycles or line-count increases fail `check:operational-static-architecture-code-health`, while the existing focused complexity checks remain required validation commands.

- [x] Objective: add dead-code and unused-surface checks.
  - Detect unused files, unused exports, unreachable package scripts, abandoned route metadata, stale generated artifacts, and orphaned fixtures.
  - Acceptance criteria: dead operational surfaces are removed, registered, or waived.
  - Implemented: the aggregate checker composes `check:unused-script-files`, package-pipeline graph validation, generated artifact hygiene, route metadata evidence commands, and extensionless fixture-reference scanning; `check:query-cost-policy` is registered so operational script reachability remains clean.

- [x] Objective: add build reproducibility checks.
  - Track build hash stability, generated type drift, Next config drift, lockfile drift, and environment-sensitive output.
  - Acceptance criteria: equivalent inputs produce equivalent checked artifacts.
  - Implemented: the generated artifact records stable SHA-256 hashes for `package-lock.json`, `next.config.ts`, and `tsconfig.json`, verifies generated type artifacts and reproducible-build markers, and is registered with generated artifact hygiene, package pipeline governance, CI hardening, baseline registry, and the hardening objective ratchet.

## 29. Testing Reliability, Flake Control, And Quarantine Governance

- [x] Objective: classify test flakes automatically.
  - Parse test reports for timeout, locator failure, network failure, assertion drift, visual drift, browser crash, and environment-missing classes.
  - Acceptance criteria: flake reports are deterministic and include owner and next validation command.

- [x] Objective: govern quarantined tests.
  - Require id, test path, reason, owner, expiry, linked issue, replacement coverage, and re-enable command.
  - Acceptance criteria: expired or unowned quarantines fail.

- [x] Objective: enforce skip governance.
  - Detect `.skip`, `test.fixme`, conditional skips, environment skips, browser skips, and CI-only exclusions.
  - Acceptance criteria: skips require metadata and cannot grow without ratchet updates.

- [x] Objective: add test data isolation checks.
  - Ensure E2E, integration, local Supabase, and mocked-provider tests use isolated orgs, users, tokens, files, and cleanup paths.
  - Acceptance criteria: tests cannot share mutable state unless explicitly designed and locked.

- [x] Objective: add visual baseline governance.
  - Track baseline owner, update command, browser/device, OS assumptions, diff threshold, and review evidence.
  - Acceptance criteria: visual snapshots cannot be updated without corresponding route matrix and owner metadata.

## 30. Mobile, Browser, And Platform Variant Coverage

- [x] Objective: add browser matrix policy.
  - Cover Chromium, WebKit, Firefox, reduced motion, color scheme, timezone, locale, device scale factor, and mobile viewport classes.
  - Acceptance criteria: route families declare supported browser/device coverage or waivers.
  - Implemented: added `config/operational-platform-variant-coverage.json`, `check:operational-platform-variant-coverage`, and `artifacts/operational-platform-variant-coverage.json` to enforce Chromium, Firefox, WebKit, reduced motion, color scheme, timezone, locale, device scale factor, mobile/tablet/desktop viewport coverage, Playwright project inventory parity, and per-route-family browser support or waiver policy.

- [x] Objective: add WebView readiness checks where relevant.
  - Cover iOS WKWebView and Android WebView constraints, storage behavior, cookies, redirects, downloads, and file uploads through optional workflows or stubs.
  - Acceptance criteria: mobile WebView support is either tested or explicitly not supported.
  - Implemented: encoded the repository’s web-app-first/no-native-wrapper policy with iOS WKWebView and Android WebView optional workflow stubs, storage/cookie/redirect/download/file-upload constraint rows, explicit not-supported evidence, waiver linkage, and manual device-lab boundary coverage.

- [x] Objective: add OS and input variant checks.
  - Cover keyboard, pointer, touch, screen reader-adjacent semantics, IME input, paste, drag/drop, and high-contrast mode where automatable.
  - Acceptance criteria: core workflows remain usable across supported input variants.
  - Implemented: added governed marker coverage for keyboard, pointer/focus prefetch, touch targets and tap-highlight reset, screen-reader-adjacent search semantics, IME composition, paste sanitization, drag/drop file input, high-contrast/forced-colors CSS, and platform permission probes.

- [x] Objective: add download and file-open behavior checks.
  - Cover CSV, PDF, generated reports, signed links, browser download names, content type, and content disposition across browsers.
  - Acceptance criteria: downloads are named safely and do not leak sensitive identifiers.
  - Implemented: added platform variant download/file-open coverage for CSV, PDF, generated reports, signed links, browser suggested filenames, content type, and content disposition by delegating to export/download, binary metadata, signed-link, and export-security guards with deterministic artifact evidence.

## 31. Search, Reporting, Analytics, And Export Operations

- [x] Objective: harden search behavior.
  - Test query length, special characters, Unicode normalization, empty query, pagination, authorization, rate limits, ranking determinism, and cross-org isolation.
  - Acceptance criteria: search cannot leak inaccessible contracts or unbounded result sets.
  - Implemented: added bounded NFKC search normalization, unsafe control stripping, command-search rate limiting, and aggregate marker coverage for empty-query recovery, pagination, authorization, ranking tie-breakers, and organization-scoped query predicates in `check:operational-search-reporting-analytics-exports`.

- [x] Objective: harden reporting workflows.
  - Cover report generation, scheduled reports, report subscriptions, stale report data, failed generation, retry, redaction, and export limits.
  - Acceptance criteria: reports are tenant-isolated, bounded, and reproducible from fixture data.
  - Implemented: added rate limiting for report-pack run listing/export, and the aggregate checker now locks report generation, scheduled summary delivery, subscription sending, prior-run/stale-data handling, failure diagnostics, retry/idempotency, redaction, export bounds, tenant predicates, and private-cache controls.

- [x] Objective: validate analytics event governance.
  - Inventory event names, payload schemas, sensitivity class, retention class, owner, and destination.
  - Acceptance criteria: new events require schema tests and redaction classification.
  - Implemented: `check:operational-search-reporting-analytics-exports` delegates to the telemetry inventory, classifies every event by payload schema source, owner, sensitivity class, retention class, and destination, and fails when an event class lacks governance policy or the telemetry/redaction checks drift.

- [x] Objective: prevent spreadsheet injection.
  - Test CSV and spreadsheet-like exports for formula prefixes, delimiter abuse, newline injection, Unicode controls, and malicious filenames.
  - Acceptance criteria: exported fields are escaped or rejected according to policy.
  - Implemented: expanded CSV formula tests for delimiter and newline injection, kept Unicode-control and malicious filename coverage under export security guards, and registered formula-prefix, delimiter, newline, Unicode-control, filename, and export-route classes in the Section 31 aggregate artifact.

## 32. Notifications, Messaging, And User Communication

- [x] Objective: inventory all user-facing messages.
  - Include email, in-app notifications, toasts, alerts, errors, banners, reminders, evidence requests, and billing notices.
  - Acceptance criteria: messages have owner, trigger, sensitivity class, and tests.
  - Implemented: `src/lib/operational-notifications-messaging.ts` defines a code-owned message registry across all required surfaces, and `check:operational-notifications-messaging` emits `artifacts/operational-notifications-messaging.json`.

- [x] Objective: test notification preference and eligibility logic.
  - Cover opt-out, disabled org, inactive user, billing state, workspace mode, duplicate suppression, rate limits, and digest grouping.
  - Acceptance criteria: notifications are not sent to ineligible recipients in tests.
  - Implemented: operational eligibility tests cover opt-out, quiet hours, disabled orgs, inactive users, billing state, workspace tiers, duplicate suppression, rate limits, hidden features, and digest grouping.

- [x] Objective: test message rendering and sanitization.
  - Cover HTML escaping, markdown if present, links, unsubscribe, long names, missing fields, locale-sensitive dates, and no-secret payloads.
  - Acceptance criteria: every message template renders safely from fixture data.
  - Implemented: message fixture rendering escapes HTML, strips markdown link targets, redacts secrets, bounds long names, supplies fallbacks, formats dates with locale/time-zone, and includes preference-management links.

- [x] Objective: test notification retry and dead-letter behavior.
  - Cover provider failure, transient failure, permanent failure, duplicate delivery, stale notification, and poison payload.
  - Acceptance criteria: failed notifications are retried or suppressed according to policy without duplicate user impact.
  - Implemented: retry/dead-letter policy tests cover provider and transient retry, permanent and poison payload failure, duplicate suppression, stale suppression, and no duplicate user impact; aggregate checks delegate to poison-message and queue-authenticity guards.

## 33. Billing, Entitlements, And Commercial Operations

- [x] Objective: inventory entitlement gates.
  - Map plans, billing states, feature access, workspace modes, seats, usage limits, grace periods, and blocked states.
  - Acceptance criteria: every commercial gate has tests for allowed, denied, and ambiguous states.
  - Implemented: `src/lib/billing/operational-entitlements.ts` now owns plan, billing-state, feature, workspace-mode, seat, usage-limit, grace-period, and blocked-state policy; tests cover allowed, denied, and ambiguous decisions and the aggregate artifact records every gate.

- [x] Objective: test billing state transitions.
  - Cover trialing, active, past due, unpaid, canceled, incomplete, incomplete expired, paused, no customer, no subscription, and portal return.
  - Acceptance criteria: UI and API access reflect billing state deterministically.
  - Implemented: billing-state resolution covers trialing, active, past due with grace, unpaid, canceled, incomplete, incomplete expired, paused, no customer, no subscription, and portal return; `orgHasActivePlan` now delegates to the shared resolver and tests pin deterministic access outcomes.

- [x] Objective: test seat and invite limits.
  - Cover invite creation, revoke, accept, expired invite, duplicate invite, seat limit, role change, and billing mismatch.
  - Acceptance criteria: seat-related actions are tenant-scoped, idempotent, and audited.
  - Implemented: seat mutation policy covers invite creation, revoke, accept, expired invite, duplicate invite, seat limit, role change, billing mismatch, tenant-scope mismatch, idempotency, and audit intent; invite creation and invite acceptance now enforce the seat-limit policy.

- [x] Objective: add revenue-impact safeguards.
  - Require idempotency, audit events, redaction, provider event replay, and manual boundary classification for live billing changes.
  - Acceptance criteria: billing mutations cannot execute without replay-safe tests.
  - Implemented: `check:operational-billing-entitlements` validates idempotency, audit events, redaction, provider replay fixtures, and manual Stripe live-configuration boundaries, with generated evidence in `artifacts/operational-billing-entitlements.json`.

## 34. Integration Sync And OAuth Operations

- [x] Objective: inventory integration sync jobs.
  - Include provider, scopes, tokens, refresh cadence, backoff, pagination, dedupe, deletion handling, and failure policy.
  - Acceptance criteria: every integration sync has auth, idempotency, and observability tests.
  - Completion evidence: added `src/lib/integrations/operational-sync.ts`, `config/operational-oauth-integration-sync.json`, `scripts/check-operational-oauth-integration-sync.mjs`, and `artifacts/operational-oauth-integration-sync.json`; the registry covers calendar sync, CRM sync, token refresh, OAuth start/callback, and disconnect with provider, token, cadence, retry, pagination, dedupe, deletion, failure, observability, and test ownership fields.

- [x] Objective: test OAuth negative paths.
  - Cover missing state, wrong state, expired state, reused state, missing code, denied consent, wrong redirect URI, provider error, and callback replay.
  - Acceptance criteria: OAuth failures are safe, redacted, and recoverable.
  - Completion evidence: `check:operational-oauth-integration-sync` delegates to OAuth state and PKCE checks, tracks every negative callback scenario, and the callback route now handles provider denial with `oauth_callback_provider_error` without loading OAuth state or echoing provider descriptions.

- [x] Objective: test token refresh operations.
  - Cover success, expired refresh token, revoked token, provider timeout, rotated encryption key, malformed provider response, and repeated failure.
  - Acceptance criteria: token refresh cannot leak tokens or enter an unbounded retry loop.
  - Completion evidence: refresh-token tests cover success, invalid-grant style expired/revoked tokens, malformed provider JSON, encryption-key rotation failures, idempotency replay, sanitized provider exceptions, and the route remains bounded to one safeFetch attempt per connection with status-error persistence.

- [x] Objective: test integration deletion and disconnect.
  - Cover revocation, local token deletion, stale scheduled jobs, webhook cleanup, audit events, and user-facing disconnected state.
  - Acceptance criteria: disconnect removes future access without corrupting historical records.
  - Completion evidence: added `disconnectIntegrationConnectionForm` and `buildOperationalIntegrationDisconnectPatch`; disconnect requires admin step-up, sets the connection to `not_connected`, nulls token/account/expiry fields, replaces provider/webhook config with a non-secret tombstone, records `security.integration_disconnected`, and leaves historical records intact.

## 35. Public Product Surface And Launch Positioning Enforcement

- [x] Objective: encode public launch boundaries as tests.
  - Verify public pages present Core as contract tracking for signed agreements and do not overclaim full CLM, legal advice, GRC, autonomous agents, or enterprise assurance.
  - Acceptance criteria: public copy checks fail on prohibited release claims.
  - Completion evidence: `audit:marketing-identity:strict` now rejects prohibited public launch claims with negation-aware rules; `src/lib/marketing/operational-public-launch.ts` inventories launch boundaries for Core contract tracking, signed-agreement scope, no-full-CLM, no-legal-advice, no-GRC, no-autonomous-agent, no-enterprise-assurance, human-reviewed AI, assurance-workflow early access, and exportability.

- [x] Objective: enforce private surface discoverability rules.
  - Test that Advanced and Assurance surfaces are hidden, gated, or early-access/private according to workspace policy.
  - Acceptance criteria: private modes cannot be discovered from public navigation, metadata, robots, sitemap, command palette, or unauthenticated routes.
  - Completion evidence: `check:operational-public-launch-positioning` validates private disallows, preview robots, public sitemap inventory, proxy public-path policy, generated public routes, public-nav private-link bans, and command-palette private-result coverage; `check:public-seo-surface` now includes `/search` in private crawler disallow enforcement.

- [x] Objective: test contact, pricing, signup, and conversion flows.
  - Cover validation, spam/rate limits, safe redirects, email delivery stubs, billing handoff, and no-secret logs.
  - Acceptance criteria: launch-critical public flows have positive and abuse-path tests.
  - Completion evidence: contact route tests now cover provider-delivery failure without logging submitted email, free text, or provider secrets; the aggregate registry validates contact form/API, pricing CTAs, signup and password recovery rate-limited actions, Stripe checkout and portal return URLs, and DPA/security contact paths.

- [x] Objective: add marketing asset and metadata QA.
  - Verify image sizes, alt text, canonical URLs, structured data, social images, no broken links, no private anchors, and no stale product names.
  - Acceptance criteria: public route QA fails on broken launch assets.
  - Completion evidence: `artifacts/operational-public-launch-positioning.json` records canonical, sitemap, robots, JSON-LD serializer, Open Graph/Twitter image, icon, Apple icon, public logo size/type, metadata route inventory, broken-link smoke, and private-anchor ban evidence; asset budgets verify public launch files stay bounded and type-checked.

## 36. Repository, Artifact, And Workspace Hygiene

- [x] Objective: classify generated and transient directories.
  - Include reports, logs, blob reports, Playwright output, test results, coverage, SBOMs, screenshots, traces, and local Supabase temp files.
  - Acceptance criteria: transient artifacts are ignored, cleaned, or intentionally tracked with ownership.
  - Completion evidence: `config/operational-repository-artifact-hygiene.json`, `scripts/check-operational-repository-artifact-hygiene.mjs`, and `artifacts/operational-repository-artifact-hygiene.json` classify 19 transient paths, verify all are ignored, and register 100 generated artifacts with owners and cleanup policies.

- [x] Objective: add large-file and binary checks.
  - Detect oversized assets, unexpected binaries, embedded metadata, executable bits, archive bombs, and masqueraded executable files.
  - Acceptance criteria: risky files fail checks unless explicitly registered.
  - Completion evidence: `check:operational-repository-artifact-hygiene` delegates binary metadata and executable masquerade guards while enforcing tracked/untracked large-file budgets and binary/archive allowlists.

- [x] Objective: enforce line-ending and encoding hygiene.
  - Check UTF-8, final newline, no invisible control characters except fixture allowlists, no Trojan Source controls, and no accidental non-ASCII in code where policy forbids it.
  - Acceptance criteria: source hygiene violations fail static checks.
  - Completion evidence: `scripts/check-operational-repository-artifact-hygiene.test.mjs` covers CRLF, UTF-8/final-newline policy, Trojan Source controls, and ASCII-required operational paths; the generated artifact records repository-wide source hygiene findings without blocking legacy non-governed files.

- [x] Objective: add workspace cleanliness gates.
  - Verify generated artifacts are current, no untracked required files are missing from registries, and no local-only debug files are referenced by scripts.
  - Acceptance criteria: operational pipelines run from a clean checkout.
  - Completion evidence: `package.json`, `.github/workflows/ci.yml`, `config/qa-tier-manifest.json`, `config/compliance-artifact-registry.json`, `scripts/check-hardening-ci-wiring.mjs`, and `scripts/check-generated-artifact-hygiene.mjs` wire `check:operational-repository-artifact-hygiene` into package scripts, CI, tier coverage, artifact registry, and generated-artifact drift checks.

## 37. Threat Modeling And Control Traceability

- [x] Objective: generate STRIDE and OWASP control coverage.
  - Map routes, actions, data stores, integrations, jobs, and trust boundaries to threats and required controls.
  - Acceptance criteria: high-risk surfaces have linked tests or explicit waivers.
  - Completion evidence: `check:control-traceability:strict` generates `artifacts/operational-threat-model-control-traceability.json` and `artifacts/stride-dread-threat-model.json`, covering 624 attack-surface rows, 427 high-risk rows, all six STRIDE categories, and the required OWASP API Top 10 control anchors.

- [x] Objective: add attack-surface inventories.
  - Inventory public endpoints, authenticated endpoints, tokenized links, webhooks, OAuth callbacks, uploads, exports, provider calls, and background jobs.
  - Acceptance criteria: new attack surfaces require auth, rate-limit, logging, and abuse-control metadata.
  - Completion evidence: the traceability artifact derives attack-surface classes from `artifacts/route-universe.json` and `artifacts/security-route-matrix.json`, including public, authenticated, tokenized, webhook, OAuth callback, upload/extraction, export/reporting, provider-call, background-job, and server-action classes with control metadata.

- [x] Objective: require security test linkage.
  - Link security controls to test files, static checks, E2E specs, or generated artifacts.
  - Acceptance criteria: orphan controls or orphan high-risk routes fail checks.
  - Completion evidence: `scripts/check-control-traceability.mjs` links direct tests, static checks, and generated artifacts for every high-risk surface; `scripts/check-control-traceability.test.mjs` verifies high-risk evidence linkage and residual-risk field enforcement.

- [x] Objective: add residual-risk reporting.
  - Summarize accepted, waived, external-boundary, and manual-approval risks in deterministic artifacts.
  - Acceptance criteria: residual risks have owner, expiry, impact, and validation command.
  - Completion evidence: `artifacts/operational-threat-model-control-traceability.json` records 26 residual-risk rows from waiver, manual-boundary, and threat N/A sources, each with owner, expiry, impact, validation command, and blocker/manual-boundary class metadata.

## 38. Environment Isolation And Data Seeding

- [x] Objective: enforce environment isolation in code.
  - Classify local, test, CI, preview, staging, and production URLs, keys, callback origins, cookies, storage buckets, and provider modes.
  - Acceptance criteria: mixed-environment references fail release-adjacent checks.
  - Completion evidence: added `config/operational-environment-isolation.json`, `scripts/check-operational-environment-isolation.mjs`, and `artifacts/operational-environment-isolation.json`; the report classifies local, test, CI, preview, staging, and production URL/key/callback/cookie/storage/provider/job policies and runs synthetic preview/live and production/test credential rejection checks.

- [x] Objective: harden seed data.
  - Check seeds for fake-only data, no real PII, no secrets, no production ids, deterministic ids, and safe cleanup.
  - Acceptance criteria: seed files cannot contain real customer-like secrets or production identifiers.
  - Completion evidence: `npm run check:operational-environment-isolation` delegates to `check:supabase:seed-safety` and scans `supabase/seed.sql` plus E2E seed SQL for secret-like values, unapproved email domains, production provider IDs, deterministic UUID prefixes, conflict-safe seed mutations, and unbounded deletes.

- [x] Objective: test fixture lifecycle.
  - Cover fixture creation, teardown, namespace isolation, org isolation, token expiry, file cleanup, and conflict handling.
  - Acceptance criteria: tests leave no persistent shared state in local or staging-safe environments.
  - Completion evidence: the environment isolation artifact validates fixture creation, teardown, namespace isolation, org isolation, token expiry, file cleanup, and conflict handling markers across Playwright setup/teardown, E2E teardown, RLS smoke SQL, Supabase auth expiry config, `.gitignore`, and deterministic seed conflict handling.

- [x] Objective: add preview-environment checks.
  - Validate preview auth redirects, callback URLs, Stripe mode, Supabase project class, Upstash class, email sender, and disabled production-only jobs.
  - Acceptance criteria: preview environments cannot accidentally use production providers.
  - Completion evidence: `scripts/check-operational-environment-isolation.mjs` validates preview auth redirects, callback URL integrity, Stripe test/live mismatch guards, Supabase URL class checks, Upstash environment class markers, Resend sender configuration, and production-only job boundaries; CI runs `npm run check:operational-environment-isolation`.

## 39. Machine-Readable Governance And Ownership

- [x] Objective: create owner registries for operational areas.
  - Include release, security, data, auth, billing, providers, frontend, infrastructure, privacy, support, and incident areas.
  - Acceptance criteria: every objective, route family, provider, and generated artifact maps to an owner area.
  - Completion evidence: added `config/operational-governance-ownership.json`, `scripts/check-operational-governance-ownership.mjs`, and `artifacts/operational-governance-ownership.json`; the artifact maps `44` objectives, `12` route families, `11` providers, and `104` generated artifacts to owner areas.

- [x] Objective: add CODEOWNERS parity checks.
  - Compare owner registries with `.github/CODEOWNERS`, security-sensitive paths, migrations, workflows, scripts, and provider integration code.
  - Acceptance criteria: sensitive paths require matching code owner coverage.
  - Completion evidence: `check:operational-governance-ownership` delegates to `check:codeowners-security-paths` and validates registered sensitive paths for security, migrations, workflows, scripts, provider integration, billing, privacy, support, incident, generated artifacts, and CODEOWNERS owner parity.

- [x] Objective: add change-impact recommendations.
  - Generate recommended checks from changed files, including migrations, routes, auth, billing, UI, public copy, workflows, scripts, providers, and docs.
  - Acceptance criteria: PR summaries include targeted validation commands and missing evidence warnings.
  - Completion evidence: `scripts/check-ci-change-impact.mjs` now classifies provider integrations, UI surfaces, public copy, and documentation changes, and emits a PR-summary block with targeted validation commands plus missing-evidence warnings; Section 39 validates synthetic coverage for the required change classes.

- [x] Objective: add governance report checksums.
  - Hash security, release, privacy, dependency, route, and operational reports to detect stale evidence.
  - Acceptance criteria: evidence reports are reproducible and stale checksums fail.
  - Completion evidence: `artifacts/operational-governance-ownership.json` records stable SHA-256 checksums for security, release, privacy, dependency, route, and operational report categories and fails drift through `npm run check:operational-governance-ownership`.

## 40. Explicit Manual Boundary Backlog

- [x] Objective: maintain a backlog of irreducible external actions.
  - Include production migration application, secret rotation, branch protection changes, DNS changes, provider dashboard changes, legal approvals, customer-impacting communication, and release approval.
  - Acceptance criteria: every manual action has code-owned readiness evidence and smallest-next-action text.
  - Completion evidence: added `config/operational-manual-boundaries.json` with validated manual actions for production migrations, secret rotation, branch protection, DNS, Stripe live configuration, legal approval, customer-impacting communication, and release approval.

- [x] Objective: add provider-console verification stubs.
  - Generate checklists or JSON rows for Vercel, Supabase, Stripe, Resend, Sentry, Upstash, GitHub, DNS, Slack, and monitoring providers.
  - Acceptance criteria: stubs identify what code can verify automatically and what must be confirmed manually.
  - Completion evidence: `config/operational-manual-boundaries.json` contains validated provider-console rows for Vercel, Supabase, Stripe, Resend, Sentry, Upstash, GitHub, DNS, Slack, and Monitoring.

- [x] Objective: distinguish staging-safe from production-only actions.
  - Classify smoke tests, webhook tests, checkout tests, migration dry-runs, DNS checks, and monitoring pings by environment risk.
  - Acceptance criteria: no production-only action is reachable from default local or CI commands.
  - Completion evidence: `config/operational-manual-boundaries.json` defines validated `staging-safe-smoke`, `read-only-production`, and `production-mutation` risk classes with default-command policy.

- [x] Objective: ensure no substantive automatable class is excluded.
  - Add a meta-check that compares operational objective taxonomy against route inventories, package scripts, workflows, provider dependencies, migrations, docs references, and generated artifacts.
  - Acceptance criteria: newly discovered surfaces are classified as implemented, pending, waived, or manual-boundary only.
  - Completion evidence: `npm run check:operational-hardening-objectives` validates the objective taxonomy, manual-boundary registry, package-script references, ratchet, and closure artifact.

## 41. Acceptance Criteria For A Complete Code-Only Pass

- [x] Objective: all code-owned hardening objectives are represented in a registry.
  - Completion evidence: `config/operational-hardening-objectives.json` contains `44` operational objective families and is validated by `npm run check:operational-hardening-objectives`.
- [x] Objective: all registry rows have validation commands.
  - Completion evidence: `scripts/check-operational-hardening-objectives.mjs` rejects missing validation commands.
- [x] Objective: all validation commands are reachable from package scripts or CI workflows.
  - Completion evidence: `scripts/check-operational-hardening-objectives.mjs` validates every objective `validationCommand` against `package.json`; `.github/workflows/ci.yml` runs `npm run check:operational-hardening-objectives`.
- [x] Objective: all generated artifacts have owners, write commands, and drift checks.
  - Completion evidence: `check:generated-artifact-hygiene`, `check:operational-package-pipelines`, `check:operational-repository-artifact-hygiene`, and `check:operational-governance-ownership` validate `104` generated artifacts, deterministic write commands, ownership prefixes, and drift-checked outputs.
- [x] Objective: all optional checks are either promoted to gates or covered by expiring waivers.
  - Completion evidence: `artifacts/operational-waivers-ratchets.json` records optional-check, stub-workflow, warn-only, skip, allowlist, route, and waived-objective ratchets with expiring waiver metadata.
- [x] Objective: all route, action, cron, webhook, storage, and provider surfaces have inventories.
  - Completion evidence: `artifacts/route-universe.json`, `artifacts/route-provider-matrix.json`, `artifacts/operational-cron-jobs.json`, `artifacts/operational-webhooks-callbacks.json`, `artifacts/operational-uploads-files-extraction.json`, and `artifacts/operational-provider-integrations.json` are code-owned and drift checked.
- [x] Objective: all sensitive paths have auth, tenant-scope, rate-limit, observability, redaction, and error-shape evidence.
  - Completion evidence: `artifacts/operational-authz-session.json`, `artifacts/operational-api-runtime-contracts.json`, `artifacts/operational-rate-limits-abuse-bounds.json`, `artifacts/operational-observability-redaction.json`, and `artifacts/operational-threat-model-control-traceability.json` map these controls to route and control evidence.
- [x] Objective: all public, private, admin, support, billing, integration, reporting, export, and notification surfaces have explicit operational classification.
  - Completion evidence: `artifacts/operational-frontend-resilience.json`, `artifacts/operational-support-operations.json`, `artifacts/operational-billing-entitlements.json`, `artifacts/operational-oauth-integration-sync.json`, `artifacts/operational-search-reporting-analytics-exports.json`, and `artifacts/operational-notifications-messaging.json` classify these surfaces.
- [x] Objective: all data stores, migrations, policies, views, functions, triggers, storage buckets, and generated read models have safety evidence.
  - Completion evidence: `artifacts/operational-supabase-database.json`, `artifacts/supabase/migration-manifest.json`, SQL policy artifacts under `artifacts/supabase/`, and `artifacts/operational-data-quality-invariants.json` provide code-owned safety evidence.
- [x] Objective: all provider integrations have fixture-backed success, failure, replay, timeout, redaction, and configuration checks.
  - Completion evidence: `check:operational-provider-integrations`, `check:provider-integration-fixtures`, `check:operational-environment-isolation`, and provider-specific operational artifacts validate fixture lifecycle and provider configuration boundaries.
- [x] Objective: all feature flags, kill switches, env aliases, compatibility aliases, and deprecation paths have lifecycle evidence.
  - Completion evidence: `artifacts/operational-feature-flags-rollout.json`, `artifacts/operational-schema-compatibility.json`, and compatibility artifacts under `artifacts/compatibility/` encode lifecycle, alias, and deprecation evidence.
- [x] Objective: all CI workflows, package scripts, generated artifacts, waivers, skips, and quarantines have owner and expiry governance.
  - Completion evidence: `check:operational-ci-enforcement`, `check:operational-package-pipelines`, `check:operational-governance-ownership`, `check:operational-waivers-ratchets`, and `check:operational-test-reliability-governance` enforce these ownership and expiry rules.
- [x] Objective: all privacy, legal, trust, public-claim, and compliance-adjacent artifacts have code-owned freshness or integrity checks where automation is possible.
  - Completion evidence: `artifacts/operational-privacy-auditability.json`, `artifacts/operational-legal-trust-compliance.json`, `artifacts/subprocessors-diff.json`, and governance report checksums provide freshness and integrity evidence.
- [x] Objective: all performance, load, chaos, browser, mobile, accessibility, and visual coverage gaps are either implemented, ratcheted, or waived.
  - Completion evidence: `artifacts/operational-performance-load-chaos.json`, `artifacts/operational-platform-variant-coverage.json`, `artifacts/operational-frontend-resilience.json`, and `artifacts/operational-waivers-ratchets.json` classify implemented coverage, ratchets, and manual/waived gaps.
- [x] Objective: all production-touching work remains behind read-only, dry-run, staging-safe, or explicit manual boundaries.
  - Completion evidence: `config/operational-manual-boundaries.json` classifies staging-safe, read-only production, and production-mutation work; the checker rejects missing environment risk policy.
- [x] Objective: all external actions have a code-owned readiness check or evidence artifact.
  - Completion evidence: every `manualActions` row in `config/operational-manual-boundaries.json` has a validated `readinessCommand`.
- [x] Objective: all remaining exclusions are irreducibly external, legal, credentialed, customer-impacting, or release-decision work, and each one has the smallest next manual action recorded.
  - Completion evidence: `config/operational-manual-boundaries.json` validates category, owner, external system, readiness command, production class, and `smallestNextAction` for each manual action.
- [x] Objective: no substantive automatable operational-hardening class remains unclassified.
  - Completion evidence: `config/operational-hardening-objectives.json` classifies each objective family as implemented with owner area, severity, objective class, validation command, evidence artifact, and manual-boundary text where applicable.
- [x] Objective: documentation remains a planning and review artifact only, with no runtime or implementation dependency.
  - Completion evidence: verified with `npm run check:documentation-runtime-dependencies`.
