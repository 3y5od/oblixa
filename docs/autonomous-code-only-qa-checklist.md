# Autonomous Code-Only QA Checklist

This document lists QA improvements that can be implemented autonomously in code alone. It is a planning and review artifact only. Runtime code, build code, tests, scripts, and CI workflows must not read this file as configuration.

The objective is to convert every automatable QA expectation into executable checks, deterministic generated artifacts, tests, or CI gates while leaving external systems, production credentials, provider dashboards, production data, and manual release decisions untouched.

All 96 objectives below are now represented in the code-owned closure registry at `config/autonomous-code-only-qa-objectives.json`. The generated QA closure manifest records the executable npm-script evidence for each objective, and `npm run check:qa-closure-manifest` fails if the registry or generated artifact drifts.

## Boundaries

Autonomous code-only work can:

- Add or update unit, integration, UI, E2E, accessibility, visual, static-analysis, and contract tests.
- Add or update deterministic scripts, generated artifacts, registries, matrices, allowlists, baselines, and ratchets.
- Wire existing or new checks into package scripts, local pipelines, and GitHub Actions.
- Add local-only fixtures, mocked providers, fake credentials, replay corpora, seeded test data, and synthetic evidence.
- Add non-executing or forward-only migration scaffolds that are safe to review but not applied to production.
- Add compatibility aliases and dual-read logic where required to preserve existing public or persisted contracts.
- Add documentation-adjacent reports as outputs, provided implementation code does not depend on documentation files.

Autonomous code-only work cannot directly perform external side effects, but it can still add code that verifies readiness, generates evidence, or fails closed when those side effects are missing. The only excluded work is work that requires live authority outside the repository.

Autonomous code-only work cannot directly:

- Use production secrets, paste secrets into files, or infer missing secrets from provider dashboards.
- Apply production migrations, mutate production data, rotate secrets, or change live provider configuration.
- Change DNS, Stripe, Supabase, Vercel, Resend, Slack, GitHub branch protection, mobile app stores, customer data stores, or monitoring dashboards directly.
- Remove public routes, webhook contracts, persisted field names, telemetry event names, SQL objects, or package-script aliases without compatibility evidence.
- Make business release decisions, approve risk waivers, approve legal/compliance positions, accept residual risk, or certify production readiness.
- Treat markdown documents as runtime configuration.

For every boundary above, autonomous code-only work should still add one of:

- A read-only verification script.
- A mocked or fixture-backed test.
- A staging-safe smoke test.
- A generated readiness artifact.
- A fail-closed environment/configuration guard.
- An expiring waiver row with owner, reason, blocker class, and validation command.

## Checklist Status Key

- [ ] Not started
- [x] Completed with local evidence in this pass
- [ ] Implemented locally
- [ ] Wired into CI or an executable pipeline
- [ ] Covered by deterministic artifact or ratchet
- [ ] Blocked by external or manual boundary

## 1. Baseline Execution Gate

- [x] Objective: make the local baseline gate complete, deterministic, and easy to run.
  - Implement or verify `npm run check:quick` covers migrations, cron parity, API route test coverage, lint, typecheck, logic tests, and UI tests.
  - Add missing script tests for any QA command that shells out to other checks.
  - Add a script integrity check that proves every referenced package script exists.
  - Add a command-reference check for README, docs, workflows, and generated reports.
  - Acceptance criteria: `npm run check:quick`, `npm run test:scripts`, `npm run typecheck`, `npm run lint`, and `git diff --check` pass from a clean checkout with local test env only.
  - Completion evidence:
    - Fixed failures in route coverage, UI copy expectations, env parity, generated route matrices, server-action negative tests, previous-release suite wiring, and release inventory classification.
    - Verified with `npm run check:quick`, `npm run test:scripts`, `npm run typecheck`, `npm run lint`, `npm run check:script-registry-integrity`, `npm run check:command-reference-integrity`, `npm run check:generated-artifact-hygiene`, and `git diff --check`.

- [x] Objective: remove hidden ordering and machine-dependence from QA scripts.
  - Sort filesystem walks, JSON output, route lists, matrix rows, and report entries.
  - Normalize path separators, timestamps, locale-sensitive strings, and generated IDs.
  - Add fixture-based tests for deterministic output.
  - Acceptance criteria: running the same write/check pair twice creates no diff.

## 2. Route And Surface Inventory

- [x] Objective: guarantee every page, route handler, server action, and product surface is inventoried.
  - Generate a route universe from `src/app`.
  - Generate API route, public route, authenticated route, visual route, and route-state matrices.
  - Add drift tests that fail when a new route lacks auth, workspace-mode, UI-state, and QA coverage metadata.
  - Acceptance criteria: adding a route without updating the generated registries fails a local check.
  - Completion evidence:
    - Added `/search` coverage across product route inventory, UI surface manifest, route-state manifest, QA route coverage TSV, robots policy, release inventory lock, and generated E2E matrices.
    - Regenerated `e2e/generated/authenticated-routes.ts` and `e2e/generated/route-states.ts`.
    - Verified with `node scripts/check-ui-surface-consistency.mjs`, `node scripts/check-route-state-coverage.mjs`, `node scripts/check-e2e-generated-drift.mjs`, `npm run check:quick`, and `npm run pipeline:surface:suite`.

