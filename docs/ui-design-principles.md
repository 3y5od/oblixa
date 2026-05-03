# Enterprise UI Design Principles

This document defines the durable UI operating model for Oblixa. It is intended for every future agent or engineer changing product UI, route states, components, copy, navigation, diagnostics, tests, release evidence, or operator-facing documentation.

The core principle:

> Exceptions earn space. Normalcy compresses. Diagnostics disclose. Operator language comes before implementation language. Every surface should make the next action obvious.

## 1. Scope And Authority

These principles apply to all authenticated product UI surfaces and any reusable component that can appear on those surfaces.

In scope:

- Dashboard, Work, Contracts, Contract detail, Tasks, Obligations, Approvals, Exceptions, Renewals, Evidence, Review, Reports, Health, Settings, Decisions, Campaigns, Accounts, Counterparties, Relationship workspaces, Advanced surfaces, Assurance surfaces, command palette, sidebar, header, loading routes, empty routes, forbidden states, not-found states, embedded tables, overlays, disclosures, and inline mutation panels.
- Active-risk, all-clear, filtered-empty, onboarding-empty, partial-data, failed-data, permission-denied, not-found, deleted, external-link-expired, loading, refreshing, mutation-pending, mutation-failed, mobile, keyboard-only, and long-content states.
- Page titles, section titles, empty-state copy, diagnostic copy, action labels, filter labels, table headers, navigation labels, command results, loading labels, accessible names, telemetry labels, and test fixtures.

Future UI changes must either follow this document or explicitly document why the target surface has a product reason to differ.

## 2. First-Fold Contract

Every operator surface must answer the highest-value operational questions before showing routine summaries:

- What is risky?
- What is overdue or due soon?
- Who owns it?
- What is blocked?
- What changed materially?
- What decision is needed?
- What recovery action is available?
- What data can be trusted?
- What can safely stay hidden?

The first fold should not primarily explain implementation architecture, table names, indexes, diagnostics, or metric availability.

## 3. Priority Ordering

Order visible content by operational consequence, not by source table, route history, or implementation convenience.

Default priority order:

1. Failed or terminal automation affecting user trust.
2. Critical exceptions and high-severity blockers.
3. Overdue work, expired deadlines, and SLA breaches.
4. Blocked work requiring dependency resolution.
5. Missing owner, missing approver, or missing accountable party.
6. Rejected, overdue, or missing evidence blocking work.
7. Renewal risk, notice deadlines, missing approved dates, and blocked renewal decisions.
8. Unhealthy contracts or data-quality gaps affecting trust.
9. Due-today work.
10. Partial or stale data affecting confidence in the current surface.
11. Recent material changes.
12. Routine counts, healthy totals, and historical context.
13. Diagnostics and implementation details.

If one category has active risk, suppress zero-value sibling categories. If every category is clear, show one compact all-clear summary.

## 4. Zero And Healthy States

Enterprise UIs should reserve screen space for decisions, exceptions, and recovery. Zero-work conditions are valuable, but they should not dominate the screen.

All-clear rules:

- Show exactly one compact all-clear state per surface.
- Use one sentence of operational copy.
- Include at most one primary follow-up action.
- Put diagnostics behind disclosure unless trust is affected.
- Do not render grids of empty modules.
- Do not show many zero-value cards as peer content.
- Do not repeat "nothing needs attention" in metrics, panels, and cards.

Good all-clear copy:

- "No exceptions requiring action."
- "No overdue, blocked, failed, or ownership-blocked work is visible for this workspace."
- "This lens has no visible work. Switch lenses or inspect health if the result looks stale."

Avoid:

- "No source objects match this V10 work index."
- "Durable work index has zero materialized records."
- "Read-model diagnostics are empty."

## 5. Active Risk Treatment

Active risk must be visually and structurally distinct.

Active-risk UI should:

- Rise above routine content.
- Include owner, deadline, severity, blocker, and next action when available.
- Use risk/attention tone only when the state truly deserves attention.
- Make the primary action explicit.
- Suppress inactive sibling modules.
- Avoid burying the item inside uniform cards.

Risk states should not rely on color alone. Use labels, headings, row order, icons where useful, and action copy.

## 6. Diagnostics Boundary

Diagnostics are necessary for trust and support, but they should not be the default operator narrative.

Default UI may mention diagnostics only when:

