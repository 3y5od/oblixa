# User-Facing Interactions Autonomous Implementation Checklist

This checklist covers implementation work that can be completed autonomously in code to ensure user-facing interactions work correctly and appear as intended across routes, components, workflows, accessibility states, visual states, permissions, data states, and CI gates.

This checklist intentionally excludes:

- documentation-only work
- external account setup, secret provisioning, DNS, hosting-console changes, or branch-protection changes outside the repository
- manual QA procedures that cannot be encoded in tests, scripts, fixtures, or CI
- ad hoc production data repair or one-off console operations

## Scope

Use this document for changes that can be completed by editing:

- `src/`
- `e2e/`
- `scripts/`
- `config/`
- `artifacts/`
- `supabase/migrations/`
- `.github/workflows/`
- repo-root test, lint, security, performance, and build configuration

## Status Legend

- `[ ]` not implemented
- `[x]` implemented

## 1. Canonical Surface Inventory

- [ ] Add `/settings/security` to `src/lib/qa/ui-surface-manifest.source.mjs`.
Objective: close the current gap where the filesystem contains a user-facing page that is absent from the generated surface manifest.
Done when: generated public/authenticated route matrices include `/settings/security` where appropriate and manifest consistency checks fail if it is removed accidentally.

- [ ] Make `UI_SURFACE_MANIFEST` the canonical user-facing route inventory.
Objective: every page route must have mode, shell family, workspace tier, expected heading, visit path, visual tier, a11y tier, smoke tier, and owner metadata.
Done when: every `src/app/**/page.tsx` route maps to exactly one manifest row or an explicit machine-readable non-user-facing exemption.

- [ ] Add a filesystem-to-manifest drift check.
Objective: prevent any new `page.tsx` file from being omitted from route coverage.
Done when: `npm run check:ui-surface-consistency` fails on missing, duplicate, stale, or orphaned manifest rows.

- [ ] Add a route-inventory-to-manifest drift check.
Objective: keep `ROUTE_INVENTORY`, workspace-mode policy, generated E2E routes, visual route lists, and UI manifest aligned.
Done when: a route cannot be added to one source of truth without either adding it everywhere required or declaring a typed exemption.

- [ ] Add a route-state-manifest-to-page drift check.
Objective: every user-facing route must have declared loading, error, not-found, denied, empty, and degraded-state expectations where applicable.
Done when: route-state coverage fails for missing required state entries.

- [ ] Add sidebar, header, command palette, more-tools, and deep-link parity checks.
Objective: navigation entry points must not advertise unavailable routes or hide available primary surfaces.
Done when: route inventory, nav model, command palette actions, more-tools cards, and workflow destination helpers are checked together.

- [ ] Add generated route fixture metadata for dynamic pages.
Objective: dynamic routes must be tested with deterministic fixture IDs instead of omitted from generated smoke/a11y/visual paths.
Done when: `/contracts/[id]`, `/campaigns/[id]`, `/decisions/[id]`, `/accounts/[key]`, `/counterparties/[key]`, `/assurance/findings/[id]`, and `/assurance/control-policies/[id]` each have seeded visit paths.

- [ ] Require route owner metadata for every surface.
Objective: automated reports must show who owns route failures, missing states, and waivers.
Done when: route inventory output includes owner, expiry, and escalation metadata for every user-facing route.

## 2. Interaction Inventory

- [ ] Generate an interaction manifest from client components and pages.
Objective: identify every button, form, link, disclosure, dialog trigger, command-palette action, keyboard shortcut, client fetch, server action, and destructive mutation.
Done when: a script outputs all interactions with route, component, action type, target API/action, permission requirement, telemetry event, and test coverage.

- [ ] Fail CI on unowned interactions.
Objective: every user-visible interaction must have an owner and expected behavior.
Done when: newly added interactive controls fail checks unless they are present in the interaction manifest or explicitly exempted.

- [ ] Fail CI on untested interactions.
Objective: every interaction must have at least one direct UI test or E2E test, with stricter requirements for destructive and mutating actions.
Done when: interaction rows expose `ui_test`, `e2e_test`, and `api_contract_test` fields and checks fail if required fields are absent.

- [ ] Classify interactions by risk.
Objective: destructive, financial, security, bulk, external-delivery, data-export, and irreversible actions require stronger confirmation and verification.
Done when: the manifest distinguishes low, medium, high, and critical interactions and applies tier-specific gates.

- [ ] Add a raw client-fetch audit.
Objective: browser mutations must use approved helpers that standardize status handling, auth handling, timeouts, idempotency, and telemetry.
Done when: raw `fetch()` in client components fails unless it is an allowlisted read-only, fire-and-forget, or instrumentation path.

- [ ] Add a raw navigation audit.
Objective: direct `window.location` and `router.push` usage must be safe, test-covered, and typed.
Done when: imperative navigation is routed through safe helpers or allowlisted with test coverage.

- [ ] Add a `_blank` link audit.
Objective: external and API-support links must use safe link behavior and visible labels.
Done when: all `_blank` links use a shared `ExternalLink` or `ApiJsonLink` primitive with safe `rel` attributes.

## 3. Shared Mutation System

- [ ] Introduce a single browser mutation abstraction over `mutateV10` and `fetchJson`.
Objective: all user-triggered mutations receive consistent idempotency, timeout, retry, status, and telemetry behavior.
Done when: mutating client components no longer hand-roll response parsing, error copy, or pending state.

- [ ] Add default idempotency keys to all browser mutations that call idempotent endpoints.
Objective: double-clicks, retries, and flaky networks must not duplicate work.
Done when: approved mutation helpers attach `x-idempotency-key` and tests assert replay/conflict behavior.

- [ ] Add client request IDs to all browser mutations.
Objective: user-visible failures must correlate with server logs, audit events, and Sentry breadcrumbs.
Done when: mutation helpers attach `x-client-request-id` and UI status can display or log a redacted diagnostic reference.

- [ ] Add abort and timeout handling to all browser mutations.
Objective: long-running requests must not leave controls permanently busy or silently fail.
Done when: every mutation helper returns typed timeout, aborted, and network-failure states with user-visible recovery copy.

- [ ] Add duplicate-submit protection to all mutation controls.
Objective: repeated clicks or Enter presses must not create multiple concurrent actions.
Done when: button/form controls disable while pending and tests cover double-click/double-submit behavior.

- [ ] Add consistent success handling.
Objective: users must receive confirmation that an action completed and know what changed.
Done when: mutation helper consumers show success copy, refresh affected data, and restore focus predictably.

