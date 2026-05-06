# Oblixa Security SPEC-AS-BUILT

This document describes the security posture implemented in this repository and the security behavior that product, engineering, operations, and customer-trust work must preserve. It is intentionally separate from `SPEC-AS-BUILT.md` and focuses on security controls, threat boundaries, operator workflows, user-facing security UX, verification gates, known gaps, and production runbooks.

The spec is grounded in the current codebase, especially:

- `src/proxy.ts`
- `src/lib/auth/*`
- `src/lib/security/*`
- `src/lib/supabase/server.ts`
- `src/lib/access-control.ts`
- `src/lib/permissions.ts`
- `src/lib/product-surface/*`
- `src/lib/v4/api-auth.ts`
- `src/lib/v5/api.ts`
- `src/lib/v6/api-auth.ts`
- `src/lib/v10-server-contracts.ts`
- `src/lib/v10-mutation-envelope.ts`
- `src/actions/auth.ts`
- `src/actions/mfa.ts`
- `src/actions/sessions.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/settings/security/page.tsx`
- `src/components/settings/security-settings-panel.tsx`
- `src/app/api/**`
- `supabase/migrations/**`
- `.env.example`
- `.gitleaks.toml`
- `.github/workflows/**`
- `config/security-*.json`
- `artifacts/security-*.json`
- `scripts/check-*security*.mjs`
- `scripts/check-*auth*.mjs`
- `scripts/check-*rls*.mjs`
- `scripts/check-*oauth*.mjs`
- `scripts/check-*api-route*.mjs`
- `semgrep/oblixa-security.yml`

## 1. Security Objective

Oblixa handles contract records, extracted legal and operational fields, evidence submissions, approvals, renewal decisions, external collaboration links, integration tokens, billing records, automation outputs, and audit evidence. The security objective is therefore:

- keep organization data isolated by default
- derive actor identity on the server
- keep service-role database access behind explicit server-side authorization and scope checks
- keep hidden workspace modules hidden across pages, navigation, command search, reports, notifications, and APIs
- require authentication for workspace and mutation surfaces
- require elevated role or capability for sensitive actions
- add step-up or MFA where sensitive state changes justify it
- prevent duplicate execution of costly, mutating, or operationally significant actions
- verify inbound automation, webhooks, cron jobs, and external participant requests
- prevent SSRF, open redirects, unsafe outbound fetches, dangerous uploads, and token leakage
- keep operational diagnostics support-safe
- make security recoverable for legitimate users through clear UX
- make security controls measurable through scripts, tests, generated matrices, and CI gates

The repository implements a defense-in-depth posture. Client UI visibility is useful UX, but it is never the security boundary. The durable security boundaries are server-side session checks, org membership resolution, role/capability checks, product-surface API eligibility, RLS, service-role scope discipline, route-level auth contracts, and CI-enforced drift checks.

## 2. Current Verification Snapshot

Local verification performed while writing this document:

- `node scripts/check-rls-policy-drift.mjs`
  - `totalCreatedTables`: 154
  - `totalRlsEnabledTables`: 154
  - `missingRls`: []
  - `missingPolicies`: []
- `node scripts/check-migration-security-patterns.mjs`
  - `issueCount`: 0
- `node scripts/security-api-route-coverage.mjs`
  - generated coverage for 184 API routes
- `node scripts/report-security-scorecard.mjs`
  - score: 100
  - status: pass
  - passCount: 9
  - failCount: 0
  - included API auth contract, API route tests, rate-limit coverage, cron auth, server-lib-admin allowlist, workflow security, tracked-secrets hygiene, incident readiness, and artifact integrity

These checks are not a substitute for production monitoring, external assessment, secret rotation, provider dashboard review, or incident tabletop evidence. They are the repo-local signal for as-built code security posture.

## 3. Trust Boundaries

Primary trust boundaries:

- Browser to Next.js App Router.
- Unauthenticated public pages to authenticated dashboard surfaces.
- Browser session cookie to Supabase Auth session validation.
- Supabase anon client to service-role Supabase client.
- Organization-scoped workspace data to service-role admin queries.
- Product-surface visible modules to hidden or unavailable modules.
- Public external token links to organization-private data.
- Cron scheduler to privileged scheduled route handlers.
- Inbound provider webhooks to trusted internal event handling.
- OAuth provider callbacks to stored OAuth state rows.
- Integration tokens at rest to encrypted database fields.
- OpenAI extraction requests to document text and extracted metadata.
- Stripe checkout and webhook payloads to billing mutation state.
- Sentry/logging to support-safe telemetry.
- CI workflows to pinned third-party actions and secret-gated runtime checks.

Security rule:

- Crossing any boundary must either have a direct guard in code, be covered by database RLS, be controlled by a signed token or shared secret, or be documented as an external operational obligation.

## 4. Asset Classes

### 4.1 High-Sensitivity Assets

- Supabase service-role key.
- Supabase auth session cookies.
- Stripe secret key and webhook secret.
- OpenAI API key.
- Resend API key.
- Cron secret.
- Inbound automation tokens.
- Internal diagnostics bearer secret.
- OAuth client secrets.
- OAuth access and refresh tokens.
- Integration token encryption key.
- External action passcode pepper.
- External submit ticket secret.
- Step-up cookie signing secret.
- Contract files and extracted text.
- Evidence submissions and external participant payloads.
- V10 audit, release evidence, idempotency, and runtime artifact rows.

Handling rules:

- Never expose server secrets through `NEXT_PUBLIC_*`.
- Never log bearer tokens, cookies, signatures, raw document text, passcodes, OAuth tokens, or raw external payloads.
- Prefer derived state, counts, IDs, hashes, and safe metadata in audit and telemetry.
- Use `Cache-Control: private, no-store` or `no-store` on sensitive APIs and diagnostics.
- Treat service-role access as privileged and require explicit org scoping in every query.

### 4.2 Medium-Sensitivity Assets

- Organization names.
- User profile names and email addresses.
- Contract titles and counterparties.
- Operational dates and work status.
- Decision workspace titles.
- Campaign names.
- Report-pack metadata.
- Product telemetry action names and route events.

Handling rules:

- Scope by organization and membership.
- Redact email-like strings in diagnostics.
- Avoid sending free text to logs unless explicitly scrubbed.
- Keep analytics and telemetry payloads on allowlisted safe fields.

### 4.3 Public Assets

- Marketing pages.
- Legal pages.
- Public security page.
- `public/.well-known/security.txt`.
- `robots.txt` and sitemap routes.
- Metadata image routes.
- External participant pages reached by opaque token.

Handling rules:

- Public does not mean unguarded mutation.
- Public external participant pages must reveal only the minimum state needed to complete the requested action.
- Public token routes must rate limit and return generic errors for invalid or expired links.

## 5. Identity And Authentication

### 5.1 Session Source

The app uses Supabase Auth through `@supabase/ssr`.

Server-side auth helpers:

- `createClient()` creates a Supabase SSR client bound to Next cookies.
- `createAdminClient()` creates a service-role client with no request cookies.
- `getAuthContext()` verifies the Supabase user, ensures membership, and returns `{ user, orgId, role, admin, mfaRequired }`.
- `getApiAuthContext()` verifies the user and deterministic organization membership for API routes.

Security properties:

- Session identity is resolved server-side.
- Organization membership is loaded server-side through the admin client.
- A missing user or membership returns no auth context.
- New users without a membership get a default organization through `ensureUserOrg`.

Known design decision:

- `getDeterministicMembership()` selects the earliest organization membership by `created_at`.
- There is no org switcher yet.
- Users with multiple memberships resolve to a stable primary org wherever this helper is used.
- Future org switching must update this spec, route guards, RLS assumptions, audit metadata, telemetry, and every place that uses deterministic membership.

### 5.2 Auth Proxy

`src/proxy.ts` is the edge auth gate for page navigation.

Behavior:

- Allows public auth pages, marketing/legal pages, root, API paths, auth callback, external participant pages, metadata image routes, crawler assets, and `/.well-known/*`.
- Redirects unauthenticated protected page requests to `/login`.
- Redirects authenticated users away from login/signup/reset surfaces to `/dashboard`.
- Redirects authenticated `/` to `/dashboard`.
- Applies onboarding calibration redirects for authenticated GET requests when required.
- Sets `OBLIXA_PATHNAME_HEADER` for downstream dashboard layout route eligibility.
- Adds correlation headers to responses.

Security notes:

- `/api/*` is intentionally allowed through proxy so individual route handlers own API auth.
- Proxy comments explicitly forbid logging raw IP or geo information.
- Proxy path policy is covered by tests and product-surface alignment checks.

### 5.3 Auth UX

Auth actions live in `src/actions/auth.ts`.

Implemented controls:

- Sign-up is rate limited by IP.
- Sign-in is rate limited by IP.
- Forgot password is rate limited by IP.
- Password length is constrained to 8-128 chars.
- Email length is constrained and must contain `@`.
- Name length is constrained.
- Sign-in failure responses are delayed to at least about 200 ms.
- Auth errors are mapped through user-facing error mapping.
- Sign-out records a security audit event when an org can be resolved.
- Sign-out redirects through `/api/auth/post-sign-out`.
- `/api/auth/post-sign-out` sets `Clear-Site-Data: "cache", "cookies"` before redirecting to `/login`.

Kill switches:

- `OBLIXA_KILL_SIGNUP=1` disables sign-up.

UX requirements:

- Auth failure copy must be actionable without revealing whether a specific account exists.
- Expired sessions should send users to sign in, not expose raw server errors.
- Sign-out should feel final on shared devices because `Clear-Site-Data` clears cache and cookies.

## 6. MFA And Step-Up

### 6.1 User MFA

Implemented in:

- `src/app/(dashboard)/settings/security/page.tsx`
- `src/components/settings/security-settings-panel.tsx`
- `src/actions/mfa.ts`

User-facing capabilities:

- List TOTP factors from Supabase MFA.
- Display current and next authenticator assurance levels.
- Start TOTP enrollment.
- Show QR code and manual secret.
- Verify TOTP enrollment.
- Remove TOTP factors.
- Show success/error states through live regions and inline mutation status.

Audit actions:

- `security.mfa_totp_verified`
- `security.mfa_totp_unenrolled`

UX requirements:

- MFA setup must remain reachable even when the organization requires MFA.
- TOTP secret copy must clearly warn that it should be treated like a password.
- MFA actions must use async and confirmation affordances where removal or sensitive changes occur.

### 6.2 Organization MFA Policy

Implemented in:

- `supabase/migrations/061_org_mfa_required.sql`
- `src/actions/mfa.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/components/settings/security-settings-panel.tsx`

Behavior:

- `organizations.mfa_required` defaults to `false`.
- Admins can toggle organization MFA policy.
- When enabled, dashboard layout requires current AAL2 for dashboard routes outside `/settings/security`.
- Non-AAL2 users are redirected to `/settings/security?mfa=required`.

Audit action:

- `security.org_mfa_required_updated`

Known gap:

- The dashboard layout enforces MFA on page navigation.
- API route handlers generally rely on their own session/role/workspace guards and do not globally enforce org MFA/AAL2.
- Sensitive APIs requiring reauthentication currently use password step-up where implemented.
- Future hardening should add reusable API-level AAL2 enforcement for orgs with `mfa_required`, especially for sensitive mutations that can be called without first rendering a dashboard page.

### 6.3 Step-Up Password

Implemented in:

- `src/app/api/settings/step-up/route.ts`
- `src/lib/security/step-up-cookie.ts`
- `src/components/settings/security-settings-panel.tsx`
- callers such as `src/app/api/integrations/oauth/start/route.ts` and `src/app/api/me/account/route.ts`

Behavior:

- User submits current password to `/api/settings/step-up`.
- Route rate limits attempts by IP.
- Route verifies the password through Supabase Auth token endpoint using `safeFetch`.
- Failure waits to about 220 ms to reduce timing signal.
- Success mints an HMAC-signed cookie named `oblixa_step_ok`.
- Cookie attributes:
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `secure` in production
  - `path: "/"`
  - `maxAge: 600`
- Cookie binds to user id and expiration.
- Cookie includes random nonce.
- Cookie HMAC uses SHA-256 and timing-safe verification.

Audit action:

- `security.step_up_password_verified`

Security notes:

- `OBLIXA_STEP_UP_SECRET` is preferred.
- If no dedicated step-up secret is configured, code falls back to a prefix of `SUPABASE_SERVICE_ROLE_KEY`.
- Production deployments should set a dedicated `OBLIXA_STEP_UP_SECRET` to allow independent rotation.

Sensitive actions currently requiring step-up:

- Integration OAuth start.
- DSR account delete request hook.
- Security panel copy says API key creation/revocation and integration OAuth should require step-up; API key routes must preserve this requirement.

Known gap:

- Checklist docs note additional step-up tests for sensitive settings are still pending.
- Step-up should be centralized for every high-impact settings mutation.

## 7. Authorization Model

### 7.1 Role Model

Workspace roles:

- `admin`
- `editor`
- `viewer`
- `ops_manager`
- `legal_reviewer`
- `finance_reviewer`
- `manager`

Core role semantics:

- `admin`: manages org settings, billing, security policy, integrations, and high-privilege operations.
- `editor`: edits contracts and most operational workflow records.
- `viewer`: read-only where visible.
- `ops_manager`: operational edits, renewals, maintenance.
- `legal_reviewer`: approval/review-oriented capability.
- `finance_reviewer`: approval and renewal capability.
- `manager`: broad operational management capability.

### 7.2 Capabilities

Implemented in `src/lib/access-control.ts`.

Capabilities:

- `contracts_edit`
- `approvals_manage`
- `renewals_manage`
- `maintenance_manage`
- `settings_manage`

Base capability mapping:

- Admin: all listed capabilities.
- Editor: contracts, approvals, renewals.
- Viewer: none.
- Ops manager: contracts, renewals, maintenance.
- Legal reviewer: approvals.
- Finance reviewer: approvals, renewals.
- Manager: contracts, approvals, renewals, maintenance.

Policy override:

- `organization_workflow_settings.role_policy_json` can override role-capability behavior.
- `canManageCapability()` loads this policy and calls `hasRoleCapability()`.

Security note:

- `canEditContracts()` in `src/lib/permissions.ts` does not consult `role_policy_json`.
- Routes using `canEditContracts()` should be reviewed if per-org capability overrides are expected to apply.

### 7.3 API Session Context

`requireSessionApiContext()`:

- wraps `getApiAuthContext()`
- returns `401 Unauthorized` JSON with private no-store headers when session or membership is missing

`requireRoleAtLeast()`:

- supports `viewer`, `editor`, `admin` rank ordering
- returns `403 Forbidden` for insufficient role

`requireV6Context()`:

- returns `401` when unauthenticated
- can enforce a `RoleCapability`
- returns `403` when capability is missing

### 7.4 Product-Surface Authorization

Implemented in:

- `src/lib/product-surface/api-workspace-guard.ts`
- `src/lib/product-surface/eligibility.ts`
- `src/lib/product-surface/v8-surface-mapping.ts`
- `src/lib/product-surface/route-guard.ts`
- `src/app/(dashboard)/layout.tsx`

Behavior:

- Dashboard layout asserts page path eligibility.
- API routes can call `requireApiWorkspaceEligibility()`.
- Hidden or unavailable modules return 403 or 404 according to denial class and route policy.
- V10 routes can receive V10 mutation envelopes for workspace denial.
- Diagnostics are logged for missing mappings or gate denials.

Security property:

- Hidden modules must not be exposed through direct links, API routes, command palette results, navigation, reports, notifications, or API JSON helper links.

Known gap:

- Product-surface inventories are distributed across multiple files and artifacts.
- The broader as-built spec notes `/settings/security` exists in the filesystem and route inventory but was called out as missing from one UI surface manifest source.

## 8. Organization Isolation And RLS

### 8.1 Database Isolation

The database uses `organization_id` as the primary tenant boundary for operational data.

As-built verification:

- 154 created public tables are detected by `check-rls-policy-drift`.
- 154 tables have RLS enabled.
- Missing RLS list is empty.
- Missing policy list is empty.

Core RLS patterns:

- Members can read rows for organizations they belong to.
- Editors/admins can insert or update operational records where allowed.
- Admins are required for organization management and sensitive subscription/webhook management.
- User-specific rows such as profiles, saved views, and notifications are scoped by `auth.uid()`.
- Storage objects in the `contracts` bucket are scoped by org id parsed from object names.

### 8.2 Initial Schema RLS

The initial migration enables RLS for:

- `organizations`
- `profiles`
- `organization_members`
- `contracts`
- `contract_files`
- `extracted_fields`
- `reminders`
- `audit_events`

It creates policies for:

- users reading/updating their own profiles
- members reading organization memberships
- members reading their organizations
- admins updating organizations
- members reading org contracts
- editors inserting/updating contracts
- admins deleting contracts
- contract-file access through contract membership
- extracted-field access through contract membership

### 8.3 Storage Object Policies

Implemented in `supabase/migrations/041_v4_security_hardening.sql`.

Controls:

- `storage_object_org_id(object_name text)` extracts org id from storage object path.
- Supports both `org/<org-uuid>/...` and legacy `<org-id>/<contract-id>/...`.
- Upload policy requires:
  - bucket is `contracts`
  - parsed org id is non-null
  - caller is org member
- View policy requires:
  - bucket is `contracts`
  - parsed org id is non-null
  - caller is org member

### 8.4 Security Definer Hardening

Implemented hardening:

- Security definer functions are expected to pin `set search_path = public`.
- `create_user_org(user_id, org_name)` checks `auth.uid() is not null` and equals the requested `user_id`.
- `handle_new_user()` is replaced with a search-path-pinned implementation.
- Migration check rejects new security definer functions missing search path, except documented legacy baseline.
- V10 RPCs revoke public execute and grant service role only where appropriate.

