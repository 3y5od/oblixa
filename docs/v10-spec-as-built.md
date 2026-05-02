# Oblixa V10 — Specification As Built (As-Built Engineering Reference)

**Document type:** As-built / implementation truth layered on the normative product contract.  
**Normative product spec:** [`docs/v10.md`](./v10.md) (user-visible requirements, SLOs, acceptance semantics).  
**Trace matrix (spec → code):** [`docs/v10-spec-trace-matrix.md`](./v10-spec-trace-matrix.md).  
**Operator runbook:** [`docs/v10-ops-runbook.md`](./v10-ops-runbook.md).  
**Typed contract version:** `V10_SPEC_VERSION = "v10.0.0"` in `src/lib/v10-release-contract.ts`.  
**Primary schema migration:** `supabase/migrations/057_v10_runtime_contracts.sql`.

This document describes **what the repository actually implements** for V10: data shapes, enforcement points, automation, CI gates, and **behavior under adversarial and failure conditions**. It is not a substitute for automated tests or release evidence; those remain authoritative for “does it pass the bar right now.”

---

## Table of contents

1. [Purpose, scope, and reading order](#1-purpose-scope-and-reading-order)  
2. [System context and trust boundaries](#2-system-context-and-trust-boundaries)  
3. [Product layers (V4–V6) and workspace modes](#3-product-layers-v4v6-and-workspace-modes)  
4. [V10 architectural role](#4-v10-architectural-role)  
5. [Versioned artifact contracts (code)](#5-versioned-artifact-contracts-code)  
6. [Enumerations and catalogs (as persisted and typed)](#6-enumerations-and-catalogs-as-persisted-and-typed)  
7. [Relational as-built: tables, indexes, constraints](#7-relational-as-built-tables-indexes-constraints)  
8. [Row Level Security and RPC exposure model](#8-row-level-security-and-rpc-exposure-model)  
9. [Read models: derivation, refresh, drift](#9-read-models-derivation-refresh-drift)  
10. [Mutations: envelope, idempotency, audit](#10-mutations-envelope-idempotency-audit)  
11. [Mutation catalog (implemented registry)](#11-mutation-catalog-implemented-registry)  
12. [Cron routes and rate limits](#12-cron-routes-and-rate-limits)  
13. [HTTP edge: proxy, session, calibration gates](#13-http-edge-proxy-session-calibration-gates)  
14. [CI, pipeline verification, and script ratchets](#14-ci-pipeline-verification-and-script-ratchets)  
15. [Telemetry, logging, and privacy enforcement](#15-telemetry-logging-and-privacy-enforcement)  
16. [Adversarial conditions — comprehensive threat-informed behavior](#16-adversarial-conditions--comprehensive-threat-informed-behavior)  
17. [Operational contracts and diagnostics](#17-operational-contracts-and-diagnostics)  
18. [Release evidence, fixtures, and promotion mechanics](#18-release-evidence-fixtures-and-promotion-mechanics)  
19. [Testing surfaces](#19-testing-surfaces)  
20. [Non-goals and explicit out-of-repo dependencies](#20-non-goals-and-explicit-out-of-repo-dependencies)  
21. [Primary source file index](#21-primary-source-file-index)  
22. [Acceptance gates and release states (encoded)](#22-acceptance-gates-and-release-states-encoded)  
23. [Mutation envelope, HTTP semantics, and schema validators](#23-mutation-envelope-http-semantics-and-schema-validators)  
24. [Required mutation contracts and runtime artifact pins](#24-required-mutation-contracts-and-runtime-artifact-pins)  
25. [Governance, eligibility, and health diagnostics](#25-governance-eligibility-and-health-diagnostics)  
26. [Contract health score and next-action resolution](#26-contract-health-score-and-next-action-resolution)  
27. [Work semantics, lenses, and deterministic ordering](#27-work-semantics-lenses-and-deterministic-ordering)  
28. [Hardening contracts and typed adversarial scenarios](#28-hardening-contracts-and-typed-adversarial-scenarios)  
29. [Database indexes and uniqueness (operational summary)](#29-database-indexes-and-uniqueness-operational-summary)  
30. [npm scripts and V10 gate commands](#30-npm-scripts-and-v10-gate-commands)  
31. [Related security and design documentation](#31-related-security-and-design-documentation)  
32. [Objective measurements and GA sample sizes](#32-objective-measurements-and-ga-sample-sizes)  
33. [Route API catalog (`v10-route-api-catalog`)](#33-route-api-catalog-v10-route-api-catalog)  
34. [UI recoverability and accessibility contracts](#34-ui-recoverability-and-accessibility-contracts)  
35. [Scheduled automation inventory (`vercel.json`)](#35-scheduled-automation-inventory-verceljson)  
36. [Appendix A: `V10_READ_MODEL_REFRESH_EVENT_TARGETS` (verbatim)](#36-appendix-a-v10_read_model_refresh_event_targets-verbatim)  
37. [Appendix B: `V10_OBJECTIVE_TARGETS` (verbatim)](#37-appendix-b-v10_objective_targets-verbatim)  
38. [Appendix C: `V10_RELEASE_FIXTURE_MINIMUMS` (verbatim)](#38-appendix-c-v10_release_fixture_minimums-verbatim)  
39. [Read-model visibility helpers (`v10-visibility`)](#39-read-model-visibility-helpers-v10-visibility)  
40. [Deferred vs direct refresh sources](#40-deferred-vs-direct-refresh-sources)

---

## 1. Purpose, scope, and reading order

### 1.1 What this document is

- A **consolidated as-built** for engineers, security reviewers, SREs, and auditors mapping **normative V10** (`docs/v10.md`) to **concrete artifacts**: SQL, RLS, RPCs, TypeScript modules, Next.js routes, cron handlers, and CI scripts.
- An explicit treatment of **failure modes and adversarial pressure** against the V10 runtime contract (org isolation, idempotency, audit integrity, read-model coherence).

### 1.2 What this document is not

- Not a promise that every UI pixel matches every §4 bullet in `docs/v10.md` without running gates; **implementation completeness** is enforced by tests and `npm run check:v10-*` scripts.
- Not legal or compliance attestation; it describes **technical controls** as implemented in code.

### 1.3 Suggested reading order

1. Normative intent: `docs/v10.md` §1–§3 (release contract, objectives, tiers).  
2. This file §2–§4 (trust boundaries + V10 role).  
3. §7–§10 and §9.6 (data, refresh fan-out, mutations).  
4. §16 (adversarial) and §28 (hardening contract types).  
5. §22–§24 (gates, envelope validators, mutation pins).  
6. §33–§35 (API catalog, UI contracts, full cron inventory).  
7. §36–§38 (appendices: refresh targets, objectives, fixture floors).  
8. `docs/v10-ops-runbook.md` for live incident handling.

---

## 2. System context and trust boundaries

### 2.1 Oblixa in one paragraph (as built)

Oblixa is a **contract operations** web application: **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind**, hosted on **Vercel**; **Supabase** for Postgres, auth, and storage; **Stripe** billing; **Resend** email; **OpenAI** for extraction; tests via **Vitest** and **Playwright**; static/dynamic analysis includes **Semgrep** (referenced in README).

**Hardening toggles (as built in config):** `.env.example` documents staged CSP (`OBLIXA_CSP_*`), Trusted Types report-only (`OBLIXA_TRUSTED_TYPES_REPORT_ONLY`), strict style CSP (`OBLIXA_CSP_STRICT_ENFORCING_STYLE`), self-hosted HSTS (`OBLIXA_SELF_HOSTED_HSTS`), and **`OBLIXA_STRICT_ENV`** for production startup warnings when automation secrets are missing. These interact with `src/lib/security/csp-builders.ts` and `next.config.ts` but are **environment-gated** — default local dev remains permissive.

### 2.2 Trust zones

| Zone | Responsibility | Typical secrets | Adversary model |
|------|----------------|-----------------|-----------------|
| **Browser** | Renders UI; holds user session cookies; runs client telemetry (if enabled). | None (only `NEXT_PUBLIC_*` config). | XSS, malicious extensions, token theft from another origin if misconfigured. |
| **Edge / Node (Next.js)** | Route handlers, Server Actions, SSR, cron entrypoints. | Service role key, provider keys, `CRON_SECRET`, encryption keys. | Request forgery, SSRF, confused-deputy if org scope omitted, header injection. |
| **Supabase Postgres** | Authoritative data; RLS for member-facing paths; **security definer** RPCs for controlled elevation. | DB credentials via platform. | SQL injection (mitigated by parameterized access patterns), **bypass of RLS** if service role used incorrectly on reads exposed to users. |
| **External actors** | Evidence submitters with opaque tokens; Stripe webhooks; email inbound hooks. | Webhook signing secrets, HMAC secrets. | Token guessing, replay, webhook spoofing. |

### 2.3 Non-negotiable V10 invariants (as built intent)

1. **Organization isolation** on every durable read/write path that surfaces tenant data (see §16.2).  
2. **Server-derived actor identity** for authenticated mutations; clients must not silently substitute `actor_user_id` (see `docs/v10.md` §5.5 and §10.4 here).  
3. **Idempotent mutations** with **payload-hash conflict** detection and **24h** replay window at the database layer (see §10).  
4. **Transactional semantics**: state-changing mutations that require audit must not commit business state if **strict audit insert** fails (`audit_write_failed` path — see §10.3).  
5. **Privacy-safe telemetry and audit metadata** — server-side sanitization strips or redacts sensitive keys (see §15).

---

## 3. Product layers (V4–V6) and workspace modes

As described in [`README.md`](../README.md):

- **V4** — execution: tasks, obligations, approvals, renewals, exceptions, programs, report packs, `/api/cron/v4/*`.  
- **V5** — decisions, campaigns, simulations, relationships, external collaboration.  
- **V6** — assurance: control policies, findings, scorecards, health graphs, playbooks, autopilot, review boards, segments.

**Workspace mode** (`core` | `advanced` | `assurance`) governs discoverability; configuration is stored in `organizations.v6_org_settings_json` (see `docs/workspace-modes-core-advanced-assurance.md`).

V10 **does not replace** these layers; it adds a **parallel, typed runtime contract** (read models, audit stream, idempotency, release evidence) aligned to `docs/v10.md` §5.

---

## 4. V10 architectural role

### 4.1 Problem V10 solves in the codebase

Prior surfaces (V8/V9) remain; V10 introduces:

- **Durable read models** (`v10_*` tables) materialized from source product tables for fast, uniform querying.  
- **A uniform mutation outcome vocabulary** (`V10_MUTATION_OUTCOMES`) and **mutation catalog** for traceability.  
- **Strong idempotency** via `v10_mutation_idempotency` + RPC `claim_v10_mutation_idempotency` / `complete_v10_mutation_idempotency`.  
- **Append-style audit** in `v10_audit_events` with JSON metadata sanitation.  
- **Operational visibility**: job/report visibility rows, refresh jobs, runtime artifacts, coverage ledger, release evidence tables.

### 4.2 Navigation families (contractual)

`V10_NAVIGATION_FAMILIES` in `src/lib/v10-release-contract.ts` lists: Home, Contracts, Review, Work, Renewals, Exceptions, Evidence, Reports, Settings, Advanced, Assurance — matching `docs/v10.md` §1.

### 4.3 Spec tiers P0 / P1 / P2 (as encoded)

`V10_RELEASE_PRIORITY_TIERS` in `src/lib/v10-release-contract.ts` mirrors `docs/v10.md` §3.1. **P2** ships only when explicitly included per release policy.

---

## 5. Versioned artifact contracts (code)

`V10_VERSIONED_ARTIFACT_CONTRACTS` defines compatibility expectations per artifact kind:

| Kind | Compatibility policy | Traceability | Migration / evidence required |
|------|----------------------|--------------|-------------------------------|
| `schema` | `breaking_requires_major` | yes | yes |
| `read_model` | `additive_only` | yes | yes |
| `api` | `additive_only` | yes | no |
| `mutation` | `additive_only` | yes | no |
| `telemetry` | `additive_only` | yes | yes |
| `release_evidence` | `evidence_version_locked` | yes | yes |
| `fixture` | `evidence_version_locked` | yes | yes |
| `acceptance_matrix` | `additive_only` | yes | no |

Helper `validateV10VersionedArtifactContract` enforces semver pattern `^v10\.\d+\.\d+$` and policy consistency.

---

## 6. Enumerations and catalogs (as persisted and typed)

### 6.1 Work, jobs, governance enums

The TypeScript exports in `src/lib/v10-release-contract.ts` are the **authoring source** for product logic. Migration `057` adds **CHECK constraints** on key columns so **invalid enum rows cannot be persisted** even if application code regresses.

Examples:

- **Work item types** — 13 values including `unassigned_work`, `automation_approval`, job failure synthetic types.  
- **Work item statuses** — `open`, `in_progress`, `blocked`, `waiting`, `done`, `canceled`.  
- **Job statuses / cancellation states** — aligned to `docs/v10.md` §4.14 and §5.1.  
- **Renewal postures and horizons** — CHECK on `v10_renewal_posture_snapshots`.  
- **Report families** — exactly the ten **Core** families for `v10_report_run_visibility` CHECK.  
- **Notification classes** — fourteen classes CHECK-constrained on `v10_notification_deliveries`.  
- **Command search** — `workspace_mode_minimum` ∈ {core, advanced, assurance}; `plan_minimum` ∈ {trial, core, advanced, assurance, enterprise}.

### 6.2 `no_action` outcome

The normative spec’s mutation outcome list in `docs/v10.md` §5.1 is reflected in code as `V10_MUTATION_OUTCOMES` including **`no_action`** (in addition to outcomes like `validation_failed`, `rate_limited`, etc.). Database CHECK on `v10_audit_events.outcome` includes `no_action`.

### 6.3 Source object types

`V10_SOURCE_OBJECT_TYPES` enumerates lineage targets (contracts, jobs, evidence, Advanced/Assurance entities, `workspace_health_diagnostic`, `runtime_artifact`, etc.). CHECK constraints on multiple tables enforce membership **at rest**.

### 6.4 Mutation outcomes (complete list)

`V10_MUTATION_OUTCOMES` in `v10-release-contract.ts` is the exhaustive set persisted on `v10_audit_events.outcome` and returned on mutation envelopes:

`success`, `validation_failed`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `stale_version`, `plan_required`, `mode_required`, `hidden_module`, `rate_limited`, `dependency_blocked`, `job_not_retryable`, `external_link_expired`, `external_link_revoked`, `audit_write_failed`, `no_action`, `server_error`.

**Normative alignment:** Matches `docs/v10.md` §5.1 with the addition of **`no_action`** for idempotent “already satisfied” paths. **`hidden_module`** maps to HTTP **404** in `V10_MUTATION_HTTP_STATUS_BY_OUTCOME` (avoid leaking module existence to unauthorized clients).

### 6.5 Rank functions (mode, role, plan)

`getV10WorkspaceModeRank`, `getV10RoleRank`, `getV10PlanRank` in `v10-release-contract.ts` implement ordered eligibility comparisons. **Special case:** `getV10RoleRank("external_token")` returns **negative infinity** in the TypeScript helper so generic “minimum role” comparisons treat external evidence as **outside** normal member ranks unless a handler explicitly whitelists that mutation.

**SQL mirror:** `v10_role_rank(text)` in migration `057` returns discrete integers (legal and finance reviewer both **20**). Application and SQL layers must stay **consistent** on ordering when adding roles.

---

## 7. Relational as-built: tables, indexes, constraints

All definitions below originate from **`057_v10_runtime_contracts.sql`** unless a later migration alters them.

### 7.1 Organization member roles (integration point)

The migration **replaces** `organization_members_role_check` so `role` ∈  
`viewer`, `legal_reviewer`, `finance_reviewer`, `editor`, `ops_manager`, `manager`, `admin`  
— matching `docs/v10.md` §3.4.

### 7.2 Core runtime tables (tenant data plane)

| Table | Purpose |
|-------|---------|
| `v10_mutation_idempotency` | Idempotency claims; unique on `(organization_id, actor_user_id, mutation_name, target_type, target_id, idempotency_key)`. Stores `request_hash`, serialized `response_json`, `claim_status` (`in_progress` \| `completed`), `claimed_at`, `completed_at`, `claim_expires_at`, row-level `expires_at` (default **now + 24h**). Indexes: lookup composite, `expires_at`, partial `client_request_id`, partial **`in_progress` + `claim_expires_at`** for stuck-claim discovery. |
| `v10_audit_events` | Append-only style audit log with `safe_metadata` JSONB. |
| `v10_read_model_rows` | Generic key/value read model bucket keyed by `(organization_id, model_key, source_table, source_id)`. |
| `v10_activation_state` | Per-contract activation FSM fields from spec §5.3 / §4.1. |
| `v10_work_items` | Unified inbox projection. **Unique** `(organization_id, source_table, source_id, type)` — same underlying source may not produce two rows of the **same** V10 work type for one org (deduplication invariant for inbox integrity). |
| `v10_contract_health_snapshots` | Deterministic health score projection + counters. |
| `v10_contract_activity_events` | Contract-scoped activity derived from audit-safe summaries. |
| `v10_field_provenance_records` | Field review / provenance. |
| `v10_renewal_posture_snapshots` | Approved-date-derived renewal posture. |
| `v10_evidence_request_statuses` | Evidence lifecycle + link state. |
| `v10_obligation_records` | Obligation projection. |
| `v10_approval_records` | Approval SLA projection. |
| `v10_exception_records` | Exceptions with `linked_source_id` lineage. |
| `v10_notification_deliveries` | Notification projection with `linked_source_id`. |
| `v10_renewal_checkpoint_records` | Renewal checkpoints. |
| `v10_external_evidence_submissions` | External submissions with privacy states. |
| `v10_job_run_visibility` | Job transparency rows; unique `(organization_id, job_class, job_id)`. |
| `v10_report_run_visibility` | Report runs; unique `(organization_id, report_run_id)`. |
| `v10_command_search_index` | Command palette search rows; GIN on `rank_terms_safe`. |
| `v10_advanced_assurance_linked_records` | P1 linkage surface for Advanced/Assurance without duplicating full read models. |

### 7.3 Release engineering tables

| Table | Purpose |
|-------|---------|
| `v10_release_evidence_records` | Evidence artifacts per `(organization_id, evidence_key, release_state)`. |
| `v10_fixture_manifests` | Fixture manifests with privacy/teardown flags; `generated_data_only` must be true. |
| `v10_denominator_locks` | Fixed denominator locks for objective metrics. |
| `v10_metric_runs` | Pass/fail/excluded accounting with CHECK `pass + fail + excluded = fixed_sample_size`. |
| `v10_promotion_decisions` | Promotion decisions with evidence key sets and rollback readiness flag. |
| `v10_release_waivers` | Time-bounded waivers for evidence keys. |
| `v10_verification_command_results` | Captures output of required CLI commands per gate category. |
| `v10_external_blocker_records` | External dependency blockers (e.g., provider readiness). |
| `v10_fixture_teardown_records` | Teardown audit for synthetic fixtures. |

### 7.4 Refresh, lineage, artifacts, coverage

| Table / RPC | Purpose |
|-------------|---------|
| `v10_read_model_refresh_jobs` | Refresh job status, drift_state, failure/stale source tables, diagnostics. |
| `v10_read_model_lineage` | Traceability from source rows to read model rows for a refresh job. |
| `v10_runtime_artifacts` | Export/report/trace artifacts with classification and retention. |
| `v10_runtime_coverage_ledger` | Maps spec areas to tests/runtime status (may have `organization_id` null for global rows — see RLS). |
| `replace_v10_read_model_rows(...)` | **Security definer** bulk upsert + scoped archive of stale visible rows. |
| `cleanup_expired_v10_mutation_idempotency` | Deletes expired or abandoned `in_progress` claims. |
| `cleanup_expired_v10_runtime_artifacts` | Archives expired artifacts (sets `visibility_state`, `revoked_at`). |
| `cleanup_old_v10_read_model_refresh_jobs` | Retention for completed refresh job rows (default 30 days). |

### 7.5 Partial / failure row validity (database guardrails)

`057` adds **conditional diagnostics** constraints, e.g.:

- `v10_job_run_visibility`: if `status` ∈ {`partial`, `failed_retryable`, `failed_terminal`} then **`diagnostic_id` NOT NULL**.  
- Same pattern for `v10_report_run_visibility` and `v10_read_model_refresh_jobs` for terminal failure/partial states.  
- Timestamps: `completed_at >= started_at` where both set.

These constraints ensure **the UI cannot be asked to render a “failed_retryable” job with no diagnostic anchor**, even if application code mis-sets fields.

---

## 8. Row Level Security and RPC exposure model

### 8.1 RLS enabled tables

Migration `057` runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for **all** listed `v10_*` tables including idempotency, audit, read models, release metadata, coverage ledger, etc.

### 8.2 Policies (summary)

- **`v10_mutation_idempotency`**: policy **`using (false)` / `with check (false)`** — members have **no direct SQL path** to read or write idempotency rows; only service-role paths through controlled RPC/app code.  
- **Most read models**: `SELECT` allowed when `v10_member_can_read(organization_id, required_role_minimum, visibility_state)` is true.  
- **Release evidence, fixtures, locks, metrics, promotion, waivers, verification, blockers, teardown, refresh jobs**: `SELECT` when **`exists (organization_members)`** — membership-based; **role rank not re-applied** on some tables (broader read within org for transparency of release process — treat as **trusted org insiders** surface).  
- **`v10_runtime_coverage_ledger`**: allows `organization_id is null` **or** org membership — supports **global** coverage rows.  
- **`v10_runtime_artifacts`**: excludes `classification = 'prohibited'` from member visibility and requires `revoked_at is null` among other conditions.

### 8.3 `v10_member_can_read`

SQL function **`v10_member_can_read(row_organization_id, row_required_role_minimum, row_visibility_state)`** returns true iff:

- `visibility_state = 'visible'`, and  
- a row exists in `organization_members` for `auth.uid()` with `v10_role_rank(role) >= v10_role_rank(required_role_minimum)`.

**Authenticated** and **service_role** may execute (see `GRANT EXECUTE`).

### 8.4 `v10_role_rank`

Maps textual roles to numeric ranks (`viewer`=10 … `admin`=60). `legal_reviewer` and `finance_reviewer` share rank 20 per migration CASE.

### 8.5 Security definer RPCs (service_role only where noted)

| Function | Who may execute | Adversarial note |
|----------|-----------------|------------------|
| `claim_v10_mutation_idempotency(...)` | **service_role** | Prevents client tampering; must only be called after server validated org + actor. |
| `complete_v10_mutation_idempotency(...)` | **service_role** | Completes only if `request_hash` matches `in_progress` claim — prevents **cross-payload completion**. |
| `cleanup_expired_v10_mutation_idempotency(timestamptz)` | **service_role** | Deletes stale claims; abuse requires already-stolen service role. |
| `replace_v10_read_model_rows(...)` | **service_role** | Validates `p_table_name` against **allowlist**; rejects rows whose `organization_id` JSON does not match `p_organization_id` — mitigates **cross-tenant batch injection**. |
| `cleanup_expired_v10_runtime_artifacts` / `cleanup_old_v10_read_model_refresh_jobs` | **service_role** | Retention enforcement. |

---

## 9. Read models: derivation, refresh, drift

### 9.1 Materialization strategy

Read models are **not** magical views; they are **written** by application refresh pipelines (`src/lib/v10-read-model-refresh.ts` and related) using service-role clients, then exposed to members under RLS.

### 9.2 `replace_v10_read_model_rows` adversarial hardening

The RPC:

1. Rejects unknown `p_table_name` (**exception**).  
2. Requires `p_rows` be a JSON **array**.  
3. Requires non-empty `p_identity_columns` that exist on the table.  
4. **Scans every incoming row** and raises if any `organization_id` ≠ `p_organization_id`.  
5. Builds dynamic `INSERT … ON CONFLICT … DO UPDATE` from **intersection** of incoming keys with real columns (prevents arbitrary column injection).  
6. Optionally archives prior visible rows not matching the new identity set, with optional **scope** columns (`model_key`, `contract_id`, etc.) when all rows share one scope value — prevents accidental **whole-table archive** unless scope is explicit and uniform.

### 9.3 Drift states

`v10_read_model_refresh_jobs.drift_state` ∈ `fresh | stale | partial | failed | missing` with a CHECK requiring: if not `fresh`, then failure counters, stale tables list, or `diagnostic_id` must explain why — supporting **`/settings/health`** diagnostics per runbook.

### 9.4 Scheduled refresh

`vercel.json` schedules **`GET /api/cron/v10/read-model-refresh`** (see §12). This drives eventual consistency between **source-of-record tables** and **V10 projections**.

**Adversarial / failure condition:** If refresh stalls, members might read **stale** work queues; mitigations include health UI, `dry_run` tooling (`node scripts/rebuild-v10-read-models.mjs --dry-run` per runbook), and cron healthchecks (`pingCronHealthcheck` in route sources).

### 9.5 Required read model keys (`V10_REQUIRED_READ_MODEL_KEYS`)

These keys are the **authoritative set** wired into refresh orchestration, closure tests, and the no-exclusions matrix. Each maps to table `v10_<key>` (see `getV10ReadModelTableName`).

| Key | Notes from `V10_READ_MODEL_RUNTIME_CONTRACTS` defaults |
|-----|--------------------------------------------------------|
| `activation_state` | Default 5-minute freshness window; supports scoped contract refresh. |
| `work_items` | Same. |
| `contract_health_snapshots` | Same. |
| `contract_activity_events` | Same. |
| `field_provenance_records` | Same. |
| `renewal_posture_snapshots` | Same. |
| `evidence_request_statuses` | Same. |
| `obligation_records` | Same. |
| `approval_records` | Same. |
| `exception_records` | Same. |
| `notification_deliveries` | Same. |
| `renewal_checkpoint_records` | Same. |
| `external_evidence_submissions` | Retention policy **`artifact_expiring`**; **no** scoped single-contract refresh in defaults. |
| `audit_events` | Retention policy mapped to **`release_evidence`** in runtime contract builder. |
| `job_run_visibility` | **2-minute** freshness window; no scoped contract refresh. |
| `report_run_visibility` | **2-minute** freshness window; no scoped contract refresh. |
| `command_search_index` | No scoped contract refresh. |
| `advanced_assurance_linked_records` | No scoped contract refresh. |

`V10_READ_MODEL_FIELDS` in `v10-release-contract.ts` must expose exactly these keys (enforced by `v10-data-contracts.v10.test.ts`).

### 9.6 Incremental refresh: `V10_READ_MODEL_REFRESH_EVENT_TARGETS`

`buildV10ReadModelRefreshEventPlan` in `v10-read-model-refresh.ts` maps a **`sourceTable`** (mutation origin) to the subset of `V10ReadModelKey` that must be recomputed. Examples:

- **`contracts`** → `activation_state`, `contract_health_snapshots`, `contract_activity_events`, `command_search_index`.  
- **`extracted_fields`** → `field_provenance_records`, `contract_health_snapshots`, `work_items`, `command_search_index`.  
- **`evidence_requirements`** / **`evidence_submissions`** → evidence + obligation + work + activity chains.  
- **`v10_audit_events`** → `audit_events`, `contract_activity_events` (audit fan-out to contract timelines).  
- Advanced/Assurance sources (`account_workspaces`, `assurance_findings`, …) → typically `advanced_assurance_linked_records` plus `command_search_index` and sometimes `job_run_visibility`.

If a source table is **not** listed, the plan falls back to **`V10_REQUIRED_READ_MODEL_KEYS` (full set)** — expensive but safe default. **`validateV10ReadModelRefreshCoverage`** ensures inventory source tables are classified as direct, indirect, or deferred refresh sources so nothing is silently skipped.

---

## 10. Mutations: envelope, idempotency, audit

### 10.1 Request identity headers (API / route handlers)

`src/lib/v10-server-contracts.ts` defines extraction helpers:

- `x-idempotency-key` → `getV10IdempotencyKeyFromRequest`  
- `x-v10-expected-version` or `If-Match` → `getV10ExpectedVersionFromRequest`  
- `x-client-request-id` or `x-request-id` → `getV10ClientRequestIdFromRequest`

### 10.2 Idempotency claim lifecycle

1. Server computes **`request_hash = SHA256(stableJson(payload))`** where `stableJson` sorts object keys recursively — deterministic hashing.  
2. RPC `claim_v10_mutation_idempotency` attempts `INSERT` with `claim_status = 'in_progress'` and `claim_expires_at` (default **5 minutes**).  
3. On conflict:

   - If existing `request_hash` differs → **`payload_conflict`** (replay attack with same key but different body).  
   - If hash matches and `completed` → **`replay`** (return prior `response_json`).  
   - If hash matches and still `in_progress` → **`in_progress`** (client should retry later).  
   - Rare `missing_after_conflict` if insert race loses visibility.

4. `complete_v10_mutation_idempotency` transitions to `completed` **only** when `request_hash` matches and row still `in_progress`.

**`expires_at`** default on table: **24 hours** after creation — aligns with `docs/v10.md` §5.5 replay window statement.

### 10.3 Audit metadata sanitization

`sanitizeV10AuditMetadata` in `v10-server-contracts.ts`:

- Drops or redacts keys matching `FORBIDDEN_AUDIT_METADATA_KEY_RE` (emails, tokens, notes, URLs, raw text patterns).  
- Caps string length (**500**) and array items (**20**).  
- Nested objects recurse with the same rules.

**Adversarial condition:** Even if application code accidentally passes PII in metadata, **persistence layer reduces** what lands in `v10_audit_events.safe_metadata`.

`recordV10AuditEvent` swallows DB errors (returns null); `recordV10AuditEventStrict` throws `V10AuditWriteError` with diagnostic id `v10_audit_write_failed` so callers can **rollback** business writes.

### 10.4 Actor and org binding

Normative spec: `actor_user_id` from session, not client. As-built enforcement is implemented in server actions / route wrappers that build `V10StandardMutationRuntimeInput` — any path that trusts client-supplied org or user IDs without membership checks is considered a **defect** and is targeted by `check:api-route-admin-org-scope`, `check:server-action-org-scope`, and related scripts in `pipeline:verify`.

### 10.5 `V10MutationResponse` shape (as implemented)

`src/lib/v10-mutation-envelope.ts` defines the canonical response object:

| Field | Role |
|-------|------|
| `outcome` | One of `V10_MUTATION_OUTCOMES`. |
| `user_visible_message` | Human-safe text; **required** non-empty for schema validation. |
| `changed_object_type` / `changed_object_id` | Set on successful mutations that altered a durable object. |
| `new_version` + `version_metadata` | Carries `expected_version`, `current_version`, `new_version` for concurrency UX. |
| `next_destination_href` | Navigable URL or sentinel **`null_no_next_destination`** (`V10_NULL_NEXT_DESTINATION`). |
| `audit_event_id` | Populated when audit row written; **required** for `success` class in `validateV10ApiResponseSchema`. |
| `diagnostic_id` | Required for denial / terminal / retryable / partial classes in schema validator. |
| `retry_eligible` | Boolean; defaults **true** for outcomes like `conflict`, `stale_version`, `rate_limited`, `dependency_blocked`, `job_not_retryable`, `server_error`. |
| `replay_state` | `not_replayed` \| `replayed` \| `in_progress` \| `payload_conflict`. |
| `validation_failures` | Optional array of `{ field, code, user_visible_message, self_fixable }`. |
| `bulk_item_outcomes` | Per-target snapshots for **bulk** mutations (stable replay payloads). |

### 10.6 Request validation and idempotency key format

`validateV10MutationRequest`:

- Requires non-empty `organization_id`, `target_type`, `target_id`, `client_request_id`.  
- Requires `expected_version` unless the mutation is exempt (see §24).  
- **Rejects** any client-supplied `actor_user_id` with failure code `server_derived` (non-self-fixable) — explicit anti-spoofing guard.  
- Idempotency key must match **`/^[A-Za-z0-9:_-]{8,200}$/`** — prevents absurdly long keys (DoS on hash/storage) and restricts charset for log safety.

### 10.7 HTTP status mapping and cache headers

`V10_MUTATION_HTTP_STATUS_BY_OUTCOME` maps each outcome to an HTTP status (e.g. `validation_failed` → **400**, `unauthorized` → **401**, `hidden_module` → **404**, `rate_limited` → **429**, `dependency_blocked` → **424**, external link failures → **410**, `audit_write_failed` → **500**).

`buildV10MutationResponseInit` always sets **`Cache-Control: private, no-store`** and **`X-V10-Idempotent-Replay: true|false`** so caches and intermediaries do not serve stale mutation responses or confuse replay semantics.

### 10.8 API response classification

`classifyV10MutationResponse` buckets responses into: `success`, `denial`, `validation`, `partial`, `retryable`, `terminal`, `stale`, `idempotent`, `no_action`. This drives **`validateV10ApiResponseSchema`**, which enforces additional rules (e.g. `no_action` messages must match `/no action|already|unchanged/i`; stale/retryable responses must supply a non-null **`next_destination_href`** for refresh/retry UX).

### 10.9 Versioned outcome helper

`getV10VersionedMutationOutcome({ expectedVersion, currentVersion, changed })` returns `validation_failed` if expected version missing, `stale_version` if mismatch, **`no_action`** if versions match and `changed === false`, else **`success`**.

---

## 11. Mutation catalog (implemented registry)

`V10_MUTATION_CATALOG` in `src/lib/v10-release-contract.ts` lists canonical mutation names with **`minimumRole`** and **`auditAction`**. Current entries:

| Mutation name | Audit action | Minimum role (catalog) |
|----------------|--------------|-------------------------|
| `create_contract_import` | `contract_import.created` | `viewer` |
| `assign_work_item_owner` | `work_item.owner_changed` | `editor` |
| `complete_work_item` | `work_item.completed` | `viewer` |
| `bulk_assign_compatible_work_items` | `work_item.bulk_owner_changed` | `ops_manager` |
| `bulk_complete_compatible_work_items` | `work_item.bulk_completed` | `ops_manager` |
| `approve_field` | `contract_field.approved` | `legal_reviewer` |
| `reject_field` | `contract_field.rejected` | `legal_reviewer` |
| `edit_and_approve_field` | `contract_field.edited_and_approved` | `legal_reviewer` |
| `retry_failed_job` | `job.retry_requested` | `viewer` |
| `create_evidence_request` | `evidence_request.created` | `editor` |
| `submit_external_evidence` | `evidence_request.submitted` | **`external_token`** |
| `accept_evidence` | `evidence_request.accepted` | `legal_reviewer` |
| `reject_evidence` | `evidence_request.rejected` | `legal_reviewer` |
| `approve_approval_request` | `approval.approved` | `viewer` |
| `reject_approval_request` | `approval.rejected` | `viewer` |
| `request_approval_changes` | `approval.changes_requested` | `viewer` |
| `delegate_approval_request` | `approval.delegated` | `ops_manager` |
| `escalate_approval_request` | `approval.escalated` | `ops_manager` |
| `assign_exception_owner` | `exception.owner_changed` | `editor` |
| `resolve_exception` | `exception.resolved` | `editor` |
| `reopen_exception` | `exception.reopened` | `ops_manager` |
| `change_renewal_posture` | `renewal.posture_changed` | `legal_reviewer` |
| `generate_renewal_decision_packet` | `renewal.decision_packet_generated` | `legal_reviewer` |
| `record_renewal_recommendation` | `renewal.recommendation_recorded` | `legal_reviewer` |
| `create_report_run` | `report_run.created` | `viewer` |
| `create_export_job` | `export_job.created` | `viewer` |
| `update_notification_preferences` | `notification_preferences.updated` | `viewer` |
| `update_module_visibility` | `workspace.module_visibility_updated` | `admin` |
| `update_workspace_mode` | `workspace.mode_updated` | `admin` |

**As-built note vs prose spec:** `docs/v10.md` §5.7 describes minimum roles per mutation in English; the **catalog** is what CI/trace tooling indexes. Any deliberate tightening (e.g., `complete_work_item` to `editor`) must be a **catalog + enforcement + test** change together.

The pseudo-role **`external_token`** supports evidence submission without a Supabase user session; rank helper `getV10RoleRank("external_token")` returns **0** so comparisons treat it as lowest privileged unless code paths explicitly allow it only for that mutation.

---

## 12. Cron routes and rate limits

Defined in `vercel.json`:

| Path | Schedule (UTC) | Purpose |
|------|----------------|---------|
| `/api/cron/v10/read-model-refresh` | `*/15 * * * *` | Periodic read-model refresh across orgs (implementation caps batch size). |
| `/api/cron/v10/idempotency-cleanup` | `12 3 * * *` | Daily cleanup of expired idempotency rows / stale claims. |
| `/api/cron/v10/runtime-artifact-cleanup` | `27 3 * * *` | Archives expired runtime artifacts. |

All use `ensureCronAuthorized` from `@/lib/v4/cron` (Bearer **`CRON_SECRET`** pattern) plus **`rateLimitCheck`** with maintenance-style rate limit keys (`RATE_LIMITS.maintenancePruneCron` or contracts recompute bucket).

**Adversarial condition:** Without `CRON_SECRET`, routes return **401**; with leaked secret, attacker can **trigger expensive refresh** — mitigated by **rate limits**, Vercel deployment isolation, and secret rotation.

---

## 13. HTTP edge: proxy, session, calibration gates

`src/proxy.ts` (Next.js proxy / middleware successor):

- Instantiates **Supabase SSR** client with **anon** key + cookie adapter.  
- Calls `supabase.auth.getUser()`.  
- If no user and path not in **`unauthenticatedAccessAllowed`**, redirects to **`/login`**.  
- If user and GET: **`resolveBlockingCalibrationPathForUserClient`** may force redirect to onboarding calibration (blocks app except `/api`, `/auth`, `/external`, `/.well-known`, `/onboarding`).  
- Authenticated users hitting **public auth surfaces** redirect to **`/dashboard`**.  
- `/` → `/dashboard` for signed-in users.  
- Sets **`OBLIXA_PATHNAME_HEADER`** and correlation headers for downstream observability.

**Adversarial / abuse notes:**

- **Open redirect:** only internal pathnames from trusted resolvers are used — do not add raw `nextUrl.search` passthrough without validation.  
- **Session fixation:** handled by Supabase SSR patterns (not reimplemented here).  
- **Calibration gate bypass:** attempted navigation to non-API routes is redirected — deep links must tolerate calibration for **authenticated** users.

---

## 14. CI, pipeline verification, and script ratchets

### 14.1 `pipeline:verify` first pass (sequential, blocking)

From `scripts/pipelines/pipeline-verify.mjs`:

1. `check:migrations:strict`  
2. `check:v10-migration-smoke:strict`  
3. `check:v10-release-evidence`  
4. `check:v10-privacy-scan`  
5. `check:v10-complete-closure`  
6. `check:v10-suite`  
7. `check:api-route-tests`  
8. `check:api-route-auth-contract`  
9. `check:api-route-admin-org-scope`  
10. `check:owner-metadata`  
11. `check:checks-integrity-meta`  
12. `check:config-drift`  
13. `check:branch-protection-drift`

Then parallel domain checks (performance, bundle, integration resilience, workspace eligibility, incident readiness, artifact integrity, QA route coverage, server action auth + org scope, lint, typecheck), then `test:coverage`, `check:surface:suite`, `build`, then `pipeline:ci-parity`.

### 14.2 `npm run test:scripts` (representative security supply-chain scripts)

`package.json` includes a long chain: Semgrep-adjacent controls, `check-security-enforcement-matrix`, `check-next-public-surface`, `check-unsafe-deserialization`, `check-server-action-auth-contract`, `check-migration-security-patterns`, `check-postmessage-origins`, `check-json-body-limited-adoption` with `OBLIXA_STRICT_BODY_LIMITS`, and more.

These constitute the **as-built secure SDLC wall** around V10 changes.

### 14.3 `pipeline:verify` — parallel domain pass (full list)

After the sequential first pass succeeds, `scripts/pipelines/pipeline-verify.mjs` runs **in parallel**:

1. `check:performance-static:strict`  
2. `check:frontend-component-complexity`  
3. `check:server-action-complexity`  
4. `check:bundle-budget`  
5. `check:hardening-debt-ratchet`  
6. `check:integration-contract-resilience`  
7. `check:concurrency-hotspots-ratchet`  
8. `check:api-workspace-eligibility:strict`  
9. `check:incident-readiness:strict`  
10. `check:artifact-integrity`  
11. `check:ci-verify-extras`  
12. `check:qa-loading-routes`  
13. `check:qa-route-coverage-tsv`  
14. `check:qa-bug-log`  
15. `check:test-skip-governance`  
16. `check:refinement-acceptance-commands`  
17. `check:server-action-auth-contract`  
18. `check:server-action-org-scope`  
19. `check:server-action-exports`  
20. `check:type-lint-ratchet`  
21. `lint`  
22. `typecheck`

### 14.4 `pipeline:verify` — final sequential pass and parity

1. `test:coverage`  
2. `check:surface:suite`  
3. `build`  
4. `pipeline:ci-parity`

Any single failing **required** step fails the pipeline with that step’s exit code (JSON results logged to stdout).

---

## 15. Telemetry, logging, and privacy enforcement

Normative rules: `docs/v10.md` §3.5 and §4.15.

As-built mechanisms (non-exhaustive):

- **Audit metadata sanitizer** (§10.3).  
- **Proxy comment** explicitly warns **not** to log raw IP/geo at edge.  
- **Release evidence + privacy scan** gates (`check:v10-privacy-scan`).  
- **Product telemetry modules** referenced in trace matrix (`product-telemetry.ts`, `v10-objective-telemetry.ts`).

**Adversarial condition:** A compromised server action could attempt to exfiltrate contract text via telemetry — mitigations are **code review**, **tests**, **`NEXT_PUBLIC_*` ban for secrets**, and **privacy scan** scripts, not a single runtime DLP in the DB.

---

## 16. Adversarial conditions — comprehensive threat-informed behavior

This section maps **threat actions** to **expected system behavior** as implemented or guarded by design. It is not a formal penetration test report.

### 16.1 Cross-tenant IDOR (horizontal privilege escalation)

**Threat:** Attacker varies `organization_id`, `contract_id`, or job IDs to access another tenant.

**Controls (defense in depth):**

- Application routes and Server Actions must resolve org via **membership**, not client JSON alone.  
- RLS policies require **`organization_members`** relationship for reads on `v10_*` projections.  
- `replace_v10_read_model_rows` rejects batches with mixed `organization_id`.  
- CI: `check:api-route-admin-org-scope`, `check:server-action-org-scope`, `check:api-route-auth-contract`.

**Expected:** `not_found` / `forbidden` outcomes without leaking whether the row exists in another org (see mutation response discipline in `buildV10DeniedMutationResponse` patterns).

### 16.2 Vertical privilege escalation (underpowered role)

**Threat:** Viewer invokes admin-only mutation (`update_workspace_mode`, `update_module_visibility`).

**Expected:** `forbidden` or `unauthorized` (depending on guard ordering) with **no mutation**; catalog role is minimum — actual handlers may still require stricter checks for finance vs legal fields.

### 16.3 Idempotency key reuse with different payload (replay confusion)

**Threat:** Attacker retries same idempotency key but modifies JSON body to change payee or amount-like fields.

**Expected:** `payload_conflict` from claim RPC; **no second application** of business logic for that key.

### 16.4 Double-submit race (two parallel requests)

**Threat:** Two tabs submit the same mutation simultaneously.

**Expected:** One wins `claimed`; the other may see `in_progress` until completion, then `replay` after completion. Business logic must still be **safe** if two workers attempted start (DB uniqueness + transactional guards on source tables remain the ultimate backstop).

### 16.5 Stale version / optimistic concurrency

**Threat:** Client uses stale `expected_version` to overwrite newer server state.

**Expected:** `stale_version` outcome where implemented; not all legacy tables may expose version — V10 envelope prefers explicit `expected_version` when enabled per mutation.

### 16.6 Audit suppression / “silent success”

**Threat:** Attacker disrupts audit writes to bypass accountability.

**Expected:** Strict paths throw `V10AuditWriteError` → mapped to **`audit_write_failed`** and **no state change** committed alongside audit (application must coordinate transaction boundaries).

### 16.7 External evidence token brute force

**Threat:** Online guessing of opaque tokens.

**Expected:** Rate limits on public routes, token length/entropy in evidence implementation (see `src/app` external evidence routes and related libs), expiration and revocation states surfaced as `external_link_expired` / `external_link_revoked` outcomes in the mutation vocabulary.

### 16.8 Webhook / inbound email / Slack spoofing

**Threat:** Forged Stripe or inbound integration payloads.

**Expected:** Signature verification using provider secrets (`STRIPE_WEBHOOK_SECRET`, optional `SLACK_SIGNING_SECRET`, `EMAIL_INBOUND_HMAC_SECRET` per `.env.example`).

### 16.9 CSV formula injection via exports

**Threat:** Export cells beginning with `=`, `+`, `-`, `@`, etc., execute in Excel.

**Expected:** Normative mitigation in `docs/v10.md` §3.5; implementation must live in export writers (guarded by reporting gate tests).

### 16.10 SSRF from extraction worker or webhooks

**Threat:** Server fetches user-controlled URL.

**Expected:** `EXTRACTION_WORKER_BASE_URL` rules in `.env.example` (https-only in prod, reject private IPs); review any `fetch` wrappers. CI includes `check-outbound-fetch` and integration resilience checks.

### 16.11 Denial of wallet / provider abuse

**Threat:** Trigger unbounded OpenAI/Resend calls.

**Expected:** Rate limits, kill switches (`OBLIXA_KILL_*` in `.env.example`), jobization thresholds in `docs/v10.md` §4.16 for large reports/exports, and cron rate limits.

### 16.12 Read after write inconsistency

**Threat:** User completes action; UI reads read model before refresh completes.

**Expected:** Eventual consistency model; UI should prefer **mutation response** + targeted revalidation; health surfaces expose drift diagnostics if lag exceeds SLO.

### 16.13 Malicious member reads release artifacts

**Threat:** Org member downloads another member’s release evidence if URLs guessable.

**Expected:** Evidence URLs should be **opaque** + short-lived where applicable; DB rows still org-scoped. `v10_runtime_artifacts` policy excludes prohibited classifications and revoked rows.

### 16.14 Service role misuse in route handlers

**Threat:** Developer uses `createAdminClient()` and returns raw rows to browser.

**Expected:** Blocked by reviews + `check:api-route-admin-org-scope` + type-level patterns; any exception is a **security bug**.

### 16.15 SQL injection via dynamic replace RPC

**Threat:** Attacker supplies `p_table_name` outside allowlist.

**Expected:** RPC raises exception; no dynamic SQL fragment from user reaches execution. Identities validated against `information_schema.columns`.

### 16.16 CSRF against Server Actions

**Threat:** Cross-site form POST triggers a mutation with the victim’s cookies.

**Expected:** Next.js / framework CSRF protections for Server Actions; same-site cookie policies per deployment; mutations still require **valid session** and **org membership** — impact bounded to actions the victim could already perform, but CSRF remains a **session-riding** risk for state-changing POSTs if misconfigured.

### 16.17 Host / origin header confusion

**Threat:** Attacker sends crafted `Host` or `X-Forwarded-Host` to poison password-reset or webhook callback URLs.

**Expected:** `resolveAppBaseUrl` and related helpers (see `.env.example` notes) prefer incoming **Host** on Vercel; `EXTRACTION_WORKER_BASE_URL` must be **https** origin-only in production; operators should pin expected hosts at edge where possible.

### 16.18 JSON body bombs and parser DoS

**Threat:** Huge JSON bodies exhaust Node memory or CPU.

**Expected:** `OBLIXA_STRICT_BODY_LIMITS` / `BODY_LIMIT_MIN_ROUTES` checks in `test:scripts`; route handlers should use bounded parsers; large exports/reports must be **jobized** per `docs/v10.md` §4.16.

### 16.19 Cache poisoning at CDN

**Threat:** Public mutation-like GET cached.

**Expected:** V10 mutation responses use **`private, no-store`**; anonymous surfaces restricted in `proxy-path-policy`; error pages should not carry sensitive `Vary` omissions for authenticated content.

### 16.20 `dependency_blocked` (HTTP 424)

**Threat:** Attacker sequences mutations to probe hidden dependency graphs.

**Expected:** Outcome returns **without** revealing other tenants’ blockers; `diagnostic_id` is support-safe; graph details stay server-side.

### 16.21 Insider abuse of org-wide release tables

**Threat:** Any org member reads `v10_metric_runs` / promotion rows and leaks release strategy.

**Expected:** RLS is **membership-only** (not role-ranked) on several release-engineering tables — **any** member of the org can `SELECT`. Treat as **trusted collaborator** surface; for high-sensitivity deployments, gate UI exposure in product layer or add admin-only policies in a future migration (would be a **breaking** RLS policy change).

### 16.22 Bulk mutation partial success

**Threat:** Client assumes all-or-nothing when bulk assign runs.

**Expected:** `bulk_item_outcomes` / `V10BulkMutationItemResult` carry **per-target** outcome, audit id, diagnostic; idempotent replay must return **identical** per-item rows (`v10-mutation-envelope.ts` contract).

---

## 17. Operational contracts and diagnostics

`src/lib/v10-operational-contracts.ts` (large) ties:

- **SLO / post-GA** check commands to **evidence freshness** and **recovery destinations** (e.g. `/settings/health#v10-runtime`).  
- **Compatibility boundaries** (API schemas, idempotency replay, provider configuration).  
- **Append-only / compensating** semantics for selected V10 tables (audit, release evidence supersession, idempotency cleanup, artifact revocation).

Use this module when answering: “What should on-call run, and what evidence proves recovery?”

---

## 18. Release evidence, fixtures, and promotion mechanics

### 18.1 In-repo scripts

- `scripts/check-v10-release-evidence.mjs` — evidence freshness, metrics, external blockers, privacy scan orchestration.  
- `scripts/check-v10-suite.mjs` — bundles suite checks + fixture registry hooks.  
- `scripts/check-v10-promotable.mjs` — promotion readiness reporting.  
- `scripts/rebuild-v10-read-models.mjs` — operator repair / dry-run rebuilds.

### 18.2 Database support

Tables **`v10_metric_runs`**, **`v10_denominator_locks`**, **`v10_promotion_decisions`**, **`v10_release_waivers`**, **`v10_external_blocker_records`** encode **accounting identities** (e.g., pass+fail+excluded = sample size) so tampering violates CHECK constraints.

---

## 19. Testing surfaces

### 19.1 Vitest naming convention

Files matching `*.v10.test.ts` / `*.v10.test.tsx` or certain registry paths are treated as **V10-attached tests** (see `scripts/check-v10-suite.mjs` grep rules).

Representative suites referenced in tooling:

- `src/lib/v10-data-contracts.v10.test.ts`  
- `src/lib/v10-server-contracts.v10.test.ts`  
- `src/lib/v10-operational-contracts.v10.test.ts`  
- `src/lib/v10-complete-closure.v10.test.ts`  
- `src/lib/v10-zero-exclusion-report.v10.test.ts`

### 19.2 Playwright

- `e2e/v10-core-smoke.spec.ts` in smoke aggregate.  
- `e2e/v10-device-matrix.*.spec.ts` behind `npm run test:e2e:v10:matrix`.

---

## 20. Non-goals and explicit out-of-repo dependencies

`V10_NON_GOALS` in `src/lib/v10-release-contract.ts` restates `docs/v10.md` §7 (no new top-level nav family, no silent automation, no doc-as-proof, etc.).

**Out-of-repo dependencies:** Supabase project health, Stripe account state, Resend domain verification, OpenAI quota, Vercel cron delivery, DNS/TLS certificates — captured partially in **`v10_external_blocker_records`** flows via `check:v10-release-evidence -- --external-blockers`.

---

## 21. Primary source file index

| Concern | Path |
|---------|------|
| Spec constants, gates, catalogs | `src/lib/v10-release-contract.ts` |
| Read model TypeScript shapes | `src/lib/v10-read-models.ts` |
| Idempotency + audit helpers | `src/lib/v10-server-contracts.ts` |
| Mutation envelope / outcomes | `src/lib/v10-mutation-envelope.ts` |
| Read model refresh orchestration | `src/lib/v10-read-model-refresh.ts` |
| Visibility transforms | `src/lib/v10-visibility.ts` |
| Ops / SLO mapping | `src/lib/v10-operational-contracts.ts` |
| Governance / hardening | `src/lib/v10-governance.ts`, `src/lib/v10-hardening-contracts.ts` |
| DB schema + RLS | `supabase/migrations/057_v10_runtime_contracts.sql` |
| Cron: read models | `src/app/api/cron/v10/read-model-refresh/route.ts` |
| Cron: idempotency | `src/app/api/cron/v10/idempotency-cleanup/route.ts` |
| Cron: artifacts | `src/app/api/cron/v10/runtime-artifact-cleanup/route.ts` |
| Auth edge | `src/proxy.ts` |
| Pipeline | `scripts/pipelines/pipeline-verify.mjs` |
| Feature ↔ route registry | `src/lib/product-surface/feature-registry.ts` |
| HTTP route / API inventory (~100 routes) | `src/lib/v10-route-api-catalog.ts` |
| UI recoverability + a11y matrix | `src/lib/v10-ui-state-contracts.ts`, `src/components/ui/v10-recoverable-state.tsx` |
| Source object → refresh coverage | `src/lib/v10-source-object-inventory.ts` |
| Vercel cron schedules | `vercel.json` |

---

## 22. Acceptance gates and release states (encoded)

### 22.1 `V10_ACCEPTANCE_GATES`

Defined in `src/lib/v10-release-contract.ts` as **sixteen** gates:  
`activation`, `work`, `contract_record`, `review_data_quality`, `renewal`, `evidence`, `approval_exception`, `search`, `reporting`, `workspace_governance`, `reliability`, `security_privacy`, `accessibility`, `performance`, `data_contract`, `objective_measurement`.

### 22.2 `V10_ACCEPTANCE_GATE_RELEASE_SCOPE`

Each gate has booleans **`beta`**, **`ga`**, **`complete`**. As built, **all listed gates are required** for beta, GA, and complete (all three flags `true` for every row). Any future relaxation must be a deliberate contract change plus trace matrix update.

### 22.3 `V10_RELEASE_STATES`

Three rows in `v10-release-contract.ts` (exact `requiresExternalEvidence` copy as built):

| State | `requiredPriorities` | `requiresExternalEvidence` |
|-------|----------------------|----------------------------|
| `beta` | `["P0"]` | `["P0 metric results"]` |
| `GA` | `["P0", "P1"]` | `["P0 and P1 launch metric results", "post-GA dashboard existence"]` |
| `complete` | `["P0", "P1", "included P2"]` | `["GA evidence", "included P2 evidence"]` |

---

## 23. Mutation envelope, HTTP semantics, and schema validators

Section §10.5–§10.9 defines the transport shape. This section lists **validator rules** enforced by `validateV10ApiResponseSchema` in `v10-mutation-envelope.ts` (failures are human-readable strings used in tests):

| Rule ID (conceptual) | Condition |
|----------------------|-----------|
| `user_visible_message_required` | Message must be non-empty trim. |
| `changed_object_required` | On `success` class, `changed_object_type` and `changed_object_id` required. |
| `audit_event_required` | On `success` class, `audit_event_id` required. |
| `validation_failures_required` | On `validation` class, at least one `validation_failures` entry. |
| `diagnostic_id_required` | For `denial`, `terminal`, `retryable`, and `partial` classes, `diagnostic_id` must be set. |
| `retry_eligible_required` | `retry_eligible` must be a boolean. |
| `replay_state_required` | Must be one of the four replay states. |
| `version_metadata_required` | `version_metadata` object present. |
| `refresh_destination_required` | `stale` class must not use `null_no_next_destination` for next href. |
| `retry_destination_required` | `retryable` class must supply a concrete next href. |
| `no_action_explanation_required` | `no_action` class message must match `/no action|already|unchanged/i`. |
| `idempotent_replay_flag_required` | `idempotent` class requires `replayed: true` in options. |

**Contract graph:** `validateV10RequiredMutationContracts()` proves:

- No duplicate mutation keys.  
- Every required row has `targetType`, dotted `auditAction`, `minimumRole`, `requiresAudit` true, `requiresIdempotency` true, `runtimeArtifact` path, valid `responseShape`.  
- **`requiresExpectedVersion`** is true unless mutation is in `V10_EXPECTED_VERSION_EXEMPT_MUTATIONS`.  
- **Catalog ↔ required bijection** (catalog-only or required-only entries both fail).

---

## 24. Required mutation contracts and runtime artifact pins

`V10_REQUIRED_MUTATION_CONTRACT_ROWS` in `v10-mutation-envelope.ts` pins, for each mutation:

| Column | Meaning |
|--------|---------|
| `key` | Mutation name (matches catalog). |
| `targetType` | Primary target type string for the envelope. |
| `sourceObjectType` | Lineage object for audits/read models. |
| `requiresIdempotency` | Always `true` in current rows. |
| `requiresAudit` | Always `true`. |
| `requiresExpectedVersion` | `false` only for **`submit_external_evidence`** and **`create_export_job`** (see `V10_EXPECTED_VERSION_EXEMPT_MUTATIONS`). |
| `runtimeArtifact` | Primary TS route or action file implementing the mutation. |
| `responseShape` | Default `v10_mutation_envelope`; bulk mutations use **`v10_bulk_mutation_envelope`**. |

**Implementation map (runtimeArtifact paths as built):**

- Import / job retry: `src/app/api/import/contracts/route.ts`, `src/app/api/import/contracts/[jobId]/route.ts`  
- Tasks / work: `src/actions/tasks.ts`  
- Field review: `src/actions/contracts.ts`  
- Evidence: `src/app/api/evidence/requests/route.ts`, `src/app/api/evidence/submit/route.ts`, `src/app/api/evidence/[id]/[action]/route.ts`  
- Approvals: `src/app/api/approvals/[id]/[action]/route.ts`  
- Exceptions: `src/app/api/exceptions/[id]/[action]/route.ts`  
- Renewals: `src/app/api/renewals/[id]/[action]/route.ts`  
- Reports / exports: `src/app/api/report-packs/route.ts`, `src/app/api/export/contracts/route.ts`  
- Settings / governance: `src/actions/product-surface-settings.ts`

---

## 25. Governance, eligibility, and health diagnostics

`src/lib/v10-governance.ts` implements **`evaluateV10Eligibility`** with deterministic precedence:

1. **`sameOrganization === false`** → `not_found` + `hidden_by_role` (anti-cross-tenant enumeration phrasing).  
2. **`deleted`** without restore/audit/export-history action → `not_found` + `deleted`.  
3. **`archived`** without allowed action → `not_found` + `archived`.  
4. **Workspace mode rank** insufficient → `mode_required` + `hidden_by_mode`.  
5. **Role rank** insufficient → `forbidden` + `hidden_by_role`.  
6. **Plan rank** insufficient → `plan_required` + `hidden_by_plan`.  
7. **`moduleHidden`** → `hidden_module` + `hidden_by_module`.  
8. Else → `success` + `visible`.

**Fallback navigation:** `getV10EligibleFallbackDestination` sends billing-blocked users toward **`/settings/billing`**, mode/module issues toward **`/settings/product`**, generic forbidden toward **`/dashboard`**.

**Health aggregation:** `getV10GovernanceHealthState` and **`buildV10SettingsHealthDiagnostics`** produce structured diagnostics (failed jobs, stale read models, notification failures, hidden modules, release blockers, **post-GA SLO misses** per `docs/v10.md` §2.2) with severities and **`recoveryHref`** anchors such as `/settings/health#v10-refresh`.

---

## 26. Contract health score and next-action resolution

### 26.1 Health score

`src/lib/v10-contract-health.ts` **`calculateV10ContractHealth`** applies deductions from `V10_HEALTH_DEDUCTIONS` in **`v10-release-contract.ts`**:

| Deduction key | Points |
|---------------|--------|
| `missing_required_activation_field` | 20 |
| `missing_or_unapproved_critical_date` | 15 |
| `overdue_linked_work` | 15 |
| `open_high_or_critical_exception` | 15 |
| `outstanding_evidence_not_overdue` | 10 |
| `renewal_notice_deadline_inside_30_days` | 10 |
| `missing_or_stale_owner` | 10 |
| `failed_or_partial_retryable_job` | 10 |
| `missing_recommended_fields` | 5 |

Score is **`max(0, 100 − sum(points))`**. Bands: **`getV10HealthBand`** → `healthy` (85+), `watch` (70–84), `at_risk` (60–69), `critical` (<60).

**Outstanding evidence nuance:** The `outstanding_evidence_not_overdue` deduction applies only when there is outstanding evidence **and** `outstandingEvidenceOverdueCount === 0` (aligns with normative “not overdue” wording in `docs/v10.md` §3.3).

### 26.2 Next action

`getV10ContractNextAction` walks **`V10_CONTRACT_NEXT_ACTION_ORDER`** until the first predicate matches; otherwise **`no_action_required`**. Order matches `docs/v10.md` §4.4 (failed import/extraction → missing required fields → field review → overdue chains → critical exception → renewal windows → owner → recommended fields → none).

---

## 27. Work semantics, lenses, and deterministic ordering

`src/lib/v10-work-semantics.ts` defines:

- **`V10WorkItemSemanticInput`** — inputs for ranking “high risk” style work (owner activity, due state, contract value, renewal pressure, etc.).  
- **`V10DeterministicListKind`** — `home` \| `work` \| `command_palette` \| `contract_health` \| `reports` \| `jobs` \| `search` \| `recovery` for sort policy selection.  
- **`V10WorkHubLensAlias`** — maps UI lens names (`assigned`, `due_today`, `failed_jobs`, …) to product language.

Normative **lens list** and **sort order** for Work remain authoritative in `docs/v10.md` §4.2; this module is the **typed implementation surface** for deterministic ordering tests.

---

## 28. Hardening contracts and typed adversarial scenarios

`src/lib/v10-hardening-contracts.ts` is a large **registry of security/privacy/scale contracts** including:

- **`V10AdversarialRouteActionScenario`** — structured negative tests: adversary ∈ {`cross_tenant`, `forged_org`, `stale_version`, `idempotency_replay`, `hidden_module`, `plan_denial`, `revoked_link`, `unsafe_export`, `malformed_payload`, `cron_auth`}, plus expected HTTP status, outcome string, diagnostic id, and booleans for audit/idempotency requirements.  
- **`V10FoundationSecurityPrivacyContract`** — tenant isolation, eligibility, audit metadata, cache headers, support diagnostics, external artifacts.  
- **`V10ServiceRoleBoundaryContract`** — documents which tables each service-role path may touch and required org predicates.  
- **`V10DatabaseHardeningContract`** — per-table RLS, unique identity columns, indexes, retention, cleanup, repair pointers.

Use this file when extending V10 to **add a new table or route** — update the relevant contract row so **`check:v10-suite`** / closure tests stay green.

---

## 29. Database indexes and uniqueness (operational summary)

Beyond per-table purposes in §7, high-value patterns include:

- **Idempotency expiry index** — time-range deletes for retention without full scans.  
- **`v10_command_search_index`** — **GIN on `rank_terms_safe`** for tokenized search.  
- **Composite org + status + time** indexes on work items, jobs, reports, notifications — support dashboard and health queries at scale (`docs/v10.md` §4.16 budgets).  
- **Partial unique upsert indexes** (suffix `_upsert`) on many `v10_*` tables for refresh idempotency — see end of migration `057`.

---

## 30. npm scripts and V10 gate commands

| Script | Purpose |
|--------|---------|
| `npm run check:v10-release-evidence` | Release evidence freshness and metric capture. |
| `npm run check:v10-privacy-scan` | Privacy scan over fixtures/evidence (`--privacy-scan all`). |
| `npm run check:v10-migration-smoke` | Validates migrations against disposable DB; `:strict` for pipeline. |
| `npm run check:v10-suite` | Aggregated V10 suite (inventory, fixtures, tests). |
| `npm run check:v10-complete-closure` | Closure + zero-exclusion Vitest bundle. |
| `npm run check:v10-inventory-lock` | Inventory lock for promotable artifacts. |
| `npm run check:v10-promotable` / `:report` | Promotion readiness. |
| `npm run check:v10-runtime-evidence-plan` | Runtime evidence plan for RC. |
| `npm run check:v10-zero-exclusion-report` | Zero-exclusion report only. |
| `npm run rebuild:v10-read-models` | Operator rebuild / repair CLI. |
| `npm run check:rebuild-v10-read-models-nightly-gate` | Nightly gate for read-model rebuild. |
| `npm run test:e2e:v10:matrix` | Cross-browser/device matrix for V10. |

`pipeline:verify` ordering is authoritative for **merge blocking** (see §14).

---

## 31. Related security and design documentation

| Document | Contents |
|----------|----------|
| `docs/SECURITY_API_AUTH_HEURISTICS.md` | API auth patterns. |
| `docs/SECURITY_API_ROUTE_COVERAGE.md` | Route coverage expectations. |
| `docs/SECURITY_SERVER_ACTIONS_HEURISTICS.md` | Server Action auth. |
| `docs/SECURITY_LIB_ADMIN_CLIENT_INDEX.md` | Service-role usage index. |
| `docs/workspace-modes-core-advanced-assurance.md` | Workspace mode semantics. |
| `docs/enterprise-ui-design-principles.md` | UI contract (cross-links Enterprise UI rule). |
| `.env.example` | Full env surface, kill switches, DSR flags, diagnostics toggles. |

---

## 32. Objective measurements and GA sample sizes

### 32.1 `V10_GA_SAMPLE_SIZES`

From `v10-release-contract.ts`: `activation` 100, `command_palette_search` 200, `report_reliability` 100, `export_reliability` 100, `renewal_reminders` 100, `evidence_follow_up` 100, `work_reachability` 200, `contract_record_trust` 50, `recoverability` 50, `usability_participants` 20, `scripted_first_time_activation_sessions` 100.

### 32.2 `V10_RELEASE_FIXTURE_MINIMUMS`

See **Appendix C** for the verbatim constant; summary: five Core-class workspace buckets, three Advanced, three Assurance, plus minimum counts for contracts, field gaps, renewals, queue shapes, evidence, report runs, and export jobs so GA denominators are physically plausible in synthetic environments.

### 32.3 `V10_OBJECTIVE_TARGETS`

See **Appendix B** for the verbatim array. Each row ties a **product objective key** to a **`measurementKey`** used in release evidence scripts and a **machine-oriented `target` string** that trace tooling can grep without parsing natural-language SLO paragraphs in `docs/v10.md` §2.

---

## 33. Route API catalog (`v10-route-api-catalog`)

`src/lib/v10-route-api-catalog.ts` is the **typed inventory** of App Router API contracts aligned to V10 performance, auth, and response-shape gates. As built, the catalog contains on the order of **100** `path:` entries (exact count may drift — enforced by `validateV10RouteApiContract` / inventory tests).

### 33.1 Core types

- **`V10RouteSurface`** — product area: `activation`, `home`, `contracts`, `review`, `work`, `renewals`, `evidence`, `approvals`, `exceptions`, `reports`, `exports`, `settings`, `advanced`, `assurance`, `command_search`.  
- **`V10RouteApiContract`** — per route: `path`, `methods`, `featureFamily`, `minimumMode`, `minimumRole`, `minimumPlan`, `authRequired`, `idempotencyRequired`, `auditRequired`, **`privateCacheRequired`**, optional **`postContract`**.  
- **`V10RoutePostContractKind`** — response discipline for POST bodies: `v10_mutation_envelope`, `session_json`, `opaque_token_json`, `stripe_signed_webhook`, `integration_inbound`, `cron_secret_json`, `worker_bearer_json`.  
- **`resolveV10RoutePostContract`** — all-GET routes resolve to **`read_only`**; otherwise defaults to **`v10_mutation_envelope`** unless `postContract` overrides (migration escape hatch documented in-field).

### 33.2 Inventory row extensions

`buildV10RouteApiInventory` produces **`V10RouteApiInventoryRow`** by attaching:

`authType` (`session` \| `external_token` \| `cron_secret`), `capability`, `routeOwner`, `diagnosticPrefix` (`v10_*`), **`errorStatusCodes`**, **`rateLimitPolicy`**, **`cachePolicy`** (currently always `private_no_store` in contract), **`paginationPolicy`**, **`responseSchema`**, **`recoveryBehavior`**.

`validateV10RouteApiInventory` catches drift between catalog rows and these derived invariants.

### 33.3 Jobs / reports boundary contracts

`V10_ROUTER_JOBS_REPORTS_BOUNDARY_CONTRACTS` groups cross-cutting domains (`command_search`, `exports`, `jobs`, `notifications`, `provider_boundary`, etc.) with **primary routes**, **read models**, **job/notification classes**, and **`recoveryDestination`** — used so cron + UI + API agree on where a failed export or report surfaces in **`/settings/health`**.

### 33.4 Action inventory

`buildV10RouteActionInventory` joins **mutation names** to **route paths** and **`runtimeArtifact`** files for traceability separate from the HTTP catalog (used by `validateV10RouteActionInventory`).

### 33.5 Catalog helpers for unauthenticated POST surfaces

`allowsUnauthenticatedApiRoute` in `v10-route-api-catalog.ts` returns true when the resolved post contract is **`stripe_signed_webhook`**, **`integration_inbound`**, **`opaque_token_json`**, or **`worker_bearer_json`**, or when the path string **includes** **`/api/evidence/`** (external / tokenized evidence flows). This is the typed mirror of “public integration edges” — any new anonymous POST must update this helper and security docs together.

---

## 34. UI recoverability and accessibility contracts

`src/lib/v10-ui-state-contracts.ts` encodes **`docs/v10.md` §4.16 / §6.12–§6.13** expectations as data:

### 34.1 `V10RecoverableUiState`

Union of recoverable surface states including: `empty`, `loading`, `partial`, `failed`, `unauthorized`, `forbidden`, `not_found`, `plan_gated`, `mode_gated`, `hidden_module`, `archived`, `deleted`, `stale`, `conflict`, `retryable`, `terminal_failure`, `dependency_blocked`, `external_link_expired`, `external_link_revoked`, **`no_action_available`**.

### 34.2 `V10UiStateContract`

Per state: **`requiresReason`**, **`requiresNextActionOrExplanation`**, **`requiresAccessibleName`** — drives empty/error UX parity tests.

### 34.3 Route state matrix and devices

- **`V10RouteStateMatrixEntry`** — which routes must prove which `requiredStates`, **`accessibilityAssertions`**, **`responsiveProfiles`**, and **`performanceBudgetKind`** (`dashboard`, `contract_list`, `command_palette`, `work_review_queue`, `report_export`).  
- **`V10BrowserDeviceProfile`** — browser (`chromium` \| `webkit` \| `firefox`), device, locale, timezone, **`inputMode`** (keyboard / touch / **`screen_reader_keyboard`**), **`reducedMotion`**, **`largeResult`**, **`degradedNetwork`** — feeds Playwright matrix specs.  
- **`V10RecoverabilityFailureMode`** — typed failure modes including `read_model_refresh_failure`, `stale_release_evidence`, `unsafe_csv_value`, `provider_outage`, **`no_action_terminal_state`**, linked to route + UI state for matrix rows.

Component **`v10-recoverable-state.tsx`** (see `scripts/check-v10-suite.mjs` allowlist) is the reference UI primitive for these contracts.

---

## 35. Scheduled automation inventory (`vercel.json`)

All entries use Vercel **Cron** (`schedule` is **UTC**). Non-V10 paths are still part of the **as-built runtime** that feeds source tables V10 read models depend on (reminders, reports, V4/V5/V6 jobs).

| Path | Schedule |
|------|----------|
| `/api/reminders/send` | `0 9 * * *` |
| `/api/reports/send-summaries` | `30 9 * * *` |
| `/api/reports/capture-metrics` | `20 * * * *` |
| `/api/webhooks/dispatch` | `*/30 * * * *` |
| `/api/tasks/run-rules` | `15 * * * *` |
| `/api/contracts/recompute-signals` | `45 * * * *` |
| `/api/integrations/calendar/sync` | `*/30 * * * *` |
| `/api/integrations/crm/sync` | `10 * * * *` |
| `/api/integrations/refresh-tokens` | `*/20 * * * *` |
| `/api/notifications/retry-deliveries` | `*/15 * * * *` |
| `/api/maintenance/prune-operational-data` | `0 3 * * *` |
| `/api/cron/stripe-webhook-events` | `30 3 * * *` |
| `/api/cron/v4/exceptions-detect` | `*/30 * * * *` |
| `/api/cron/v4/attestations-issue` | `0 * * * *` |
| `/api/cron/v4/approvals-sla` | `*/20 * * * *` |
| `/api/cron/v4/escalations-dispatch` | `*/20 * * * *` |
| `/api/cron/v4/report-packs-generate` | `15 * * * *` |
| `/api/cron/v4/evidence-followup` | `45 * * * *` |
| `/api/cron/v4/programs-reconcile` | `10 * * * *` |
| `/api/cron/v4/renewals-recompute-signals` | `25 * * * *` |
| `/api/cron/v5/campaign-progress` | `*/30 * * * *` |
| `/api/cron/v5/simulation-snapshots` | `5 * * * *` |
| `/api/cron/v5/capacity-forecast-refresh` | `20 * * * *` |
| `/api/cron/v5/portfolio-risk-recompute` | `35 * * * *` |
| `/api/cron/v5/external-followup` | `50 * * * *` |
| `/api/cron/v5/decision-sla-monitor` | `*/20 * * * *` |
| `/api/cron/v5/recommendation-refresh` | `40 * * * *` |
| `/api/cron/v5/relationship-rollups` | `15 * * * *` |
| `/api/cron/v6/assurance-checks` | `*/30 * * * *` |
| `/api/cron/v6/finding-refresh` | `10 * * * *` |
| `/api/cron/v6/autopilot-dry-run` | `20 * * * *` |
| `/api/cron/v6/autopilot-execution` | `40 * * * *` |
| `/api/cron/v6/scorecard-recompute` | `25 * * * *` |
| `/api/cron/v6/health-graph-rollups` | `35 * * * *` |
| `/api/cron/v6/control-policy-reevaluation` | `45 * * * *` |
| `/api/cron/v6/outcome-effectiveness` | `50 * * * *` |
| `/api/cron/v6/review-board-packet-generation` | `5 * * * *` |
| `/api/cron/v6/segment-recompute` | `55 * * * *` |
| `/api/cron/v6/playbook-follow-up-assurance` | `8 * * * *` |
| `/api/cron/v6/external-workflow-deadlines` | `*/25 * * * *` |
| `/api/cron/v6/onboarding-calibration-stale` | `18 4 * * *` |
| **`/api/cron/v10/read-model-refresh`** | **`*/15 * * * *`** |
| **`/api/cron/v10/idempotency-cleanup`** | **`12 3 * * *`** |
| **`/api/cron/v10/runtime-artifact-cleanup`** | **`27 3 * * *`** |

**Authorization note:** V10 cron routes use **`ensureCronAuthorized`** + **`CRON_SECRET`** (see §12). Other cron paths use the same family of helpers where applicable; always verify in each `route.ts` before assuming Bearer-only auth.

---

## 36. Appendix A: `V10_READ_MODEL_REFRESH_EVENT_TARGETS` (verbatim)

Source: `src/lib/v10-read-model-refresh.ts`. Keys are **`sourceTable`** values; values are ordered lists of **`V10ReadModelKey`** refreshed for that event. Unlisted `sourceTable` values trigger **full** `V10_REQUIRED_READ_MODEL_KEYS` refresh (see §9.6).

| `sourceTable` | Target read model keys |
|---------------|-------------------------|
| `contracts` | `activation_state`, `contract_health_snapshots`, `contract_activity_events`, `command_search_index` |
| `extracted_fields` | `field_provenance_records`, `contract_health_snapshots`, `work_items`, `command_search_index` |
| `contract_tasks` | `work_items`, `contract_activity_events`, `command_search_index` |
| `contract_obligations` | `obligation_records`, `work_items`, `contract_health_snapshots`, `command_search_index` |
| `contract_approvals` | `approval_records`, `work_items`, `contract_activity_events`, `command_search_index` |
| `exceptions` | `exception_records`, `work_items`, `contract_health_snapshots`, `command_search_index` |
| `evidence_requirements` | `evidence_request_statuses`, `obligation_records`, `work_items`, `contract_activity_events` |
| `evidence_submissions` | `external_evidence_submissions`, `evidence_request_statuses`, `contract_activity_events` |
| `contract_renewal_checkpoints` | `renewal_checkpoint_records`, `renewal_posture_snapshots`, `work_items` |
| `notification_deliveries` | `notification_deliveries` |
| `contract_import_jobs` | `job_run_visibility`, `activation_state`, `work_items` |
| `contract_export_jobs` | `job_run_visibility`, `report_run_visibility` |
| `report_runs` | `report_run_visibility`, `job_run_visibility` |
| `saved_views` | `command_search_index` |
| `v10_audit_events` | `audit_events`, `contract_activity_events` |
| `account_workspaces` | `advanced_assurance_linked_records`, `command_search_index` |
| `counterparty_workspaces` | `advanced_assurance_linked_records`, `command_search_index` |
| `decision_workspaces` | `advanced_assurance_linked_records`, `command_search_index` |
| `portfolio_campaigns` | `advanced_assurance_linked_records`, `command_search_index` |
| `assurance_findings` | `advanced_assurance_linked_records`, `command_search_index` |
| `control_policies` | `advanced_assurance_linked_records`, `command_search_index` |
| `adaptive_playbook_runs` | `advanced_assurance_linked_records`, `job_run_visibility` |
| `change_simulations` | `advanced_assurance_linked_records`, `job_run_visibility` |
| `assurance_scorecards` | `advanced_assurance_linked_records`, `command_search_index` |
| `review_boards` | `advanced_assurance_linked_records`, `command_search_index` |
| `portfolio_health_graph_edges` | `advanced_assurance_linked_records` |

---

## 37. Appendix B: `V10_OBJECTIVE_TARGETS` (verbatim)

Source: `src/lib/v10-release-contract.ts`.

| `key` | `measurementKey` | `target` |
|-------|------------------|----------|
| `first_contract_activation` | `activation` | `80_percent_valid_upload_or_import_to_first_work_item_under_10_minutes` |
| `daily_action_clearance` | `work_reachability` | `95_percent_user_owned_actionable_items_reachable_in_two_clicks_or_fewer` |
| `contract_record_trust` | `contract_record_trust` | `all_fixture_contract_detail_pages_show_v10_trust_header_above_first_fold` |
| `evidence_accountability` | `evidence_follow_up` | `scheduled_reminders_overdue_owner_notification_and_escalation_work_items` |
| `report_reliability` | `report_reliability` | `95_percent_standard_runs_complete_or_fail_retryable_under_2_minutes` |
| `export_reliability` | `export_reliability` | `95_percent_exports_up_to_50000_rows_complete_or_fail_retryable_under_2_minutes` |
| `search_as_router` | `command_palette_search` | `95_percent_exact_match_queries_return_destination_or_recovery_action` |
| `in_app_recoverability` | `recoverability` | `every_recoverable_state_shows_reason_and_valid_next_action_or_explanation` |
| `product_self_explanation` | `usability_participants` | `18_of_20_pre_ga_first_time_participants_complete_without_help_docs` |

---

## 38. Appendix C: `V10_RELEASE_FIXTURE_MINIMUMS` (verbatim)

Source: `src/lib/v10-release-contract.ts`.

| Key | Minimum count |
|-----|----------------|
| `core_workspaces` | 5 |
| `advanced_workspaces` | 3 |
| `assurance_workspaces` | 3 |
| `contracts` | 50 |
| `missing_required_field_contracts` | 10 |
| `renewal_or_notice_inside_365_days` | 10 |
| `unassigned_actionable_items` | 10 |
| `overdue_items` | 10 |
| `blocked_items` | 10 |
| `evidence_requests` | 10 |
| `report_runs` | 10 |
| `export_jobs` | 10 |

---

## 39. Read-model visibility helpers (`v10-visibility`)

`src/lib/v10-visibility.ts` implements **server-side filtering** aligned to RLS semantics before rows hit the client:

- **`V10VisibilityDenialReason`** — `cross_org`, `hidden_visibility_state`, `insufficient_role`, `workspace_mode_hidden`, `plan_gated`, `module_hidden`, `inactive_owner`, `stale_owner`, `external_token_expired`, `external_token_revoked`.  
- **`evaluateV10ReadModelVisibility`** — rejects **`rowOrganizationId !== organizationId`** first (`cross_org`), then non-`visible` **`visibility_state`**, then **role** / **workspace mode** / **plan** using cumulative “readable sets” from **`getV10ReadableRoleMinimums`**, **`getV10ReadableWorkspaceModes`**, **`getV10ReadablePlanMinimums`** (users see rows at their tier and below in each ordering).  
- **`applyV10ReadModelVisibility`** / **`applyV10CommandSearchVisibility`** — used when composing command palette vs generic read-model payloads (`v10-read-models.ts` imports).

This layer is a **second line of defense** next to Postgres RLS: service-role fetches should still run through these helpers before serializing to the browser.

---

## 40. Deferred vs direct refresh sources

`v10-read-model-refresh.ts` defines:

- **`V10_READ_MODEL_REFRESH_EVENT_TARGETS`** — direct incremental map (Appendix A).  
- **`V10_READ_MODEL_REFRESH_SOURCE_TABLES`** / **`V10_READ_MODEL_REFRESH_INDIRECT_SOURCE_TABLES`** / **`V10_READ_MODEL_REFRESH_DEFERRED_SOURCE_TABLES`** — partition the **`V10_SOURCE_OBJECT_INVENTORY`** so **`validateV10ReadModelRefreshCoverage`** can fail closed if a new inventory **`sourceTable`** is not classified (prevents “new contract table shipped without refresh wiring”).  
- **`V10_READ_MODEL_REFRESH_DEFERRED_SOURCE_TABLES`** is derived from inventory rows whose **`autonomousStatus`** is `typed_contract` or **`external_evidence`** — these sources do not get automatic eager refresh in the same tier as high-churn tables; operators rely on cron full refresh or explicit repair.

---

## Document control

- **Authoring principle:** When implementation diverges from `docs/v10.md`, prefer fixing code **or** updating the normative spec in the same PR; this as-built file should be updated when **schema**, **RLS**, **cron**, or **contract catalogs** change materially.  
- **Classification:** Engineering — may contain operational detail; still avoid pasting live secrets, raw customer payloads, or signed URLs (per `docs/v10-ops-runbook.md`).

---

*End of V10 Specification As Built.*