- [ ] Add consistent recoverable error handling.
Objective: 401, 403, 409, 422, 429, timeout, network failure, stale version, invalid JSON, and 500 responses must produce actionable user copy.
Done when: every mutation error path maps through shared recovery-state logic and has component tests.

- [ ] Add consistent partial-success handling.
Objective: bulk actions must show processed, skipped, failed, and retryable counts.
Done when: bulk mutation components expose partial outcomes instead of only success/failure.

- [ ] Add stale-data recovery.
Objective: users must be told when data changed underneath them and how to refresh or retry safely.
Done when: stale-version and conflict responses show refresh-first copy and avoid unsafe repeated mutations.

- [ ] Add offline/network recovery.
Objective: browser network failures must produce retry guidance without implying server failure.
Done when: fetch rejection tests verify offline copy and retry affordances.

## 4. Shared UI Primitives

- [ ] Add `AsyncActionButton`.
Objective: standardize loading labels, disabled behavior, `aria-busy`, icons, spinner policy, and status linkage.
Done when: mutation buttons can be refactored to one primitive without losing variant styling.

- [ ] Add `ConfirmActionButton`.
Objective: destructive or irreversible actions require a consistent confirmation flow.
Done when: delete, revoke, rollback, close, reject, disable, pause, retry-bulk, publish, and regenerate actions use the primitive.

- [ ] Add `InlineMutationStatus`.
Objective: success, error, warning, partial, retryable, and denied statuses render consistently and accessibly.
Done when: action components stop inventing local status markup.

- [ ] Add `LiveRegion`.
Objective: screen readers must receive pending, success, and error updates.
Done when: all mutating forms/buttons use polite or assertive live regions according to severity.

- [ ] Add `FieldError`.
Objective: form errors must consistently connect inputs to visible error copy.
Done when: invalid fields use stable IDs, `aria-describedby`, and `aria-invalid`.

- [ ] Add `ValidationSummary`.
Objective: multi-field forms must summarize blocking errors before submit.
Done when: complex forms expose a keyboard-reachable error summary with links or references to invalid fields.

- [ ] Add `ExternalLink`.
Objective: external links must be safe, styled consistently, and visibly marked when they leave the app or open a new tab.
Done when: `_blank` links are centralized and audited.

- [ ] Add `ApiJsonLink`.
Objective: support/debug JSON routes must not look like primary product actions.
Done when: API JSON links have consistent labels, icons, target behavior, and permission-aware visibility.

- [ ] Add `RouteStateShell`.
Objective: loading, empty, denied, not-found, error, stale, and partial states must share layout, heading, recovery actions, and accessibility behavior.
Done when: route-state components use one primitive or compatible wrappers.

- [ ] Add `PermissionEligibilityHint`.
Objective: disabled or hidden controls must explain permission and workspace-mode requirements where safe.
Done when: viewer/member/admin/workspace-mode gates render predictable hints.

## 5. Forms And Validation

- [ ] Audit every form field for visible label coverage.
Objective: inputs, selects, textareas, checkboxes, radio groups, and custom controls must be accessible by name.
Done when: a script and UI tests fail on unlabeled form controls.

- [ ] Add `aria-describedby` coverage for helper and error text.
Objective: users and assistive tech must receive constraints and validation feedback.
Done when: every validation-capable field links to helper or error text.

- [ ] Add `aria-invalid` on invalid fields.
Objective: field-level validation state must be machine-readable.
Done when: failing fields expose `aria-invalid=true` in tests.

- [ ] Add autocomplete and input-mode audits.
Objective: auth, billing, email, date, numeric, URL, and token fields must expose appropriate browser hints.
Done when: forms fail checks if common field types omit safe autocomplete/input mode.

- [ ] Add submit-pending state to server-action forms.
Objective: forms using `useActionState`, `formAction`, or server actions must prevent duplicate submissions.
Done when: submit controls reflect `useFormStatus` or equivalent pending state.

- [ ] Add validation summary to bulk and multi-section forms.
Objective: complex forms must guide users to all blocking errors.
Done when: upload, operations settings, product calibration, external submission, policy simulation, and review-board forms surface grouped validation.

- [ ] Add invalid JSON editor handling.
Objective: JSON textareas must validate before submit and avoid sending malformed payloads.
Done when: campaign assignment, workflow config, policy simulation, and settings JSON editors show inline parse errors.

- [ ] Add file upload validation.
Objective: upload flows must validate type, size, empty file, duplicate file, and server rejection paths.
Done when: contract upload and bulk upload tests cover each rejection path.

- [ ] Add date/time validation.
Objective: date, deadline, SLA, recurrence, token expiry, and reminder fields must reject invalid or ambiguous values.
Done when: date inputs have tests for invalid, timezone-sensitive, past/future, and boundary values.

## 6. Destructive And High-Risk Actions

- [ ] Require confirmation for delete-contract actions.
Objective: contract deletion must not be triggered by accidental click or keyboard activation.
Done when: deletion requires confirmation, shows target identity, and verifies server result.

- [ ] Require confirmation for invite revoke and API key revoke actions.
Objective: access-control changes must be intentional and recoverable where possible.
Done when: revocation controls use confirmation and inline status.

- [ ] Require confirmation for campaign rollback, close, pause, resume, and start.
Objective: campaign lifecycle transitions must communicate impact and prevent accidental execution.
Done when: lifecycle buttons use confirmation for risky transitions and tests cover denied/failed paths.

- [ ] Require confirmation for evidence rejection and approval override.
Objective: review outcomes must not be accidental or ambiguous.
Done when: evidence actions show target, outcome, optional reason, and result status.

- [ ] Require confirmation for approval reject and changes-requested actions.
Objective: approval workflows must preserve user intent and context.
Done when: reject/change flows require reason input when policy demands it.

- [ ] Require confirmation for report/job retry actions.
Objective: retries must not duplicate long-running work without user awareness.
Done when: retry controls explain idempotency, previous status, and expected result.

- [ ] Require confirmation for policy publish and simulation promotion.
Objective: policy-affecting actions must be deliberate.
Done when: publish/promote buttons summarize affected scope before mutation.

- [ ] Require confirmation for MFA policy changes and security-sensitive operations.
Objective: security settings must avoid accidental organization-wide changes.
Done when: sensitive controls require confirmation and step-up where applicable.

## 7. Route States