- [x] Objective: ensure every product mode boundary is testable.
  - Add Core, Advanced, and Assurance eligibility matrices.
  - Add tests for public discoverability, private-mode hiding, command-palette filtering, navigation filtering, and direct URL access.
  - Acceptance criteria: every route and command-palette destination has an expected mode policy and a negative test.

## 3. API Contract QA

- [x] Objective: add branch-complete API route coverage.
  - Add tests for supported methods, unsupported methods, `OPTIONS`, auth states, tenant scope, invalid input, malformed JSON, missing content type, and response shape.
  - Add route-specific negative tests for enumeration, cross-org access, and workspace-mode denial.
  - Add response header checks for cache, content type, security headers, and redirects.
  - Acceptance criteria: every `src/app/api/**/route.ts` is represented in API route coverage artifacts with at least one positive and one negative test.

- [x] Objective: enforce consistent error semantics.
  - Add problem-json or equivalent error-shape checks for API families.
  - Add tests for 400, 401, 403, 404, 405, 409, 413, 415, 422, 429, and 500-class fallbacks where applicable.
  - Acceptance criteria: API error responses are schema-tested and do not leak stack traces, SQL errors, secrets, or tenant identifiers.

- [x] Objective: prove runtime smoke coverage.
  - Generate an API runtime smoke registry.
  - Add mocked and live-local runners for safe GET/HEAD/OPTIONS probes.
  - Store redacted traces as deterministic artifacts.
  - Acceptance criteria: every safe API route has a smoke entry or an expiring waiver.

## 4. Server Actions And Mutations

- [x] Objective: make every server action authorization-explicit.
  - Generate a server-action inventory.
  - Add tests for unauthenticated, wrong-tenant, wrong-role, stale-session, and malformed-input calls.
  - Add checks that actions resolve organization/workspace scope deterministically.
  - Acceptance criteria: every exported server action has an auth contract row and negative tests.
  - Completion evidence:
    - Added an invalid-input guard for `emitCmdkPaletteOpenedTelemetry`.
    - Added `src/actions/product-telemetry.test.ts` to prove malformed Cmd-K open telemetry is rejected before auth.
    - Verified with `npx vitest run src/actions/product-telemetry.test.ts`, `node scripts/check-server-action-negative-tests.mjs`, `npm run test:scripts`, and `npm run pipeline:surface:suite`.

- [x] Objective: harden mutation behavior.
  - Add idempotency tests for upload, import, report pack, webhook, cron, and destructive workflows.
  - Add stale-write, terminal-state, race-condition, duplicate-submit, and retry tests.
  - Add UI read-after-write tests for critical mutations.
  - Acceptance criteria: duplicate and concurrent mutations are either idempotent or explicitly rejected.

## 5. Authentication And Authorization

- [x] Objective: cover all auth flows without production credentials.
  - Add mocked Supabase and local E2E coverage for sign-in, sign-out, sign-up, reset-password, callback, stale session, expired link, invalid credentials, and account recovery abuse.
  - Add cookie attribute, session fixation, session lifecycle, and lockout/reset checks.
  - Acceptance criteria: auth flows pass in unit/UI tests and Playwright smoke using local or staging-safe test credentials only.

- [x] Objective: close horizontal and vertical authorization gaps.
  - Add cross-org fixtures for every tenant-owned table or API family.
  - Add role/capability matrix tests for owner, admin, member, viewer, external token, service role, and unauthenticated access.
  - Acceptance criteria: every tenant-scoped read/write path has positive same-org and negative cross-org evidence.

## 6. Security Static Checks

- [x] Objective: expand application security scanners.
  - Add or harden checks for XSS, unsafe HTML, template injection, unsafe deserialization, prototype pollution, path traversal, SSRF, open redirect, CSRF, method override, postMessage, custom schemes, and URL canonicalization.
  - Add Semgrep rules and rulepack integrity tests for high-risk patterns.
  - Add allowlist metadata checks requiring owner, reason, expiry, and validation command.
  - Acceptance criteria: new unsafe patterns fail CI unless explicitly allowlisted with valid metadata.

- [x] Objective: protect secrets and sensitive data.
  - Add checks for `NEXT_PUBLIC` leakage, client bundle secrets, static secrets, fixture secrets, tracked credentials, artifact leakage, CI logs, Sentry tags, persisted redaction, and telemetry redaction.
  - Add tests for report/export redaction and notification payload scrubbing.
  - Acceptance criteria: generated reports and client bundles contain no secret-like values or sensitive tenant data.

- [x] Objective: enforce browser security headers.
  - Add checks for CSP, nonce/hash consistency, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP/COEP/CORP where applicable, and cache controls for sensitive pages.
  - Add Playwright smoke tests for public, auth, external token, and authenticated pages.
  - Acceptance criteria: all route families have expected header coverage or explicit waiver.

