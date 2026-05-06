# Oblixa SPEC-AS-BUILT

This document describes Oblixa as it is implemented in this repository. It is both an engineering specification and a UX specification: product behavior, visible surfaces, interaction patterns, data contracts, eligibility rules, automation, and verification expectations are documented together because the product is built as an operating system for post-signature contract execution.

The specification is grounded in the current codebase, especially:

- `README.md`
- `docs/v10.md`
- `docs/ui-design-principles.md`
- `src/lib/navigation.ts`
- `src/lib/product-surface/*`
- `src/lib/v10-*.ts`
- `src/app/**`
- `src/components/**`
- `src/actions/**`
- `src/app/api/**`
- `supabase/migrations/**`
- `openapi.yaml`
- `vercel.json`
- `package.json`

## 1. Product Definition

Oblixa is a contract operations platform for turning signed agreements into tracked work, deadlines, approvals, evidence, reminders, and audit-ready reporting.

It is not positioned as a drafting-first CLM suite. The built product focuses on the post-signature execution layer:

- centralizing signed contract records
- extracting operational fields from uploaded documents
- requiring human review before extracted values drive workflow
- routing work through owners, deadlines, approvals, obligations, exceptions, evidence requests, renewals, reports, exports, and automation
- exposing audit and operational health states so teams can recover from stale data, failed jobs, missing owners, or hidden workspace modules

The current product model is layered:

- **Core**: contracts, review, work, renewals, exceptions, evidence, reports, settings, upload/import/export, reminders, and notifications.
- **Advanced**: decisions, campaigns, simulations, programs, relationships, accounts, counterparties, portfolio analytics, external collaboration, and control-room behavior.
- **Assurance**: findings, control policies, scorecards, playbooks, review boards, autopilot, segments, program evolution, health graph, outcome intelligence, and governed automation.
- **V10 runtime layer**: activation state, unified work items, contract health snapshots, report/job visibility, command search index, audit events, release evidence, read-model refresh, idempotency, and runtime artifacts.

## 2. Users And Operating Context

Oblixa is built for operations, finance, legal-adjacent, legal reviewer, and manager personas that need accountable execution after signature.

Primary users:

- **Viewer**: reads visible workspace records, can inspect assigned or public workspace state where allowed.
- **Legal reviewer**: reviews fields, evidence, approvals, renewals, and legal-adjacent operational decisions.
- **Finance reviewer**: participates in finance-specific review and approval paths.
- **Editor**: creates and updates operational records such as contracts, work items, evidence requests, exceptions, and settings where scoped.
- **Ops manager**: handles team-level ownership, bulk work, escalations, automation review, and operational health.
- **Manager**: has elevated read and decision context for portfolio and team-level operations.
- **Admin**: manages organization settings, workspace mode, module visibility, billing, security policy, and sensitive diagnostics.
- **External token participant**: uses signed external links to submit evidence, acknowledge receipt, confirm renewal input, respond to structured requests, complete attestations, review packets, or confirm notice delivery without full workspace access.

The app assumes organization isolation. User identity and organization membership are resolved server-side before authenticated product data is shown or mutated. Workspace visibility is determined by mode, role, feature flags, plan/module eligibility, and server-side guards.

## 3. Technology Stack

Runtime:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, RLS, and storage
- Stripe for billing
- Resend for email
- OpenAI for document extraction
- Sentry for server/client telemetry
- Vercel for deployment and cron scheduling

Testing and assurance:

- Vitest for logic and component tests
- Playwright for public, authenticated, accessibility, resilience, visual, and smoke tests
- Semgrep custom rules
- CodeQL, dependency review, SBOM, security sweeps, and QA workflow gates
- Custom scripts under `scripts/` for route, API, migration, surface, security, and release checks

## 4. UX Operating Model

The governing UI principle is:

> Exceptions earn space. Normalcy compresses. Diagnostics disclose. Operator language comes before implementation language. Every surface should make the next action obvious.

### 4.1 First-Fold Contract

Authenticated operator surfaces prioritize:

- what is risky
- what is overdue or due soon
- who owns it
- what is blocked
- what changed materially
- what decision is needed
- what recovery action is available
- what data can be trusted
- what can safely stay hidden

Routine metrics, healthy totals, and implementation diagnostics appear after active operational consequence.

### 4.2 Content Priority

Default visible priority order:

1. Failed or terminal automation affecting user trust.
2. Critical exceptions and high-severity blockers.
3. Overdue work, expired deadlines, and SLA breaches.
4. Blocked work requiring dependency resolution.
5. Missing owner, missing approver, or missing accountable party.
6. Rejected, overdue, or missing evidence blocking work.
7. Renewal risk, notice deadlines, missing approved dates, and blocked renewal decisions.
8. Unhealthy contracts or data-quality gaps affecting trust.
9. Due-today work.
10. Partial or stale data affecting confidence.
11. Recent material changes.
12. Routine counts, healthy totals, and historical context.
13. Diagnostics and implementation details.

### 4.3 Copy Rules

Default product copy uses operational language:

- "Data freshness" instead of "read-model"
- "Work queue" instead of "durable work index"
- "Source record" instead of "source object" on default UI
- "Renewal risk" instead of "renewal posture" where user-facing
- "Support artifact" instead of "runtime artifact" outside diagnostics
- "Health checks" or "trust checks" instead of "runtime diagnostics"

Implementation terms such as raw table names, raw enum values, job class names, diagnostic IDs, and runtime artifacts belong in diagnostic disclosures unless the user needs them to recover.

### 4.4 Layout Density

The design system uses a quiet, enterprise operational style:

- compact headers for routine workspaces
- larger page headers only where orientation is needed
- dense tables for comparison-heavy records
- queue rows and cards for actionable work
- status panels for risk, partial data, recoverability, and all-clear state
- diagnostic disclosures for support metadata
- segmented controls for lenses
- table shells for ledgers and dense lists
- links with action verbs rather than passive "Open" labels when the workflow is known

Cards are used for active risk, decisions, exceptions, summary items with actions, hub shortcuts, and grouped metrics. Dense rows and tables are preferred for large operational lists.

### 4.5 Interaction Primitives

Implemented shared primitives include:

- `V10RecoverableState` for empty, partial, failed, unauthorized, forbidden, not found, deleted, terminal, expired, revoked, and other recoverable states.
- `OperationalSummaryCard` for KPI tiles.
- `OperationalSurfaceLinkCard` for navigation cards.
- `OperationalQueueRow` for dense action rows.
- `DiagnosticDisclosure` for support-safe implementation detail.
- `QueueItemCard` for operational work items.
- `StatusBadge` for semantic state display.
- `PermissionEligibilityHint` for permission and eligibility explanation.
- `EmptyState` and telemetry-aware empty state links.
- `InlineSkeleton` and loading panels for stable loading states.

### 4.6 State Handling

Every meaningful state must expose:

- a state reason
- the trustworthy data subset if partial
- a next action, recovery action, or explicit no-action explanation
- keyboard and screen-reader semantics
- support-safe diagnostics only when useful

Urgent recoverable states use `role="alert"` and assertive live regions. Empty and partial states use status semantics and compact copy.

## 5. Application Shell

Authenticated surfaces share the dashboard shell.

Shell components:

- Sidebar with grouped primary navigation, workspace/advanced/assurance/tool grouping, badges, collapse state, and mobile overlay.
- Header and command palette loader.
- Skip link to main content.
- Legal footer where applicable.
- Page-load telemetry reporter.
- Refetch-on-window-focus behavior.
- Workspace required state for unauthenticated or missing context.

### 5.1 Sidebar Navigation

The sidebar is generated from `NAV_ITEMS` and filtered through product-surface eligibility. Primary navigation groups:

- Workspace: Home, Contracts, Review, Work, Renewals, Exceptions, Evidence, Reports, Settings.
- Advanced: Decisions, Campaigns, Programs, Relationships.
- Assurance: Assurance.
- Tools: Tools index.

Operations, personal, and workspace sections expose secondary routes such as Intake, Approvals, Obligations, Report packs, Execution graph, Collaboration, Review cadence, Analytics, Data quality, Maintenance, Watchlists, Persona dashboard, Billing, System health, and Policy registry.

Badges exist for review queue, approvals, obligations, and watchlists. Badge visibility is also filtered by product-surface rules.

### 5.2 Command Palette

The command palette is a global router:

- opened by visible mobile trigger or Cmd/Ctrl+K
- auto-focuses search input
- groups results by workflow area: Monitor, Workflows, Assurance, Insights, Workspace
- filters eligible navigation and workflow destinations
- stores recent command hrefs in local storage
- runs remote contract search for queries with at least two characters
- exposes partial, failed, and zero-result states with recovery destinations
- sends telemetry for open, zero-result, failed-search, and selected-result events

Search results include:

- pages and workflows from the navigation model
- command search jump items from product-surface registry
- remote contract results with title, counterparty, owner, status, result type, and action label
- recovery links to workspace health and contract list search

## 6. Product Surface Governance

Workspace modes:

- `core`: Core contract operations.
- `advanced`: Core plus decisions, campaigns, programs, relationships, simulations, analytics, and Advanced reports.
- `assurance`: Advanced plus assurance controls, findings, scorecards, playbooks, review boards, autopilot, segments, program evolution, health graph, and Assurance reports.

Feature families are registered in `PRODUCT_FEATURE_REGISTRY`. Each family defines:

- label
- parent domain
- minimum workspace mode
- default feature state
- lifecycle
- top-level nav eligibility
- global search eligibility
- notification eligibility
- dashboard promotion eligibility
- badge eligibility
- contextual entry eligibility
- deep-link eligibility
- admin reveal policy
- route prefixes
- API prefixes
- optional feature flags
- optional module keys

Eligibility applies to:

- page routes
- sidebar/nav children
- command palette
- more/tools index
- workflow destinations
- API routes
- server actions
- report families
- hrefs
- audit event filtering
- dashboards

Hidden or ineligible surfaces may return 403 or 404 depending on denial class and discoverability policy. Hidden modules must not widen access to backend capability.

## 7. User-Facing Route Inventory

The as-built route universe is represented across `src/app`, `ROUTE_INVENTORY`, and the UI surface manifest.

### 7.1 Public And Auth Routes

| Route | Surface | UX role |
| --- | --- | --- |
| `/` | Marketing landing | Explains post-signature contract execution, capabilities, workflow, use cases, trust, FAQ, and CTAs. |
| `/login` | Auth | Email/password sign-in, callback error banners, forgot-password entry. |
| `/signup` | Auth | Account creation with full name, email, and password. |
| `/forgot-password` | Auth | Reset link request. |
| `/reset-password` | Auth | New password form. |
| `/privacy` | Marketing legal | Privacy content. |
| `/terms` | Marketing legal | Terms of use. |
| `/security` | Marketing legal | Public security posture. |
| `/accessibility` | Marketing legal | Accessibility content. |
| `/cookies` | Marketing legal | Cookie policy. |
| `/external/[token]` | External workflow | Token-scoped external response form. |

### 7.2 Core Authenticated Routes

| Route | UX role |
| --- | --- |
| `/dashboard` | Home workspace answering action now, due soon, blockers, missing data, recent change, and owned work. |
| `/dashboard/persona` | Persona-specific dashboard view. |
| `/contracts` | Contract portfolio list with search, owner, status, region, deadline, evidence, review, exception, health, data-quality filters, saved views, report subscriptions, export status, and pagination. |
| `/contracts/[id]` | Contract record with overview, fields, dates, tasks, obligations, approvals, exceptions, evidence, files, reports, notes, audit, health, owner, next action, extraction state, and workflow continuity. |
| `/contracts/new` | Single contract upload. |
| `/contracts/bulk` | Bulk import. |
| `/contracts/review` | Extraction and field validation queue. |
| `/work` | Unified work queue with V10 lenses and inline actions. |
| `/contracts/tasks` | Task queue and task operations. |
| `/contracts/obligations` | Obligation queue and obligation operations. |
| `/contracts/approvals` | Approval queue, SLA metrics, and approval operations. |
| `/contracts/renewals` | Renewal horizon and renewal workspace. |
| `/contracts/exceptions` | Exception queue, triage, and resolution. |
| `/contracts/evidence-studio` | Evidence requests, evidence status, submission review, and evidence exports. |
| `/contracts/reports` | Contract report packs, run history, scheduling, and exports. |
| `/reports` | Operational reports control room and report family navigation. |
| `/settings` | Profile, organization, members, invites, and workspace controls. |
| `/settings/security` | MFA enrollment, session hygiene, step-up state, and organization MFA policy. |
| `/settings/billing` | Stripe plan, checkout, portal, and subscription health. |
| `/settings/operations` | Workflow configuration. |
| `/settings/product` | Workspace mode, module visibility, calibration, and product experience controls. |
| `/settings/health` | System health, job visibility, report/export/import/extraction health, V10 diagnostics, release readiness, and recoverability. |
| `/settings/policy` | Policy registry JSON and policy simulation. |
| `/more` | Tools index for secondary destinations and shortcuts. |
| `/onboarding/calibration` | Workspace calibration and onboarding setup. |

### 7.3 Advanced Routes