### 8.5 Security Invoker View

`supabase/migrations/063_contract_operational_dates_security_invoker.sql` recreates `public.contract_operational_dates` with `security_invoker = true`.

Security objective:

- Views should apply RLS and grants for the querying role rather than silently acting with owner privileges.

### 8.6 V10 Runtime RLS

`supabase/migrations/057_v10_runtime_contracts.sql` enables RLS for V10 runtime tables, including:

- `v10_mutation_idempotency`
- `v10_audit_events`
- `v10_read_model_rows`
- `v10_activation_state`
- `v10_work_items`
- `v10_contract_health_snapshots`
- `v10_contract_activity_events`
- `v10_field_provenance_records`
- `v10_renewal_posture_snapshots`
- `v10_evidence_request_statuses`
- `v10_obligation_records`
- `v10_approval_records`
- `v10_exception_records`
- `v10_notification_deliveries`
- `v10_renewal_checkpoint_records`
- `v10_external_evidence_submissions`
- `v10_job_run_visibility`
- `v10_report_run_visibility`
- `v10_command_search_index`
- `v10_release_evidence_records`
- `v10_fixture_manifests`
- `v10_denominator_locks`
- `v10_metric_runs`
- `v10_promotion_decisions`
- `v10_release_waivers`
- `v10_verification_command_results`
- `v10_external_blocker_records`
- `v10_fixture_teardown_records`
- `v10_read_model_refresh_jobs`
- `v10_read_model_lineage`
- `v10_runtime_artifacts`
- `v10_runtime_coverage_ledger`
- `v10_advanced_assurance_linked_records`

Special policy:

- `v10_mutation_idempotency` has no direct member access.
- Member-readable V10 tables are scoped to org membership through V10 read helpers and policies.
- Expired or revoked runtime artifacts are not broadly readable.

Security objective:

- V10 runtime evidence is auditable and readable to members where appropriate, but mutation idempotency internals remain service-role controlled.

## 9. Service Role Usage

The service-role client bypasses RLS. The code uses it because Server Components and route handlers need deterministic organization resolution, background jobs, and cross-table workflow operations.

Rules:

- Every service-role query touching tenant data must include explicit organization scoping or derive organization from a verified membership, signed token, verified webhook metadata, or cron/system batch scope.
- Service-role usage in library files is tracked by `check:server-lib-admin`.
- API admin/org-scope usage is tracked by `check:api-route-admin-org-scope`.
- Server actions org-scope is tracked by `check:server-action-org-scope`.
- Route tests and coverage checks are required or allowlisted.

As-built verification:

- Security scorecard reports `check:server-lib-admin` passing with 46 allowlisted library files that reference `createAdminClient`.

Design risk:

- Service-role access can accidentally bypass RLS. Reviews must focus on missing `.eq("organization_id", orgId)`, using route params before org validation, and cross-org IDs in bulk operations.

## 10. API Security Contract

### 10.1 API Route Ownership

Proxy permits `/api/*` unauthenticated at the edge so each API route can own the correct auth boundary.

Valid route auth patterns include:

- session and membership guard
- role/capability guard
- product-surface workspace guard
- cron secret guard
- webhook signature verification
- inbound automation bearer token
- external opaque token plus passcode/ticket
- public health or tracking routes with explicit allowlist and rate limit

### 10.2 Auth Contract Coverage

Scripts:

- `check:api-route-auth-contract`
- `check:api-route-auth-route-index`
- `sync:api-route-auth-route-index`
- `report:api-route-auth-contract`
- `report:api-route-auth-and-scope-coverage`

As-built verification:

- Security scorecard reports 184 API routes satisfy auth contract checks.

Route inventory files:

- `scripts/api-route-auth-inventory.txt`
- `scripts/api-route-auth-route-index.txt`
- `scripts/api-route-public-allowlist.txt`
- `artifacts/security-route-matrix.json`
- `artifacts/generated/security/SECURITY_API_ROUTE_COVERAGE.md`

### 10.3 Private No-Store Headers

Sensitive API helpers define:

- `Cache-Control: private, no-store`
- `Pragma: no-cache`

`next.config.ts` applies to `/api/:path*`:

- `Cache-Control: private, no-store`
- `Pragma: no-cache`
- `Vary: Cookie`

Cron and diagnostics add no-store headers separately.

### 10.4 JSON Body Limits

Implemented in `src/lib/security/read-json-body-limited.ts`.

Behavior:

- Default max JSON body size is 512 KiB.
- If `Content-Length` exceeds max, return 413.
- If read text exceeds max, return 413.
- Invalid JSON returns 400.
- `parseJsonBodyWithLimit()` combines body limit with typed parser mapping.

Requirement:

- New JSON mutation routes should use this helper unless they have a narrower parser or documented reason.

### 10.5 Content-Type Policy

Implemented in `src/lib/security/json-content-type.ts`.

Behavior:

- Rejects clearly wrong content types when JSON is expected.
- Allows missing content type.
- Allows `application/json`.
- Allows `text/plain` because some runtimes default to it for string bodies.

### 10.6 Sec-Fetch Policy

Implemented in `src/lib/security/sec-fetch-policy.ts`.

Behavior:

- GET, HEAD, OPTIONS are allowed.
- Mutations are allowed for missing `Sec-Fetch-Site`, `same-origin`, `same-site`, or `none`.
- Cross-site mutations are rejected when callers use the helper.

Requirement:

- Cookie-authenticated browser mutation routes should use this policy or an equivalent origin/referrer guard.

Known gap:

- This helper exists and is tested, but the spec should not assume every cookie-authenticated mutation already invokes it.
- CI has `check:csrf-surface-guards`; future failures should block release.

### 10.7 Problem JSON And Error Safety

The repo has checks for API problem JSON consistency and raw error JSON allowlists.

Security requirements:

- User-facing errors must be supportable and not leak secrets.
- Diagnostic IDs may identify failure class but must not include secret or raw user content.
- 401, 403, 404, 409, 410, 424, 429, and 500 outcomes must be semantically distinct where possible.
- Hidden modules should prefer 404 when discoverability should be suppressed.

## 11. Rate Limiting And Abuse Controls

### 11.1 Rate Limit Implementation

Implemented in `src/lib/rate-limit.ts`.

Behavior:

- Uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
- Falls back to in-memory sliding windows when Upstash is absent.
- In-memory fallback is per process/instance and is suitable for local development or best-effort protection, not global production protection.
- Upstash errors fall back to in-process windows.

Production requirement:

- Configure Upstash for distributed rate limits in production.

### 11.2 Current Rate-Limited Surfaces

Cataloged limits include:

- AI extraction
- extraction worker
- sign-in
- sign-up
- forgot password
- step-up password
- invites
- event reads
- inbound email automation
- inbound Slack automation
- inbound integration callbacks
- cron/internal jobs
- report tracking pixels and click redirects
- external token reads and mutations
- session-backed external workflow steps
- V5 and V6 cron jobs
- report run retry
- CSV export
- import/export job polling
- calendar export
- self-service data export
- review packet export
- integration sync and token refresh
- Stripe checkout, portal, and webhook
- template previews
- onboarding calibration actions
- product telemetry
- internal debugging sweep

### 11.3 Rate-Limit Coverage Checks

Script:

- `check:api-route-rate-limit-coverage`

As-built verification:

- Security scorecard reports 184 API routes satisfy rate-limit coverage or allowlist.

Review rule:

- A mutating route without rate limit must have a narrow, documented allowlist reason.

## 12. Secrets And Key Management

### 12.1 Environment Contract

Required server env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`

Required for integration token encryption:

- `INTEGRATION_TOKEN_ENCRYPTION_KEY`

Important optional or deployment-critical server env:

- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OPENAI_API_KEY`
- `EXTRACTION_WORKER_SECRET`
- `EXTRACTION_WORKER_BASE_URL`
- `OBLIXA_STEP_UP_SECRET`
- `CRON_SECRET`
- `INBOUND_AUTOMATION_TOKEN`
- `INBOUND_EMAIL_AUTOMATION_TOKEN`
- `INBOUND_SLACK_AUTOMATION_TOKEN`
- `INBOUND_INTEGRATIONS_CALLBACK_TOKEN`
- `INBOUND_AUTOMATION_ORG_ALLOWLIST`
- `EXTERNAL_ACTION_SUBMIT_TICKET_SECRET`
- `EXTERNAL_ACTION_PASSCODE_PEPPER`
- `OBLIXA_INTERNAL_DIAG_SECRET`
- `OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST`
- OAuth provider credentials
- Sentry DSNs and release configuration
- Upstash Redis credentials

Rules:

- `NEXT_PUBLIC_*` variables are browser-visible.
- Server secrets must never be prefixed with `NEXT_PUBLIC_`.
- `.env.example` documents the distinction.
- `check:env-example-parity`, `check:security-env-contract`, and related checks guard drift.

### 12.2 Secret Comparison