- [ ] Add loading state coverage for every user-facing route.
Objective: every page must render a stable, accessible loading state.
Done when: generated route-state tests cover all routes with loading UI or explicit non-applicable exemptions.

- [ ] Add empty state coverage for every data list.
Objective: empty datasets must explain what is missing and what action is available.
Done when: contracts, tasks, obligations, approvals, renewals, exceptions, reports, campaigns, decisions, assurance, settings, accounts, and counterparties all have tested empty states.

- [ ] Add denied state coverage for every permission-gated route.
Objective: users without access must see clear, safe, non-leaky denial copy.
Done when: viewer/member/admin/workspace-mode test fixtures validate route and control denial states.

- [ ] Add not-found state coverage for every dynamic route.
Objective: missing IDs must not crash or leak tenant data.
Done when: dynamic detail pages return safe not-found states under missing and cross-org IDs.

- [ ] Add partial-data state coverage.
Objective: pages with multiple backend queries must degrade gracefully when one query fails.
Done when: dashboards, reports, assurance, health, work, and contract detail pages can render partial data with explicit warnings.

- [ ] Add stale-data state coverage.
Objective: users must know when data may be outdated and how to refresh.
Done when: route state components can display stale timestamps and refresh actions.

- [ ] Add terminal-error state coverage.
Objective: route errors must provide recovery actions and safe diagnostics.
Done when: error boundaries and route-state panels have visual and a11y coverage.

- [ ] Add onboarding-blocking state coverage.
Objective: calibration-required users must receive consistent blocking, resume, and completion paths.
Done when: onboarding gate states are covered in route and interaction tests.

## 8. Accessibility

- [ ] Add axe coverage for all generated public routes.
Objective: public surfaces must have zero serious or critical axe violations.
Done when: route matrices drive axe tests without hand-maintained omissions.

- [ ] Add axe coverage for all generated authenticated routes.
Objective: core, advanced, assurance, utility, and settings surfaces must pass serious/critical axe checks with seeded auth.
Done when: authenticated axe tests run from generated route matrices.

- [ ] Add axe coverage for route states.
Objective: loading, error, denied, empty, and not-found states must be accessible.
Done when: route-state visual/a11y tests cover all state families.

- [ ] Add keyboard-only path coverage.
Objective: navigation, command palette, forms, dialogs, drawers, disclosures, tables, pagination, and destructive confirmations must be operable without a mouse.
Done when: Playwright tests use keyboard navigation and assertions for focus order and activation.

- [ ] Add focus-trap coverage for dialogs and drawers.
Objective: mobile navigation and command palette must not leak focus behind overlays.
Done when: tests verify initial focus, cycling, Escape close, overlay close, and focus restoration.

- [ ] Add skip-link coverage across shells.
Objective: users must be able to bypass repeated navigation.
Done when: marketing, auth, dashboard, and external shells expose functional skip links.

- [ ] Add heading hierarchy checks.
Objective: every route must have one meaningful H1 and coherent section headings.
Done when: page-heading and route-heading checks cover all surfaces.

- [ ] Add landmark checks.
Objective: every shell must expose main, nav, header, footer, search, and complementary landmarks appropriately.
Done when: shell-landmark tests cover route families and responsive variants.

- [ ] Add reduced-motion checks.
Objective: motion-sensitive users must not receive unnecessary animation.
Done when: tests verify drawer, palette, wizard, skeleton, spinner, and page-load behavior under `prefers-reduced-motion`.

- [ ] Add color contrast checks.
Objective: text, status chips, buttons, focus rings, disabled controls, and alerts must remain readable.
Done when: automated color-vision and contrast tests cover core visual states.

- [ ] Add zoom and reflow checks.
Objective: 200% zoom and narrow viewports must not hide or overlap critical controls.
Done when: Playwright viewport/zoom tests cover all route families.

- [ ] Add screen-reader status semantics.
Objective: live updates must use `status` or `alert` consistently.
Done when: mutation status, loading states, validation summaries, and error panels expose correct roles.

## 9. Responsive And Visual Quality

- [ ] Require desktop visual baselines for all primary routes.
Objective: visual regressions must be detected before release.
Done when: public, auth, dashboard, contracts, work, reports, settings, campaigns, decisions, assurance, external, loading, and error states have snapshots.

- [ ] Require mobile visual baselines for all primary routes.
Objective: mobile layout regressions must be detected before release.
Done when: generated route matrices include Pixel-sized screenshots for core surfaces and critical workflows.

- [ ] Require tablet visual baselines for all primary routes.
Objective: tablet-specific overflow and drawer behavior must be covered.
Done when: iPad-sized screenshots are generated for route families.

- [ ] Add visual baselines for empty, denied, partial, and error states.
Objective: non-happy-path states must look intentional.
Done when: route-state snapshots cover every state family.

- [ ] Add long-text visual tests.
Objective: user-generated contract titles, counterparty names, notes, reasons, URLs, and emails must wrap safely.
Done when: seeded long strings do not break cards, tables, nav, or dialogs.

- [ ] Add high-density data visual tests.
Objective: large tables and queues must remain usable.
Done when: seeded pages with many rows preserve spacing, pagination, sticky controls, and overflow behavior.

- [ ] Add narrow viewport overflow audit.
Objective: no horizontal page overflow except intentional scroll containers.
Done when: Playwright checks fail on body-level horizontal overflow.

- [ ] Add print/export visual checks where pages expose printable reports.
Objective: user-visible exported/printed layouts must not collapse.
Done when: report and packet surfaces have print-media smoke coverage or explicit exemptions.

## 10. Navigation And Search

- [ ] Add sidebar route parity tests.
Objective: visible nav links must match route inventory and user permissions.
Done when: sidebar tests cover core, advanced, assurance, utility, collapsed, expanded, and mobile states.

- [ ] Add mobile navigation drawer tests.
Objective: drawer open/close, overlay, focus trap, and route-click close behavior must be reliable.
Done when: keyboard and pointer tests cover mobile navigation.

- [ ] Add command-palette action parity tests.
Objective: command search must expose valid destinations and hide denied surfaces.
Done when: command actions are generated from route/workflow inventory and tested for no-result, result, keyboard, and navigation paths.

- [ ] Add command-palette network-state tests.
Objective: search API failure, timeout, empty result, and invalid response must render recoverable states.
Done when: Playwright or component tests mock command API status classes.

- [ ] Add header search tests.
Objective: workspace search must open command palette, pass query, and preserve focus semantics.
Done when: header tests cover submit, keyboard shortcut, no query, and no-match states.

