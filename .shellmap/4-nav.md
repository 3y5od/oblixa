I now have everything needed. Here is the complete digest.

---

# Navigation source-of-truth & app-shell copy/style digest

## 1. Source-of-truth files

| Concern | File |
|---|---|
| Nav registry, types, active-path helpers | `C:/Users/dizho/oblixa/src/lib/navigation.ts` |
| Surface/permission filtering | `C:/Users/dizho/oblixa/src/lib/product-surface/nav-visibility.ts` |
| Sidebar model (sections, badges, ordering) | `C:/Users/dizho/oblixa/src/components/layout/sidebar-model.ts` |
| Sidebar shell render | `C:/Users/dizho/oblixa/src/components/layout/sidebar.tsx` |
| Sidebar sub-components | `C:/Users/dizho/oblixa/src/components/layout/sidebar/*.tsx` |
| Breadcrumb | `C:/Users/dizho/oblixa/src/components/layout/topbar/topbar-breadcrumb.tsx` |
| Sidebar CSS tokens + `ui-sidebar-*` classes | `C:/Users/dizho/oblixa/src/app/globals.css` |

---

## 2. `NAV_ITEMS` (full, quoted) — `src/lib/navigation.ts:147-399`

Each item below quotes `name`, `href`, `description`, `section`, `icon`, `badgeKey`, and `navChildren` exactly as defined.

**Dashboard** — name `"Dashboard"`, href `"/dashboard"`, description `"What needs action, what is due, and what you own."`, section `"primary"`, icon `"dashboard"`. No badgeKey. No navChildren. (searchGroup `"pages"`, searchSynonyms `["home","overview"]`)

**Contracts** — name `"Contracts"`, href `"/contracts"`, description `"Every contract you've added, with renewal and notice dates."`, section `"primary"`, icon `"contracts"`. No badgeKey. searchSynonyms `["contract","agreement","agreements","inventory"]`. navChildren:
- `"All contracts"` → `/contracts`, desc `"Every contract in the workspace with filters and search."`
- `"Review queue"` → `/contracts/review`, desc `"Review suggested contract dates, owners, and terms before they drive reminders and reports."`, `badgeKey: "reviewQueue"`, searchGroup `"queues"`, icon `"review-fields"`, actionVerb `"REVIEW"`, searchSynonyms `["review","confirm","approve","approval","details","fields","extraction"]`

**Tasks** — name `"Tasks"`, href `"/work"`, description `"Follow-up tasks, approvals, contract requirements, issues, and evidence requests."`, section `"primary"`, icon `"tasks"`. No badgeKey. searchGroup `"queues"`, searchSynonyms `["work","tasks","approvals","obligations","issues","exceptions","queue"]`. `navChildren: []` (empty). (Note the top-level label is **Tasks** even though href is `/work`.)

**Renewals** — name `"Renewals"`, href `"/renewals"`, description `"Upcoming renewal and notice dates."`, section `"primary"`, icon `"renewals"`. No badgeKey. No navChildren.

**Evidence** — name `"Evidence"`, href `"/evidence"`, description `"Evidence requests, collection, and audit trail."`, section `"primary"`, icon `"evidence"`. No badgeKey. No navChildren.

**Decisions** — name `"Decisions"`, href `"/decisions"`, description `"Decision workspaces and queue."`, section `"primary"`, icon `"decisions"`, `v5FlagsAnyOf: ["v5DecisionFoundation"]`. No badgeKey. navChildren (names → hrefs):
- `"Decision queue"` → `/decisions?queue=active`
- `"Manager review"` → `/decisions/review` (flag `v5ControlRoomUx`)
- `"Compare"` → `/decisions/compare` (flag `v5ControlRoomUx`)
- `"Renewals"` → `/decisions?type=renewal`
- `"Amendments"` → `/decisions?type=amendment_request`
- `"Waivers"` → `/decisions?type=waiver_exception`
- `"Policy"` → `/decisions?type=policy_exception`

**Campaigns** — name `"Campaigns"`, href `"/campaigns"`, description `"Change campaigns with preview and progress."`, section `"primary"`, icon `"campaigns"`, `v5FlagsAnyOf: ["v5PortfolioCampaigns"]`. navChildren:
- `"Active"` → `/campaigns?status=active`
- `"History"` → `/campaigns?status=closed`
- `"Remediation"` → `/campaigns?type=remediation_push`
- `"Compare"` → `/campaigns/compare`
- `"Simulations"` → `/campaigns#simulations`