- Data is partial, stale, failed, or missing.
- A recovery path depends on diagnostics.
- The user needs to distinguish all-clear from unavailable data.
- Support handoff is likely.

Implementation details belong in diagnostic disclosures:

- Table names.
- Raw enum values.
- Internal IDs.
- Diagnostic IDs.
- Job class names.
- Runtime artifact identifiers.
- Read refresh internals.
- Failure payloads.
- Source reconciliation notes.

Diagnostic disclosures must be keyboard-accessible, support-safe, and proportional.

## 7. Copy And Terminology

Use user-operational language first.

Preferred terms:

- "Data freshness" instead of "read-model".
- "Work queue" instead of "durable work index".
- "Source record" instead of "source object" when a source concept must be visible.
- "Renewal risk" instead of "renewal posture".
- "Support artifact" instead of "runtime artifact" on default UI.
- "Health checks" or "trust checks" instead of "runtime diagnostics".
- "Bulk-compatible group" only when a real bulk action is available.

Terms banned from default operator surfaces unless inside diagnostics:

- `read-model`
- `durable work index`
- `source object`
- raw table names
- raw enum values with underscores
- `compatible action group`
- internal coverage names
- runtime artifact identifiers
- provider error payloads
- unredacted IDs that do not help the user act

Copy must be proportional:

- Severe states get enough explanation to recover.
- Partial states explain what is trustworthy and what may be stale.
- Failed states provide a direct recovery action and diagnostic path.
- All-clear states get one concise sentence.
- Diagnostics get details only after disclosure.

## 8. Action Labels And Affordance

Generic repeated links create false affordance. Use action verbs tied to the object and workflow.

Allowed default action verbs:

- Assign
- Approve
- Reject
- Retry
- Resolve
- Review
- Request
- Accept
- Export
- Import
- Continue
- Inspect
- Configure
- Browse
- Refresh
- Triage
- Recover

Use "Browse" for low-urgency navigation. Use "View" sparingly for passive inspection. Avoid repeated standalone "Open" when the destination and action are known.

Examples:

- "Review reports" instead of "Open reports".
- "Triage exceptions" instead of "Open exceptions".
- "Continue review" instead of "Open review queue".
- "Inspect health" instead of "Open health".
- "Review relationship" instead of "View below".
- "Retry job" instead of "Open failed job".

Every visible action should answer: what happens if I click this?

## 9. Layout Density

Use density intentionally.

Hero:

- Use for onboarding, first activation, true control-room summaries, and rare executive contexts.
- Do not use for routine queue pages.

Standard:

- Use for active risk, decisions, high-value summaries, and pages with a small number of meaningful panels.

Compact:

- Use for transactional queue pages, health summaries, reports, relationship workspaces, settings, and mature all-clear states.

Dense row:

- Use for large lists, tables, history, diagnostics, and repeated operational records.

Disclosure:

- Use for healthy diagnostics, support metadata, inactive modules, advanced internals, compatibility notes, and raw payload links.

Avoid nested cards when the inner content is a single empty state, a single link, or a zero metric.

## 10. Cards, Rows, Tables, And Chips

Use the right primitive for the information density.

Cards are for:

- Active risks.
- Decisions.
- Exceptions.
- Summary items with a meaningful action.
- Small high-value groups.

Rows are for:

- Work queues.
- Triage lanes.
- Diagnostics.
- History.
- Repeated operational records.

Tables are for:

- Dense contract lists.
- Review queues.
- Records that need comparison across columns.
- Bulk selection workflows.

Chips are for:

- Supporting metadata.
- Small counts.
- Status or severity hints.
- Never as the only way to communicate critical risk.

No-signal cells should be quiet, not filled with loud dashes or success badges.

## 11. Dashboard Principles

The dashboard is a triage surface, not a catalog of modules.

Dashboard must:

- Show exceptions and decisions first.
- Render active dashboard items only by default.
- Suppress empty sibling categories when another category is active.
- Compress all-clear into one strip.
- Put data freshness and workspace health behind diagnostics unless trust is affected.
- Treat recent activity as context, not success or risk.
- Avoid repeating the same signal across triage panel, metric grid, and lower cards.

Dashboard should not:

- Use a large metric grid as primary content.
- Present failed reports, evidence attention, overdue work, and recent changes with equal weight.
- Show many "Open" links across empty cards.