- [ ] Add breadcrumbs or continuity-link parity tests where continuity links exist.
Objective: route-to-route context links must stay valid.
Done when: contract, evidence, report, work, relationship, and assurance continuity links have href validation.

- [ ] Add post-auth redirect tests.
Objective: users must land on safe intended pages after login, MFA, reset, and callback flows.
Done when: auth redirect helpers and E2E flows cover safe, unsafe, missing, and expired destination values.

## 11. Authentication, Session, And MFA

- [ ] Add E2E coverage for login success.
Objective: credentialed users can sign in and reach the dashboard.
Done when: login flow passes with seeded credentials and asserts shell state.

- [ ] Add E2E coverage for invalid login.
Objective: bad credentials show safe, helpful error copy.
Done when: invalid email/password tests assert no crash and no secret leakage.

- [ ] Add E2E coverage for signup.
Objective: account creation path renders and handles validation/server states.
Done when: signup tests cover empty, invalid, duplicate, and accepted states with mocked or seeded provider behavior.

- [ ] Add E2E coverage for forgot password.
Objective: reset request flow shows safe confirmation without leaking account existence.
Done when: flow tests cover valid and invalid email shapes.

- [ ] Add E2E coverage for reset password.
Objective: password reset page handles missing token, invalid token, weak password, and success.
Done when: reset-password tests validate user-visible states.

- [ ] Add E2E coverage for logout.
Objective: sign-out must clear session state and route safely.
Done when: logout button/action leads to public or login surface with no authenticated shell.

- [ ] Add session-expired mutation tests.
Objective: expired sessions must show sign-in recovery copy instead of raw errors.
Done when: client mutation tests cover 401 and 403 responses.

- [ ] Add MFA-required flow tests.
Objective: users redirected to `/settings/security?mfa=required` must see enrollment guidance and TOTP state.
Done when: settings security E2E covers required-banner and TOTP panel rendering.

- [ ] Add MFA enrollment tests.
Objective: TOTP setup, challenge, verification failure, success, and existing-factor states must work.
Done when: `SecuritySettingsPanel` has direct tests and route-level smoke coverage.

- [ ] Add step-up tests for sensitive settings.
Objective: security-sensitive mutations must require appropriate assurance level.
Done when: step-up API and UI states are covered for insufficient and sufficient AAL.

## 12. Permissions And Workspace Modes

- [ ] Add seeded role fixtures.
Objective: viewer, member, admin, owner, and no-membership users must be testable without external setup.
Done when: E2E and route tests can switch role context deterministically.

- [ ] Add seeded workspace-mode fixtures.
Objective: core, advanced, assurance, utility, and disabled modes must be testable.
Done when: routes and nav can be tested under each workspace mode.

- [ ] Add permission denial coverage for every route.
Objective: denied users must see safe UI and must not access hidden data.
Done when: route tests cover mode/role denial for every gated page.

- [ ] Add permission denial coverage for every interaction.
Objective: unauthorized users must not see executable controls or must see disabled controls with clear reasons.
Done when: interaction manifest rows include permission tests.

- [ ] Add API/UI permission parity tests.
Objective: UI visibility must match server enforcement.
Done when: a user who cannot see a control also receives 401/403 from direct API calls, and vice versa.

- [ ] Add workspace-required coverage.
Objective: users without workspace context must see a consistent recovery state.
Done when: all dashboard routes render `WorkspaceRequiredState` or typed equivalents.

- [ ] Add billing/tier gating coverage.
Objective: plan-limited users must receive upgrade or eligibility states instead of broken links.
Done when: billing and workspace-mode gates have route and interaction tests.

## 13. Data Fixtures And Determinism

- [ ] Add deterministic seed data for all route families.
Objective: E2E tests must not skip because rows are absent.
Done when: seeded fixtures create contract, task, obligation, approval, renewal, exception, evidence request, report run, campaign, decision, account, counterparty, assurance finding, control policy, scorecard, playbook, review board, and notification rows.

- [ ] Add seed reset helpers.
Objective: tests must run repeatedly without state pollution.
Done when: setup/teardown can reset seeded org/user data safely.

- [ ] Add fixture IDs to generated route matrices.
Objective: dynamic page tests must avoid hard-coded brittle values.
Done when: generated routes use fixture aliases resolved during E2E setup.

- [ ] Add fixture health checks.
Objective: E2E should fail early with clear fixture errors instead of skipping late.
Done when: fixture preflight validates required users, orgs, permissions, and rows.

- [ ] Add no-data fixtures.
Objective: empty-state testing must be deterministic.
Done when: each route family has an empty seeded workspace or query marker.

- [ ] Add high-data fixtures.
Objective: pagination, overflow, and performance must be testable.
Done when: large queues and tables can be seeded behind a controlled test flag.

- [ ] Add cross-org isolation fixtures.
Objective: detail pages and APIs must reject foreign IDs.
Done when: seeded foreign rows verify not-found/forbidden behavior.

## 14. Component Test Expansion

- [ ] Add direct UI tests for every component with `fetch()`.
Objective: network-backed components must cover success, error, timeout, invalid JSON, and denied states.
Done when: all client-fetch components have direct tests or are refactored through tested shared primitives.

- [ ] Add direct UI tests for every component with server actions.
Objective: server-action forms must cover pending, success, error, validation, and duplicate-submit states.
Done when: all `useActionState`, `formAction`, and server-action forms have UI tests.

- [ ] Add direct UI tests for every destructive action component.
Objective: high-risk controls must verify confirmation, cancellation, success, failure, and focus behavior.
Done when: delete, revoke, close, rollback, reject, disable, retry, publish, and promotion controls are tested.

- [ ] Add direct UI tests for shared layout.
Objective: header, sidebar, command palette, footer, skip link, and workspace-required states must be stable.
Done when: each layout component has desktop, mobile, keyboard, permission, and route-active tests.

- [ ] Add direct UI tests for route-state primitives.
Objective: loading, empty, denied, error, partial, stale, and not-found rendering must be reusable and test-covered.
Done when: state primitives have snapshot-free semantic tests.

- [ ] Add direct UI tests for upload components.
Objective: file input behavior must be reliable and accessible.
Done when: upload components cover file selection, invalid file, multiple files, pending, and server failure.

- [ ] Add direct UI tests for table components.
Objective: sorting, filtering, pagination, row actions, empty rows, and overflow controls must be tested.
Done when: core table/list components have interaction tests.