**Assurance** — name `"Assurance"`, href `"/assurance"`, description `"Findings, controls, scorecards, and playbooks."`, section `"primary"`, icon `"assurance"`, `v5FlagsAnyOf: ["v6AssuranceCore","v6ControlPolicies","v6AdaptivePlaybooks","v6ReviewBoards","v6Autopilot","v6Segments"]`. navChildren:
- `"Findings"` → `/assurance/findings` (`v6AssuranceCore`)
- `"Control policies"` → `/assurance/control-policies` (`v6ControlPolicies`)
- `"Scorecards"` → `/assurance/scorecards` (`v6AssuranceCore`)
- `"Playbooks"` → `/assurance/playbooks` (`v6AdaptivePlaybooks`)
- `"Review boards"` → `/assurance/review-boards` (`v6ReviewBoards`)
- `"Autopilot"` → `/assurance/autopilot` (`v6Autopilot`)
- `"Segments"` → `/assurance/segments` (`v6Segments`)
- `"Program evolution"` → `/assurance/program-evolution` (`v6AssuranceCore`)
- `"Health graph"` → `/assurance/health-graph` (`v6AssuranceCore`)

**Relationships** — name `"Relationships"`, href `"/relationship-workspaces"`, description `"Account and counterparty summaries by stable keys."`, section `"primary"`, icon `"relationships"`, `v5FlagsAnyOf: ["v5RelationshipLayer"]`. No navChildren.

**Reports** — name `"Reports"`, href `"/reports"`, description `"Operational reports and exports."`, section `"primary"`, icon `"reports"`, searchGroup `"reports"`, actionVerb `"VIEW"`. No badgeKey/navChildren.

**Tools** — name `"Tools"`, href `"/more"`, description `"Secondary tools, maintenance, and admin-only destinations."`, section `"primary"`, icon `"more"`, searchGroup `"tools"`, searchSynonyms `["more","admin","utility","utilities"]`.

**Intake** — name `"Intake"`, href `"/contracts/intake"`, description `"Monitor intake queues and throughput."`, section `"operations"`. No icon/badge.

**Approvals** — name `"Approvals"`, href `"/contracts/approvals"`, description `"SLA-governed approvals and escalation bottlenecks."`, section `"operations"`, `badgeKey: "approvals"`.

**Obligations** — name `"Obligations"`, href `"/contracts/obligations"`, description `"Due obligations, ownership, and evidence status."`, section `"operations"`, `badgeKey: "obligations"`. (Registry name is "Obligations" but it is **section `operations`**, not surfaced in Core sidebar — see §9.)

**Programs** — name `"Programs"`, href `"/contracts/programs"`, description `"Manage contract program catalog and versions."`, section `"primary"`, icon `"programs"`.

**Execution graph** — name `"Execution graph"`, href `"/contracts/execution-graph"`, description `"Cross-task dependency view and input-needed states."`, section `"operations"`.

**Collaboration** — name `"Collaboration"`, href `"/contracts/collaboration"`, description `"Notes, mentions, and contract-detail collaboration."`, section `"operations"`.

**Review cadence** — name `"Review cadence"`, href `"/contracts/review-cadence"`, description `"Weekly and monthly review ritual workspace."`, section `"operations"`.

**Analytics** — name `"Analytics"`, href `"/contracts/analytics"`, description `"Contract trends and operational KPIs."`, section `"operations"`.

**Data quality** — name `"Data quality"`, href `"/contracts/data-quality"`, description `"Completeness, lineage confidence, and remediation targets."`, section `"operations"`.

**Maintenance** — name `"Maintenance"`, href `"/contracts/maintenance"`, description `"Data hygiene and cleanup operations."`, section `"operations"`.

**Watchlists** — name `"Watchlists"`, href `"/contracts/watchlists"`, description `"Contracts you explicitly monitor."`, section `"personal"`, `badgeKey: "watchlists"`.

**Persona dashboard** — name `"Persona dashboard"`, href `"/dashboard/persona"`, description `"Role-specific dashboard views."`, section `"personal"`.

**Settings** — name `"Settings"`, href `"/settings"`, description `"Profile, workspace, team, billing, notifications, security, and export settings."`, section `"primary"`, icon `"settings"`, searchGroup `"tools"`, actionVerb `"MANAGE"`.

---

## 3. `PRIMARY_NAV_GROUPS` — `src/lib/navigation.ts:126-145`

```
{ label: "Workspace", hrefs: ["/dashboard","/contracts","/work","/renewals","/evidence","/reports","/settings"] }
{ label: "Advanced",  hrefs: ["/decisions","/campaigns","/contracts/programs","/relationship-workspaces"] }
{ label: "Assurance", hrefs: ["/assurance"] }
{ label: "Tools",     hrefs: ["/more"] }
```

