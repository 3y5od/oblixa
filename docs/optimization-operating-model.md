# Optimization Operating Model

This document covers the operational workstreams that sit outside route code but still affect loading speed, reliability, customer trust, and rollout safety.

## Incident Communications And Degraded Operations

Severity mapping:

- `SEV-1`: auth unavailable, primary dashboard routes unavailable, cross-org exposure risk, data deletion/retention incident, billing enforcement failure, or critical provider outage with no safe fallback.
- `SEV-2`: sustained p95 primary route latency above budget, Supabase degradation, import/export backlog, extraction/report generation failure, email delivery outage, telemetry outage hiding production health, or stuck migrations/backfills.
- `SEV-3`: stale summaries, delayed nav badges, degraded optional AI/search/analytics, partial report/export generation, or isolated mobile/enterprise-network failures.
- `SEV-4`: minor visual regressions, documentation drift, non-critical procurement evidence gaps, or isolated support diagnostics gaps.

Customer messaging templates must describe impact, affected workflows, freshness or accuracy implications, workaround, next update time, and recovery criteria. They must not expose provider secrets, internal table names, raw query plans, customer data, or exploit details.

Incident reviews must capture root cause, missing metric, missing guardrail, budget adjustment, runbook update, test or audit addition, support follow-up, and customer-facing communication owner.

Break-glass controls should preserve primary workflows while disabling optional expensive systems such as AI extraction, exports, imports, report generation, assurance recompute, telemetry ingestion, notification delivery, command-palette remote search, and graph analytics.

## Legal Hold, Residency, Privacy, And Data Lifecycle

Derived summaries, search vectors, normalized operational dates, telemetry, job payloads, exports, reports, artifacts, logs, and backups are data copies. Any optimization that adds one of these must document:

- Source of truth and derived fields.
- Org scope and role scope.
- Retention policy and legal-hold behavior.
- Deletion, export, correction, and suppression behavior.
- Provider, region, and residency assumptions.
- Redaction and minimization rules.

Cleanup jobs must skip legal-hold records and must not retain records past policy when no hold applies. Support diagnostics, incident reports, provider payloads, logs, traces, screenshots, analyzer artifacts, and generated evidence must be redacted before sharing outside trusted operators.

Performance telemetry is treated as internal diagnostic data by default. If it includes user IDs, IP addresses, route paths that reveal customer activity, search terms, file names, or contract metadata, it must be treated as personal/customer data and follow consent, retention, deletion, and redaction rules.

## Enterprise, Mobile, And External Consumer Compatibility

Primary workflows must continue when optional telemetry, Sentry, analytics, beacon endpoints, or provider scripts are blocked by firewalls, ad blockers, tracking blockers, CSP, browser extensions, VPN latency, SSL inspection, managed device policies, or private browsing.

Supported external contracts include public pages, auth callbacks, password reset links, invitation links, external participant routes, signed download links, calendar feeds, webhooks, CSV/PDF/JSON exports, report artifacts, email links, and documented API behavior. Changes to routing, caching, redirects, tokens, exports, or public artifacts require compatibility checks.

Downloads and generated artifacts must set safe content type, content disposition, cache scope, and sniffing protections. User-provided or generated content previews must be sanitized, bounded, org-scoped, and never parsed on the first page load unless the preview is the primary action.

Mobile and embedded-webview checks should cover route load bytes, INP, scroll performance, drawer latency, keyboard-induced layout shifts, safe areas, touch targets, file uploads, external participant flows, auth, password reset, evidence submission, report links, and signed downloads.

## Billing, Quotas, Providers, And Cost Controls

Billable and expensive resources include seats, contracts, storage, imports, exports, AI extraction, reports, notifications, assurance recomputes, provider calls, and status polling. Entitlement and quota checks must use trusted internal state on hot paths; provider calls are for reconciliation, not route rendering.

Webhook processing must be idempotent and observable. Duplicate, delayed, out-of-order, failed, downgraded, canceled, reactivated, and customer-ID-mismatch events require tests or support diagnostics.

Provider inventory must track hosting, database, storage, auth, email, AI, billing, telemetry, error tracking, CI, DNS, analytics, and status providers with data categories, criticality, region, retention, deletion behavior, breach notification dependencies, fallback strategy, and exit strategy.

## Accessibility, Procurement, And Trust Evidence

Formal accessibility evidence should include route coverage, known exceptions, test commands, remediation ownership, regression policy, keyboard coverage, focus order, landmarks, headings, labels, error messages, reduced motion, contrast, zoom/reflow, screen-reader behavior, live regions, streamed content, exports, reports, emails, and PDFs.

Procurement-ready evidence should cover supported browsers, accessibility testing scope, performance commitments, data handling, degraded modes, subprocessors, dependency/license summaries, and release validation commands.

Accessibility signoff is required for changes that split server/client components, change loading states, virtualize lists, alter dialogs/forms, or introduce new dynamic content.

## Database, Search, And Domain Semantics

Database operations must track autovacuum, bloat, statistics freshness, locks, dead tuples, deadlocks, slow planning time, rows read versus rows returned, and query plans for snapshot RPCs, summary reads, large searches, import/export scans, report summaries, and assurance analytics.

Every new index needs an owner, hot query, write-cost expectation, bloat watch, and removal criteria. Bulk imports, summary rebuilds, and backfills must avoid long-lived locks and starvation of autovacuum.

Business-date semantics must be explicit for renewal windows, notice deadlines, due soon, overdue, review dates, report periods, reminder dates, and SLA simulations. Document whether calculations use calendar days, business days, org timezone, user timezone, UTC, contract jurisdiction, or date-only semantics.

Search behavior must define relevance expectations for command palette, contract search, extracted-field search, saved views, report discovery, settings search, and future global search. Search telemetry must avoid storing sensitive raw terms unless explicitly redacted and approved.

## Tooling, Governance, And Change Control

High-risk optimization PRs require review for migrations, security headers, auth/route guards, provider credentials, CI scripts, performance budgets, release artifacts, route inventories, generated baselines, and rollback plans.

Environment ownership must cover Vercel settings, environment variables, cron definitions, domains, redirects, headers, DNS, Supabase settings, storage buckets, auth settings, provider webhooks, Redis/Upstash, Sentry, callback URLs, and telemetry sampling.

Reproducible local verification tiers:

- Minimal: `npm run report:performance-baseline`, `npm run check:performance-static:grep`, `npm run typecheck`.
- Medium: minimal plus `npm run lint`, focused tests, and `npm run check:migrations`.
- Full: medium plus `npm run test`, `npm run check:bundle-budget`, analyzer build, and relevant Playwright routes.

Any change that adds telemetry, AI calls, email paths, storage artifacts, logging, external integrations, generated artifacts, or new data copies must update the provider/data-processing inventory or state why no update is needed.

## Ownership And Knowledge Transfer

Future contributors should preserve these anti-pattern removals:

- No layout-blocking optional data.
- No broad refresh loops by default.
- No exact counts on first render unless user-critical.
- No unbounded list reads.
- No client-imported server telemetry for passive events.
- No heavy always-mounted hidden client islands.

Recurring reviews should cover performance budgets, dependency weight, DB health, job backlogs, route inventory, accessibility evidence, incident learnings, data-processing inventory, provider inventory, mobile/enterprise feedback, and customer-reported performance issues.