## 12. Work Queue Principles

Work is a needs-action surface.

Work must:

- Prioritize blocked, overdue, high severity, unassigned, due today, failed jobs, and failed reports.
- Show owner, due state, blocker, and next action.
- Use compact rows for large result sets.
- Keep source reconciliation in diagnostics.
- Make lens navigation proportional.
- Keep recently completed work separate from active work.
- Preserve telemetry for empty-state links and work-surface test IDs.

Work should not:

- Lead with lens counts, work item type counts, source diagnostics, or compatible action groups.
- Render per-section empty panels that compete with active work.
- Show raw secondary-action arrays as default content.

## 13. Contracts List Principles

Contracts list is an operational scanning surface.

Default column priority:

1. Contract.
2. Next action.
3. Deadline/risk.
4. Owner.
5. Status.
6. Updated.

Move "Created" and audit-heavy metadata out of default priority unless the current workflow requires it.

Contract rows should:

- Derive next action from row signals, status, owner, review stats, evidence, exceptions, and date gaps.
- Use readable labels, not abbreviations like "ex" or "ev".
- Keep risky rows scannable on narrow screens.
- Preserve horizontal scroll and sticky headers.
- Keep bulk actions secondary until selection exists.
- Explain selected scope across pages and filters.

## 14. Contract Detail Principles

Contract detail must answer:

- What is the contract?
- Who owns it?
- What is risky?
- What deadline matters?
- What changed?
- What action is next?

Detail pages should:

- Keep immediate actions above record navigation.
- Group navigation into Overview, Work, Evidence, Record, History, and More where appropriate.
- Preserve old anchors and tab deep links.
- Suppress empty overview modules unless the absence explains a trust gap.
- Move raw extraction, files, audit, maintenance, and diagnostics behind progressive disclosure unless they block action.
- Keep mutation controls aligned with primary/secondary action hierarchy.

## 15. Queue Page Principles

Tasks, obligations, approvals, exceptions, renewals, evidence, review, intake, maintenance, and data-quality queues should share one grammar:

- Object type.
- Title.
- Contract.
- Owner.
- Due state.
- Severity or status.
- Blocker or reason.
- Next action.
- Secondary disclosure.

Queue pages must sort by operational priority. Empty queues must be compact and must not create false affordance.

Queue-specific priority:

- Tasks: blocked, overdue, due today, high priority, owner, next task action.
- Approvals: SLA pressure, pending approver, delegation label, contract impact, approve/reject/review action.
- Obligations: overdue, due soon, blocked, owner, obligation type, evidence dependency, completion or waiver action.
- Exceptions: critical/high severity, unassigned, overdue, blocker reason, resolution or assignment action.
- Renewals: notice deadline, renewal deadline, missing approved dates, blocked dates, negotiation/checkpoint action.
- Evidence: overdue, rejected, missing, requester/submitter, contract, accept/reject/request action.
- Review: pending fields, next contract continuity, date gaps, completion action.
- Intake/import: failed/partial imports, row errors, retry/correct action.

## 16. Health, Reports, Decisions, Campaigns, And Shell

Health is impact-first:

- Data freshness issue.
- Failed or partial report.
- Retryable or failed job.
- Import/export issue.
- Notification delivery issue.
- Stale or expired idempotency claim.
- Support artifact requiring attention.
- Release/readiness blocker.
- Normal systems behind disclosure.

Reports should:

- Prioritize failed, partial, running, stale, and scheduled-summary issues.
- Put destination cards and report-family browsing after active issues.
- Explain trust in generated/downloaded data only when relevant.

Decisions should:

- Separate open, overdue, blocked, review-required, and recorded decisions.
- Avoid making completed decisions peer-priority with active decisions.

Campaigns should:

- Separate blocked, waiting for approval, running, failed automation, comparisons, and completed records.
- Keep payload JSON links inside diagnostics.

Shell should:

- Preserve skip links, landmarks, sidebar semantics, header focus order, mobile drawer behavior, and command palette lazy loading.
- Avoid decorative controls with no behavior.
- Badge actionable exceptions only, not normal counts.

## 17. Relationship, Portfolio, Advanced, And Assurance Surfaces

Advanced surfaces must not become loud internal dashboards.

Relationship pages should show:

- Relationship risk.
- Renewal exposure.
- Ownership gaps.
- Active exceptions.
- Failed reports or failed automation.
- Recent material changes.
- Then summaries and diagnostics.