Implemented in `src/lib/security/secret-compare.ts`.

Controls:

- `secureCompareUtf8()` hashes both inputs with SHA-256 and uses `timingSafeEqual`, avoiding length-based timing leaks.
- `parseBearerToken()` extracts non-empty bearer tokens.

Uses:

- Cron secret verification.
- Bearer-secret internal diagnostics.
- Inbound automation tokens.

### 12.3 Token Encryption

Implemented in `src/lib/security/token-crypto.ts`.

Behavior:

- Integration tokens are encrypted with AES-256-GCM.
- Key must decode from base64 to 32 bytes.
- Ciphertext format prefix is `enc:v1:`.
- 12-byte random IV.
- 16-byte auth tag.
- Backward compatibility returns plaintext for old unprefixed rows.

Production requirement:

- Rotate old plaintext integration token rows to encrypted values.
- Set and protect `INTEGRATION_TOKEN_ENCRYPTION_KEY`.
- Do not reuse this key for unrelated HMAC or cookie signing.

### 12.4 Step-Up Cookie Secret

Implemented in `src/lib/security/step-up-cookie.ts`.

Rules:

- Prefer `OBLIXA_STEP_UP_SECRET`.
- Minimum length is 16 chars.
- Fallback to service-role key exists but should not be used as the production runbook default.
- Rotate step-up secret independently when suspicious step-up activity occurs.

### 12.5 External Link Secrets

Implemented in `src/lib/v5/api.ts`.

Controls:

- External action passcodes are hashed with SHA-256 over `pepper:plain`.
- Production-like env requires `EXTERNAL_ACTION_PASSCODE_PEPPER`.
- Submit tickets are HMAC signed.
- Production-like env requires dedicated `EXTERNAL_ACTION_SUBMIT_TICKET_SECRET`.
- Production submit ticket signing explicitly rejects relying on `CRON_SECRET` or passcode pepper fallback.

Known hardening opportunity:

- External passcode hashing is deterministic SHA-256 with a server pepper, not a memory-hard password hashing scheme.
- This is acceptable only if passcodes are treated as bounded link unlock codes with rate limiting and expiration.
- If passcodes become user-chosen passwords or long-lived credentials, migrate to a password hashing algorithm and per-link salt.

### 12.6 Secret Scanning

Configured:

- `.gitleaks.toml`
- `.gitleaksignore`
- `check:tracked-secrets-hygiene`
- `check:gitleaks-allowlist`
- GitHub workflow with `gitleaks/gitleaks-action`
- optional secrets history scan workflow
- optional secretlint workflow stub

As-built verification:

- Security scorecard reports tracked secrets hygiene passing across 2850 tracked files.

## 13. Transport, Headers, And Browser Isolation

### 13.1 Global Headers

Implemented in:

- `next.config.ts`
- `src/lib/security/csp-builders.ts`

Headers:

- `X-Content-Type-Options: nosniff`
- `X-DNS-Prefetch-Control: off`
- `X-Permitted-Cross-Domain-Policies: none`
- `X-Frame-Options: SAMEORIGIN`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone, geolocation, payment, display capture, web share, interest cohort, USB, Bluetooth, serial, and HID
- `Content-Security-Policy`
- `Content-Security-Policy-Report-Only`
- `Strict-Transport-Security` in production when Vercel or self-hosted HSTS is enabled

### 13.2 Enforcing CSP