Note: in the rendered sidebar the `"Workspace"` group label is rewritten to **`"Core"`** via `localPrimaryLabel()` in `sidebar-model.ts:291-293` (`label === "Workspace" ? "Core" : label`).

---

## 4. `isActivePath` / `isContractsRoot` / `getWorkflowAreaForNavItem` (high level) — `navigation.ts:448-517`

- **`isContractsRoot(pathname)`** — returns false unless path starts with `/contracts`; `/contracts` → true; otherwise true only if the path is **not** any of `CONTRACTS_SUBROUTES`. `CONTRACTS_SUBROUTES` is derived dynamically from every NAV_ITEM href/child href under `/contracts/` plus an explicit `ADDITIONAL_CONTRACTS_SUBROUTES` list (`/contracts/bulk`, `/contracts/reports`, `/contracts/tasks`, `/contracts/renewals`, `/contracts/exceptions`, `/contracts/evidence-studio`). So sub-surfaces don't light up the Contracts inventory root.
- **`isActivePath(pathname, href)`** — `/contracts` delegates to `isContractsRoot`. `/renewals` is active for both `/renewals*` **and** `/contracts/renewals*`. `/evidence` active for `/evidence*` **and** `/contracts/evidence-studio*`. `/settings` active for `/settings*`. Default: exact match or `pathname.startsWith(`${href}/`)`.
- **`getWorkflowAreaForNavItem(item)`** — maps href → `WorkflowArea`: `/dashboard*` → `"monitor"`; `/assurance*` (or `/api/assurance*`) → `"assurance"`; `/reports`, `/contracts/reports`, `/reports#*` → `"insights"`; `/settings*`, section `"workspace"`, or `/more` → `"workspace"`; everything else → `"workflows"`. `WORKFLOW_AREA_LABELS` maps these to `Monitor / Workflows / Assurance / Insights / Workspace`.

---

## 5. `WorkspaceRole` type — `navigation.ts:6-13`

```
"admin" | "editor" | "viewer" | "ops_manager" | "legal_reviewer" | "finance_reviewer" | "manager"
```

---

## 6. Breadcrumb / page-label derivation — `topbar-breadcrumb.tsx`

Breadcrumbs are **not** derived from a single route-title map — they come from a hand-written `resolveBreadcrumb(pathname)` switch (`topbar-breadcrumb.tsx:60-105`), independent of `NAV_ITEMS`. Hard-coded crumb constants at the top: `CONTRACTS {label:"Contracts",href:"/contracts"}`, `TASKS {label:"Tasks",href:"/work"}`, `REPORTS`, `SETTINGS`. Key mappings (the label source the spec asks about):
- `/contracts/new` → `[Contracts, "New contract"]`
- **`/contracts/bulk` → `[Contracts, "Import contracts"]`** (line 66 — this is where "Import contracts" originates as a breadcrumb)
- `/contracts/review` → `[Contracts, "Review queue"]`
- `/contracts/exceptions` → `[Tasks, "Issues"]`
- `/contracts/obligations` → `[Tasks, "Requirements"]`
- `/work*` → `["Tasks"]`
- `/settings/*` resolved via `SETTINGS_LEAF` map (Security/Billing/Operations/Product/System health/Policy)
- Fallback (Advanced/Assurance) uses `NAV_ITEMS` + `WORKFLOW_AREA_LABELS` + `getWorkflowAreaForNavItem`.

Separately, **page `<h1>`/`<title>` metadata** come from spec-string constants, not the breadcrumb:
- `/work` title = `WORK_PAGE_TITLE = "Tasks"` (`src/lib/work/spec-strings.ts:2`)
- `/contracts/review` title = `FIELD_REVIEW_TITLE = "Contract Review Queue"` (`src/lib/field-review/spec-strings.ts:1`)

---

## 7. Copy-rule verification (PASS/FAIL with actual strings)