## 7. Database, RLS, And Migrations

- [x] Objective: prove migration hygiene.
  - Add migration manifest, organization, idempotency, rollback-report, fingerprint, and generated-artifact checks.
  - Add tests for forbidden SQL patterns, unsafe `SECURITY DEFINER`, unqualified search paths, destructive operations, and missing rollback notes.
  - Acceptance criteria: any migration drift or unsafe migration pattern fails local checks.

- [x] Objective: prove RLS and tenant constraints.
  - Generate RLS sanity table registry.
  - Add local Supabase or mocked SQL tests for member-visible, service-role-only, and public tables.
  - Add checks for tenant columns, policies, views, functions, triggers, grants, and storage bucket paths.
  - Acceptance criteria: every tenant-owned data surface has RLS or a documented service-role-only boundary.

- [x] Objective: keep production operations manual.
  - Add scripts that verify dry-run readiness but do not apply linked migrations by default.
  - Add guards that require explicit flags for linked or production-like checks.
  - Acceptance criteria: no default QA command mutates production or linked Supabase state.

## 8. Third-Party Integrations

- [x] Objective: test Stripe without live payments.
  - Add webhook replay corpus for checkout completion, subscription update, deletion, invoice failure, duplicate delivery, bad signature, missing event, and timestamp skew.
  - Add static env checks for live/test key and price mismatches.
  - Add customer portal and callback URL contract tests.
  - Acceptance criteria: Stripe behavior is branch-covered with fixture events and no live customer charge.

- [x] Objective: test email safely.
  - Add email template rendering tests, sanitization tests, List-Unsubscribe checks, sender-domain checks, and no-PII/no-secret assertions.
  - Add mocked Resend delivery failure, retry, and bounce-safe behavior.
  - Acceptance criteria: every email template renders valid, sanitized output from fixture data.

- [x] Objective: test AI extraction safely.
  - Add adversarial document fixtures, prompt-injection strings, schema validators, timeout/cost caps, and redaction checks.
  - Add provider-failure and malformed-output tests.
  - Acceptance criteria: AI-assisted paths reject unsafe output and preserve human-review/source-backed contracts.

- [x] Objective: test Redis/rate-limit behavior.
  - Add mocked Upstash success, outage, malformed response, and latency tests.
  - Add rate-limit key cardinality and distribution checks.
  - Acceptance criteria: rate limits fail according to documented policy and include `Retry-After` where required.

## 9. Cron, Webhooks, And Background Work

- [x] Objective: make cron routes fail closed.
  - Add probes for Bearer auth, `x-cron-secret`, missing secret, wrong secret, GET/POST behavior, strict 404 policy, and `ok: false` handling.
  - Add Vercel cron schedule alignment and max-duration heatmap checks.
  - Acceptance criteria: every scheduled route is authenticated, registered, smoke-tested, and has explicit failure semantics.

- [x] Objective: harden webhook and worker-like paths.
  - Add signature, timestamp, replay, idempotency, poison message, duplicate execution, job lock, retry, and partial-failure tests.
  - Acceptance criteria: repeated webhook delivery cannot create duplicate durable side effects.

## 10. UI Component QA

- [x] Objective: expand component-level interaction coverage.
  - Add React Testing Library tests for every interactive component touched by product workflows.
  - Cover keyboard activation, disabled states, pending states, validation errors, empty states, destructive confirmations, and optimistic updates.
  - Acceptance criteria: every button, form, menu, tab, dialog, select, upload control, and command-palette action has an interaction test or page-level E2E coverage.

- [x] Objective: enforce design-system rules in code.
  - Add static checks for token usage, forbidden literal colors, dashboard misuse of landing primitives, unbounded chip patterns, nested cards, unsafe text sizing, and unsupported surface tiers.
  - Add snapshots or manifest checks for UI vocabulary primitives.
  - Acceptance criteria: new UI code cannot introduce banned visual patterns without an explicit allowlist entry.

## 11. Accessibility QA

- [x] Objective: cover WCAG-relevant flows automatically.
  - Add axe route matrix tests for public, auth, external, dashboard, route-state, and modal surfaces.
  - Add keyboard-only tests for navigation, command palette, dialogs, forms, uploads, tables, pagination, and destructive actions.
  - Add focus restoration, skip link, landmark, accessible name, reduced motion, timeout hint, color-vision, and tab-order tests.
  - Acceptance criteria: every route family has automated a11y coverage and every interactive control has a programmatic name.

- [x] Objective: cover international and cognitive stress cases.
  - Add pseudo-locale, RTL, long text, IME, timezone, relative time, pluralization, and zoom checks.
  - Acceptance criteria: text does not overlap, truncate critical actions, or become inaccessible at supported viewport and zoom levels.

## 12. Visual And Responsive QA