Current enforcing CSP:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` plus `unsafe-eval` in non-production
- `worker-src 'self' blob:`
- `style-src 'self' 'unsafe-inline'` unless strict style env is enabled in production
- `img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://*.sentry-cdn.com`
- `font-src 'self' data:`
- `connect-src 'self'` plus Supabase, Stripe, Sentry, Vercel vitals/live endpoints
- `frame-src` Stripe frames
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'self'`

### 13.3 Report-Only Strict CSP

Report-only CSP supports:

- strict script source without `unsafe-inline`
- optional build-time script nonce
- strict `style-src 'self'`
- optional Trusted Types report-only directive through `OBLIXA_TRUSTED_TYPES_REPORT_ONLY=1`

Hardening path:

- Continue staging report-only CSP with nonce.
- Remove `unsafe-inline` from enforcing script policy when Next/runtime constraints allow.
- Enable `OBLIXA_CSP_STRICT_ENFORCING_STYLE=1` only after validating UI styling.

### 13.4 JSON-LD Safety

`serializeJsonLdForInlineScript()` escapes `<` as `\u003c` so JSON-LD cannot close a script tag with a literal `</script>`.

Requirement:

- Any inline JSON-LD must use this serializer.

## 14. Redirects, URLs, And SSRF

### 14.1 Open Redirect Guard

Implemented in `src/lib/security/redirect.ts`.

Rules:

- Only same-origin relative paths are accepted.
- Rejects empty, too long, non-leading slash, protocol-relative, full scheme, control chars, backslash, `@`, and `<`.
- Fallback is `/dashboard`.

Used by auth callback for `next`.

### 14.2 Public Origin Helpers

Implemented:

- `src/lib/app-url.ts`
- `src/lib/security/trusted-forwarded.ts`

Security objective:

- Absolute URLs for OAuth, email links, and workers must derive from trusted request context or configured base URL.
- Host and forwarded headers need careful handling to avoid attacker-controlled callback origins.

### 14.3 Outbound URL Validation

Implemented in:

- `src/lib/security/url-policy.ts`
- `src/lib/security/safe-fetch.ts`
- `src/lib/security/worker-url.ts`

Controls:

- Allow only `http:` and `https:` where outbound HTTP is intended.
- Reject localhost and `.localhost`.
- Reject private IPv4 ranges.
- Reject loopback, link-local, unique-local, multicast IPv6 ranges.
- Treat IPv4-mapped IPv6 carefully.
- DNS-resolve hostnames before fetch and reject blocked IP resolutions.
- Abort outbound fetches by timeout.
- Allow localhost only in non-production when explicitly requested.
- Validate `EXTRACTION_WORKER_BASE_URL` as origin-only with no path, query, credentials, or hash.
- In production, extraction worker origin must use HTTPS.

SSRF threat classes addressed:

- direct private IP URL
- localhost aliases
- metadata IP
- DNS to private IP
- unsupported schemes
- IPv4-mapped IPv6 bypass
- worker URL path/query injection

Known hardening requirement:

- Any new server-side dynamic fetch must use `safeFetch()` or an approved trusted-source pattern.
- CI has `check:security-fetch-sinks:strict` and outbound domain allowlist checks.

## 15. Uploads, Files, Markdown, And Injection

### 15.1 Upload Filename Sanitization

Implemented in `src/lib/security/upload-filename.ts`.

Controls:

- Strip path components.
- Strip control characters.
- Replace `.` and `..` with `document`.
- Trim to 255 chars.
- Fallback to `document`.

### 15.2 Contract Storage Path Validation

Implemented in `src/lib/security/validation.ts`.

Controls:

- Storage path shape must be `{orgId}/{contractId}/{uuid}-{filename}`.
- Reject empty, overly long, percent signs, traversal, backslash, NUL, and invalid UUID segments.
- Filename tail must be present and <= 500 chars.

### 15.3 Markdown And Markup Sanitization

Implemented utilities:

- `stripDangerousHtmlTags()` removes script blocks and iframe opening tags for simple markdown previews.
- `sanitizeExternalHref()` blocks dangerous schemes such as `javascript:`, `data:`, `vbscript:`, and `file:`.
- `externalLinkRelAndReferrer()` returns `noopener noreferrer` and `no-referrer`.
- `svgOrCssTextHasRemoteSubresourceRefs()` detects remote subresource refs in SVG/CSS.

Important limitation:

- `stripDangerousHtmlTags()` is explicitly minimal and is not a full sanitizer.
- Do not use it as the sole control for arbitrary untrusted HTML.

### 15.4 Prototype Pollution And Unicode

Implemented:

- `stripPrototypePollutionKeys()` removes `__proto__`, `constructor`, and `prototype`.
- `hasConfusableMixedScript()` flags Latin mixed with Cyrillic or Greek.
- `isPunycodeInternationalizedDomain()` detects punycode hostnames.

Controls:

- These helpers reduce unsafe object merge and phishing/homograph risk.
- Callers must intentionally apply them where user-controlled object keys, hosts, or display names matter.

## 16. External Collaboration Links

### 16.1 Link Status

Implemented in `src/app/api/external-actions/[token]/status/route.ts`.

Controls:

- V5 external collaboration feature gate.
- IP rate limit.
- Opaque token lookup.
- Expired open links are treated as effectively expired.
- `passcode_hash` is stripped from response.
- Response returns only:
  - action type
  - status
  - expiration
  - whether a passcode is required
  - workflow chain/deadline/ack metadata
  - correction message
  - submit ticket when fresh reauth is required

### 16.2 Link Submit

Implemented in `src/app/api/external-actions/[token]/submit/route.ts`.

Controls:

- V5 external collaboration feature gate.
- IP rate limit.
- Size-limited JSON body.
- Opaque token lookup.
- Submit ticket check when `requires_reauth` is true.
- Passcode verification when passcode hash exists.
- Expired link is persisted as expired and returns 410.
- Already submitted link returns 409.
- Action type is validated.
- Payload is validated and normalized by action type.
- Passcode and submit ticket are removed before persistence.
- Update is scoped by link id and organization id.
- Submitted state update requires `.neq("status", "submitted")`.
- Evidence submission only occurs after verifying evidence requirement belongs to same organization.
- Relationship timeline and assurance side effects are best effort with partial error reporting.

### 16.3 Participant Workflow Step

Implemented in `src/app/api/external-actions/[token]/participant/workflow-step/route.ts`.

Controls:

- V5 external collaboration feature gate.
- V6 assurance feature gate.
- IP rate limit.
- Optional idempotency key.
- Opaque token lookup.
- Link must be open.
- Expired link returns 410.
- Size-limited JSON parse.
- Passcode verification.
- Workflow deadline enforcement.
- Partial response for event insert failure.

UX requirement:

- External participants should get clear recovery messages for expired, already submitted, missing passcode, and stale ticket states.

## 17. Inbound Automation And Webhooks

### 17.1 Cron Routes

Implemented in:

- `src/lib/security/cron-auth.ts`
- `src/lib/security/cron-route-gate.ts`
- `src/lib/cron/route-runner.ts`
- `src/lib/v6/cron-route-runner.ts`
- `vercel.json`

Controls:

- Cron routes require `CRON_SECRET`.
- Accepted credentials:
  - `Authorization: Bearer <CRON_SECRET>`
  - `x-cron-secret`
  - `x-vercel-cron-secret`
- Missing env returns 503 with diagnostic `cron_secret_missing`.
- Bad or missing caller secret returns 401 with diagnostic `cron_unauthorized`.
- Secrets use timing-safe comparison.
- Shared route runner applies idempotency, rate limit, dependency preflight, admin client preflight, healthcheck pings, structured errors, and no-store headers.
- V6 wrapper adds feature gating and organization discovery.

As-built verification:

- `vercel.json` declares 44 scheduled paths.
- `check:cron-route-auth` reports 44 scheduled route files reference shared cron auth or wrapper in the security scorecard run.

Review rule:

- New scheduled routes must use `withCronRoute`, `withV6CronRoute`, or the shared cron gate directly.

### 17.2 Inbound Automation Tokens

Implemented in `src/lib/security/inbound-automation-token.ts`.

Routes:

- email automation
- Slack automation
- integration action callback

Secret resolution:

- email: `INBOUND_EMAIL_AUTOMATION_TOKEN` then `INBOUND_AUTOMATION_TOKEN`
- Slack: `INBOUND_SLACK_AUTOMATION_TOKEN` then `INBOUND_AUTOMATION_TOKEN`
- integration callback: `INBOUND_INTEGRATIONS_CALLBACK_TOKEN` then `INBOUND_AUTOMATION_TOKEN`

Controls:

- Bearer token required.
- Per-route secret override allows least privilege and rotation.
- Shared fallback token remains available.

### 17.3 Inbound Org Allowlist

Implemented in `src/lib/security/inbound-org-allowlist.ts`.

Behavior:

- `INBOUND_AUTOMATION_ORG_ALLOWLIST` can restrict inbound automation to comma-separated org UUIDs.
- Unset allowlist allows all orgs for backward compatibility.
- Empty after parsing allows all.
- Non-allowlisted org returns 403.

Production recommendation:

- Use per-route inbound tokens plus org allowlist for shared-token deployments.

### 17.4 Inbound Email HMAC

Implemented in `src/lib/security/inbound-email-signing.ts`.

Controls:

- Optional `EMAIL_INBOUND_HMAC_SECRET`.
- Expects `X-Oblixa-Email-Signature: sha256=<hex>`.
- HMAC is computed over raw JSON body.
- Uses timing-safe comparison.

### 17.5 Slack Signing

Implemented in `src/lib/security/slack-signing.ts`.

Controls:

- Verifies Slack v0 signature.
- Requires signature header and timestamp.
- Rejects timestamp skew over default 300 seconds.
- HMACs raw body.
- Uses timing-safe comparison.

### 17.6 Stripe Webhook

Implemented in `src/app/api/stripe/webhook/route.ts`.

Controls:

- Requires `STRIPE_WEBHOOK_SECRET`.
- Verifies `stripe-signature` with Stripe SDK before processing.
- Rate limits by IP after signature verification.
- Claims event id in `stripe_webhook_events`.
- Duplicate event id returns success with duplicate marker.
- Customer/org binding mismatch is logged and not applied.
- Subscription state updates are org scoped.
- Processing failures update event status.
- Missing provider configuration returns dependency-blocked JSON.

## 18. OAuth And Integrations

### 18.1 OAuth Start

Implemented in `src/app/api/integrations/oauth/start/route.ts`.

Controls:

- Rate limit.
- Size-limited JSON.
- Provider allowlist:
  - `google_calendar`
  - `outlook_calendar`
  - `slack`
  - `email`
  - `crm`
- Session required.
- Deterministic membership required.
- Role must be admin.
- Step-up cookie required.
- Product-surface API workspace eligibility required.
- Optional idempotency key blocks duplicate start.
- Provider config loaded from env or existing connection config.
- Authorize URL validated as outbound HTTP URL.
- Redirect URI must match request origin.
- PKCE verifier/challenge generated.
- OAuth state generated randomly, expires in 15 minutes, and is stored with redirect URI and code verifier.

### 18.2 OAuth Callback

Implemented in `src/app/api/integrations/oauth/callback/route.ts`.

Controls:

- Rate limit.
- Requires state and code.
- State must exist.
- State must not be consumed.
- State must not be expired.
- State must include redirect URI and code verifier.
- Provider config loaded from env or connection config.
- Token URL validated.
- Token exchange uses `safeFetch()`.
- Token exchange timeout is 20 seconds.
- Access token is required.
- Access and refresh tokens are encrypted before storage.
- Missing encryption key returns dependency-blocked response.
- Connection upsert is org scoped.
- OAuth state is marked consumed after successful persistence.

### 18.3 API Keys

Database hardening in `supabase/migrations/021_security_hardening_auth_and_keys.sql` adds:

- `scopes`
- `expires_at`
- `revoked_at`
- active/expiry index

Security audit actions include:

- `security.integration_api_key_created`
- `security.integration_api_key_revoked`

Requirement:

- API key creation/revocation must require admin or equivalent settings capability and recent step-up.
- API key material must be shown only once.
- Stored key material should be hashed or otherwise non-recoverable where API semantics allow.

## 19. Billing And PCI Boundary

Stripe surfaces:

- Checkout route.
- Billing portal route.
- Webhook route.

Security model:

- Payment card data stays with Stripe-hosted surfaces.
- Application stores Stripe customer/subscription identifiers and statuses, not card data.
- Checkout/portal sessions are rate limited.
- Webhooks are signature verified.
- Webhook event IDs are persisted for idempotency.

Requirement:

- Do not introduce direct card collection in this repository without a new PCI-focused architecture spec and compliance review.

## 20. AI And Extraction Security

Relevant controls:

- `OPENAI_API_KEY` is server-only.
- Extraction worker route uses bearer secret when configured.
- Extraction worker base URL has SSRF guard.
- AI extraction is rate limited.
- Uploaded filenames and storage paths are sanitized.
- Contract files are org scoped in storage and database.
- Extracted fields require human review before operational workflow uses approved values.
- V10 audit metadata forbids sensitive metadata keys and truncates long strings.
- CI includes AI context redaction, prompt injection guards, and AI tool-call authz checks.

Security rules:

- Do not send unnecessary organization secrets, tokens, or unrelated contract records to AI providers.
- Do not log raw extraction prompts, raw contract text, or raw model outputs unless behind a governed debugging control and redacted.
- Treat extraction output as untrusted until parsed, normalized, and reviewed.
- Keep model configuration server-side.

Known external obligation:

- Provider data handling, retention, and enterprise controls require out-of-repo vendor/compliance evidence.

## 21. V10 Mutation And Audit Contract

### 21.1 Mutation Envelope

Implemented in:

- `src/lib/v10-mutation-envelope.ts`
- `src/lib/v10-server-contracts.ts`

V10 mutation requests require:

- `organization_id`
- `target_type`
- `target_id`
- `expected_version` unless exempt
- `idempotency_key`
- `client_request_id`

Server-derived fields:

- Actor identity must be derived from authenticated server session.
- `actor_user_id` in client request is rejected by validation.

Response contract:

- `outcome`
- `user_visible_message`
- changed object type/id
- new version
- version metadata
- next destination href or null sentinel
- audit event id
- diagnostic id
- retry eligibility
- replay state
- validation failures when applicable
- bulk item outcomes when applicable

### 21.2 Idempotency

Controls:

- V10 idempotency key format is 8-200 chars, letters/numbers/colon/underscore/dash.
- Request payload is stable-hashed.
- Durable idempotency rows are scoped by organization, actor, mutation name, target type, target id, and key.
- Claim RPC handles claimed, replay, in-progress, payload-conflict, and missing-after-conflict states.
- Completion RPC persists response snapshots.
- Missing or invalid keys fail closed.
- Payload conflicts return diagnostic.
- In-progress keys return conflict.
- RPC unavailability returns diagnostic and does not execute mutation.

V10 database controls:

- `v10_mutation_idempotency` has unique identity constraints.
- Lookup, expiry, client-request, and in-progress indexes exist.
- Cleanup RPC is service-role only.
- Direct member access policy is `false`.

### 21.3 Audit

V10 audit records include:

- organization id
- actor user id
- actor type
- action
- target type/id
- optional contract id
- outcome
- before/after state hashes
- safe metadata
- diagnostic id

Metadata sanitizer:

- Redacts keys matching sensitive terms such as email, phone, address, token, secret, password, note, comment, text, body, URL, file name, file URL, signed link, raw clause, or contract text.
- Truncates long strings.
- Caps array items.

Security audit actions are namespaced under `security.*`.

Requirement:

- Security-sensitive mutations should record V10 audit events.
- User-facing success for high-impact V10 mutations should include an audit event id when the contract requires audit.
- Audit failures in strict mutation paths must be visible as `audit_write_failed` or equivalent.

## 22. Observability And Diagnostics

### 22.1 Sentry Scrubbing

Implemented in:

- `src/lib/observability/sentry-scrub.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