| Rule | Result | Actual current string / source |
|---|---|---|
| `/work` displays as "Tasks" | **PASS** | Nav label `"Tasks"` (`NAV_ITEMS`, href `/work`); breadcrumb `["Tasks"]`; page title `WORK_PAGE_TITLE = "Tasks"`. No "Work" appears as a user-visible label. |
| `/contracts/bulk` displays as "Import contracts" | **PASS** | Breadcrumb leaf `"Import contracts"` (`topbar-breadcrumb.tsx:66`). |
| `/contracts/review` displays as "Contract Review Queue" or "Review queue" | **PASS (both)** | Breadcrumb leaf `"Review queue"` (`topbar-breadcrumb.tsx:67`); nav child name `"Review queue"`; page title `FIELD_REVIEW_TITLE = "Contract Review Queue"`. |
| No "Obligation"/"Exception"/"Blocked"/"Computed" in **visible nav/breadcrumb copy** | **PASS for breadcrumb; PARTIAL for nav registry** | Breadcrumb already uses the corrected vocabulary: `/contracts/exceptions → "Issues"`, `/contracts/obligations → "Requirements"`. Grep for `Obligation\|Exception\|Blocked\|Computed` across `src/components/layout/**` returned **No matches**. **However**, the words still exist in the **NAV_ITEMS registry**: item name `"Obligations"` + description `"Due obligations…"` (operations), item name `"Approvals"` desc mentions nothing, and `Tasks` description/searchSynonyms still contain `"obligations"`, `"issues"`, `"exceptions"`. These registry items are `section: "operations"` and **hidden in Core mode** (see §9), so they don't render in the public Core sidebar/breadcrumb — but if Advanced mode surfaces them, the raw "Obligations" label would appear. The user-facing replacements per spec (Contract requirement / Problem / Cannot proceed / Calculated) are **not** applied to the registry `name`/`description` fields. Flag for the redesign: rename registry `Obligations` → requirement vocabulary if it can ever surface. |
| Bottom item shows "Admin" — source | **IDENTIFIED** | It is **not a nav item**. The sidebar bottom shows a workspace **role badge**, rendered by `SidebarFooter` (`src/components/layout/sidebar/sidebar-footer.tsx`). The string comes from the local `ROLE_LABEL` map at lines 5-11: `{ owner:"Owner", admin:"Admin", member:"Member", viewer:"Viewer", operator:"Operator" }`, keyed by the `role` prop lower-cased (line 31). So an "Admin" at the rail bottom = the current user's role is `admin`. The same label map also exists in `src/lib/roles.ts:9` (`admin:"Admin"`) and is used as a role badge in the settings/account surfaces. |

---

## 8. Permission filtering (`nav-visibility.ts`) — core vs advanced/assurance/utility

`isNavItemVisibleForSurface(item, input)` (lines 153-199) is the gate for sidebar + cmd-K. Order:
1. `canAccessItem(item, role)` (role gate via `minRole`).
2. **Core-mode section gate**: if `mode === "core"` and `item.section` is set and `!== "primary"` → hidden. (This is why all `operations`/`personal` items vanish in Core.)
3. `/more` (Tools): hidden in Core; otherwise honors `utilityModulesHidden.more_tools`.
4. `/reports` and `/contracts/reports` always visible.
5. Core + a **core-utility path** (`isCoreUtilityNavPath`) → hidden; plus per-module `utilityModulesHidden` (intake, data_quality, review_cadence, watchlists, execution_graph, approval_workload, approval_sla_simulator).
6. V5 feature-flag gate (`isV5NavItemVisible`).
7. **Advanced modules** (`advancedModuleForHref`: compare_views, analytics, maintenance, collaboration, decisions, campaigns, programs, relationships): hidden in Core; require `seesAdvancedPrimaryNav`; respect `advancedModulesHidden`.
8. **Assurance** (`isAssuranceHref` or name `"Assurance"`): require `seesAssuranceNav`; respect `assuranceModulesHidden` (findings, control_policies, scorecards, playbooks, autopilot, review_boards, segments, program_evolution, health_graph).
9. `/dashboard/persona` hidden in Core for viewer/legal_reviewer/finance_reviewer.

`isNavChildVisibleForSurface` (201-235) applies the analogous flag/mode/advanced/assurance gates to child links, plus Reports-hash min-mode (`reportsNavChildMinMode`).

`filterNavBadgesForSurface` (237-277) strips badge counts (`reviewQueue`/`approvals`/`obligations`/`watchlists`) whose owning surface isn't visible, and logs a diagnostic.

`roleMayBypassProductRoute(role)` → true only for `admin`.