## 15. E2E Workflow Coverage

- [ ] Add full auth workflow E2E.
Objective: users can sign up, sign in, reset password, sign out, and recover from expired sessions.
Done when: auth workflow tests run deterministically with mocked or seeded provider behavior.

- [ ] Add contract creation E2E.
Objective: users can create or upload a contract and see it appear in the list/detail view.
Done when: create/upload flow asserts persisted title, status, and navigation.

- [ ] Add bulk import E2E.
Objective: users can upload CSV, see job status, inspect errors, retry failed rows, and recover from invalid files.
Done when: bulk import tests cover success, partial, failure, retry, and job-detail states.

- [ ] Add contract review E2E.
Objective: reviewers can approve/reject fields and understand pending critical fields.
Done when: review queue and field review paths cover accept, reject, required missing fields, and save-next behavior.

- [ ] Add task workflow E2E.
Objective: users can filter, create, assign, update status, and save task views.
Done when: task queue tests cover filters, saved view creation, row action, denied state, and empty state.

- [ ] Add obligation workflow E2E.
Objective: users can update obligation owner/status/evidence requirements and see results.
Done when: obligation panel and queue interactions are covered.

- [ ] Add approval workflow E2E.
Objective: users can approve, reject, request changes, and view SLA/workload states.
Done when: approval actions show correct outcomes and refresh behavior.

- [ ] Add renewal workflow E2E.
Objective: users can update checkpoints, decisions, reminders, and renewal status.
Done when: renewal rows, checklist actions, and checkpoint panel are covered.

- [ ] Add exception workflow E2E.
Objective: users can assign, resolve, reopen, and filter exceptions.
Done when: exception panels and exception ledger actions are covered.

- [ ] Add evidence workflow E2E.
Objective: users can request evidence, external users can submit, reviewers can approve/reject, and exports work.
Done when: internal and external evidence paths are covered with token fixtures.

- [ ] Add report workflow E2E.
Objective: users can view reports, inspect run failures, retry runs, export data, and navigate report destinations.
Done when: reports pages and report-run retry routes are covered.

- [ ] Add settings workflow E2E.
Objective: users can edit profile, org, invites, billing actions, security, operations, policy, health, and product calibration surfaces.
Done when: settings routes have interaction tests for success, denied, validation, and provider-failure states.

- [ ] Add campaign workflow E2E.
Objective: users can create, preview, start, pause, resume, close, rollback, assign rows, and inspect JSON support routes.
Done when: campaign lifecycle and assignment panels are covered.

- [ ] Add decision workflow E2E.
Objective: users can create decisions, review packets, approve/recommend/close, compare, and inspect context.
Done when: decision queue/detail/review/compare paths are covered.

- [ ] Add assurance workflow E2E.
Objective: users can view findings, resolve findings, assign control policies, run checks, approve playbooks, manage review boards, and inspect health graph.
Done when: assurance route family workflows are covered.

- [ ] Add relationship workspace E2E.
Objective: account and counterparty pages load, link to support summaries, and handle missing keys safely.
Done when: relationship routes cover happy, missing, and cross-org cases.

- [ ] Add external token E2E.
Objective: external users can submit required responses and see expired/invalid/used token states.
Done when: external submission covers all action types and token-state outcomes.

## 16. API Status And Network Mocking

- [ ] Add browser-level API mock tests for 400 responses.
Objective: validation failures must show user-correctable messages.
Done when: forms and buttons display field or summary errors.

- [ ] Add browser-level API mock tests for 401 and 403 responses.
Objective: auth and permission failures must show sign-in or permission guidance.
Done when: route and mutation components map auth failures consistently.

- [ ] Add browser-level API mock tests for 404 responses.
Objective: missing records must show not-found or stale-data recovery.
Done when: detail and action flows handle missing target IDs.

- [ ] Add browser-level API mock tests for 409 responses.
Objective: conflicts and idempotency payload conflicts must show refresh-first guidance.
Done when: mutation components avoid unsafe repeat attempts.

- [ ] Add browser-level API mock tests for 422 responses.
Objective: semantic validation failures must be actionable.
Done when: components show field-specific or summary validation copy.

- [ ] Add browser-level API mock tests for 429 responses.
Objective: rate limits must prevent rapid retries and show wait guidance.
Done when: retry affordances are disabled or delayed as appropriate.

- [ ] Add browser-level API mock tests for 500 and 503 responses.
Objective: server and dependency failures must show safe retry or support copy.
Done when: technical details are redacted and diagnostics are retained.

- [ ] Add browser-level API mock tests for invalid JSON.
Objective: malformed responses must not crash clients.
Done when: response parsers return safe fallback errors.

- [ ] Add browser-level API mock tests for empty success bodies.
Objective: 204/empty-body success must not be treated as invalid.
Done when: client helpers handle empty success consistently.

- [ ] Add browser-level API mock tests for network failure.
Objective: rejected fetches must produce offline/retry copy.
Done when: client mutations handle `TypeError`, aborted requests, and load failures.

## 17. Observability And Telemetry

- [ ] Add product-surface telemetry for every user-visible mutation.
Objective: success, denial, validation, conflict, retryable, terminal, and partial outcomes must be observable.
Done when: interaction manifest rows map to telemetry events and tests assert emission or safe no-op.

- [ ] Add visible-error telemetry for every route family.
Objective: user-facing failures must be counted without leaking PII.
Done when: error boundaries, route-state panels, and mutation statuses emit redacted events.

- [ ] Add Sentry breadcrumb coverage for navigation and mutations.
Objective: support can reconstruct user journeys leading to failures.
Done when: route transitions and interaction outcomes create scoped breadcrumbs.

- [ ] Add request correlation to client/server flows.
Objective: UI failure, API response, and server log must share a request or client ID.
Done when: tests verify correlation headers and response diagnostics.

- [ ] Add telemetry suppression for sensitive fields.
Objective: tokens, contract content, notes, emails, raw JSON payloads, and secrets must not be emitted.
Done when: redaction tests cover mutation and route telemetry.

- [ ] Add telemetry coverage checks.
Objective: new interactions must declare telemetry behavior.
Done when: interaction manifest fails if mutating interactions lack telemetry classification.

## 18. Performance And Stability

- [ ] Add route-level performance budgets.
Objective: primary routes must stay within budget for server response, LCP proxy, CLS, interaction latency, and JS size.
Done when: budgets are encoded in scripts and CI artifacts.