Controls:

- Sentry is initialized only when DSN exists.
- `beforeSend` scrubs events.
- Default trace/profile sample rates are 0 unless configured.
- `sendDefaultPii` is false unless explicitly enabled.

Scrubbed values:

- authorization headers
- proxy authorization
- cookies and set-cookie
- API keys
- forwarded authorization
- Stripe signature
- Slack signature
- cron secrets
- inbound automation token
- webhook signature
- integration token
- Cloudflare Access JWT/token
- true client IP
- auth request email
- AWS security token
- baggage/tracestate
- forwarded client cert headers
- Sentry user email, username email, and IP address
- request URLs/query strings with email-like substrings
- breadcrumbs and extras with email-like substrings
- onboarding/calibration payloads and raw messages
- denied metric tag keys

### 22.2 Log Redaction

Implemented in `src/lib/observability/log-redaction.ts`.

Controls:

- Redacts email-like substrings.
- Deep-redacts JSON-like values.
- Formats unknown errors safely for logs.
- Caps free-text length.

### 22.3 Internal Debugging Sweep

Implemented in `src/app/api/internal/debugging-sweep/route.ts`.

Controls:

- Disabled unless `OBLIXA_DEBUGGING_SWEEP_ENDPOINT=1`.
- If disabled or missing bearer secret, returns 404-style disabled response.
- Requires bearer secret `OBLIXA_INTERNAL_DIAG_SECRET`.
- Invalid bearer returns 403.
- IP rate limit.
- Optional IP allowlist through `OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST`.
- Malformed IP allowlist fails closed with 403.
- No-store headers.
- Sorted deterministic JSON.
- Logs only client IP prefix, not full IP.
- Optional V10 audit event if `OBLIXA_INTERNAL_DIAG_AUDIT_ORG_ID` is set.

Requirement:

- Keep this endpoint off in production unless actively needed.
- Rotate its bearer secret independently from cron and inbound automation secrets.
- Use IP allowlist for production diagnostics.

## 23. Security UX

### 23.1 Security Settings Page

Route:

- `/settings/security`

User-facing sections:

- Authenticator (TOTP)
- Sessions
- Step-up (password)
- Data export
- Organization MFA policy for admins

UX security requirements:

- Security controls must be understandable without exposing implementation internals.
- Security actions must use clear in-progress, success, and error states.
- Destructive actions, such as removing authenticators or revoking sessions, require confirmation.
- Live region updates must announce security action progress and errors.
- Admin-only controls must be hidden from non-admins.
- The MFA page must remain accessible when org MFA is required.

Current limitation:

- Detailed per-device session listing is not implemented in product; the UI explains that Supabase dashboard access is required for detailed device listings.

### 23.2 Public Security Page

Route:

- `/security`

Content:

- transport and authentication overview
- organization isolation overview
- integrations and automation overview
- vulnerability disclosure direction to `security.txt`

Machine-readable disclosure:

- `public/.well-known/security.txt`
- contact: `security@oblixa.io`
- canonical policy URL: `https://oblixa.io/security`

Requirement:

- Public security content must remain accurate and not overstate controls that are only planned or external.

### 23.3 Error UX

Security error UX rules:

- 401 means the user needs authentication.
- 403 means authenticated but not allowed, step-up needed, feature mode required, or policy forbids action.
- 404 can intentionally hide unavailable/hidden modules or disabled diagnostics.
- 409 means stale version, duplicate execution, already submitted, or conflict.
- 410 means expired or revoked external link.
- 424 means dependency blocked for V10-style dependency failure.
- 429 includes `Retry-After` when available.
- 503 means server-side dependency or secret misconfiguration for privileged routes.

UX copy rules:

- Tell legitimate users what to do next.
- Do not reveal whether a secret, token, or unrelated org record exists.
- Use diagnostic IDs for support instead of raw stack traces.

## 24. Data Lifecycle, DSR, And Legal Hold

### 24.1 Self-Service Export

Route:

- `GET /api/me/export`

Controls:

- Disabled by `OBLIXA_DSR_SELF_EXPORT=0`.
- Requires auth.
- Rate limits by user and IP.
- Requires deterministic membership.
- Blocks export if `profiles.legal_hold` is true.
- Returns JSON attachment with profile, organization, and membership summary.
- Uses private no-store.
- Audits success and legal-hold block.

Audit actions:

- `security.dsr_self_export_downloaded`
- `security.dsr_self_export_blocked_legal_hold`

### 24.2 Account Delete Request Hook

Route:

- `DELETE /api/me/account`

Controls:

- Disabled unless `OBLIXA_DSR_ACCOUNT_DELETE=1`.
- Requires auth.
- Requires recent step-up cookie.
- Rate limits by user and IP.
- Blocks if `profiles.legal_hold` is true.
- Records audit event.
- Returns 202 accepted.

Important limitation:

- Automated account purge is not executed in this build.
- The route records an operator follow-up request.

Audit actions:

- `security.dsr_account_delete_requested`
- `security.dsr_account_delete_blocked_legal_hold`

### 24.3 Operational Retention

Route:

- `/api/maintenance/prune-operational-data`

Controls:

- Cron-authenticated route.
- Retention days are clamped between 7 and 3650.
- Notification deliveries and selected audit actions are pruned after configured retention.

Defaults:

- notification deliveries: 120 days
- selected operational audit events: 180 days

Environment:

- `OPS_RETENTION_NOTIFICATION_DELIVERIES_DAYS`
- `OPS_RETENTION_AUDIT_EVENTS_DAYS`

## 25. Supply Chain And CI Security

### 25.1 Package And Dependency Controls

Controls:

- `npm audit --audit-level=high` in CI.
- CycloneDX SBOM generation.
- SBOM license allowlist spot check.
- SBOM diff/VEX stub gate.
- Dependency risk reports.
- Dependency review workflow.
- OpenSSF Scorecard workflow.
- Trivy filesystem workflow.
- CodeQL workflow.
- Semgrep SARIF workflow.
- Gitleaks workflow.

Artifacts:

- `cyclonedx-sbom.json`
- license allowlist artifacts
- dependency review policy artifacts

### 25.2 GitHub Workflow Security

Controls:

- CI top-level permissions default to `contents: read`.
- Jobs declare scoped permissions.
- Third-party actions are pinned to commit SHAs in primary CI.
- `check:github-workflows-security` rejects dangerous workflow patterns.
- `pull_request_target` danger patterns are checked.
- Scheduled workflows use secret gates.
- Runtime comprehensive pass can be skipped when required secrets are missing unless strict vars require failure.

### 25.3 Static Analysis

Controls:

- `semgrep/oblixa-security.yml`
- Semgrep p/ci and p/typescript configs.
- security static grep scripts.
- fetch sink checks.
- route auth checks.
- RLS drift checks.
- migration security pattern checks.
- environment parity checks.
- security header checks.
- OAuth PKCE/state checks.
- CSRF surface guard checks.
- upload and URL canonicalization checks.
- session fixation/lifecycle checks.
- tracked secrets hygiene.
- artifact integrity checks.

### 25.4 Security Program Artifacts

Repo-local governance files:

- `config/security-enforcement-matrix.json`
- `config/security-coverage-ledger.json`
- `config/security-external-obligations.json`
- `config/maximal-security-closure-register.json`
- `artifacts/security-control-coverage-matrix.rows.json`
- `artifacts/security-route-matrix.json`
- `artifacts/security-proxy-matrix.json`
- `artifacts/security-program-optional-declarations.json`