Takeaway for the redesign: keep calling `isNavItemVisibleForSurface` / `isNavChildVisibleForSurface` (via `sidebar-model.ts`'s `visibleNavItems` and `toSidebarItem`) and `filterNavBadgesForSurface` — do not re-implement filtering in the new shell, or Core-mode hiding and advanced/assurance gating will break.

---

## 9. Sidebar model structure — `sidebar-model.ts`

`buildSidebarModel` produces `sections[]`. Branches:
- **`forcedCollapsed` (rail)**: only a `"Primary"` rail section (all primary items) + optional `"Workspace"` rail; `variant:"rail"`, `visibleWhenCollapsed:true`.
- **Expanded**: one section per `PRIMARY_NAV_GROUPS` group (`variant:"primary"`, label "Workspace"→"Core"); then `"Workflow queues"` (`variant:"secondary"`, only non-Core, ops items not already shown as primary children, capped at 6 + a `"Browse all queues"` overflow row → `/more?section=workflows`); then `"My views"` (`variant:"secondary"`, personal); then `"Workspace"` (`variant:"workspace"`).
- **Child rows render only when the parent is active** (contextual subnav, `toSidebarItem:251-267`). Inactive/collapsed → child queue counts roll up onto the parent chip.
- Active detection: `isSidebarHrefVisuallyActive` → query/hash targets use exact match, else `isActivePath`.

Badge copy (model-owned):
- expanded aria/title via `badgeLabel`: e.g. `"3 pending approvals need action"`, `"2 obligations need attention"`, `"1 detail confirmation item needs action"`, `"N watchlist items need attention"`.
- collapsed tooltip meaning via `collapsedBadgeMeaning`: `"N to review"`, `"N approvals to act on"`, `"N requirements"`, `"N alerts"`. (Note: `obligations` tone surfaces as **"requirement(s)"** here — corrected vocabulary.)

---

## 10. Exact visual treatment (verbatim classNames, tokens, copy)

### 10a. `sidebar.tsx` (shell `<aside>`)
- Desktop aside className (line 283-285):
  `ui-sidebar-surface sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex` + width `w-[var(--shell-sidebar-collapsed-w)]` (collapsed) / `w-[var(--shell-sidebar-w)]` (expanded). `aria-label="Workspace"`.
- Body wrapper (line 229): `min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3`. Inner nav container: `space-y-2` (collapsed) / `space-y-1`.

### 10b. `SidebarBrand` (`sidebar-brand.tsx`)
- `BRAND_TILE_CLASS` (line 7-8):
  `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[15px] font-bold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]`
- Brand row container: `flex h-16 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-3`; collapsed: `…justify-center…px-2`.
- Brand link: `group flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`.
- Collapsed tile link adds: `transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`; `aria-label="Oblixa — go to dashboard"`.
- Wordmark: `truncate text-[15px] font-bold leading-none tracking-tight text-[var(--sidebar-fg)]` → text **"Oblixa"**. Category line: `mt-1 truncate text-[10.5px] font-medium leading-none tracking-[0.02em] text-[var(--sidebar-muted)]` → text **"Contract follow-up"**.
- Mobile close button: `ui-icon-button border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_3%,transparent)] p-2 text-[var(--sidebar-muted)] hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`; `aria-label="Close navigation"`.

### 10c. `SidebarSection` (`sidebar-section.tsx`)
- `<section>` className: `rail`→`mt-2`; first→`mt-0 pt-0`; else→`mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5`.
- Heading `<h2>`: visually-hidden (`sr-only`) when collapsed/first; else `ui-caps-1 px-3 text-[10px]` with inline `style={{ color: "var(--sidebar-heading)" }}`. Text = section label (e.g. **"Core"**, **"Advanced"**, **"Assurance"**, **"Tools"**, **"Workflow queues"**, **"My views"**, **"Workspace"**).
- Inner `<nav>`: `space-y-1.5` (collapsed/hidden-heading) / `mt-2 space-y-1.5`.
- Per-item wrapper: `space-y-0.5` + conditional `mt-2` on Dashboard (i===1) and last item in first section.

### 10d. `SidebarNavItem` (`sidebar-nav-item.tsx`)
- Base link: `ui-sidebar-link` + (collapsed top-level) `mx-auto h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] justify-center px-0` + a state class:
  - child active → `ui-sidebar-sublink-indent text-[12.5px] ui-sidebar-sublink-active`; child idle → `…ui-sidebar-sublink-idle`
  - collapsed active → `ui-sidebar-link-active-rail`; collapsed idle → `ui-sidebar-link-idle`
  - parent-expanded → `ui-sidebar-link-parent`
  - top-level active → `ui-sidebar-link-active`; idle → `ui-sidebar-link-idle`
- Icon: lucide `size={16} strokeWidth={1.75} className="shrink-0"`, inline `style.color`: selected → `var(--accent-strong)`; parent-expanded → inherits (undefined); else → `var(--sidebar-icon-idle)`.
- No-icon top-level marker dot: `h-1.5 w-1.5 shrink-0 rounded-full` + active `bg-[var(--sidebar-fg)]` / idle `border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent`.
- Label span: `ui-nowrap-safe min-w-0 flex-1`.
- Parent chevron (`ChevronDown`): `ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]` `strokeWidth={2}`.
- `aria-current={exactActive ? "page" : undefined}`; collapsed `aria-label={item.collapsedLabel}`.

### 10e. `SidebarBadge` (`sidebar-badge.tsx`)
- Tone styles (inline `CSSProperties`): obligations → ink `var(--sidebar-danger-ink)`, bg `color-mix(in oklab, var(--sidebar-danger-ink) 13%, transparent)`, border `…40%…`. reviewQueue/approvals → `var(--sidebar-warn-ink)` (13% bg / 40% border). neutral → `var(--sidebar-fg)` 80% ink / 9% bg / 20% border.
- Collapsed chip: `absolute -right-1 -top-1 inline-flex h-[1.05rem] items-center justify-center rounded-full border text-[9px] font-semibold leading-none tabular-nums ring-2 ring-[var(--sidebar)]` + `w-[1.05rem]` (single) / `min-w-[1.05rem] px-1`. `aria-hidden="true"`, `title={badge.label}`.
- Expanded chip: `ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold leading-none`; inner count `tabular-nums`, noun `font-medium tracking-tight`. Noun via `navCountNoun`: **review/approval/requirement/alert** (pluralized). `aria-label`/`title` = full badge label.

### 10f. `SidebarFooter` (`sidebar-footer.tsx`) — the "Admin" role badge
- Expanded container: `flex h-12 shrink-0 items-center justify-between gap-2 border-t border-[var(--sidebar-section-border)] px-3`; collapsed: `…justify-center…px-2` `h-12`.
- Role badge span: `inline-flex min-w-0 items-center gap-1.5 text-[var(--sidebar-muted)]`; `aria-label`/`title` = `` `Your role in this workspace: ${roleLabel}` ``. Icon `Building2 size={14} strokeWidth={1.85}`. Label span: `truncate text-[11.5px] font-medium leading-none` (`aria-hidden`) → text = **roleLabel** (e.g. "Admin").
- Collapse buttons (`PanelLeftClose`/`PanelLeftOpen size={18}`): `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`. Collapsed variant uses `h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)]`. aria-labels **"Collapse sidebar"** / **"Expand sidebar"**, titles **"Collapse sidebar (⌘\\)"** / **"Expand sidebar (⌘\\)"**.

### 10g. `SidebarMobileAccount` (`sidebar-account.tsx`)
- Container: `border-t border-[var(--sidebar-section-border)] px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Heading: `ui-caps-1 px-3 pb-1.5 text-[10px]` style `color:var(--sidebar-heading)` → **"Account"**.
- Sign-out button: `group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[13px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]` → label **"Sign out"** (`LogOut size={18}`).

### 10h. `mobile-drawer.tsx`
- Trigger button: `fixed left-4 top-[max(0.625rem,env(safe-area-inset-top))] z-40 inline-flex h-[var(--shell-mobile-trigger)] w-[var(--shell-mobile-trigger)] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)] transition-colors duration-[var(--ui-duration)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden`; `aria-label="Open navigation"` (`Menu size={18}`).
- Drawer root: `fixed inset-0 z-50 flex lg:hidden`, `role="dialog" aria-modal="true" aria-label="Navigation drawer"`. Drawer aside: `ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[var(--shell-drawer-w)] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]`. Scrim: `ui-overlay-scrim h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`, `aria-label="Close navigation overlay"`.

### 10i. `CollapsedTooltip` (`collapsed-tooltip.tsx`)
- Portaled span, inline `style`: `position:fixed; top; left; transform:translateY(-50%); maxWidth:var(--shell-tooltip-w)`. className: `pointer-events-none z-[70] truncate whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)]`. `aria-hidden="true"`.

### 10j. `TopbarBreadcrumb` (`topbar-breadcrumb.tsx`)
- `<nav aria-label="Breadcrumb">`: `hidden min-w-0 shrink items-center gap-2 lg:flex`.
- Area medallion span: `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-strong)_40%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]`; icon `h-4 w-4 strokeWidth={1.85}`.
- `<ol>`: `flex min-w-0 items-center gap-1.5`; `<li>`: `flex min-w-0 items-center gap-1.5`. Separator `ChevronRight`: `h-3 w-3 shrink-0 text-[var(--text-tertiary)]` `strokeWidth={2}`.
- Link crumb: `ui-nowrap-safe max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-[12.5px] font-medium leading-[1.1] text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`.
- Current/leaf crumb span: `max-w-[14rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]`; `aria-current="page"` on last.

---

## 11. CSS custom properties & `ui-sidebar-*` classes (verbatim) — `globals.css`

**Light-mode tokens** (`:root`, lines ~58-141):
```
--accent: #2257d6;  --accent-strong: #0b49c8; /* cobalt */  --accent-soft: #dce7fa;
--sidebar: #edefe9;
--sidebar-surface: #f4f6f0;  --sidebar-border: #d8dcd2;  --sidebar-muted: #5f6f68;
--sidebar-fg: #18201d;  --sidebar-raised: #ffffff;
--sidebar-brand-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent);
--sidebar-heading: color-mix(in oklab, var(--sidebar-fg) 50%, transparent);
--sidebar-section-border: color-mix(in oklab, var(--sidebar-fg) 13%, transparent);
--sidebar-hover: color-mix(in oklab, var(--sidebar-fg) 6%, transparent);
--sidebar-focus: color-mix(in oklab, var(--sidebar-fg) 66%, var(--accent));
--sidebar-warn-ink: #8a5a00;  --sidebar-danger-ink: #8b2f2f;
--sidebar-icon-idle: color-mix(in oklab, var(--sidebar-muted) 92%, transparent);
--shell-sidebar-w: 16rem;  --shell-sidebar-collapsed-w: 4rem;
--shell-collapsed-slot: 2.75rem;  --shell-tooltip-w: 17rem;
--color-sidebar-border: var(--sidebar-border);
```
(Also referenced but defined elsewhere: `--shell-mobile-trigger`, `--shell-drawer-w`, `--ui-duration`, `--ui-duration-slow`, `--ui-ease-out`, `--radius-md`, `--radius-lg`, `--surface-raised`, `--surface-contrast`, `--border-subtle`, `--border-strong`, `--text-primary/secondary/tertiary`, `--focus-ring`, `--shadow-1/2`, `--danger-ink`.)

**Dark-mode overrides** (lines ~157-180): `--accent: oklch(0.72 0.19 264)`, `--accent-strong: oklch(0.8 0.17 266)`, `--accent-soft: oklch(0.3 0.07 262)`, `--sidebar: oklch(0.12 0.02 258)`, `--sidebar-surface: oklch(0.17 0.022 258)`, `--sidebar-raised: oklch(0.225 0.022 258)`, `--sidebar-border: oklch(0.27 0.02 258)`, `--sidebar-muted: oklch(0.71 0.018 254)`, `--sidebar-fg: oklch(0.96 0.006 252)`, `--sidebar-heading: …52%…`, `--sidebar-section-border: …11%…`, `--sidebar-hover: …10%…`, `--sidebar-focus: …70%…var(--accent)`, `--sidebar-warn-ink: oklch(0.86 0.12 84)`, `--sidebar-danger-ink: oklch(0.79 0.14 22)`.

**Class definitions:**
```css
.ui-sidebar-surface {
  color: var(--sidebar-fg);
  background-color: var(--sidebar);
  background-image: linear-gradient(180deg, color-mix(in oklab, var(--sidebar-surface) 92%, var(--sidebar)) 0%, var(--sidebar) 100%);
}
.ui-sidebar-link {            /* @apply relative flex min-h-10 min-w-0 items-center gap-3 px-3 py-2 text-[13px] font-medium; */
  border-radius: var(--radius-md);
  color: var(--sidebar-muted);
  transition-property: background-color, color, border-color, box-shadow;
  transition-duration: var(--ui-duration-slow);
  transition-timing-function: var(--ui-ease-out);
}
@media (min-width:1024px){ .ui-sidebar-link { min-height:2.5rem; padding-top:.4375rem; padding-bottom:.4375rem; } }
.ui-sidebar-link-idle   { color: var(--sidebar-muted); }
.ui-sidebar-link-parent { color: var(--sidebar-fg); }
.ui-sidebar-link-active {
  position: relative; color: var(--sidebar-fg);
  background-color: var(--sidebar-raised);
  background-image: linear-gradient(90deg, color-mix(in oklab, var(--accent) 9%, transparent) 0%, color-mix(in oklab, var(--accent) 3%, transparent) 56%, transparent 88%);
  box-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent);
}
.ui-sidebar-link-active::before {   /* left accent rail */
  content:""; position:absolute; left:0; top:22%; bottom:22%; width:2px;
  border-radius:0 3px 3px 0; background: var(--accent-strong);
  box-shadow: 0 0 8px -1px color-mix(in oklab, var(--accent) 50%, transparent); pointer-events:none;
}
.ui-sidebar-link-active-rail {      /* @apply relative; collapsed tile */
  background: color-mix(in oklab, var(--sidebar-raised) 86%, var(--accent));
  box-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 8%, transparent);
}
.ui-sidebar-link-active-rail::before { content:""; /* @apply absolute left-1.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full; */ background: var(--accent-strong); top:50%; bottom:auto; width:2px; }
.ui-sidebar-link-idle:hover { color: var(--sidebar-fg); background: color-mix(in oklab, var(--sidebar-hover) 70%, transparent); }
.ui-sidebar-sublink-active  { color: var(--sidebar-fg); background: color-mix(in oklab, var(--accent) 10%, transparent); box-shadow: inset 2px 0 0 color-mix(in oklab, var(--accent-strong) 60%, transparent); }
.ui-sidebar-sublink-idle    { color: var(--sidebar-muted); }
.ui-sidebar-sublink-idle:hover { color: var(--sidebar-fg); background: color-mix(in oklab, var(--sidebar-hover) 70%, transparent); }
.ui-sidebar-sublink-indent  { padding-left: calc(0.75rem + 16px + 0.75rem); }
```
**Focus ring** (shared, lines 886-892):
```css
.ui-sidebar-link:focus-visible { outline:none;
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 50%, var(--surface-raised)), 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
  transition: box-shadow 100ms ease-out; }