| Route | UX role |
| --- | --- |
| `/decisions` | Decision queue with type/status filters, metrics, creation form, and ledger. |
| `/decisions/[id]` | Decision workspace detail, stakeholders, recommendation, context, packet, review, and disposition. |
| `/decisions/review` | Manager review queue for decisions. |
| `/decisions/compare` | Decision comparison surface. |
| `/campaigns` | Campaign queue with rollout metrics, filters, simulation studio, and campaign ledger. |
| `/campaigns/[id]` | Campaign workspace detail with preview, start, pause, resume, close, rollback, export, and row management. |
| `/campaigns/compare` | Campaign and simulation comparison. |
| `/contracts/programs` | Contract program catalog and program assignment controls. |
| `/contracts/analytics` | Portfolio trends and operational analytics. |
| `/relationship-workspaces` | Account and counterparty relationship overview. |
| `/accounts/[key]` | Account workspace summary by stable key. |
| `/counterparties/[key]` | Counterparty workspace summary by stable key. |
| `/contracts/collaboration` | External collaboration, notes, mentions, and field collaboration. |

### 7.4 Assurance Routes

| Route | UX role |
| --- | --- |
| `/assurance` | Assurance command center with findings, policy pass rate, automation metrics, latest check run, diagnostics, and hub links. |
| `/assurance/findings` | Findings queue. |
| `/assurance/findings/[id]` | Finding detail and resolution timeline. |
| `/assurance/control-policies` | Control policy list and creation. |
| `/assurance/control-policies/[id]` | Control policy detail, assignment, publish, simulation, and remediation playbook context. |
| `/assurance/scorecards` | Scorecards by team/account/segment/program/counterparty. |
| `/assurance/playbooks` | Adaptive playbooks and run execution. |
| `/assurance/review-boards` | Review boards and packet generation. |
| `/assurance/autopilot` | Safe autopilot rules, dry-runs, execution, and revert logs. |
| `/assurance/segments` | Segment definitions and recompute actions. |
| `/assurance/program-evolution` | Program experiment, simulation, rollout, and results workflow. |
| `/assurance/health-graph` | Portfolio health graph concentration and propagation risk. |

### 7.5 Utility Routes

| Route | UX role |
| --- | --- |
| `/contracts/intake` | Intake queues and throughput monitoring. |
| `/contracts/data-quality` | Completeness, lineage confidence, and remediation targets. |
| `/contracts/review-cadence` | Weekly/monthly review ritual workspace. |
| `/contracts/watchlists` | Explicitly monitored contracts. |
| `/contracts/execution-graph` | Cross-work dependency graph and blockers. |
| `/contracts/approvals/workload` | Approval workload distribution. |
| `/contracts/approvals/sla-simulator` | SLA simulator for approval routing. |
| `/contracts/maintenance` | Data hygiene and cleanup operations. |

## 8. Core UX Flows

### 8.1 First Contract Activation

Activation path:

1. User signs up or signs in.
2. User enters an organization/workspace.
3. User creates a contract by upload, new contract entry, or bulk import.
4. Upload/import validation succeeds and creates durable job state.
5. Extraction runs inline or through worker route depending on environment.
6. Extracted fields are reviewed with source snippets and confidence state.
7. Required activation fields are approved or rejected.
8. Contract owner is assigned or explicitly remains unassigned.
9. First generated work item is created from approved operational state.
10. Dashboard and Work queue reflect new action state.

Required activation fields:

- title
- counterparty
- contract type
- lifecycle status
- owner or unassigned state
- effective date
- end date
- renewal date
- notice deadline
- governing law
- contract value and currency

Activation states:

- `workspace_prepared`
- `contract_uploaded_or_imported`
- `extraction_queued`
- `extraction_running`
- `extraction_partially_complete`
- `extraction_failed`
- `required_field_review_ready`
- `required_fields_approved`
- `owner_assigned`
- `first_work_item_generated`
- `dashboard_updated`

UX requirements:

- Upload/import errors must distinguish invalid file, parse failure, extraction failure, partial extraction, and retryable state.
- Field review must show source, confidence, current value, approval/rejection controls, and rejection reason.
- The product must not silently use extracted fields for reminders until the user has approved them.
- Failed or partial extraction must appear in contract detail, Work failed-jobs lens, and system health.

### 8.2 Daily Work Clearance

The `/work` page is the canonical daily queue.

V10 lenses:

- assigned to me
- assigned to my team
- unassigned
- due today
- due soon
- overdue
- blocked
- high risk
- recently completed
- failed jobs
- automation approvals

Work item types:

- field review
- contract task
- obligation
- approval
- renewal checkpoint
- exception
- evidence request
- report failure
- export failure
- import failure
- extraction failure
- automation approval
- unassigned work

Work list sorting prioritizes:

- blocked high-risk items
- overdue work
- due today
- due soon
- failed jobs
- automation approvals
- unassigned work
- routine work

Each work row should expose:

- title
- object type
- owner or owner state
- status
- due date/state
- priority
- severity
- blocker reason when present
- primary action
- secondary action summary
- compatible action group when bulk action is possible
- contract continuity link when applicable

Legacy source queue diagnostics currently remain available below the V10 work index for tasks, approvals, obligations, and exceptions.

### 8.3 Contract Record Trust

The contract detail page is the trusted operational record. It loads:

- contract identity and metadata
- files
- extracted fields
- audit events
- reminders and reminder delivery state
- extraction job
- tasks
- notes
- obligations
- renewal checkpoints
- renewal scenario
- approvals
- field comments
- handoff checklists
- task, obligation, and approval events
- watchlist state
- renewal workspace notes
- operational casefile events
- evidence requirements and submissions

Top-level tab groups:

- Overview
- Work
- Evidence
- Record
- History

Concrete tabs:

- overview
- fields
- dates
- tasks
- obligations
- approvals
- exceptions
- evidence
- files
- reports
- notes
- audit

Expected first-fold trust elements:

- status
- owner
- health or next-step signal
- critical dates
- missing critical data
- open exceptions
- outstanding evidence
- renewal state
- latest audit or material event
- extraction/review state
- immediate actions

Actions include:

- extract fields
- download files
- upload more files
- assign owner
- delete contract
- transition contract status
- batch approve fields
- add fields
- add comments
- create clarification task
- request approval
- update renewal scenario
- seed renewal playbook
- update handoff checklist
- supersede file
- update external link
- apply template pack
- update program assignment override
- add/remove watchlist entry

### 8.4 Field Review And Data Quality

Field review is evidence-backed and human-gated.

Field states:

- extracted
- approved
- rejected
- missing
- ambiguous
- user supplied
- stale source

Confidence states:

- none
- low
- medium
- high

Field UX:

- show extracted value and source context
- distinguish missing and ambiguous values
- allow approve, reject, edit-and-approve
- persist reviewer, reviewed time, rejection reason, value hash, source label, source file, and last modified actor
- feed contract health and activation state
- expose data-quality remediation routes

### 8.5 Renewals

Renewal posture is based on approved operational dates.

Renewal postures:

- no approved renewal data
- blocked missing approved dates
- no renewal action required
- monitor
- plan
- negotiate
- notice deadline approaching
- notice overdue
- renewal overdue
- completed

Renewal horizons:

- 365 days
- 180 days
- 90 days
- 60 days
- 30 days
- 14 days
- 7 days
- 1 day
- overdue

Renewal UX requirements:

- missing approved dates must show blocked reminder state
- approved notice and renewal dates drive reminders and checkpoints
- renewal checkpoints carry owner, status, due state, approved notice deadline, approved renewal date, reminder eligibility, blocker reason, and audit event IDs
- detail pages and Work queue must route renewal actions back to the source contract

### 8.6 Evidence

Evidence workflows support internal requests and external submissions.

Evidence request state includes:

- requester
- external responder state
- due date
- status
- submission count
- latest submission time
- reviewer
- reviewed time
- rejection reason
- resubmission allowed
- external link state
- audit event IDs

External token workflow supports action types including:

- submit evidence
- acknowledge receipt
- structured request response
- confirm renewal input
- upload requested document
- confirm notice delivery
- amendment intake response
- complete attestation
- review decision packet

External UX:

- load status before rendering form
- show expired or non-open request state
- support optional or required passcode
- show reauth instructions and correction message
- show workflow progress and acknowledgement deadline when present
- disable duplicate intent through busy state
- show thank-you confirmation after successful submission
- refresh status after failed submission

### 8.7 Approvals And Exceptions

Approval statuses:

- pending
- approved
- rejected
- changes requested

Approval actions:

- approve
- reject
- request changes
- delegate
- escalate

Exception resolution actions:

- accepted risk
- fixed
- converted to task
- evidence requested
- escalated to approval
- campaign created
- finding linked

Exception UX:

- prioritize high and critical severity
- show owner, due date, source, root cause, linked tasks, linked evidence, linked approvals, linked decisions, audit history, and reopen/resolution state
- integrate with campaigns and findings when workspace mode and module eligibility allow

### 8.8 Reports And Exports

Reports are operational surfaces, not document-only output.

Core report families:

- contract portfolio summary
- renewal horizon report
- overdue work report
- exception report
- evidence status report
- approval SLA report
- data quality report
- audit activity report
- import/extraction reliability report
- workspace health report

Report run statuses:

- queued
- running
- succeeded
- partial
- failed retryable
- failed terminal
- retrying
- canceled

Reports UX:

- `/reports` shows delivery posture before report family links.
- Core mode emphasizes recent failures, running reports, success counts, latest failure/success timestamp, export follow-through, and links to report history and system health.
- Advanced/Assurance mode renders richer portfolio, campaign, capacity, assurance, and outcome sections when eligible.
- Truncated or partial exports must identify selected rows, generated rows, and reason.
- Report and export failures should provide diagnostic ID and retry action when retryable.

### 8.9 Settings, Security, And Health

Settings include:

- profile details
- organization name
- member table
- pending invites
- invite form
- demo seed button for admins
- security settings link
- system health link when role capability allows
- workflow configuration
- product experience controls
- policy registry controls
- calendar export links

Security settings include:

- TOTP factor list
- current and next AAL from Supabase MFA
- organization MFA required state
- step-up controls for sensitive changes
- degraded panel when MFA metadata calls fail

System health includes:

- outbound webhook delivery posture
- report runs
- cron audit events
- notification delivery counts
- import jobs
- export jobs
- extraction jobs
- reminders
- V10 job visibility
- V10 report visibility
- V10 read-model refresh jobs
- V10 runtime coverage ledger
- V10 runtime artifacts
- V10 idempotency backlog and expired claims
- V10 post-GA SLO blockers

Unauthorized users receive a recoverable forbidden state with a permission explanation.

## 9. Advanced UX Flows

### 9.1 Decisions

Decision workspaces support:

- decision type
- status
- title
- linked contract IDs
- account/counterparty keys
- owner
- due date
- required inputs
- recommendation
- rationale markdown
- approval path
- final disposition
- post-decision actions
- stakeholders
- event history
- packet generation and packet runs

Decision queue UX:

- filter by type and active queue
- show filtered workspace count
- show open count
- show review/blocked pressure
- expose creation form
- show ledger with title, object, type, status, owner, due date, next action, and linked contract count

### 9.2 Campaigns And Simulations

Campaigns support:

- type
- status
- owner
- eligibility
- assignment
- preview summary
- progress summary
- rollback safety
- linked contract rows
- event history

Campaign statuses:

- draft
- previewed
- active
- paused
- closed

Campaign UX:

- filter by status and type
- show active, paused, and processed counts
- expose diagnostics links
- show simulation studio when simulation/intelligence is enabled
- promote completed simulation to draft campaign
- ledger shows campaign, object, type, status, owner, previewed, processed, and next action

### 9.3 Relationships

Relationship workspaces are based on stable keys:

- account key
- counterparty key

They summarize:

- display name
- owner
- summary JSON
- health signal JSON
- timeline events
- account/counterparty-specific rollups

Relationship surfaces do not guess missing keys; contracts must be populated with `account_key` and `counterparty_key`.

### 9.4 Programs

Programs support:

- program catalog
- program versions
- contract assignments
- auto/manual/policy assignment modes
- program impact preview
- program-driven contract operations and reporting

## 10. Assurance UX Flows

### 10.1 Assurance Hub

The Assurance command center shows:

- open findings
- policy pass rate
- playbook runs over the last 30 days
- latest assurance check run
- watch signals
- recommended interventions
- diagnostics for incremental runs, review boards, autopilot, external yield, and median age of open findings
- navigation to findings, controls, scorecards, health graph, review boards, playbooks, autopilot, segments, and program evolution

### 10.2 Control Policies

Control policies support:

- objective
- scope JSON
- severity model
- enforcement mode
- remediation playbook
- status
- published versions
- assignments to segments/accounts/counterparties/programs/contract classes/global scope

Enforcement modes:

- observe only
- warn
- create exception
- require decision workspace
- trigger campaign
- trigger autopilot action
- escalate immediately

### 10.3 Findings

Findings support:

- type
- title
- summary
- severity
- confidence
- scope JSON
- linked controls
- linked entities
- recommended playbook
- analyst note
- status
- resolution actor/time
- source check run
- event history

Finding statuses:

- open
- in review
- resolved
- dismissed

### 10.4 Playbooks And Autopilot

Adaptive playbooks support:

- eligibility JSON
- preconditions JSON
- approval mode
- execution template
- follow-up checks
- preview
- run status
- step stages
- success assessment

Playbook run statuses:

- queued
- previewed
- awaiting approval
- running
- completed
- failed
- cancelled

Autopilot supports:

- rules
- dry-run
- enable/disable
- run logs
- bounded execution
- revert operations
- execution kill switch through feature flags/org settings

### 10.5 Scorecards, Review Boards, Segments, Program Evolution, Health Graph

Scorecards summarize overall score, dimensions, score drivers, and snapshots by entity type.

Review boards generate and track recurring assurance packets and runs.

Segments define portfolio hierarchy and membership, with recompute actions.

Program evolution experiments support simulation, rollout advancement, and results capture.

Health graph nodes and edges model concentration, propagation risk, relationship type, weight, and explainability.

## 11. Data Model