Assurance and advanced pages should:

- Separate customer-facing operational risk from internal proof/readiness artifacts.
- Prioritize open findings, failed playbooks, blocked policies, low scorecards, and confidence drops.
- Keep telemetry and analysis visible only when it changes action.
- Preserve product-mode and route eligibility.

Release/readiness/evidence surfaces should avoid leaking acceptance vocabulary into default operator pages.

## 18. Forms, Mutations, Bulk Actions, And Recovery

Mutation UI must be specific, scoped, and recoverable.

Every mutation should provide:

- One primary action.
- Clear pending state.
- Disabled-state explanation.
- Scoped error recovery.
- Post-action state update or route refresh.
- Audit/telemetry continuity where required.

Bulk actions:

- Appear only after selection exists.
- State exact scope across pages and filters.
- Preserve selected IDs across pagination/filter changes where designed.
- Avoid ambiguity around "all" versus "selected".

Retry actions:

- Distinguish retryable, terminal, partial, already retrying, and stale.
- Link to the most useful recovery destination.
- Avoid raw system errors outside diagnostics.

Permission-disabled controls must explain the business reason: role, plan, product mode, missing prerequisite, stale data, or terminal state.

## 19. Data Freshness, URLs, Anchors, And Compatibility

Do not break existing navigation contracts casually.

Future UI work must:

- Preserve current URLs and query parsers unless intentionally migrated.
- Preserve or alias contract tabs, evidence anchors, dates anchors, ownership anchors, audit anchors, work lenses, contract filters, reports links, and health fragments.
- Keep data freshness visible only when stale, partial, failed, or relevant to trust.
- Avoid conflating source-table data with materialized work data in user copy.
- Preserve org scoping, role scoping, product-surface gating, and Supabase visibility filters.
- Preserve telemetry intent when moving UI behind disclosure.

When a UI element is compressed or moved, keep any product-significant telemetry that proves the state was shown or opened.

## 20. Loading, Empty, Error, Permission, And Mobile States

Loading:

- Skeleton geometry should match final compact hierarchy.
- Do not reserve old empty-card grids.
- Avoid avoidable layout shifts.

All-clear:

- Compact.
- One sentence.
- Optional browse action.
- Optional diagnostic disclosure.

Filtered empty:

- Show active filters.
- Provide clear/broaden action.

Onboarding empty:

- Can be more explanatory.
- Should guide setup.

Partial:

- Scoped warning.
- State what remains trustworthy.
- Provide health or retry path.

Failed:

- Alert.
- Direct recovery action.
- Diagnostic path.

Forbidden:

- Name the needed business permission or owner.
- Avoid generic authorization failure copy.

Mobile:

- Top action first.
- Active risk second.
- Filters after action/risk.
- Diagnostics last.
- Touch targets remain usable.

Keyboard:

- Tabs, disclosures, filters, command palette, tables, bulk actions, and inline mutations must be reachable and visibly focused.

## 21. Accessibility

UI hierarchy changes must preserve semantics.

Requirements:

- Keep heading order meaningful.
- Preserve `main` landmarks and skip links.
- Preserve dialog semantics in command palette.
- Scope `aria-live` to recoverable states.
- Use native `details`/`summary` or equivalent keyboard semantics for disclosure.
- Keep table headers associated with cells.
- Keep row actions and selection checkboxes screen-reader understandable.
- Do not rely on color alone for severity.
- Preserve focus rings on dense rows.
- Keep accessible names aligned with visible terminology.

## 22. Responsiveness And Performance

Do not trade clarity for heavy UI.

Requirements:

- Prefer dense rows/tables over hundreds of cards.
- Keep server components server-side when possible.
- Avoid unnecessary client components for presentational hierarchy.
- Do not introduce dependencies unless an existing pattern cannot support the behavior.
- Keep large pages incremental and maintainable.
- Do not move server-only formatting into client components without reason.
- Preserve sticky headers and horizontal overflow behavior.
- Test narrow, medium, wide, and dense-table layouts where practical.

## 23. Privacy And Security

Diagnostics must be support-safe.

Default UI must not expose:

- Secrets.
- Provider credentials.
- Signed URLs.
- Raw contract text.
- Raw evidence notes.
- Customer emails unless necessary to the workflow.
- Internal org IDs or user IDs unless necessary to support.
- Raw failure payloads.
- Export filenames or report details that reveal sensitive content unnecessarily.