```
**`prefers-reduced-transparency`** (2228-2235): `.ui-sidebar-link-active` → `background-image:none; background-color: color-mix(in oklab, var(--accent) 26%, var(--sidebar-surface));`
**`prefers-contrast:more`** (2246-2255): active rows → `background: color-mix(in oklab, var(--sidebar-fg) 18%, transparent); box-shadow: inset 0 0 0 2px currentColor;` idle hover/focus → `box-shadow: inset 0 0 0 2px currentColor;`
**Helpers:** `.ui-nowrap-safe { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }` · `.ui-caps-1 { font-weight:700; letter-spacing:0.18em; text-transform:uppercase; }`

---

## 12. Sidebar icon map (`sidebar-icons.ts`) — lucide glyphs per `icon` key
`dashboard→LayoutDashboard, review→SearchCheck, contracts→FileText, tasks→ListChecks, renewals→CalendarClock, exceptions→BellRing, evidence→FileCheck2, reports→BarChart3, decisions→BadgeCheck, campaigns→Megaphone, assurance→Shield, relationships→GitBranch, programs→Boxes, settings→Settings, billing→CreditCard, more→Grid2x2, profile→UserRound, workspace-identity→Building2, team→Users, imports→Upload, security-account→ShieldCheck, notifications→Bell, export→Download, review-fields→ClipboardCheck`. Breadcrumb area medallion uses its own `AREA_ICON` map (Dashboard→LayoutDashboard, Contracts→FileText, Tasks→ListChecks, Renewals→CalendarClock, Evidence→FileCheck2, Reports→BarChart3, Settings→SettingsIcon, Tools→Wrench, Search→SearchIcon).

---

## Key takeaways for the redesign
1. **Two independent label sources** — nav labels live in `NAV_ITEMS` (registry), breadcrumb labels live in `topbar-breadcrumb.tsx`'s hand-written switch, page titles live in `*/spec-strings.ts`. They are kept in sync manually and pinned by `*.surface.test.ts`. The redesign must keep all three aligned.
2. **"Admin" at rail bottom is a role badge**, not a nav destination — `SidebarFooter` `ROLE_LABEL` map (also in `lib/roles.ts`). Don't mistake it for a nav item.
3. **Permission filtering must stay routed through `nav-visibility.ts`** (`isNavItemVisibleForSurface` / `isNavChildVisibleForSurface` / `filterNavBadgesForSurface`) via `sidebar-model.ts`. Core mode hides every non-`primary` section item.
4. **Vocabulary gap**: breadcrumb already uses Issues/Requirements (no Obligation/Exception/Blocked/Computed in the layout render path), but the `NAV_ITEMS` registry still literally contains `"Obligations"` (name + description) and `"obligations"/"issues"/"exceptions"` synonyms. Those items are `section:"operations"` (Core-hidden) but would surface with raw labels in Advanced mode — apply the Contract requirement / Problem vocabulary there if the redesign exposes them.