The database is Supabase/PostgreSQL with RLS and service-role server operations.

### 11.1 Foundational Tables

Identity and organization:

- `profiles`
- `organizations`
- `organization_members`
- `organization_invites`
- `organization_workflow_settings`

Contract record:

- `contracts`
- `contract_files`
- `extracted_fields`
- `field_templates`
- `saved_views`
- `audit_events`

Core work and operations:

- `contract_tasks`
- `contract_task_events`
- `contract_task_comments`
- `contract_task_dependencies`
- `contract_task_checklist_items`
- `contract_task_artifacts`
- `contract_obligations`
- `contract_obligation_events`
- `contract_approvals`
- `contract_approval_events`
- `contract_renewal_checkpoints`
- `contract_renewal_scenarios`
- `contract_renewal_workspace_notes`
- `exceptions`
- `exception_events`
- `evidence_requirements`
- `evidence_submissions`
- `evidence_requirement_templates`
- `attestation_requests`
- `attestation_responses`
- `reminders`
- `reminder_templates`
- `notification_deliveries`
- `internal_notifications`

Import/export/extraction/reporting:

- `contract_import_jobs`
- `contract_import_job_rows`
- `contract_export_jobs`
- `contract_extraction_jobs`
- `report_packs`
- `report_pack_runs`
- `report_pack_subscriptions`
- `report_runs`
- `report_run_recipients`
- `report_subscriptions`
- `contract_data_quality_snapshots`
- `calendar_feeds`

V4 execution:

- `contract_programs`
- `contract_program_versions`
- `contract_program_assignments`
- `execution_graph_edges`
- `approval_slas`
- `escalation_policies`
- `renewal_decision_packets`
- `operational_casefile_events`
- `maintenance_campaigns`
- `maintenance_campaign_rows`
- `role_command_center_preferences`

V5 advanced:

- `decision_workspaces`
- `decision_workspace_events`
- `decision_workspace_stakeholders`
- `decision_recommendations`
- `decision_packet_templates`
- `decision_packet_runs`
- `portfolio_campaigns`
- `portfolio_campaign_contracts`
- `portfolio_campaign_events`
- `account_workspaces`
- `counterparty_workspaces`
- `relationship_timelines`
- `relationship_timeline_events`
- `external_action_links`
- `external_action_events`
- `change_simulations`
- `change_simulation_runs`
- `capacity_snapshots`
- `capacity_forecasts`
- `operational_recommendations`
- `org_behavior_metrics`

V6 assurance:

- `control_policies`
- `control_policy_versions`
- `control_policy_assignments`
- `assurance_findings`
- `assurance_finding_events`
- `assurance_check_runs`
- `adaptive_playbooks`
- `adaptive_playbook_runs`
- `adaptive_playbook_steps`
- `portfolio_health_graph_nodes`
- `portfolio_health_graph_edges`
- `assurance_scorecards`
- `scorecard_snapshots`
- `outcome_intervention_analyses`
- `review_boards`
- `review_board_runs`
- `segment_definitions`
- `segment_memberships`
- `autopilot_rules`
- `autopilot_run_logs`
- `program_evolution_experiments`
- `program_evolution_results`

Integrations and billing:

- `integration_connections`
- `integration_api_keys`
- `integration_oauth_states`
- `webhook_subscriptions`
- `outbound_events`
- `outbound_event_deliveries`
- `stripe_webhook_events`

### 11.2 V10 Runtime Tables

V10 read and runtime contracts:

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

Shared V10 read-model fields:

- id
- organization id
- workspace mode
- required role minimum
- feature family
- source table
- source id
- created/updated/deleted/archived timestamps
- visibility state

V10 visibility states:

- visible
- hidden by mode
- hidden by role
- hidden by plan
- hidden by module
- deleted
- archived

### 11.3 V10 Role, Mode, And Plan Order

Roles:

1. viewer
2. legal reviewer
3. finance reviewer
4. editor
5. ops manager
6. manager
7. admin

Workspace modes:

1. core
2. advanced
3. assurance

Plans:

1. trial
2. core
3. advanced
4. assurance
5. enterprise

### 11.4 Contract Health

Contract health starts at 100 and subtracts:

- 20 for missing required activation field
- 15 for missing or unapproved critical date
- 15 for overdue linked work
- 15 for open high or critical exception
- 10 for outstanding evidence not overdue
- 10 for renewal notice deadline inside 30 days when not terminal
- 10 for missing or stale owner
- 10 for failed or partial retryable job
- 5 for missing recommended fields

Bands:

- healthy: 85 to 100
- watch: 70 to 84
- at risk: 60 to 69
- critical: 0 to 59

Next action priority:

1. failed import or extraction blocking record creation
2. missing required activation field
3. pending required field review
4. overdue approval
5. overdue obligation
6. overdue evidence request
7. open critical exception
8. renewal notice deadline inside 30 days
9. renewal date inside 90 days
10. unassigned owner
11. missing recommended field
12. no action required

## 12. Mutations And API Response Contract

V10 mutations require a consistent envelope:

- organization id
- target type
- target id
- expected version unless exempt
- idempotency key
- client request id

V10 mutation response includes:

- outcome
- user-visible message
- changed object type/id
- new version
- expected/current/new version metadata
- next destination href or null sentinel
- audit event id
- diagnostic id
- retry eligibility
- replay state
- validation failures
- optional bulk item outcomes

V10 outcomes:

- success
- validation failed
- unauthorized
- forbidden
- not found
- conflict
- stale version
- plan required
- mode required
- hidden module
- rate limited
- dependency blocked
- job not retryable
- external link expired
- external link revoked
- audit write failed
- no action
- server error

Required V10 mutations include:

- create contract import
- assign work item owner
- complete work item
- bulk assign compatible work items
- bulk complete compatible work items
- approve/reject/edit-and-approve field
- retry failed job
- create evidence request
- submit external evidence
- accept/reject evidence
- approve/reject/request changes/delegate/escalate approval
- assign/resolve/reopen exception
- change renewal posture
- generate renewal decision packet
- record renewal recommendation
- create report run
- create export job
- update notification preferences
- update module visibility
- update workspace mode

Idempotency:

- persisted in `v10_mutation_idempotency`
- unique by organization, actor, mutation, target, and idempotency key
- supports claim, in-progress, replay, payload conflict, and completion states
- service role can clean expired claims
- direct member access to idempotency rows is denied by RLS

## 13. API Surface

The OpenAPI contract is `openapi.yaml` version `0.1.0`. API routes are implemented under `src/app/api/**`.

API families:

- Accounts and counterparties summaries.
- Approvals actions and SLA metrics.
- Assurance analytics, checks, findings, health graph, scorecards, and workflows.
- Attestations.
- Auth post-sign-out.
- Autopilot rules, dry-runs, enablement, runs, and revert.
- Campaign lifecycle, rows, preview, export, rollback, and collection CRUD.
- Capacity forecast and reassignment plan.
- Command center preferences.
- Command palette contract search.
- Contracts recompute signals.
- Control policies assign, publish, simulate, update, create, list.
- Cron routes for Stripe, V4, V5, V6, and V10 automation.
- Decisions, packets, recommendations, review, stakeholders, and templates.
- Events.
- Evidence actions, export, requests, and submit.
- Exceptions actions, listing, and detection.
- Export calendar feeds, contract exports, and review packet.
- External actions status, submit, participant step, workflow step, and create link.
- Extraction.
- Health.
- Import contracts and job retry/status.
- Integrations OAuth/actions/calendar/CRM/token refresh/Slack.
- Intelligence portfolio and recommendations.
- Internal debugging sweep.
- Maintenance campaigns and pruning.
- Personal account export/delete.
- Notifications retry.
- Outcomes.
- Playbooks and playbook runs.
- Policy simulation.
- Product telemetry.
- Program evolution.
- Programs.
- Reminders.
- Renewals.
- Report packs and report run retry.
- Reports capture/send and tracking.
- Review boards.
- Segments.
- Settings step-up.
- Simulations.
- Stripe checkout, portal, webhook.
- Tasks from email, tasks from Slack, and task rules.
- Templates preview.
- Webhook dispatch.
- Workspace nav badges and V6 settings.

API route conventions:

- private API responses use no-store headers
- session routes require authenticated organization context
- workspace-mode API eligibility is enforced through product-surface mapping
- cron routes require `CRON_SECRET` and return 503 when misconfigured, 401 when unauthorized
- many route handlers use `runApiRoute`/`withRouteContract` to standardize rate limit, preflight, dependency failure, partial response, duration, and diagnostic shape
- V10 workspace denials can return V10 mutation envelopes for mutating routes

## 14. Scheduled Automation

Vercel cron schedules include:

Core:

- `/api/reminders/send` daily at 09:00
- `/api/reports/send-summaries` daily at 09:30
- `/api/reports/capture-metrics` hourly at minute 20
- `/api/webhooks/dispatch` every 30 minutes
- `/api/tasks/run-rules` hourly at minute 15
- `/api/contracts/recompute-signals` hourly at minute 45
- `/api/integrations/calendar/sync` every 30 minutes
- `/api/integrations/crm/sync` hourly at minute 10
- `/api/integrations/refresh-tokens` every 20 minutes
- `/api/notifications/retry-deliveries` every 15 minutes
- `/api/maintenance/prune-operational-data` daily at 03:00
- `/api/cron/stripe-webhook-events` daily at 03:30

V4:

- exceptions detection
- attestations issue
- approvals SLA
- escalations dispatch
- report packs generation
- evidence follow-up
- programs reconcile
- renewals signal recompute

V5:

- campaign progress
- simulation snapshots
- capacity forecast refresh
- portfolio risk recompute
- external follow-up
- decision SLA monitor
- recommendation refresh
- relationship rollups

V6:

- assurance checks
- finding refresh
- autopilot dry-run
- autopilot execution
- scorecard recompute
- health graph rollups
- control policy reevaluation
- outcome effectiveness
- review board packet generation
- segment recompute
- playbook follow-up assurance
- external workflow deadlines
- onboarding calibration stale check

V10:

- read-model refresh every 15 minutes
- idempotency cleanup daily at 03:12
- runtime artifact cleanup daily at 03:27

## 15. Integrations

Built integration areas:

- Stripe checkout, portal, and webhooks.
- Resend email delivery.
- OpenAI extraction, long-document chunking, optional PDF OCR fallback, and worker execution.
- Calendar export and calendar feed tokens.
- OAuth start/callback and token refresh.
- Calendar and CRM sync.
- Slack renewal summary and inbound task creation.
- Email inbound task creation.
- Webhook subscriptions, outbound events, and retry deliveries.
- External action signed links and submit tickets.
- Sentry server/client telemetry.

## 16. Security, Privacy, And Compliance

Security controls in the codebase include:

- Supabase Auth.
- Organization membership checks.
- RLS on user-visible tables.
- Service-role-only functions and cleanup paths where needed.
- Workspace mode, role, plan, module, and feature gating.
- API route session context.
- Cron bearer/header authorization.
- Step-up cookie support.
- MFA panel and organization MFA policy.
- No-store API cache headers.
- CSP/security headers built from `next.config.ts`.
- Sentry release tagging.
- Kill switches for signup, billing, extraction, invites, inbound automation, and webhook dispatch.
- Safe redirects and URL policy helpers.
- JSON content-type and body limit checks.
- Upload filename guards.
- CSV formula safety.
- Markdown sanitization and safe JSON helpers.
- Trusted forwarded header checks.
- Secret comparison helpers.
- Stripe webhook signature tests.
- Slack and email signing support.
- Audit write helpers.
- SBOM, semgrep, dependency, CodeQL, and OpenSSF workflows.

Privacy and telemetry rules:

- `NEXT_PUBLIC_*` variables are client-exposed and must not contain secrets.
- Telemetry must not include raw contract text, uploaded document content, secrets, private provider payloads, or unredacted IDs that do not help user recovery.
- V10 audit and runtime artifacts are classified and scoped.
- Customer-private artifacts should not be exposed through public diagnostics.

## 17. Accessibility And Responsiveness

As-built accessibility support includes:

- skip link
- semantic headings and landmarks across route shells
- keyboard-accessible command palette
- Escape handling for overlays
- focus restoration in command palette and mobile nav
- `aria-busy` on auth submit buttons
- `aria-invalid`/`aria-describedby` on auth errors
- recoverable state `role="status"` or `role="alert"` based on urgency
- loading skeletons marked `aria-hidden`
- form labels for primary auth and external workflow controls
- Playwright a11y suites for landmarks, keyboard, dialogs, forms, route states, and route H1 contracts
- UI tests for core primitives

Responsive behavior:

- sidebar collapses and has mobile overlay
- mobile command palette trigger is fixed and hides near footer
- tables use responsive shells and dense rows
- headers and action bars wrap
- grids shift between single-column, two-column, three-column, and wider layouts
- route loading panels preserve stable dimensions

## 18. Performance And Reliability

Performance-related implementation:

- Next.js server components for authenticated data-heavy pages.
- Suspense fallbacks for dashboard and reports content.
- No-store API headers for private data.
- Query pagination on contract list.
- Contract page limits for events/comments/requirements.
- GIN/index support for command search and JSON-driven runtime data.
- Upsert indexes for V10 read-model replacement.
- V10 read-model refresh jobs and lineage.
- Job visibility and report visibility tables.
- Cron canary and SLO monitor workflows.
- Optional k6 load smoke.
- Playwright memory, performance, visual, multi-browser, and device matrix specs.

Reliability states:

- queued
- running
- succeeded
- partial
- failed retryable
- failed terminal
- retrying
- canceled
- cancelable
- not cancelable
- cancel requested
- canceled