- [ ] Add CLS checks for loading states.
Objective: skeletons and async content must not shift layouts excessively.
Done when: route-state visual/perf tests fail on layout shift regressions.

- [ ] Add mobile performance checks.
Objective: small viewports must remain usable and responsive.
Done when: mobile route smoke includes performance marks and overflow checks.

- [ ] Add command-palette latency checks.
Objective: search interactions must remain responsive with large route/action lists.
Done when: local filtering and remote search have performance assertions.

- [ ] Add table/list render checks.
Objective: large queues must not freeze the browser.
Done when: seeded high-row tests measure initial render and filter latency.

- [ ] Add memory smoke checks for core workflows.
Objective: navigation between major surfaces must not leak obvious memory.
Done when: optional memory tests become deterministic enough for nightly.

- [ ] Add bundle budget gates by route family.
Objective: large shared components must not inflate all routes.
Done when: route chunks and shared client bundles are measured and budgeted.

- [ ] Split oversized components and pages.
Objective: reduce bug density and improve testability of large UI files.
Done when: current complexity offenders are below thresholds or decomposed behind clear waivers.

## 19. Security And Privacy In User Interactions

- [ ] Add client-side safe-link enforcement.
Objective: external URLs, API JSON links, and user-supplied hrefs must be sanitized and labeled.
Done when: links use safe helpers and unsafe schemes are rejected.

- [ ] Add user-generated-content rendering tests.
Objective: notes, names, titles, reasons, comments, and JSON previews must not execute markup or break layout.
Done when: XSS-like strings render as text and remain visually contained.

- [ ] Add clipboard/download safety tests.
Objective: exports, downloads, and copied text must not leak formulas, tokens, or hidden fields.
Done when: CSV formula protection, filename safety, and export scope checks are covered.

- [ ] Add sensitive-action step-up checks.
Objective: security, billing, API key, MFA, webhook, and integration actions must enforce current assurance requirements.
Done when: UI and API tests agree on step-up requirements.

- [ ] Add private-cache checks for user-facing APIs consumed by the UI.
Objective: sensitive API responses must not be cached by browsers or shared intermediaries.
Done when: API contract tests assert `no-store`/private headers where required.

- [ ] Add safe diagnostic display tests.
Objective: user-visible diagnostics must help support without leaking internals.
Done when: errors show diagnostic IDs, not stack traces, SQL, bearer tokens, or raw provider errors.

## 20. Import, Export, Report, And File Workflows

- [ ] Harden contract upload UI.
Objective: upload state must handle selection, validation, progress, success, extraction queued, partial extraction, and failure.
Done when: upload tests cover each state and route snapshots cover the visual result.

- [ ] Harden bulk import UI.
Objective: CSV import must handle malformed rows, partial success, retryable rows, superseded jobs, and permission denial.
Done when: bulk upload and job retry components have UI and E2E coverage.

- [ ] Harden export UI.
Objective: exports must handle small synchronous exports, async jobs, polling, failed jobs, retry, and download links.
Done when: export buttons and export routes have status tests.

- [ ] Harden report run UI.
Objective: failed, running, succeeded, partial, retried, and disabled report states must be visible.
Done when: report pages and retry routes have state coverage.

- [ ] Harden evidence upload/submission UI.
Objective: internal and external evidence flows must handle required fields, expired tokens, duplicate submission, approval, and rejection.
Done when: evidence components and external submit form cover all branches.

- [ ] Harden JSON support views.
Objective: support/debug JSON links must be safe, permission-aware, and not primary workflow blockers.
Done when: API JSON links use `ApiJsonLink` and route tests assert permission behavior.

## 21. Surface-Specific Implementation Items

- [ ] Harden marketing routes.
Objective: home, privacy, terms, security, accessibility, and cookies pages must pass headings, landmarks, visual, SEO, a11y, and responsive checks.
Done when: generated public route tests cover all public surfaces.

- [ ] Harden auth routes.
Objective: login, signup, forgot password, reset password, and auth error/loading states must handle validation, provider errors, and safe redirects.
Done when: auth form tests and E2E flows cover success and failure states.

- [ ] Harden dashboard home.
Objective: dashboard data panels must handle empty, partial, degraded, stale, and high-signal states.
Done when: dashboard route tests simulate each data state.

- [ ] Harden work queue.
Objective: work inbox filters, bulk actions, inline actions, retry extraction, exception panels, and diagnostics must work with all statuses.
Done when: work route E2E covers happy and failed interaction paths.

- [ ] Harden contracts list.
Objective: search, filters, pagination, saved views, exports, table actions, and empty states must be reliable.
Done when: contract table/list tests cover interactions and route E2E.

- [ ] Harden contract detail.
Objective: tabs, field review, notes, tasks, obligations, evidence, external collaboration, renewal checkpoints, deletion, and exports must work.
Done when: contract detail page is decomposed and each panel has direct tests.

- [ ] Harden contract new/upload.
Objective: upload, manual fields, extraction state, validation, and redirect must work.
Done when: upload form tests and E2E create flow pass.

- [ ] Harden contract bulk.
Objective: CSV import, job listing, retry, error downloads, and status updates must be test-covered.
Done when: bulk page visual, UI, and API-status tests cover states.

- [ ] Harden contract review.
Objective: field review, save-next, telemetry links, critical pending fields, and empty queue must work.
Done when: review page E2E and component tests cover all outcomes.

- [ ] Harden tasks.
Objective: task filters, saved views, row actions, team filters, due dates, and assignment must work.
Done when: tasks page and work queue task actions are covered.

- [ ] Harden obligations.
Objective: obligation panel and queue actions must handle status, owner, evidence, due dates, and errors.
Done when: obligation component and route tests cover all mutation branches.

- [ ] Harden approvals.
Objective: approve, reject, request changes, workload, SLA simulator, and permission states must work.
Done when: approvals E2E covers queue and utility routes.

- [ ] Harden renewals.
Objective: renewal checkpoints, checklist actions, Slack summaries, calendar exports, and reminder states must work.
Done when: renewal components and routes have UI/E2E coverage.

- [ ] Harden exceptions.
Objective: exception assignment, resolve, reopen, detection runs, and filters must work.
Done when: exception panels and route tests cover all statuses.

- [ ] Harden evidence studio.
Objective: evidence requests, submissions, reviews, exports, and external links must work.
Done when: evidence route and external token E2E cover end-to-end flow.

- [ ] Harden reports.
Objective: reports control room, contracts reports, advanced reports, assurance reports, exports, retries, and schedule states must work.
Done when: reports route family has full visual/a11y/interaction coverage.