Security program coverage families include:

- governance SDLC
- asset trust boundaries
- identity/session
- authorization/IDOR
- API route plane
- rate limit/DoS
- secrets/crypto
- headers/CSP
- XSS/injection
- CSRF/OAuth
- SSRF/webhooks
- files/extraction
- Postgres/RLS
- cron jobs
- observability
- CI/supply chain
- business logic
- payments
- email/notifications
- collaboration
- AI/ML
- data lifecycle
- incident response
- regulatory mapping
- browser privacy
- session depth
- Git integrity
- eDiscovery
- external obligations

## 26. Production Security Checklist

Required before production:

- Set `SUPABASE_SERVICE_ROLE_KEY`.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` if billing is enabled.
- Set `INTEGRATION_TOKEN_ENCRYPTION_KEY` to a base64-encoded 32-byte key.
- Set `CRON_SECRET`.
- Set `OBLIXA_STEP_UP_SECRET`.
- Set `EXTERNAL_ACTION_PASSCODE_PEPPER` if external links with passcodes are enabled.
- Set `EXTERNAL_ACTION_SUBMIT_TICKET_SECRET` if external links require fresh submit tickets.
- Set per-route inbound automation tokens when inbound routes are enabled.
- Set `INBOUND_AUTOMATION_ORG_ALLOWLIST` for shared-token inbound automation.
- Set Upstash Redis env vars for distributed rate limiting.
- Set Sentry DSN only if scrubber is active and privacy review approves event content.
- Set HSTS behavior for self-hosted production with `OBLIXA_SELF_HOSTED_HSTS=1` when not on Vercel.
- Keep `OBLIXA_DEBUGGING_SWEEP_ENDPOINT` unset unless actively operating diagnostics.
- If diagnostics are enabled, set `OBLIXA_INTERNAL_DIAG_SECRET` and IP allowlist.
- Review `.env.example` parity.
- Run `npm run verify:security` or equivalent comprehensive security pipeline.
- Confirm `public/.well-known/security.txt` contact and canonical URLs are correct for deployed domain.

Recommended before production:

- Enable organization MFA for internal/admin workspaces.
- Configure SSO through Supabase/provider if required by customer trust posture.
- Run `npm run security:semgrep:full`.
- Run CodeQL, gitleaks, dependency review, and Trivy workflows.
- Run staging runtime smoke and cron canary with real staging secrets.
- Promote report-only CSP only after telemetry indicates compatibility.
- Rotate any legacy plaintext integration tokens.
- Review all service-role allowlist entries.

## 27. Incident Response Runbooks

### 27.1 Suspected Session Compromise

Immediate actions:

- Ask affected user to use `/settings/security` to revoke other sessions.
- Admin may require org MFA.
- Rotate user password through Supabase Auth flow.
- Review V10 audit events for:
  - `security.sessions_revoke_others`
  - `security.session_signed_out`
  - suspicious settings or integration actions
- If org-wide risk exists, enable `mfa_required`.

Repo-supported controls:

- other-session revoke
- sign-out audit
- Clear-Site-Data on sign-out
- org MFA enforcement for dashboard pages

### 27.2 Cron Secret Exposure

Immediate actions:

- Rotate `CRON_SECRET`.
- Redeploy all cron callers.
- Review scheduled route audit and healthcheck logs.
- Search for unexpected 401/200/500 spikes on cron paths.
- Consider temporary kill switches for risky subsystems.

Repo-supported controls:

- cron secret accepts bearer or cron secret headers
- unauthorized returns 401
- missing env returns 503
- cron route runner rate limits and idempotency-protects duplicate requests

### 27.3 Inbound Automation Token Exposure

Immediate actions:

- Rotate affected per-route token first.
- If shared token was used, rotate `INBOUND_AUTOMATION_TOKEN`.
- Configure or tighten `INBOUND_AUTOMATION_ORG_ALLOWLIST`.
- Review created tasks, action callbacks, and integration event rows.
- Enable kill switch `OBLIXA_KILL_INBOUND_AUTOMATION=1` if abuse is active.

### 27.4 OAuth Token Exposure

Immediate actions:

- Revoke provider tokens in provider dashboards.
- Rotate `INTEGRATION_TOKEN_ENCRYPTION_KEY` only with planned re-encryption workflow.
- Delete or reconnect compromised integration rows.
- Review integration connection access and audit events.
- Confirm OAuth callback state consumption and expiry behavior.

### 27.5 Stripe Webhook Abuse

Immediate actions:

- Rotate Stripe webhook secret.
- Confirm webhook endpoint URL in Stripe.
- Review `stripe_webhook_events` for duplicate or failed events.
- Confirm subscription state against Stripe dashboard.
- Watch for customer/org binding mismatch messages.

### 27.6 External Link Abuse

Immediate actions:

- Revoke or expire affected `external_action_links`.
- Rotate `EXTERNAL_ACTION_PASSCODE_PEPPER` only if all outstanding passcodes can be invalidated or reissued.
- Rotate `EXTERNAL_ACTION_SUBMIT_TICKET_SECRET` to invalidate submit tickets.
- Review external action events and evidence submissions.
- Lower external token rate limits if abuse is active.

### 27.7 Service Role Exposure

Immediate actions:

- Rotate Supabase service-role key.
- Redeploy all serverless environments.
- Review V10 audit events and database logs for unexpected cross-org reads or writes.
- Review service-role allowlist and recent PRs touching `createAdminClient`.
- Consider disabling high-risk cron and inbound automation with kill switches.

### 27.8 OpenAI Or Extraction Abuse

Immediate actions:

- Rotate `OPENAI_API_KEY`.
- Enable `OBLIXA_KILL_EXTRACTION=1`.
- Review extraction jobs and uploaded file activity.
- Verify `EXTRACTION_WORKER_BASE_URL` and `EXTRACTION_WORKER_SECRET`.
- Confirm no raw contract text leaked into logs or Sentry.

## 28. Known Gaps And Hardening Backlog

This section documents observable repo state and security gaps. It is not a product roadmap commitment, but these items should be considered before claiming a hardened production posture.

- API-level MFA/AAL2 enforcement is not globally centralized for orgs with `mfa_required`.
- Step-up is implemented but checklist docs call for additional sensitive-action tests and broader coverage.
- Security settings session UX can revoke other sessions but does not list every device/session in product.
- `OBLIXA_STEP_UP_SECRET` has a service-role-key fallback; production should configure a dedicated secret.
- External passcode hashing uses SHA-256 with pepper; acceptable for short-lived link passcodes, not for long-lived passwords.
- `stripDangerousHtmlTags()` is minimal and must not be treated as a general HTML sanitizer.
- Product-surface inventories are distributed across multiple files and generated artifacts; manifest drift remains a class of risk.
- Some security program obligations are intentionally external and require out-of-repo evidence.
- Production distributed rate limiting depends on Upstash env; fallback is per instance.
- Service-role usage is broad by design and must remain under allowlist, org-scope, and code-review discipline.
- V10 runtime release evidence tables exist, but production assurance depends on real operational data, not only repo tests.
- Public `/security` page is intentionally high-level and should be periodically reconciled with this document.

## 29. Review Checklist For New Work

Every new route, action, cron job, or data table must answer:

- What asset class does it touch?
- Is the caller authenticated, signed, bearer-authorized, cron-authorized, or public by design?
- Is organization id server-derived or validated against membership?
- Does it use service-role access?
- If yes, where is org scope enforced?
- Does it need product-surface eligibility?
- Does it need role or capability checks?
- Does it need MFA or step-up?
- Does it mutate state?
- If yes, does it need rate limit, idempotency, expected version, and audit?
- Does it parse JSON?
- If yes, does it use size limits and content-type policy?
- Does it fetch a dynamic URL?
- If yes, does it use `safeFetch()` or an approved trusted-source pattern?
- Does it accept upload names, storage paths, URLs, markdown, SVG, CSS, or HTML?
- If yes, what sanitizer or validator applies?
- Does it interact with external providers?
- If yes, how are signatures, tokens, state, PKCE, callback origins, retries, and idempotency handled?
- Does it emit logs, Sentry events, telemetry, or audit metadata?
- If yes, is payload support-safe?
- Does it expose hidden modules through links, command search, reports, notifications, or API JSON?
- Does it need a colocated route/action test?
- Does it need OpenAPI coverage?
- Does it need RLS policy updates?
- Does it need `.env.example` updates?
- Does it need `security-enforcement-matrix` or external-obligation updates?

## 30. Verification Commands

Core security verification:

```bash
npm run verify:security
```

Focused checks:

```bash
npm run check:api-route-auth-contract
npm run check:api-route-rate-limit-coverage
npm run check:api-route-tests
npm run check:cron-route-auth
npm run check:server-action-auth-contract
npm run check:server-action-org-scope
npm run check:api-route-admin-org-scope
npm run check:server-lib-admin
npm run check:rls-policy-drift
npm run check:migration-security-patterns
npm run check:security-headers
npm run check:security-env-contract
npm run check:security-event-contract
npm run check:tracked-secrets-hygiene
npm run check:gitleaks-allowlist
npm run check:oauth-state-integrity
npm run check:oauth-pkce-enforcement
npm run check:session-fixation-defenses
npm run check:session-lifecycle-security
npm run check:csrf-surface-guards
npm run check:security-fetch-sinks:strict
npm run check:upload-security-guards
npm run check:url-canonicalization-security
npm run check:security-enforcement-matrix
npm run check:security-control-coverage
npm run report:security-scorecard
```

Runtime and external checks:

```bash
npm run test:e2e -- e2e/security-api.spec.ts
npm run test:e2e -- e2e/security-headers-smoke.spec.ts
npm run test:e2e -- e2e/cron-bearer-parity.spec.ts
npm run test:rls-smoke
npm run security:semgrep:full
```

Generated reports:

```bash
npm run report:security-route-matrix
npm run report:security-proxy-matrix
npm run report:security-api-coverage
npm run report:api-route-auth-and-scope-coverage
npm run build:security-control-coverage-matrix
```

## 31. Security Acceptance Criteria

A release or major security-sensitive change is acceptable only when:

- All new public routes are explicitly allowlisted or guarded.
- All new authenticated routes have server-side session/membership checks.
- All new mutating routes have rate limits or documented allowlist.
- All new V10-required mutations have idempotency, expected version policy, audit, and envelope responses.
- All service-role code paths are org scoped.
- All new tables have RLS enabled and policies.
- All new security definer functions pin search path.
- All new external provider callbacks verify state/signature/secret and freshness.
- All new dynamic outbound fetches pass SSRF policy.
- All new env vars are documented or allowlisted.
- All new secrets are server-only.
- All new user-facing security errors have recovery copy.
- All security-sensitive actions produce audit events or have a documented reason.
- Security scorecard remains passing.

## 32. Appendix: Control Map

Identity and session:

- Supabase SSR auth client.
- Edge proxy page gate.
- Server-side auth context.
- Deterministic membership.
- Password auth actions with rate limits.
- Sign-out audit.
- Clear-Site-Data sign-out route.
- TOTP MFA.
- Org MFA policy.
- Step-up password cookie.

Authorization:

- Role and capability model.
- Product-surface route guard.
- Product-surface API guard.
- V6 capability guard.
- Workspace mode/module eligibility.
- Admin-only security settings.
- Service-role org-scope checks.

Data isolation:

- Postgres RLS on all created tables.
- Org-member policies.
- User-owned row policies.
- Storage object org policies.
- V10 member read policies.
- No direct member access to V10 idempotency internals.
- Security invoker operational date view.

API and mutation safety:

- API auth contract checks.
- API route tests or allowlists.
- Private no-store headers.
- JSON body limits.
- Content-type guard.
- Sec-Fetch helper.
- Rate limit catalog.
- Idempotency.
- V10 mutation envelope.
- Expected version and stale response.
- Audit event contract.

Secrets and crypto:

- Required env loader.
- Secret compare helper.
- AES-256-GCM integration token encryption.
- HMAC step-up cookie.
- HMAC external submit ticket.
- Peppered external passcode hash.
- Gitleaks config.
- Tracked secrets hygiene.

External boundary:

- Cron secret gate.
- Cron route runner.
- Stripe signature verification.
- Slack signature verification.
- Inbound email HMAC.
- Inbound automation bearer tokens.
- Inbound org allowlist.
- OAuth state and PKCE.
- OAuth safe token exchange.
- External action token/passcode/ticket/expiry.

Browser and injection:

- Security headers.
- CSP and CSP report-only.
- Trusted Types report-only option.
- JSON-LD serializer.
- Upload filename sanitization.
- Storage path validation.
- External href sanitizer.
- SVG/CSS remote subresource detector.
- Prototype pollution key stripping.
- Unicode homograph helpers.

Operations:

- Internal diagnostics disabled by default.
- Internal diagnostics bearer and IP allowlist.
- Sentry scrubber.
- Log redaction.
- Security audit event namespace.
- Kill switches.
- DSR export/delete hooks.
- Legal hold.
- Operational retention cron.

Supply chain:

- npm audit.
- SBOM.
- License allowlist.
- Semgrep.
- CodeQL.
- Trivy.
- Dependency review.
- OpenSSF Scorecard.
- Gitleaks.
- Workflow security checks.
- Pinned GitHub actions.
- Security enforcement matrix.

## 33. Appendix: External Obligations

The repo tracks external obligations in `config/security-external-obligations.json`. These require operational evidence outside this codebase.

Examples:

- MDM and endpoint posture.
- Physical/SOC controls.
- SIM-swap and SMS risk controls.
- Background checks and insider-risk controls.
- Bug bounty or vulnerability disclosure operations.
- Cyber insurance.
- Datacenter visitor controls.
- Secure time/NTP.
- HSM/KMS ceremony.
- Customer audit evidence.
- Lawful access transparency.
- DR tabletop and red-team exercises.
- Awareness training for vishing/deepfake risk.
- Sovereign residency review.
- Forensic chain-of-custody.
- AI governance.
- Business continuity for climate/cloud/energy risks.
- Privacy transfer impact assessments.
- PCI/SWIFT adjacent compliance where applicable.
- Cloud detection playbooks.
- ISAC memberships.
- Registrar homograph policy.
- eDiscovery counsel.
- Export-control counsel.

Security claim rule:

- Do not represent external obligations as completed based only on repository artifacts.

## 34. Appendix: File Reference Index

Core runtime:

- `src/proxy.ts`
- `src/lib/auth/proxy-path-policy.ts`
- `src/lib/supabase/server.ts`
- `src/lib/access-control.ts`
- `src/lib/permissions.ts`
- `src/lib/security/api-guards.ts`
- `src/lib/product-surface/api-workspace-guard.ts`
- `src/lib/v4/api-auth.ts`
- `src/lib/v6/api-auth.ts`

Security primitives:

- `src/lib/security/cron-auth.ts`
- `src/lib/security/cron-route-gate.ts`
- `src/lib/security/secret-compare.ts`
- `src/lib/security/token-crypto.ts`
- `src/lib/security/step-up-cookie.ts`
- `src/lib/security/read-json-body-limited.ts`
- `src/lib/security/json-content-type.ts`
- `src/lib/security/sec-fetch-policy.ts`
- `src/lib/security/safe-fetch.ts`
- `src/lib/security/url-policy.ts`
- `src/lib/security/redirect.ts`
- `src/lib/security/worker-url.ts`
- `src/lib/security/upload-filename.ts`
- `src/lib/security/validation.ts`
- `src/lib/security/safe-external-href.ts`
- `src/lib/security/simple-markdown-sanitize.ts`
- `src/lib/security/svg-css-subresource-guard.ts`
- `src/lib/security/strip-prototype-pollution.ts`
- `src/lib/security/bidi-homograph.ts`
- `src/lib/security/inbound-automation-token.ts`
- `src/lib/security/inbound-email-signing.ts`
- `src/lib/security/slack-signing.ts`
- `src/lib/security/inbound-org-allowlist.ts`
- `src/lib/security/audit-write.ts`
- `src/lib/security/kill-switches.ts`

User-facing security:

- `src/app/(dashboard)/settings/security/page.tsx`
- `src/components/settings/security-settings-panel.tsx`
- `src/actions/mfa.ts`
- `src/actions/sessions.ts`
- `src/actions/auth.ts`
- `src/app/(marketing)/security/page.tsx`
- `public/.well-known/security.txt`

High-risk routes:

- `src/app/api/settings/step-up/route.ts`
- `src/app/api/me/export/route.ts`
- `src/app/api/me/account/route.ts`
- `src/app/api/internal/debugging-sweep/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/integrations/oauth/start/route.ts`
- `src/app/api/integrations/oauth/callback/route.ts`
- `src/app/api/external-actions/[token]/status/route.ts`
- `src/app/api/external-actions/[token]/submit/route.ts`
- `src/app/api/external-actions/[token]/participant/workflow-step/route.ts`

Database:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/021_security_hardening_auth_and_keys.sql`
- `supabase/migrations/041_v4_security_hardening.sql`
- `supabase/migrations/057_v10_runtime_contracts.sql`
- `supabase/migrations/060_security_program_rls_wave_marker.sql`
- `supabase/migrations/061_org_mfa_required.sql`
- `supabase/migrations/062_profile_legal_hold.sql`
- `supabase/migrations/063_contract_operational_dates_security_invoker.sql`

CI and governance:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/semgrep-sarif.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/security-audit-weekly.yml`
- `.github/workflows/trivy-fs.yml`
- `.gitleaks.toml`
- `semgrep/oblixa-security.yml`
- `config/security-enforcement-matrix.json`
- `config/security-coverage-ledger.json`
- `config/security-external-obligations.json`
- `artifacts/security-route-matrix.json`
- `artifacts/security-proxy-matrix.json`