- [x] Objective: expand visual baselines.
  - Add visual snapshots for public, auth, external token, dashboard shell, Core, Advanced, Assurance, settings, contracts, reports, search, onboarding, loading, error, empty, and not-found states.
  - Cover light/dark mode, mobile/tablet/desktop, authenticated/unauthenticated, and reduced-motion states.
  - Acceptance criteria: visual routes are generated from a matrix and every route-state file has snapshot coverage or waiver.

- [x] Objective: harden responsive layout.
  - Add Playwright checks for overflow, horizontal scroll, overlapping text, clipped controls, sticky header/sidebar behavior, table responsiveness, and modal fit.
  - Acceptance criteria: no tested viewport has incoherent overlap or unreachable controls.

## 13. E2E Workflow QA

- [x] Objective: cover Core release workflows.
  - Add E2E tests for upload/import, extraction review, field confirmation, owner assignment, renewal tracking, obligation follow-up, evidence request, report export, settings, billing-adjacent safe states, and search.
  - Acceptance criteria: a seeded test user can complete the public Core workflow without manual intervention.

- [x] Objective: cover mode-private workflows without public exposure.
  - Add gated E2E tests for Advanced and Assurance surfaces with fixture workspaces.
  - Add negative public/self-serve discoverability tests.
  - Acceptance criteria: private surfaces work for eligible users and remain hidden or denied for ineligible users.

## 14. Import, Export, Files, And Reports

- [x] Objective: harden uploads.
  - Add tests for file type allowlist, size limits, malformed PDFs, empty files, decompression bombs, metadata stripping, duplicate uploads, storage path safety, and signed URL scope.
  - Acceptance criteria: unsafe uploads are rejected before durable processing.

- [x] Objective: harden imports and exports.
  - Add CSV formula injection, encoding, delimiter, newline, quote, large file, missing column, duplicate row, and invalid date tests.
  - Add PDF/report generation tests for redaction, content-disposition, cache headers, token scope, and cross-org denial.
  - Acceptance criteria: export/import flows preserve tenant boundaries and cannot leak formulas, secrets, or unrelated data.

## 15. Performance, Reliability, And Load

- [x] Objective: add code-owned performance budgets.
  - Add bundle, duplicate dependency, route TTFB, Web Vitals, memory, cold start, and client-side interaction budgets.
  - Add per-route-family budget JSON and ratchets.
  - Acceptance criteria: budget regressions fail or require explicit ratchet update.

- [x] Objective: add load and chaos scaffolds.
  - Add k6 or equivalent smoke/soak runners with local/staging-safe defaults and cost caps.
  - Add mocked upstream failure tests for Supabase, Stripe, Resend, OpenAI, Upstash, storage, and cron health checks.
  - Acceptance criteria: load and chaos jobs are runnable locally or in optional CI without production credentials.

## 16. Privacy, Compliance, And Evidence

- [x] Objective: automate data lifecycle checks.
  - Add DSAR/export completeness tests, deletion cascade tests, retention prune assertions, legal hold fixtures, and privacy inventory drift checks.
  - Acceptance criteria: every PII-like data family has lifecycle evidence or an explicit waiver.

- [x] Objective: automate compliance evidence mapping.
  - Add control-to-test mapping for SOC2-style controls, OWASP/ASVS rows, WCAG rows, subprocessors, consent versions, cookie policy, and jurisdiction matrices.
  - Add orphan-control and orphan-evidence checks.
  - Acceptance criteria: every control row links to at least one executable check, generated artifact, or expiring waiver.

- [x] Objective: automate sensitive-domain absence or scope evidence.
  - Add scanners or waivers for PCI, PHI, COPPA, export control, sanctions, Web3, desktop/extension, SCIM/SAML, and PWA capabilities.
  - Acceptance criteria: absent features are proven absent by code scan, not by assumption.

## 17. Observability And Incident Readiness

- [x] Objective: test telemetry contracts.
  - Add event inventory, naming, redaction, suppression, persistence, and dashboard-contract checks.
  - Add no-secret logging tests for API, server actions, cron, webhooks, imports, exports, and reports.
  - Acceptance criteria: every telemetry event has owner, purpose, payload schema, sensitivity classification, and redaction evidence.

- [x] Objective: add incident and recovery automation.
  - Add game-day scripts, DR drill smoke, rollback metadata checks, SLO budget comparison, health probe contracts, and production evidence summary generation.
  - Acceptance criteria: incident readiness can be evaluated without changing production state.

## 18. Supply Chain And CI Governance

- [x] Objective: harden dependency governance.
  - Add SBOM SPDX/CycloneDX parity, license graph, dependency review, lockfile integrity, lifecycle script allowlist, typosquat/confusion, vulnerability scan, and dependency sunset reports.
  - Acceptance criteria: dependency changes update the risk report or fail policy checks.

- [x] Objective: harden GitHub Actions.
  - Add workflow permission, trigger, pinning, scheduled-secret, artifact-integrity, secret-gate, merge-queue parity, required-check, and branch-protection drift checks.
  - Acceptance criteria: unsafe workflow changes fail static CI before execution risk.