- [ ] Harden settings.
Objective: profile, org, invites, billing, operations, product, health, policy, and security settings must work under role and workspace constraints.
Done when: each settings route has route, component, and permission tests.

- [ ] Harden campaigns.
Objective: list, detail, compare, simulation promotion, assignment, lifecycle, export, preview, and rollback must work.
Done when: campaign components and APIs have success/error E2E coverage.

- [ ] Harden decisions.
Objective: decision queue, create, detail, review, compare, packet, approve, recommend, close, and context actions must work.
Done when: decision route family has workflow and status coverage.

- [ ] Harden assurance.
Objective: assurance overview, findings, control policies, scorecards, playbooks, review boards, autopilot, segments, program evolution, and health graph must work.
Done when: assurance route family has seeded workflow E2E and component tests.

- [ ] Harden relationship workspaces.
Objective: account/counterparty summary, timelines, support JSON, relationship overview, and missing-key states must work.
Done when: relationship routes have dynamic fixture and not-found coverage.

- [ ] Harden onboarding calibration.
Objective: wizard progress, preview, completion paths, stale state, export, non-dismiss behavior, and route blocking must work.
Done when: onboarding E2E no longer skips because fixture state is absent.

- [ ] Harden external token surface.
Objective: token validation, expired/used/invalid state, submission forms, required acknowledgements, and success page must work.
Done when: external public E2E covers all token states and submission types.

## 22. Backend/UI Consistency

- [ ] Add read-after-write tests for all user-visible mutations.
Objective: UI success must correspond to persisted backend state.
Done when: mutating E2E flows assert post-action data from UI or API.

- [ ] Add RLS parity tests for UI actions.
Objective: direct API calls must enforce the same permissions as UI gates.
Done when: every protected interaction has role-based API tests.

- [ ] Add transaction/idempotency tests for high-risk operations.
Objective: retries and concurrent submissions must not duplicate or corrupt work.
Done when: imports, exports, approvals, evidence, campaigns, reports, and exceptions have idempotency coverage.

- [ ] Add stale-version tests.
Objective: simultaneous edits must not silently overwrite user changes.
Done when: APIs and UI return conflict/stale states for outdated versions.

- [ ] Add background job visibility tests.
Objective: async jobs started from UI must appear in status surfaces.
Done when: imports, exports, report runs, extraction, read-model refresh, and retry jobs have visible state transitions.

- [ ] Add migration-backed fixture checks.
Objective: UI assumptions must match current database schema.
Done when: migration smoke and fixture setup run together in CI.

## 23. Internationalization, Locale, And Time

- [ ] Add pseudo-locale tests.
Objective: expanded strings must not break layouts or truncate critical copy.
Done when: generated routes run under pseudo-locale with no overflow or missing headings.

- [ ] Add RTL tests.
Objective: layout, icons, tables, drawers, and forms must remain usable in right-to-left direction.
Done when: core route snapshots or assertions pass under `dir=rtl`.

- [ ] Add timezone matrix tests.
Objective: due dates, renewal dates, SLA deadlines, report timestamps, and job times must be stable across timezones.
Done when: tests cover at least one negative and one positive UTC offset.

- [ ] Add locale number/date formatting tests.
Objective: currency, percentages, counts, and dates must render predictably.
Done when: formatting helpers and key UI surfaces have locale tests.

- [ ] Add relative-time stability tests.
Objective: live timestamps must not create hydration mismatch or confusing stale text.
Done when: server-rendered and client-rendered date text is stable or explicitly suppressed safely.

## 24. Test Governance And Skip Burn-Down

- [ ] Burn down credential-gated E2E skips.
Objective: CI should run authenticated product workflows using deterministic seeded credentials.
Done when: critical authenticated tests do not skip by default in CI.

- [ ] Burn down fixture-gated E2E skips.
Objective: tests should create or verify required data instead of skipping when rows are absent.
Done when: fixture preflight replaces late runtime skips.

- [ ] Separate non-product lab skips from product skip baseline.
Objective: optional device/browser/lab experiments must not obscure product interaction coverage.
Done when: product skip baseline tracks only user-facing product coverage.

- [ ] Add skip expiry enforcement.
Objective: temporary skips must be removed or renewed deliberately.
Done when: expired skips fail CI with owner and route/action metadata.

- [ ] Add no-new-skip and skip-count-down gates.
Objective: coverage must improve over time.
Done when: CI fails on new product skips and can enforce decreasing skip ceilings.

- [ ] Add flaky-test classification.
Objective: failures must distinguish product regression, fixture issue, environment issue, and test bug.
Done when: Playwright reports include failure taxonomy and rerun metadata.

## 25. CI And Release Gates

- [ ] Add `check:user-facing-interactions`.
Objective: one command must run the full autonomous interaction closure gate.
Done when: the command runs route manifest checks, interaction manifest checks, UI tests, E2E smoke, a11y, route states, visual coverage checks, API mocks, and coverage thresholds.

- [ ] Add `report:user-facing-interactions`.
Objective: CI must produce a machine-readable artifact of remaining gaps.
Done when: artifact lists routes, interactions, tests, visual coverage, a11y coverage, skips, waivers, and owners.

- [ ] Add PR-gated lightweight interaction checks.
Objective: common regressions must be caught quickly.
Done when: PR CI runs drift checks, unit/UI tests for touched surfaces, static audits, and relevant E2E smoke.

- [ ] Add nightly full interaction checks.
Objective: expensive multi-browser, visual, a11y, and fixture-heavy tests must run regularly.
Done when: nightly runs full generated route matrices across browser/device profiles.

- [ ] Add release-candidate strict checks.
Objective: releases must block on complete user-facing coverage.
Done when: RC workflow enforces strict thresholds, no expired waivers, and required visual baselines.

- [ ] Add CI artifact upload for visual diffs, route coverage, interaction coverage, axe results, console errors, network errors, and performance budgets.
Objective: failures must be diagnosable without rerunning locally.
Done when: CI uploads stable artifacts for every interaction gate.

- [ ] Add console-error fail gates.
Objective: user-facing pages must not throw unhandled browser errors.
Done when: E2E fixtures fail on unexpected `pageerror`, console error, failed request, and hydration warnings.

- [ ] Add network-error fail gates.
Objective: route smoke tests must not hide failed API calls.
Done when: Playwright fixtures fail on unexpected 4xx/5xx or failed requests, with allowlists for intentional probes.