Retryable diagnostics include:

- diagnostic id
- failure category
- user-visible detail
- retry eligibility
- retry action
- completed/failed/skipped/retryable counts

## 19. Release And QA Model

Core commands:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run check:quick`
- `npm run verify`
- `npm run verify:security`
- `npm run check:v8-suite`
- `npm run test:e2e:smoke`
- `npm run test:e2e:a11y`
- `npm run test:e2e:visual:full`
- `npm run release:checklist`

CI quality jobs:

- `quality_static_security`
- `quality_static_surface`
- `quality_static_governance`
- `quality_static_codehealth`
- `quality_unit`
- `quality_security`
- `quality_build_e2e`
- aggregate `quality`

Additional workflows:

- CodeQL
- Semgrep SARIF
- dependency review
- cron canary
- SLO monitor
- post-merge smoke
- QA maximal/nightly/release-candidate workflows
- security audit weekly
- OpenSSF scorecard
- optional/stub workflows for DAST, Trivy, k8s, Terraform, mobile WebView, CDN, visual update, secret history scanning, and external SaaS integrations

E2E suite coverage includes:

- auth flow
- authenticated smoke
- marketing public
- external public
- V3/V5/V6/V9/V10 workflows
- route states
- accessibility
- security headers
- session cookies
- UI resilience
- cron smoke
- visual public/core/advanced/assurance/shell/external
- device matrix across Chromium/WebKit/Firefox
- onboarding calibration
- settings security
- URL adversarial checks
- public SEO/well-known/robots

## 20. Environment And Deployment

Required local setup:

- Node.js 20+
- npm 10+
- `npm install`
- `.env.local` based on `.env.example`
- `npm run dev`

Critical environment areas:

- Supabase public URL and anon key
- Supabase service role key
- Stripe publishable key, secret key, price id, webhook secret
- Resend API key and sender email
- OpenAI API key and extraction model options
- app base URL
- cron secret
- extraction worker secret and base URL when worker mode is used
- step-up secret
- Slack signing secret
- email inbound HMAC secret
- optional debugging sweep secret and IP allowlist
- Google site verification
- feature flags for V3/V4/V5/V6
- V5 decision packet bucket
- external action submit ticket secret
- product kill switches
- E2E authenticated test credentials

Deployment expectations:

- Vercel hosts the Next.js app.
- Supabase auth redirects must match deployment URL.
- Stripe webhook destination must match deployment URL.
- Cron and callback destinations must match deployment URL.
- Release-style validation requires provider secrets.
- Public environment variables are embedded in client bundles and must never contain secrets.

## 21. Known As-Built Notes And Gaps

This section captures observable repo state, not roadmap aspiration.

- `.cursor/rules` exists but currently contains no rule files.
- `docs/user-facing-interactions-autonomous-implementation-checklist.md` is an explicit checklist of additional autonomous hardening work; many items remain unchecked.
- The UI surface manifest source currently lists many routes but omits `/settings/security`, while route inventory and the filesystem include it. The checklist calls this out as a gap to close.
- The product has multiple overlapping inventories: filesystem routes, `ROUTE_INVENTORY`, UI surface manifest, route-state manifest, generated route matrices, OpenAPI, feature registry, and product-surface mapping. Scripts and tests exist to control drift, but the checklist calls for stronger manifest centralization.
- Some diagnostic links are raw API JSON links in product surfaces. The UI principles allow diagnostics when useful but prefer support-safe disclosures and consistent API JSON link treatment.
- V10 is implemented through runtime contracts, read models, migrations, tests, and UI surfaces; release evidence and SLO promotion tables exist, but actual promoted production evidence depends on environment data and external operational runs.
- Several optional QA and external SaaS workflows are stubs or disabled by `if: false`, documenting future or org-gated checks rather than running continuously.

## 22. Appendix: API Endpoint Inventory

The following endpoint list is generated from `openapi.yaml` and route files at the time this document was written.

Accounts and counterparties:

- `GET /api/accounts/{key}/summary`
- `GET /api/counterparties/{key}/summary`

Approvals:

- `POST /api/approvals/{id}/{action}`
- `GET /api/approvals/sla-metrics`

Assurance:

- `GET /api/assurance/analytics/summary`
- `GET /api/assurance/check-runs`
- `GET /api/assurance/check-runs/{id}`
- `POST /api/assurance/checks/run`
- `POST /api/assurance/external-links/{id}/response-pack`
- `GET /api/assurance/findings`
- `GET /api/assurance/findings/{id}/events`
- `POST /api/assurance/findings/{id}/resolve`
- `GET /api/assurance/health-graph`
- `GET /api/assurance/scorecards`
- `GET /api/assurance/scorecards/{id}/snapshots`
- `POST /api/assurance/workflows/run-all`

Attestations:

- `POST /api/attestations/{id}/respond`
- `GET /api/attestations/run`

Autopilot:

- `GET /api/autopilot/rules`
- `POST /api/autopilot/rules`
- `PATCH /api/autopilot/rules/{id}`
- `DELETE /api/autopilot/rules/{id}`
- `POST /api/autopilot/rules/{id}/dry-run`
- `POST /api/autopilot/rules/{id}/enable`
- `GET /api/autopilot/runs`
- `POST /api/autopilot/run-logs/{id}/revert`

Campaigns:

- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/{id}`
- `PATCH /api/campaigns/{id}`
- `POST /api/campaigns/{id}/preview`
- `POST /api/campaigns/{id}/start`
- `POST /api/campaigns/{id}/pause`
- `POST /api/campaigns/{id}/resume`
- `POST /api/campaigns/{id}/close`
- `POST /api/campaigns/{id}/rollback`
- `GET /api/campaigns/{id}/export`
- `PATCH /api/campaigns/{id}/contracts/{rowId}`

Capacity and command center:

- `GET /api/capacity/forecast`
- `POST /api/capacity/reassignment-plan`
- `GET /api/command-centers/preferences`
- `POST /api/command-centers/preferences`
- `GET /api/command-palette/contracts`

Control policies:

- `GET /api/control-policies`
- `POST /api/control-policies`
- `PATCH /api/control-policies/{id}`
- `POST /api/control-policies/{id}/assign`
- `POST /api/control-policies/{id}/publish`
- `POST /api/control-policies/{id}/simulate`

Decisions:

- `GET /api/decisions`
- `POST /api/decisions`
- `GET /api/decisions/{id}`
- `PATCH /api/decisions/{id}`
- `POST /api/decisions/{id}/approve`
- `POST /api/decisions/{id}/close`
- `GET /api/decisions/{id}/context`
- `POST /api/decisions/{id}/packet`
- `GET /api/decisions/{id}/packet-runs/{runId}`
- `POST /api/decisions/{id}/recommend`
- `POST /api/decisions/{id}/review`
- `POST /api/decisions/{id}/stakeholders`
- `GET /api/decisions/packet-templates`
- `POST /api/decisions/packet-templates`
- `GET /api/decisions/packet-templates/{id}`
- `PATCH /api/decisions/packet-templates/{id}`
- `DELETE /api/decisions/packet-templates/{id}`