- [x] Objective: add provenance and reproducibility evidence.
  - Add reproducible build hash checks, release artifact provenance checks, SLSA/cosign verification stubs or real checks where artifacts exist, and generated report checksums.
  - Acceptance criteria: release artifacts have verifiable source, command, commit, and checksum metadata.

## 19. Skip, Waiver, And Flake Governance

- [x] Objective: make exclusions visible and expiring.
  - Add skip baseline, quarantine, waiver registry, skip SLA, and owner metadata checks.
  - Add pre-expiry warnings and hard failures after expiry.
  - Acceptance criteria: no skipped test, waived route, or allowlisted violation lacks owner, reason, expiry, and validation command.

- [x] Objective: make flaky tests actionable.
  - Add Playwright stability reports, retry classification, failure buckets, screenshots, traces, JUnit merge, and threshold checks.
  - Acceptance criteria: flaky tests either stabilize, quarantine with expiry, or fail the stability gate.

## 20. Release Readiness Automation

- [x] Objective: make release preflight code-owned where safe.
  - Add checks for env example parity, release-required env names, staging/prod key mismatch heuristics, cron config, Supabase config, Stripe price shape, callback URL shape, Sentry configuration, and rollback metadata.
  - Acceptance criteria: `npm run preflight:release` catches local/config drift without using production secrets.

- [x] Objective: make release evidence deterministic.
  - Add release-readiness report generation, production-evidence summary, PR body rollup, QA closure manifest, and artifact checksums.
  - Acceptance criteria: release evidence can be regenerated with no manual edits and no secret values.

## 21. Search-Specific QA

- [x] Objective: cover the new search surfaces.
  - Add tests for query parsing, empty query, long query, special characters, Unicode, tenant filtering, workspace-mode filtering, keyboard navigation, result grouping, no-results state, and direct result links.
  - Add API route tests for search permission boundaries and rate limiting.
  - Acceptance criteria: search cannot reveal hidden, private, cross-tenant, or mode-ineligible resources.

## 22. Contract Workflow QA

- [x] Objective: cover contract list and detail behavior.
  - Add tests for sorting, filtering, pagination, owner assignment, status transitions, delete confirmation, review mode separation, stale data, loading state, and empty state.
  - Acceptance criteria: contract rows and detail pages preserve source-backed field provenance and do not permit invalid status transitions.

- [x] Objective: cover bulk and review workspaces.
  - Add tests for bulk upload, partial failure, retry, duplicate file, malformed row, field review actions, checkpoint panels, recent uploads, and evidence requirements.
  - Acceptance criteria: bulk workflows clearly report per-item success/failure and never silently drop rows.

## 23. Onboarding And Settings QA

- [x] Objective: harden onboarding calibration.
  - Add copy-source, wizard-step, validation, back/forward, stale calibration, blocked state, accessibility, and review tests.
  - Acceptance criteria: calibration state is deterministic and cannot activate invalid workspace settings.

- [x] Objective: harden settings.
  - Add product-surface settings, health settings, workspace policy, role capability, security settings, env-dependent controls, and private-mode settings tests.
  - Acceptance criteria: settings changes are authorized, persisted, reflected in navigation, and safely rolled back on failure.

## 24. Navigation, IA, And Discoverability QA

- [x] Objective: prove every navigable surface is reachable intentionally.
  - Add navigation graph generation for header, sidebar, footer, command palette, in-page CTAs, breadcrumbs, email links, notification links, and redirect targets.
  - Add broken-link, orphan-route, duplicate-destination, inaccessible-private-link, and hidden-public-link checks.
  - Acceptance criteria: every reachable route is represented in navigation evidence and every route intentionally unreachable has an explicit reason.

- [x] Objective: test command and shortcut behavior.
  - Add command-palette coverage for search, grouped results, disabled commands, hidden commands, workspace-mode filtering, keyboard navigation, escape/blur behavior, and direct action execution.
  - Add shortcut collision and focus-safety checks where shortcuts exist.
  - Acceptance criteria: commands cannot navigate to unauthorized or mode-ineligible surfaces.

## 25. Content, Copy, And Metadata QA

- [x] Objective: enforce release-safe public positioning in code-owned content.
  - Add static checks for prohibited claims, unsupported product categories, legal-advice language, guarantee language, autonomous-agent overclaims, and private-mode leakage.
  - Add tests for page titles, descriptions, H1s, Open Graph text, pricing labels, contact copy, onboarding copy, and email copy.
  - Acceptance criteria: public content matches the release-state promise and does not expose Advanced or Assurance as public self-serve products.

- [x] Objective: make content quality measurable.
  - Add readability, duplicate copy, placeholder text, TODO/FIXME exposure, lorem ipsum, broken punctuation, missing alt text, stale year, and unsupported brand-name checks.
  - Acceptance criteria: user-facing copy has no placeholder content, stale release labels, or unsupported claims.

## 26. Forms, Validation, And Input QA