- [ ] Add visual baseline completeness gates.
Objective: visual tests must cover all required route/state/device rows.
Done when: CI fails if a required route lacks a committed baseline.

## 26. Coverage Thresholds

- [ ] Raise UI coverage thresholds.
Objective: current UI coverage should move from broad low floors to meaningful per-directory and per-component floors.
Done when: `vitest.ui.config.ts` enforces floors for layout, auth, contracts, dashboard, settings, reports, work, assurance, and shared UI.

- [ ] Raise logic coverage thresholds for user-facing helpers.
Objective: route guards, mutation envelopes, error mappers, auth redirects, and surface inventories must be strongly covered.
Done when: `vitest.config.ts` enforces floors for `src/lib/auth`, `src/lib/product-surface`, `src/lib/http`, `src/lib/errors`, `src/lib/ui`, and `src/actions`.

- [ ] Enforce `coverage-threshold.json` minimums.
Objective: coverage completeness must be release-blocking, not report-only.
Done when: strict mode requires nonzero minimums for registry evidence, runtime evidence, vitest line coverage, and coverage score.

- [ ] Add per-route coverage scoring.
Objective: routes must show missing UI, E2E, visual, a11y, interaction, and state coverage independently.
Done when: coverage reports identify under-covered routes by name.

- [ ] Add per-interaction coverage scoring.
Objective: high-risk actions must be visibly blocked until tested.
Done when: interaction coverage reports classify missing happy, unhappy, permission, network, and visual coverage.

## 27. Component Complexity And Maintainability

- [ ] Refactor `src/app/(dashboard)/contracts/[id]/page.tsx`.
Objective: split contract detail into data loader, route shell, field review section, task section, obligation section, evidence section, renewal section, notes section, and action section.
Done when: each section is independently testable and the page falls below the configured complexity target.

- [ ] Refactor `src/app/(dashboard)/settings/health/page.tsx`.
Objective: split diagnostics, route health, job health, telemetry, dependency, and recovery panels.
Done when: each panel has tests and the route shell is thin.

- [ ] Refactor `src/app/(dashboard)/work/page.tsx`.
Objective: split queue summary, filters, grouped work rows, diagnostics, inline actions, and exception panels.
Done when: work queue behavior is covered by smaller components.

- [ ] Refactor `src/components/layout/command-palette.tsx`.
Objective: split state machine, search API client, result groups, keyboard handling, and view rendering.
Done when: keyboard and search behavior can be tested without rendering the full shell.

- [ ] Refactor `src/components/layout/sidebar.tsx`.
Objective: split nav model rendering, badges, desktop shell, mobile drawer, profile block, and sign-out control.
Done when: desktop/mobile/collapsed states have focused tests.

- [ ] Refactor large contract components.
Objective: contract table, task panel, obligation panel, upload form, field review, and renewal checkpoints must become smaller and testable.
Done when: each large component is decomposed into pure helpers and focused UI subcomponents.

- [ ] Refactor large dashboard/report/assurance components.
Objective: high-density operational panels must be testable by section.
Done when: reports, dashboard upper/lower, assurance blocks, and operational summary cards have focused tests.

## 28. Data Tables, Lists, And Queues

- [ ] Add table caption and summary coverage.
Objective: data tables must explain their content and current filters.
Done when: table components expose captions or equivalent accessible summaries.

- [ ] Add pagination tests.
Objective: next/previous/page-size controls must work and preserve filters.
Done when: contract and queue pagination tests cover boundaries and URL state.

- [ ] Add sort tests.
Objective: sortable tables must reflect current sort and preserve accessibility state.
Done when: sort controls expose `aria-sort` or equivalent state.

- [ ] Add filter URL-state tests.
Objective: filters must survive reloads, navigation, and sharing.
Done when: route tests assert query params and selected controls remain in sync.

- [ ] Add row action tests.
Objective: actions inside rows must remain keyboard-accessible and permission-aware.
Done when: row-level menus/buttons have direct and E2E coverage.

- [ ] Add empty filtered-state tests.
Objective: empty because of filters must differ from empty because no data exists.
Done when: filtered empty states include clear/reset affordances.

- [ ] Add horizontal overflow containers.
Objective: wide data must scroll intentionally without breaking body layout.
Done when: tables use scoped overflow wrappers and mobile tests assert no body overflow.

## 29. External Integrations In UI

- [ ] Add Stripe action recovery states.
Objective: checkout and billing portal buttons must handle missing URL, provider error, network failure, and loading.
Done when: billing action tests cover success and failure responses.

- [ ] Add Slack integration action recovery states.
Objective: Slack summary form must handle provider failure and validation errors.
Done when: Slack renewal summary component tests cover success and failure.

- [ ] Add calendar integration action recovery states.
Objective: calendar sync/export actions must show provider and permission failures.
Done when: calendar-related UI/API flows have status tests.

- [ ] Add email delivery recovery states.
Objective: report summary, reminder, invite, and external notification flows must surface delivery degradation where user-facing.
Done when: settings/reports/health surfaces display delivery status consistently.

- [ ] Add OpenAI/extraction degradation states.
Objective: extraction or AI-backed features must show queued, partial, provider-error, retry, and disabled states.
Done when: extraction UI and API tests cover provider failures.

## 30. Final Acceptance Gate

- [ ] Add a machine-readable closure artifact.
Objective: release readiness must summarize every user-facing route and interaction.
Done when: `artifacts/assurance/user-facing-interactions-closure.json` includes route count, interaction count, coverage by category, waivers, failures, and generated timestamp.

- [ ] Add a strict closure check.
Objective: releases must fail on missing route coverage, missing interaction coverage, expired waivers, serious a11y findings, visual baseline gaps, unhandled console errors, or untested destructive actions.
Done when: `npm run check:user-facing-interactions` returns nonzero for any blocking gap.

- [ ] Add waiver expiry and owner enforcement.
Objective: unavoidable gaps must be temporary, owned, and visible.
Done when: waivers require owner, reason, route/action ID, expiry, and replacement plan encoded in JSON.

- [ ] Add gap burn-down metrics.
Objective: autonomous implementation can proceed incrementally without losing direction.
Done when: reports show remaining gaps by route, interaction, risk tier, component, and test type.

- [ ] Add a zero-exclusion target mode.
Objective: the repository can prove that every user-facing interaction is either covered or explicitly non-applicable.
Done when: strict mode rejects unknown, unclassified, or unowned user-facing behavior.