Events, evidence, exceptions:

- `GET /api/events`
- `POST /api/evidence/{id}/{action}`
- `GET /api/evidence/export/{contractId}`
- `POST /api/evidence/requests`
- `POST /api/evidence/submit`
- `GET /api/exceptions`
- `POST /api/exceptions/{id}/{action}`
- `POST /api/exceptions/run-detection`

Export:

- `GET /api/export/calendar`
- `GET /api/export/calendar/feed`
- `GET /api/export/calendar/feed/{token}`
- `GET /api/export/contracts`
- `POST /api/export/contracts`
- `GET /api/export/contracts/{jobId}`
- `POST /api/export/contracts/{jobId}`
- `GET /api/export/review-packet`

External actions:

- `POST /api/external-actions/create-link`
- `GET /api/external-actions/{token}/status`
- `POST /api/external-actions/{token}/submit`
- `POST /api/external-actions/{token}/participant/workflow-step`
- `POST /api/external-actions/{token}/workflow-step`

Extraction, health, import:

- `POST /api/extract`
- `POST /api/extract/run`
- `GET /api/health`
- `HEAD /api/health`
- `POST /api/import/contracts`
- `GET /api/import/contracts/{jobId}`
- `POST /api/import/contracts/{jobId}`

Integrations:

- `POST /api/integrations/actions/callback`
- `GET /api/integrations/oauth/callback`
- `POST /api/integrations/oauth/start`
- `POST /api/integrations/slack/renewal-summary`
- cron-only calendar/CRM sync and token refresh routes exist in `src/app/api/integrations`.

Intelligence:

- `GET /api/intelligence/decision-queue`
- `GET /api/intelligence/portfolio-by-counterparty`
- `GET /api/intelligence/portfolio-by-program`
- `GET /api/intelligence/portfolio-signals`
- `GET /api/intelligence/recommendations`
- `PATCH /api/intelligence/recommendations/{id}`

Maintenance and personal data:

- `GET /api/maintenance/campaigns/{id}`
- `GET /api/maintenance/campaigns/{id}/preview`
- `POST /api/maintenance/campaigns`
- `POST /api/maintenance/campaigns/{id}/run`
- `POST /api/maintenance/campaigns/{id}/rollback`
- `GET /api/me/export`
- `DELETE /api/me/account`

Outcomes, playbooks, policy:

- `GET /api/outcomes/control-effectiveness`
- `GET /api/outcomes/interventions`
- `GET /api/outcomes/program-effectiveness`
- `GET /api/playbooks`
- `POST /api/playbooks`
- `POST /api/playbooks/{id}/preview`
- `POST /api/playbooks/{id}/run`
- `GET /api/playbooks/runs/{id}`
- `POST /api/playbooks/runs/{id}/approve`
- `POST /api/policy/simulate`

Program evolution, programs, renewals:

- `GET /api/program-evolution/experiments`
- `POST /api/program-evolution/experiments`
- `POST /api/program-evolution/experiments/{id}/advance-rollout`
- `POST /api/program-evolution/experiments/{id}/results`
- `POST /api/program-evolution/experiments/{id}/simulate`
- `GET /api/programs`
- `POST /api/programs`
- `POST /api/programs/{id}/{action}`
- `POST /api/renewals/{id}/{action}`
- `GET /api/renewals/portfolio-signals`

Reports:

- `GET /api/report-packs`
- `POST /api/report-packs`
- `GET /api/report-packs/{id}/runs`
- `POST /api/report-runs/{runId}/retry`
- `GET /api/reports/track/click/{token}`
- `GET /api/reports/track/open/{token}`

Review boards and segments:

- `GET /api/review-boards`
- `POST /api/review-boards`
- `PATCH /api/review-boards/{id}`
- `POST /api/review-boards/{id}/generate-run`
- `GET /api/review-boards/{id}/runs`
- `GET /api/review-boards/runs/{id}`
- `PATCH /api/review-boards/runs/{id}`
- `GET /api/segments`
- `POST /api/segments`
- `POST /api/segments/{id}/recompute`

Settings, simulations, Stripe, tasks:

- `POST /api/settings/step-up`
- `GET /api/simulations/{id}`
- `POST /api/simulations/run`
- `POST /api/simulations/{id}/promote-to-campaign`
- `POST /api/stripe/checkout`
- `POST /api/stripe/portal`
- `POST /api/stripe/webhook`
- `POST /api/tasks/from-email`
- `POST /api/tasks/from-slack`

Templates, telemetry, webhooks, workspace:

- `GET /api/templates/preview`
- `POST /api/product-telemetry/page-load`
- `POST /api/webhooks/dispatch`
- `GET /api/workspace/nav-badges`
- `GET /api/workspace/v6-settings`
- `PATCH /api/workspace/v6-settings`

Internal:

- `GET /api/internal/debugging-sweep`

## 23. Appendix: Verification Coverage Map

Selected as-built coverage sources:

- Route inventory drift: `src/lib/product-surface/route-inventory.drift.test.ts`
- UI surface manifest: `src/lib/qa/ui-surface-manifest.source.mjs`
- Route state manifest: `src/lib/qa/route-state-manifest.source.mjs`
- Product-surface eligibility: `src/lib/product-surface/*.test.ts`
- V10 release, data, mutation, UI state, objective, job, and traceability tests: `src/lib/v10-*.test.ts`
- V4/V5/V6 domain tests: `src/lib/v4`, `src/lib/v5`, `src/lib/v6`
- Component UI tests: `src/components/**/*.ui.test.tsx`
- Playwright E2E: `e2e/*.spec.ts`
- API route auth/scope/rate-limit checks: `scripts/check-api-route-*.mjs`
- Security checks: `scripts/check-*.mjs`, `semgrep/*.yml`
- Migration checks: `scripts/check-migrations.mjs`, `scripts/check-migration-security-patterns.mjs`
- OpenAPI smoke: `scripts/openapi-contract-smoke.mjs`

## 24. Appendix: UX Doctrines For Future Changes

Future implementation should preserve these as-built doctrines:

- Keep Core complete without Advanced or Assurance.
- Keep Advanced and Assurance additive.
- Prefer operational next actions over explanation-only panels.
- Do not expose hidden modules through nav, command palette, reports, notifications, API JSON links, or deep links.
- Keep all user-facing work reachable through Home, Work, contract detail, or command palette.
- Put failed, partial, overdue, blocked, and unowned states above routine summaries.
- Compress healthy states into one concise summary.
- Use diagnostics only when trust or recovery requires them.
- Use shared primitives for recoverable states, status badges, queue rows, operational cards, diagnostics, and permission hints.
- Treat documentation as support material; shipped behavior, tests, telemetry, audit rows, and runtime evidence are the source of release truth.