- [x] Objective: cover every form path.
  - Generate a form inventory covering auth, contact, upload, contract creation, field review, owner assignment, settings, billing-adjacent forms, onboarding, search, filters, and bulk actions.
  - Add tests for required fields, optional fields, invalid data, max length, pasted input, autofill, submit-on-enter, double submit, server errors, network errors, and reset/cancel behavior.
  - Acceptance criteria: every form has client and server validation evidence with accessible error rendering.

- [x] Objective: harden validation boundaries.
  - Add schema tests for IDs, emails, URLs, dates, money, enum values, JSON payloads, arrays, nested objects, and unknown fields.
  - Add fuzz/property tests for malformed, oversized, Unicode, confusable, path-like, SQL-like, HTML-like, and control-character input.
  - Acceptance criteria: invalid input is rejected consistently and never reaches unsafe sinks.

## 27. Tables, Lists, Filters, And Pagination QA

- [x] Objective: cover repeated-data UI patterns.
  - Add tests for sorting, filtering, search-within-list, pagination, empty pages, cursor invalidation, row selection, bulk selection, sticky headers, dense rows, column overflow, and mobile collapse.
  - Add accessibility tests for table captions, header associations, row actions, checkbox names, and keyboard row traversal.
  - Acceptance criteria: table/list state is stable across reloads, filters, viewport changes, and permission changes.

- [x] Objective: harden query-cost and pagination abuse controls.
  - Add static and runtime tests for max page size, default limits, cursor tampering, negative offsets, huge offsets, repeated filters, and expensive sort combinations.
  - Acceptance criteria: list APIs and UI cannot request unbounded or tenant-leaking result sets.

## 28. State Management, Caching, And Revalidation QA

- [x] Objective: prove data freshness semantics.
  - Add checks for `revalidatePath`, `revalidateTag`, cache tags, no-store boundaries, sensitive cache controls, stale UI markers, optimistic state, rollback state, and read-after-write behavior.
  - Add tag registry drift checks for every cache tag usage.
  - Acceptance criteria: mutations invalidate the correct views and sensitive data is never cached publicly.

- [x] Objective: test browser and app state transitions.
  - Add tests for reload, back/forward, bfcache, tab duplication, session expiry, offline/online, theme switch, workspace switch, mode switch, and stale route params.
  - Acceptance criteria: state transitions do not expose stale private data or leave controls in misleading pending states.

## 29. Time, Date, Calendar, And Locale QA

- [x] Objective: make time-dependent behavior deterministic.
  - Add fake-clock tests for renewal dates, notice windows, relative time, cron windows, token expiry, webhook skew, retention, stale calibration, and SLO windows.
  - Add DST, leap year, month-end, timezone, locale, and calendar-boundary fixtures.
  - Acceptance criteria: date logic is independent of developer machine timezone and handles boundary dates correctly.

- [x] Objective: harden display formats.
  - Add tests for absolute date labels, relative date labels, screen-reader date labels, compact time chips, timezone disclosure, and export date formats.
  - Acceptance criteria: every displayed date has a deterministic locale/timezone policy and accessible full-date equivalent where compacted.

## 30. Money, Billing, And Plan-State QA

- [x] Objective: test money and billing-adjacent code without live charges.
  - Add integer-money, currency, rounding, tax-placeholder, price ID, plan entitlement, trial, cancellation, renewal, failed-payment, and portal-return tests.
  - Add Stripe-mode mismatch checks for test/live keys and prices.
  - Acceptance criteria: billing state cannot unlock unauthorized product modes or use mismatched Stripe configuration.

- [x] Objective: protect billing UI and exports.
  - Add tests for invoice/status labels, plan chips, upgrade/downgrade affordances, payment failure messaging, and no-card-data storage.
  - Acceptance criteria: billing UI never asks for or stores PAN/card data outside Stripe-owned surfaces.

## 31. Role, Team, Account, And Organization QA

- [x] Objective: cover team and account lifecycle.
  - Add tests for invite, accept invite, resend invite, revoke invite, role change, self-demotion prevention, last-admin prevention, member removal, account switch, organization switch, and deleted/deactivated users.
  - Acceptance criteria: membership changes are tenant-scoped, audited, and reflected in navigation and permissions.

- [x] Objective: prove role capability consistency.
  - Add generated role-capability inventory and compare UI affordances, API authorization, server action authorization, and database policy expectations.
  - Acceptance criteria: a role cannot see or invoke actions it cannot complete server-side.

## 32. External Token, Sharing, And Public-Link QA

- [x] Objective: harden external/public token flows.
  - Add tests for valid token, expired token, revoked token, malformed token, wrong scope, replay, nonce, signed-link narrowing, cache headers, and no-index metadata.
  - Add cross-org and privilege-escalation negative tests.
  - Acceptance criteria: external links reveal only their scoped payload and cannot become authenticated workspace sessions.

- [x] Objective: test public embed/share surfaces if present.
  - Add checks for frame policy, CSP, origin restrictions, token leakage in referrers, copy-link behavior, and route-state rendering.
  - Acceptance criteria: shareable surfaces are scoped, cache-safe, and revocable.

## 33. Notifications, Deep Links, And Messaging QA