Diagnostic disclosures should:

- Redact or summarize sensitive details.
- Show identifiers only when they help support or recovery.
- Keep download/export trust copy clear about selected scope, freshness, truncation, and user responsibility.

Do not weaken org scoping, role scoping, product-surface eligibility, or route access expectations.

## 24. Localization, Timezone, Theme, And Browser Behavior

Future UI should be localization-ready:

- Avoid concatenated grammar where possible.
- Centralize raw enum-to-label mapping.
- Allow longer translated labels.
- Preserve Unicode and RTL titles.
- Avoid brittle date strings.

Dates and times:

- Preserve business-date parsing rules.
- Use stable server-rendered dates or suppress hydration warnings where appropriate.
- Keep deadlines, relative times, report timestamps, renewal dates, notice deadlines, and audit timestamps timezone-safe.

Theme and browser:

- Use tokens rather than hard-coded colors where possible.
- Preserve dark mode, light mode, high-contrast behavior, reduced motion, hover/focus, and disabled-state contrast.
- Validate sticky headers, horizontal scroll, disclosures, segmented controls, drawers, and command palette overlays in supported browsers where feasible.

## 25. Telemetry, Docs, Release Evidence, And Rollout

Telemetry must remain semantically stable when UI is compressed or moved.

Track or preserve:

- All-clear impressions.
- Diagnostic disclosure opens where product-significant.
- Next-action clicks.
- Retry actions.
- Bulk actions.
- Command palette selections.
- Empty-state navigation.
- Partial-data impressions.

Docs and release evidence must be updated when UI behavior changes:

- Runbooks.
- Operator QA notes.
- Release evidence.
- Compatibility aliases.
- Release notes.
- Screenshots or visual references if they show old card-heavy states.

Rollout monitoring should include:

- Route errors.
- Hydration errors.
- Command palette errors.
- Report/export failures.
- Mutation recoverability.
- Partial data states.
- Diagnostic disclosure usage.
- All-clear impressions.

Do not invent a feature flag unless rollout risk requires it. Prefer existing product-surface/context gates.

## 26. Testing And Guardrails

Future UI changes must update the appropriate layer of tests.

Required test areas:

- Shared primitive tests.
- Component UI tests.
- Static source-contract tests.
- Route/copy/a11y tests.
- E2E smoke where feasible.
- Optional visual tests when baselines intentionally change.
- Privacy/redaction tests when diagnostics or failure messages move.
- Locale/timezone tests when date rendering changes.
- Telemetry assertions when empty states or diagnostics move.

Guardrails should catch:

- Implementation-first terms on default surfaces.
- Repeated generic "Open" links.
- Zero-state card grids.
- Active risks hidden below routine content.
- Broken deep links.
- Missing role/mode coverage.
- Missing all-clear/filtered-empty/partial/failed/forbidden/loading states.

Relevant local contracts include:

- `src/lib/ui/operational-copy.ts`
- `src/lib/ui/operational-priority.ts`
- `src/lib/ui/enterprise-ui-sweep-contract.ts`
- `src/components/ui/v10-recoverable-state.tsx`
- `src/components/ui/operational-summary-card.tsx`
- `src/components/contracts/contract-table.tsx`

## 27. Agent Compliance Checklist

Before changing UI, agents must check:

- Does the first fold show active risk or the next action before routine metrics?
- Are zero/healthy states compressed?
- Are diagnostics hidden unless trust or recovery depends on them?
- Are action labels contextual?
- Are default surfaces free of implementation-first terms?
- Are accessible names aligned with visible copy?
- Are mobile and keyboard order preserved?
- Are role, product mode, feature flag, and route eligibility preserved?
- Are URLs, anchors, query params, and telemetry attributes preserved or intentionally migrated?
- Are sensitive diagnostics support-safe?
- Are tests or static guardrails updated?

If a change violates one of these principles, document why in the code review or implementation notes and add a test or contract that prevents accidental drift.

## 28. Short Version

Use this short version when making a fast judgment:

- Show exceptions first.
- Compress normalcy.
- Use operator language.
- Disclose diagnostics.
- Make the next action specific.
- Preserve access, telemetry, anchors, and accessibility.
- Test the behavior, not just the markup.