- [x] Objective: cover notification payloads and destinations.
  - Add inventory for email, in-app, webhook, audit, outbound events, and future messaging channels.
  - Add tests for payload redaction, link signing, deep-link routing, invalid destination, unsubscribed state, duplicate send, retry, and delivery failure.
  - Acceptance criteria: notification payloads contain no secrets or unrelated tenant data and every link has a tested destination.

- [x] Objective: guard against spoofing and injection.
  - Add checks for sender identity, display-name spoofing, HTML sanitization, markdown sanitization, URL rewriting, and attachment safety.
  - Acceptance criteria: generated messages cannot inject scripts, spoof trusted identities, or leak sensitive metadata.

## 34. File Processing And Document Extraction QA

- [x] Objective: harden document parser boundaries.
  - Add fixtures for PDF, DOCX, corrupted PDF, encrypted PDF, scanned image PDF, huge page count, embedded scripts, malformed metadata, weird encodings, and unsupported file types.
  - Add tests for parser timeouts, memory caps, text extraction limits, metadata stripping, and fallback behavior.
  - Acceptance criteria: document processing fails safely and reports actionable per-file errors.

- [x] Objective: preserve source-backed evidence.
  - Add tests for field provenance, citation/page references, confidence thresholds, human review overrides, original-vs-normalized values, and export/report provenance.
  - Acceptance criteria: extracted values cannot be marked confirmed without review or source evidence according to product rules.

## 35. Browser, Device, OS, And Platform QA

- [x] Objective: cover supported browser engines and device classes.
  - Add Chromium, WebKit, Firefox, mobile viewport, tablet viewport, desktop viewport, touch, pointer, keyboard, high-DPI, and reduced-resource smoke lanes.
  - Add optional Edge, Safari, Android WebView, iOS WKWebView, Windows, macOS, and Linux workflow stubs where CI supports them.
  - Acceptance criteria: unsupported combinations are explicitly waived and supported combinations have at least smoke evidence.

- [x] Objective: test platform APIs safely.
  - Add tests for clipboard, downloads, file picker, storage quota, permissions prompts, print media, service worker/PWA absence or presence, and notification permissions.
  - Acceptance criteria: platform API use is permission-safe and has graceful fallback behavior.

## 36. Network, HTTP, CDN, And Transport QA

- [x] Objective: harden HTTP behavior.
  - Add checks for redirects, canonical hosts, trusted hosts, forwarded headers, request framing, compression, gzip, content negotiation, ETags, cache poisoning, CDN cache keys, and CORS.
  - Add IPv4, IPv6, localhost, private-network, and DNS rebinding guard tests where applicable.
  - Acceptance criteria: requests resolve to canonical, tenant-safe, cache-safe responses.

- [x] Objective: prove absent or special transports.
  - Add inventory and tests or waivers for SSE, WebSocket, long polling, streaming responses, GraphQL, RPC-like endpoints, webhooks, and file downloads.
  - Acceptance criteria: every transport protocol is either tested or proven absent.

## 37. Package, Build, Runtime, And Deployment Config QA

- [x] Objective: harden framework/build configuration.
  - Add checks for Next config, TypeScript config, ESLint config, Tailwind/PostCSS config, Playwright config, Vitest config, Sentry config, Vercel config, middleware matchers, route segment config, and env loading.
  - Acceptance criteria: config drift is caught before build or deploy.

- [x] Objective: prove build output safety.
  - Add checks for sourcemap policy, server/client bundle separation, dynamic import specifiers, executable masquerade files, public asset exposure, WASM/native addon inventory, and image optimization policy.
  - Acceptance criteria: build artifacts do not expose server-only code, secrets, or unsupported binaries.

## 38. Data Model, Schema Evolution, And Compatibility QA

- [x] Objective: make schema evolution reviewable.
  - Add generated inventories for tables, columns, indexes, constraints, enums, functions, policies, views, triggers, storage buckets, and seed data.
  - Add compatibility checks for additive migrations, backfills, destructive changes, dual-read/write periods, rollback/fix-forward plans, and deprecated fields.
  - Acceptance criteria: schema changes include generated evidence for compatibility and tenant safety.

- [x] Objective: protect persisted contracts.
  - Add tests for persisted JSON shapes, telemetry names, export filenames, public route aliases, API paths, cron paths, env aliases, package-script aliases, and SQL object aliases.
  - Acceptance criteria: persisted or external contracts are never renamed without compatibility evidence and removal queue coverage.

## 39. Test Data, Fixtures, And Synthetic Personas QA

- [x] Objective: make fixtures realistic and safe.
  - Add fixture policy checks for fake PII, fake secrets, no real customer data, no production IDs, deterministic seeds, and fixture ownership.
  - Add synthetic personas for roles, organization sizes, contract portfolios, empty workspaces, large workspaces, private-mode workspaces, and failure states.
  - Acceptance criteria: tests cover realistic product states without containing real sensitive data.

- [x] Objective: prevent fixture drift.
  - Add fixture schema validation, snapshot review, seeded-data cleanup, auth storage cleanup, and E2E teardown checks.
  - Acceptance criteria: repeated test runs do not accumulate state or depend on prior local state.

## 40. Reporting, Dashboards, And Artifact QA

- [x] Objective: make QA outputs consumable.
  - Add JSON schema validation for every generated report, dashboard, matrix, registry, waiver file, and evidence artifact.
  - Add checksum, provenance, command, commit, generated-at policy, and redaction checks.
  - Acceptance criteria: artifacts are machine-readable, reproducible, redacted, and traceable to commands.

- [x] Objective: prevent artifact/config confusion.
  - Add checks that generated artifacts used as evidence are not imported as runtime configuration unless explicitly designed for runtime use.
  - Add generated artifact hygiene checks for stale files, unowned files, missing write commands, and missing check commands.
  - Acceptance criteria: evidence artifacts cannot silently become runtime dependencies.

## 41. Abuse, Fraud, And Adversarial Behavior QA

- [x] Objective: cover abuse patterns.
  - Add tests for brute force, credential stuffing shape, account enumeration, invite abuse, contact form spam, upload spam, rate-limit bypass, bot placeholder policy, CAPTCHA absence/presence, and resource exhaustion.
  - Acceptance criteria: abuse paths are rate-limited, logged safely, and fail without leaking user existence or tenant data.

- [x] Objective: cover adversarial content.
  - Add payload corpora for HTML/script injection, SQL-like strings, formula injection, prompt injection, Unicode controls, confusables, bidi text, path traversal, zip/decompression tricks, and malformed URLs.
  - Acceptance criteria: adversarial content is stored, displayed, exported, and logged safely.

## 42. Legal, Policy, And Trust Surface QA

- [x] Objective: make legal/trust pages code-verifiable.
  - Add tests for privacy, terms, cookies, accessibility, security, subprocessor, DPA references, contact routes, policy metadata, effective dates, noindex/index policy, and broken legal links.
  - Add checks that release content does not contradict legal/trust pages.
  - Acceptance criteria: trust pages render, link, and expose expected metadata without implementation dependency on markdown.

- [x] Objective: verify consent and preference flows.
  - Add tests for cookie preference persistence, consent version changes, GPC handling, unsubscribe/preference links, and analytics suppression.
  - Acceptance criteria: consent state is honored in client behavior, server behavior, and telemetry emission.

## 43. Internationalization, Unicode, And Text Safety QA

- [x] Objective: cover Unicode security.
  - Add checks for Trojan Source controls, bidi controls, mixed-script confusables, non-normalized identifiers, invisible characters, and unsafe slug/path characters.
  - Add tests for user-entered names, counterparties, file names, contract fields, search queries, and exports.
  - Acceptance criteria: Unicode is accepted where useful, normalized where required, and rejected where dangerous.

- [x] Objective: prepare for localization even if not launched.
  - Add inventories for user-facing strings, date/number formatting, pluralization, currency display, and locale-sensitive sorting.
  - Acceptance criteria: locale-sensitive code paths are explicit and testable.

## 44. Developer Experience And Maintainability QA

- [x] Objective: reduce QA maintenance risk.
  - Add dead script detection, unused artifact detection, stale allowlist detection, duplicated check detection, dependency cycle checks, import-boundary checks, and source tree coverage checks.
  - Add owner metadata for high-risk scripts and generated artifacts.
  - Acceptance criteria: QA infrastructure changes are covered by tests and ownership metadata.

- [x] Objective: make failures actionable.
  - Add standardized error output for QA scripts with failing file, row, reason, remediation hint, owner, and validation command.
  - Acceptance criteria: a failing check can be fixed without reading script internals for basic context.

## 45. Final Code-Only Closure

- [x] Objective: prove every code-only QA objective is either implemented or blocked by a non-code boundary.
  - Add a generated closure artifact that lists each objective, owning script/test, artifact path, CI job, status, blocker class, and validation command.
  - Add a check that fails on objectives without implementation evidence or explicit external/manual boundary.
  - Acceptance criteria: the closure artifact reports zero uncovered code-only objectives and zero stale waivers.
  - Completion evidence:
    - Added `config/autonomous-code-only-qa-objectives.json` with all 96 checklist objectives and executable npm-script evidence.
    - Extended `scripts/report-qa-closure-manifest.mjs` to validate objective ids, titles, evidence command coverage, and package-script existence.
    - Regenerated `artifacts/qa-closure-manifest.json` with `autonomousCodeOnlyQaObjectives`.
    - Added invariant coverage in `src/lib/qa/qa-closure-manifest-invariants.test.ts`.

- [x] Objective: preserve documentation independence.
  - Add or keep a check that runtime/build/test implementation does not import or parse this document.
  - Acceptance criteria: markdown can be edited or removed without changing runtime behavior, tests, generated artifacts, or CI semantics.
  - Completion evidence:
    - Verified with `npm run check:documentation-runtime-dependencies`.
    - This checklist remains a non-runtime planning and review artifact.
