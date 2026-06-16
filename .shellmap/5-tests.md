Confirmed: `--shell-drawer-w` and `--shell-mobile-trigger` are referenced in `mobile-drawer.tsx` but have **no definition** anywhere in CSS (they resolve to nothing / fall back to width:auto). This is a latent bug worth noting in the digest. I now have everything to produce the consolidated digest.

# App-Shell Test & Style Catalogue

A precise inventory of every test that pins app-shell copy/structure, plus verbatim visual treatment (className strings, CSS recipes, design tokens) for the redesign. Test files live in `C:/Users/dizho/oblixa/src/components/layout/` (and one in `src/app/(dashboard)/`); the visual treatment they implicitly protect lives in the source components and `src/app/globals.css`.

---

## PART 1 — WHAT EACH TEST PINS (copy, test-ids, roles, structure, behavior)

### 1. `src/components/layout/sidebar.ui.test.tsx` (renders `Sidebar`)

**Test-ids asserted** (from `@/lib/qa/test-ids` → `shellTestIds`):
- `"primary-nav"` (`shellTestIds.primaryNav`) — the nav container; `.textContent` is repeatedly asserted.
- `"sidebar-collapse-toggle"` (`shellTestIds.sidebarCollapseToggle`).

**DOM IDs asserted (must stay stable):**
- `desktop-sidebar-body` — referenced via `document.getElementById("desktop-sidebar-body")` AND as the toggle's `aria-controls` value. Defined in `sidebar/constants.ts` as `DESKTOP_SIDEBAR_BODY_ID`.

**localStorage key:** `"oblixa.sidebar.collapsed"` — values `"1"` (collapsed), `"0"` (expanded). Set/asserted directly.

**Exact copy / link names asserted:**
- Core primary contains `"Dashboard"`; must NOT contain `"Decisions"` or `"Campaigns"`.
- `link name /^tasks$/i` with `aria-current="page"` on `/work`; must NOT render links named `work`, `approvals`, `obligations`, `exceptions`.
- Advanced surface contains `"Decisions"`, `"Campaigns"`, `"Relationships"`.
- `"Browse tools"` text must be absent in drawer when `showToolsLink={false}`; `"Tools"` absent from primary-nav.
- `link name /^tools$/i` must be null for Core even when `showToolsLink: true`.
- Badge: `getByText("7")`; `getByTitle("7 detail confirmation items need action")` whose `aria-label` === `"7 detail confirmation items need action"`.
- Collapsed link accessible name (verbatim): `"Contracts, 101 to review"` — asserted as both the `role="link"` name and its `aria-label`. The visible badge `getByTitle("101 detail confirmation items need action")` must have `aria-hidden="true"`.
- Section heading text `"Core"` must have className containing `"sr-only"`. The string `"Contract operations OS"` must NOT be present.
- `button name /^sign out$/i` must be **null** in the desktop sidebar (expanded and collapsed). Sign-out lives only in the account menu (desktop) and mobile drawer.
- Collapsed tooltip: focusing the Settings link shows text `/^Settings$/`; Escape hides it.
- Mobile open button: `button name /open navigation/i`.
- Drawer: `dialog name /navigation drawer/i`; its `firstElementChild?.tagName` === `"ASIDE"`; contains `button name /^close navigation$/i`; contains text `"Oblixa"` and `link name /^contracts$/i`.
- Focus-trap test references `link name /oblixa/i` (first focusable) and `button name /close navigation overlay/i` (last focusable).
- Badge title strings: `"2 detail confirmation items need action"`, `"3 detail confirmation items need action"`; `"9 watchlist items"` must be absent; `link name /^watchlists$/i` absent.
- Active query link: href `"/decisions?type=renewal"` gets `aria-current="page"`; `link name /^decision queue$/i` gets none.

**Roles / aria asserted:**
- `getAllByRole("navigation")` — all `aria-labelledby` values must be **unique** (`new Set(names).size === names.length`).
- Collapse toggle: `aria-controls="desktop-sidebar-body"`, `aria-expanded="true"` (default/expanded).
- Onboarding (`/onboarding/calibration`): collapse toggle (`sidebar-collapse-toggle`) must be **absent** (`queryByTestId(...)` null) and stored pref `"0"` not overwritten.

**Behaviors pinned:** mobile drawer opens on left (first child is `ASIDE`); Tab/Shift+Tab focus trap wraps between first link and overlay button; focus returns to open button after Escape / overlay click / close-button / nav-link click; drawer closes on route change; client `/api/workspace/nav-badges` refresh filters hidden keys and survives fetch rejection.

---

### 2. `src/components/layout/account-menu.ui.test.tsx` (renders `AccountMenu`)

**Trigger accessible name (exact):**
- `button name /account menu for jane doe/i` (when `displayName="Jane Doe"`). The trigger has `aria-expanded` toggling `"false"`→`"true"`.

**Menu item names (exact, role=menuitem):**
- `/^workspace settings$/i` → copy **"Workspace settings"**.
- `/account security/i` → copy **"Account security"**.
- `/sign out/i` → copy **"Sign out"**.
- `/billing and access/i` → copy **"Billing and access"** — present ONLY for `role="admin"`/owner; absent for `member`/`viewer`.

**Role pill copy:** text `"Admin"` present, text `"ADMIN"` must be **null** (sentence-case, never shouted).

**Behaviors:** closed menu renders no menuitems; clicking Sign out submits the form (calls mocked `signOut` once); activating a destination closes the menu and resets `aria-expanded` to `"false"`.

---

### 3. `src/components/layout/header.ui.test.tsx` (renders `Header`)

**Test-id asserted:** `"workspace-header-search"` (`shellTestIds.headerSearch`).

**Copy / breadcrumb asserted:**
- `getByText("Dashboard")` on `/dashboard`; text `/core/i` must be absent; text `"Tools"` absent in Core.
- Nested crumb `/contracts/review`: `link name "Contracts"` with `href="/contracts"`; leaf text `"Review queue"`.
- Account-name privacy: with only an email, `button name "Account menu"` (exact) exists; the email local-part `"altemailforroux"` must be absent; `button name /account menu for/i` must be **null**.

**Behavior (routing):** typing into the search and submitting the form pushes `"/search?q=renewals"`; empty submit pushes `"/search"` (no query string).

---

### 4. `src/components/layout/legal-footer.test.ts` (reads `legal-footer.tsx` source as text)

Source string MUST NOT contain: `href="/decisions`, `href="/campaigns`, `href="/assurance` (footer never links Advanced/Assurance hubs).

---

### 5. `src/components/layout/legal-footer.ui.test.tsx` (renders `LegalFooter`)

- `navigation name /footer links/i` exists (the `aria-label="Footer links"` nav).
- `link name "Security"` exists.
- Visible text `/does not provide legal advice/i` always present.
- `button name /view/i` must be **null** (no disclosure toggle).

---

### 6. `src/components/layout/sidebar-model.test.ts` (pure model `buildSidebarModel`)

Pins the navigation **data contract** (names/order/badges), not styling.
- **Core primary order (exact array):** `["Dashboard", "Contracts", "Tasks", "Renewals", "Evidence", "Reports", "Settings"]` — asserted both for non-collapsed and collapsed `variant: "rail"`.
- Core admin primary === Core primary (no advanced leakage).
- Advanced adds `"Decisions"`, `"Campaigns"`, `"Programs"`, `"Relationships"`.
- Assurance children (exact order): `["Findings", "Control policies", "Scorecards", "Playbooks", "Review boards", "Autopilot", "Segments", "Program evolution", "Health graph"]`.
- Badge display: rolled-up Contracts `badge.displayValue` === `"4"` / `"5"`; collapsed 99+ cap → `{ displayValue: "99+", label: "101 detail confirmation items need action" }`.
- Contracts active children (exact): `["All contracts", "Review queue"]`; "All contracts" `exactActive`, "Review queue" badge `displayValue "5"`.
- Tasks/Reports/Settings children === `[]`. Section labels exclude `"My views"` and `"Workspace navigation"`; section `ariaLabel`s are unique.
- `sidebarPrefetch`: `/contracts`, `/reports#portfolio-signals`, `/assurance/findings`, `/more` → `false`; `/dashboard` → `undefined`.

---

### 7. `src/components/layout/command-palette-surface-filter.test.ts` (reads `command-palette.tsx` source as text)

Source must contain literals: `isCmdkHrefAllowed`, `isCmdkHrefAllowed(item.href, surface)`, `isCmdkHrefAllowed(match.href, surface)`, `COMMAND_PALETTE_OPEN_EVENT`, `addEventListener(COMMAND_PALETTE_OPEN_EVENT`.

---

### 8. `src/components/layout/command-palette.ui.test.tsx` (renders `CommandPalette`) — also a shell test

**Test-id asserted:** `"command-palette-results"` (`shellTestIds.commandPaletteResults`).
**localStorage key:** `"oblixa.command-palette.recent"`.
**Roles / copy (exact):**
- `dialog name /command palette/i`.
- Placeholder `/search pages, queues, reports, tools/i` (exact source: **"Search pages, queues, reports, tools"** — but note the live `TopbarSearch`/`SearchField` chrome placeholder is "Search contracts, tasks, reports"; the palette's own input placeholder differs).
- Group header text `"Pages"`; quiet meta line `"/contracts"`; `"Recent"` marker.
- Result-type / status text: `"Contract"`, `"Acme Corp"`, `"Taylor Ops"`, `"Active"`, `"Inspect recovery action"`.
- Recovery copy: `"Command search could not load."`, `button name "Retry search"`, `link name "Review workspace health"` → href `/settings/health`; `link name "Review work queue"` → `/work`; `"Command search is partially available"`; `"No command result matched this query."` inside `[data-v10-diagnostic-id="v10_command_zero_result"]`.
- Trigger: `button name /open command palette/i`.

---

### 9. `src/components/layout/skip-link.ui.test.tsx` (renders `SkipLink`)

- `link name /skip to main content/i` (copy **"Skip to main content"**); clicking moves focus to `#main-content` (`MAIN_CONTENT_ID`).

---

### 10. `src/components/layout/workspace-required-state.ui.test.tsx`

- Text `"No workspace linked"` and `/ask a workspace admin/i` (copy: **"Ask a workspace admin to invite you to an organization."**).

---

### 11. `src/app/(dashboard)/layout.surface.test.ts` (reads `layout.tsx` source as text — pins exact className strings)

Three className strings must appear **verbatim** (any redesign of the content stack must update this test in lockstep):
```
"flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip [overflow-clip-margin:0.75rem] bg-transparent lg:shadow-[inset_8px_0_14px_-14px_color-mix(in_oklab,var(--text-primary)_22%,transparent)]"
"flex-1 overflow-x-clip [overflow-clip-margin:0.75rem] px-4 pb-5 pt-4 outline-none md:px-6 md:pb-6 md:pt-5 xl:px-8"
"ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip [overflow-clip-margin:0.75rem] pb-2"
```

---

## PART 2 — VERBATIM VISUAL TREATMENT (the redesign target)

### Test-id registry — `src/lib/qa/test-ids.ts`
`MAIN_CONTENT_ID = "main-content"`. `shellTestIds`: `headerTopbar:"workspace-header"`, `sidebarDesktop:"sidebar-desktop"`, `sidebarCollapseToggle:"sidebar-collapse-toggle"`, `sidebarMobileOpen:"sidebar-mobile-open"`, `sidebarMobileDrawer:"sidebar-mobile-drawer"`, `sidebarSignOut:"sidebar-sign-out"`, `primaryNav:"primary-nav"`, `headerSearch:"workspace-header-search"`, `commandPaletteTrigger/Root/Input/Results`. **These string values must be preserved or every shell test updated.**

### Shell design tokens — `globals.css` `:root` (light) — lines 79–141
```
--sidebar: #edefe9;
--sidebar-surface: #f4f6f0;        --sidebar-border: #d8dcd2;
--sidebar-muted: #5f6f68;          --sidebar-fg: #18201d;
--sidebar-raised: #ffffff;
--sidebar-brand-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent);
--sidebar-heading: color-mix(in oklab, var(--sidebar-fg) 50%, transparent);
--sidebar-section-border: color-mix(in oklab, var(--sidebar-fg) 13%, transparent);
--sidebar-hover: color-mix(in oklab, var(--sidebar-fg) 6%, transparent);
--sidebar-focus: color-mix(in oklab, var(--sidebar-fg) 66%, var(--accent));
--sidebar-warn-ink: #8a5a00;       --sidebar-danger-ink: #8b2f2f;
--shell-topbar-h: 4rem;            --shell-sidebar-w: 16rem;
--shell-sidebar-collapsed-w: 4rem; --shell-collapsed-slot: 2.75rem;
--shell-content-max: 1440px;       --shell-avatar-size: 2rem;
--shell-account-menu-w: 19.5rem;   --shell-tooltip-w: 17rem;
--sidebar-icon-idle: color-mix(in oklab, var(--sidebar-muted) 92%, transparent);
```
Dark mode (lines 169–180) re-defines `--sidebar: oklch(0.12 0.02 258)`, `--sidebar-surface: oklch(0.17 0.022 258)`, `--sidebar-raised: oklch(0.225 0.022 258)`, `--sidebar-border: oklch(0.27 0.02 258)`, `--sidebar-muted: oklch(0.71 0.018 254)`, `--sidebar-fg: oklch(0.96 0.006 252)`, etc.

**⚠ Latent token gap:** `--shell-drawer-w` (used in `mobile-drawer.tsx` aside width) and `--shell-mobile-trigger` (mobile open button h/w) are **referenced but never defined** in any CSS. They currently resolve to no value (auto). Define them during the redesign if drawer/trigger sizing matters.

### Sidebar (`sidebar.tsx`)
Desktop `<aside aria-label="Workspace" data-testid="sidebar-desktop">`:
```
ui-sidebar-surface sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex
```
Width toggles: `w-[var(--shell-sidebar-collapsed-w)]` (collapsed) vs `w-[var(--shell-sidebar-w)]`.
Body div (`id=desktop-sidebar-body`): `min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3`.
`primary-nav` wrapper: `space-y-2` (collapsed) / `space-y-1` (expanded).

`.ui-sidebar-surface` (globals.css 1522): `color:var(--sidebar-fg); background-color:var(--sidebar); background-image:linear-gradient(180deg, color-mix(in oklab, var(--sidebar-surface) 92%, var(--sidebar)) 0%, var(--sidebar) 100%);`

### Sidebar nav links — `.ui-sidebar-link*` recipes (globals.css 1532–1631)
```
.ui-sidebar-link { @apply relative flex min-h-10 min-w-0 items-center gap-3 px-3 py-2 text-[13px] font-medium;
  border-radius: var(--radius-md); color: var(--sidebar-muted);
  transition-property: background-color, color, border-color, box-shadow;
  transition-duration: var(--ui-duration-slow); transition-timing-function: var(--ui-ease-out); }
@media(min-width:1024px){ .ui-sidebar-link{ min-height:2.5rem; padding-top:.4375rem; padding-bottom:.4375rem; } }
.ui-sidebar-link-idle { color: var(--sidebar-muted); }
.ui-sidebar-link-parent { color: var(--sidebar-fg); }
.ui-sidebar-link-active { position:relative; color:var(--sidebar-fg); background-color:var(--sidebar-raised);
  background-image: linear-gradient(90deg, color-mix(in oklab,var(--accent) 9%,transparent) 0%, color-mix(in oklab,var(--accent) 3%,transparent) 56%, transparent 88%);
  box-shadow: 0 1px 2px color-mix(in oklab,var(--sidebar-fg) 9%,transparent); }
.ui-sidebar-link-active::before { content:""; position:absolute; left:0; top:22%; bottom:22%; width:2px;
  border-radius:0 3px 3px 0; background:var(--accent-strong); box-shadow:0 0 8px -1px color-mix(in oklab,var(--accent) 50%,transparent); }
.ui-sidebar-link-active-rail { @apply relative; background: color-mix(in oklab,var(--sidebar-raised) 86%,var(--accent));
  box-shadow:0 1px 2px color-mix(in oklab,var(--sidebar-fg) 8%,transparent); }
.ui-sidebar-link-active-rail::before { content:""; @apply absolute left-1.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full;
  background:var(--accent-strong); top:50%; bottom:auto; width:2px; }
.ui-sidebar-link-idle:hover { color:var(--sidebar-fg); background: color-mix(in oklab,var(--sidebar-hover) 70%,transparent); }
.ui-sidebar-sublink-active { color:var(--sidebar-fg); background: color-mix(in oklab,var(--accent) 10%,transparent);
  box-shadow: inset 2px 0 0 color-mix(in oklab,var(--accent-strong) 60%,transparent); }
.ui-sidebar-sublink-idle { color:var(--sidebar-muted); }
.ui-sidebar-sublink-idle:hover { color:var(--sidebar-fg); background: color-mix(in oklab,var(--sidebar-hover) 70%,transparent); }
.ui-sidebar-sublink-indent { padding-left: calc(0.75rem + 16px + 0.75rem); }
```
Nav-item (`sidebar-nav-item.tsx`): link base `ui-sidebar-link`; collapsed top-level adds `mx-auto h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] justify-center px-0`. Child link: `ui-sidebar-sublink-indent text-[12.5px]` + active/idle. Icon `size={16} strokeWidth={1.75}`, color `var(--accent-strong)` (selected) / `var(--sidebar-icon-idle)` (idle). No-icon marker dot: `h-1.5 w-1.5 shrink-0 rounded-full`, active `bg-[var(--sidebar-fg)]` else `border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent`. Label span `ui-nowrap-safe min-w-0 flex-1`. Parent chevron `ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]` strokeWidth 2.

Dark-mode override (2228–2253): `.ui-sidebar-link-active` gets `background-color: color-mix(in oklab,var(--accent) 26%,var(--sidebar-surface))`; `.ui-sidebar-link-active/.ui-sidebar-sublink-active` `background: color-mix(in oklab,var(--sidebar-fg) 18%,transparent)`.

### Sidebar section (`sidebar-section.tsx`)
Section spacing: rail `mt-2`; first `mt-0 pt-0`; others `mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5`. Heading `<h2>`: visible class `ui-caps-1 px-3 text-[10px]` with inline `style={{ color: "var(--sidebar-heading)" }}`; hidden → `sr-only` (this is what the "Core" heading test checks). Inner nav: `space-y-1.5` / `mt-2 space-y-1.5`. Item wrapper `space-y-0.5` + conditional `mt-2`.

### Sidebar brand (`sidebar-brand.tsx`)
`BRAND_TILE_CLASS`:
```
inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[15px] font-bold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]
```
Collapsed wrapper: `flex h-16 shrink-0 items-center justify-center border-b border-[var(--sidebar-section-border)] px-2`; brand link aria-label `"Oblixa — go to dashboard"`, glyph `O`, hover `hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`. Expanded wrapper: `...justify-between... px-3`; link `group flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`. Wordmark: **"Oblixa"** `truncate text-[15px] font-bold leading-none tracking-tight text-[var(--sidebar-fg)]`; tagline **"Contract follow-up"** `mt-1 truncate text-[10.5px] font-medium leading-none tracking-[0.02em] text-[var(--sidebar-muted)]`. Mobile close button: `ui-icon-button border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_3%,transparent)] p-2 text-[var(--sidebar-muted)] hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`, aria-label `"Close navigation"`, `<X size={18}>`.

### Sidebar footer (`sidebar-footer.tsx`)
ROLE_LABEL map: owner→Owner, admin→Admin, member→Member, viewer→Viewer, operator→Operator. Collapsed bar: `flex h-12 shrink-0 items-center justify-center border-t border-[var(--sidebar-section-border)] px-2`; toggle button `inline-flex h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`, aria-label `"Expand sidebar"`, title `"Expand sidebar (⌘\\)"`, `aria-expanded={false}`, `<PanelLeftOpen size={18} strokeWidth={1.85}>`. Expanded bar: `flex h-12 ... justify-between gap-2 border-t ... px-3`; role pill: `inline-flex min-w-0 items-center gap-1.5 text-[var(--sidebar-muted)]` with aria-label/title `"Your role in this workspace: {roleLabel}"`, `<Building2 size={14}>`, label `truncate text-[11.5px] font-medium leading-none`; toggle `inline-flex h-8 w-8 shrink-0 ... rounded-lg text-[var(--sidebar-muted)] ...` aria-label `"Collapse sidebar"`, title `"Collapse sidebar (⌘\\)"`, `aria-expanded={true}`, `<PanelLeftClose size={18}>`. Both toggles carry `data-testid="sidebar-collapse-toggle"` and `aria-controls="desktop-sidebar-body"`.

### Sidebar mobile account (`sidebar-account.tsx`)
Wrapper `border-t border-[var(--sidebar-section-border)] px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`; heading **"Account"** `ui-caps-1 px-3 pb-1.5 text-[10px]` inline `color: var(--sidebar-heading)`. Sign-out button `data-testid="sidebar-sign-out"`: `group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[13px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`; `<LogOut size={18}>` + span **"Sign out"**.

### Mobile drawer (`mobile-drawer.tsx`)
Trigger button `data-testid="sidebar-mobile-open"`, aria-label `"Open navigation"`:
```
fixed left-4 top-[max(0.625rem,env(safe-area-inset-top))] z-40 inline-flex h-[var(--shell-mobile-trigger)] w-[var(--shell-mobile-trigger)] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)] transition-colors duration-[var(--ui-duration)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden
```
Drawer root `fixed inset-0 z-50 flex lg:hidden`, `role="dialog" aria-modal="true" aria-label="Navigation drawer" data-testid="sidebar-mobile-drawer"`. Aside (must remain first child, tag ASIDE): `ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[var(--shell-drawer-w)] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]`. Overlay button aria-label `"Close navigation overlay"`: `ui-overlay-scrim h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`. `.ui-overlay-scrim`: `background: color-mix(in oklab,#18181b 64%,transparent); backdrop-filter: blur(12px); animation: ui-overlay-scrim-enter 150ms ease-out;`

### Header / topbar (`header.tsx`)
`<header data-testid="workspace-header" className="ui-topbar sticky top-0 z-30 shrink-0 px-4 md:px-6 xl:px-8">`. Inner row: `mx-auto flex h-[var(--shell-topbar-h)] w-full max-w-[var(--shell-content-max)] items-center gap-3 pl-12 md:gap-4 lg:pl-0`. Right cluster `flex min-w-0 flex-1 items-center justify-end gap-3`. Tools link (non-Core only): `ui-btn-ghost hidden h-10 shrink-0 items-center gap-1.5 px-3 py-0 text-[12.5px] font-semibold md:inline-flex`, aria-label `"Open tools"`, `<Wrench className="h-3.5 w-3.5">` + **"Tools"**.
`.ui-topbar`: `@apply relative border-b; backdrop-filter:none; border-bottom-color:var(--border-subtle); background: color-mix(in oklab,var(--canvas) 58%,var(--surface-raised));`

### Topbar breadcrumb (`topbar-breadcrumb.tsx`)
`<nav aria-label="Breadcrumb" className="hidden min-w-0 shrink items-center gap-2 lg:flex">`. Area medallion: `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-strong)_40%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]`. `<ol className="flex min-w-0 items-center gap-1.5">`, `<li className="flex min-w-0 items-center gap-1.5">`. Separator `<ChevronRight className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]">` strokeWidth 2. Link crumb: `ui-nowrap-safe max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-[12.5px] font-medium leading-[1.1] text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`. Leaf span: `max-w-[14rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]`, `aria-current="page"`. Crumb labels (copy): Dashboard / Contracts / Tasks / Renewals / Evidence / Reports / Settings / New contract / Import contracts / Review queue / Issues / Requirements / Approvals / Report history / Contract / System health / Diagnostics / Tools / Search / Set up workspace / Workspace. Settings leaf map: Security, Billing, Operations, Product, System health, Policy.

### Topbar search (`topbar-search.tsx` + `search-field.tsx` chrome variant)
Wrapper `min-w-0 flex-1 sm:max-w-[22rem] md:max-w-[26rem]`; `TIGHT_SEARCH_WIDTH = 360`. SearchField props: `variant="chrome"`, `testId="workspace-header-search"`, ariaLabel `"Search workspace"`, placeholder **"Search contracts, tasks, reports"** (tight: **"Search"**), kbdHint `⌘`/`K`, `ariaKeyShortcuts="Meta+K Control+K"`. Submit → `/search?q=...` or `/search`.
Chrome input sizeClass: `ui-input min-h-10 pl-11 pr-12 text-sm`. Form `role="search" className="relative w-full"`. Icon button aria-label `"Focus search input"`, `text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]`, `<Search h-4 w-4 strokeWidth={1.85}>`. Input `type="search"` (NOT combobox for chrome), `maxLength=120`. Clear-X (aria-label `"Clear search"`): `inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]`. Kbd hint span: `hidden items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:inline-flex` with `<kbd className="ui-kbd">`.

### Account menu (`account-menu.tsx`)
`DropdownMenu` props: `ariaLabel="Account"`, `align="end"`, `zIndexClassName="z-[60]"`, `widthClassName="w-[var(--shell-account-menu-w)]"`. Trigger button: `ui-account-trigger ui-chip-focus group`, aria-label `"Account menu for {displayName}"` or `"Account menu"`. Avatar span: `ui-avatar-tile h-[var(--shell-avatar-size)] w-[var(--shell-avatar-size)] rounded-[0.6rem] text-[12px] font-semibold`. Name span: `hidden min-w-0 max-w-[8.5rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:block`. Chevron: `hidden h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--ui-duration)] group-aria-expanded:rotate-180 sm:block`.
Panel header: avatar `ui-avatar-tile h-9 w-9 rounded-[0.7rem] text-[13px] font-semibold`; name `ui-text-compact-wrap text-[13px] font-semibold tracking-tight text-[var(--text-primary)]`; email `ui-nowrap-safe font-mono text-[11px] leading-snug tracking-[0.02em] text-[var(--text-tertiary)]`; role pill `mt-1.5 inline-flex max-w-max items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] font-semibold leading-none tracking-[0.01em] text-[var(--text-secondary)]`. Dividers: `mx-1 my-1 block h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]`. Section eyebrow **"Account"**: `ui-caps-2 px-2.5 pb-0.5 pt-1 text-[10px] text-[var(--text-tertiary)]`.
`itemClass` (shared menuitem):
```
ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] focus-visible:text-[var(--text-primary)] focus-visible:outline-none
```
Menu items (href / icon / copy): `/settings` Settings **"Workspace settings"**; `/settings/security` ShieldCheck **"Account security"**; `/settings/billing` CreditCard **"Billing and access"** (admin/owner only). Icons `h-4 w-4 shrink-0 text-[var(--text-tertiary)]` strokeWidth 1.85. Sign-out button (its own danger recipe, NOT itemClass): `ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] hover:text-[var(--danger-ink)] focus-visible:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] focus-visible:text-[var(--danger-ink)] focus-visible:outline-none` + `<LogOut h-4 w-4>` + **"Sign out"**.
`.ui-account-trigger`: `@apply inline-flex h-10 max-w-[14rem] shrink-0 items-center gap-2 rounded-full border px-1.5 pr-2.5 text-left transition-colors; border-color: color-mix(in oklab,var(--border-subtle) 86%,transparent); background:var(--surface-raised); box-shadow:none;` hover → `border-color: color-mix(in oklab,var(--accent) 28%,var(--border-subtle)); background: color-mix(in oklab,var(--accent-soft) 18%,var(--surface-raised));`
`.ui-avatar-tile`: `@apply flex items-center justify-center border; @apply h-10 w-10; border-radius:4px; border-color: color-mix(in oklab,var(--text-primary) 92%,transparent); background: var(--accent-strong); color:#f4f7f8;`
`.ui-chip-focus:focus-visible`: `outline: 2px solid color-mix(in oklab,var(--accent) 60%,transparent); outline-offset:2px; border-radius:inherit;`

### Legal footer (`legal-footer.tsx`)
`<footer id="legal-footer" className="ui-footer-shell shrink-0 px-4 py-2 md:px-6">`. Inner `mx-auto flex max-w-[1680px] flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4`. Text `<p className="flex min-w-0 items-start gap-1.5 text-[11px] leading-snug text-[var(--text-tertiary)] md:items-center">` with `<Info size={11} strokeWidth={1.85}>` and copy: **"Oblixa tracks contract follow-up after signature. It does not provide legal advice."** `LegalLinks variant="compact" className="shrink-0 gap-x-4 gap-y-1" aria-label="Footer links"`.
`.ui-footer-shell`: `@apply relative border-t; backdrop-filter:none; border-top-color:transparent; background: color-mix(in oklab,var(--canvas) 58%,var(--surface-raised));` + `::before` 1px top hairline `color-mix(in oklab,var(--text-primary) 16%,transparent)`.

### Legal links (`legal-links.tsx`)
LINKS (full): /security Security, /privacy Privacy, /terms Terms, /acceptable-use Acceptable use, /accessibility Accessibility, /cookies Cookies, /contact Contact. Compact = first 3 (Security, Privacy, Terms). Link class: `ui-nowrap-safe rounded-sm font-semibold leading-none text-[var(--text-tertiary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] hover:underline ... focus-visible:text-[var(--accent-strong)] ...` + compact size `text-[11px] tracking-[0.01em]` (full: `uppercase text-[10.5px] tracking-[0.14em]`). `.ui-legal-links`: `@apply flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium; color:var(--text-tertiary);`

### Skip link (`skip-link.tsx`)
`<a href="#main-content" className="ui-skip-link">Skip to main content</a>`. `.ui-skip-link`: `@apply absolute left-[-10000px] top-0 z-[200] h-px w-px overflow-hidden whitespace-nowrap;` `:focus` → `@apply left-4 top-4 h-auto w-auto overflow-visible whitespace-normal px-4 py-2.5 text-sm font-medium shadow-lg outline-none ring-2 ring-offset-2; border-radius:var(--radius-lg); background:var(--text-primary); color:var(--text-inverse); --tw-ring-color:var(--focus-ring);`

### Workspace required state (`workspace-required-state.tsx`)
`EmptyState` eyebrow **"Workspace access"**, title **"No workspace linked"**, copy **"Your account is not linked to an organization yet. Refresh this page, then contact your workspace admin if this keeps happening."**, action `<p className="ui-density-note">Ask a workspace admin to invite you to an organization.</p>`. Outer `ui-route-state-shell min-h-[48vh] px-0`; EmptyState `mx-auto w-full max-w-2xl`.

---

## PART 3 — CONSOLIDATED "MUST PRESERVE OR UPDATE-IN-TEST" CHECKLIST

**A. Test-id string values (changing any breaks ≥1 test):** `workspace-header`, `sidebar-collapse-toggle`, `sidebar-mobile-open`, `sidebar-mobile-drawer`, `sidebar-sign-out`, `primary-nav`, `workspace-header-search`, `command-palette-results`, `main-content`.

**B. Stable DOM ids:** `desktop-sidebar-body` (also the toggle `aria-controls`), `legal-footer`, `main-content`.

**C. localStorage keys:** `oblixa.sidebar.collapsed` (`"0"`/`"1"`), `oblixa.command-palette.recent`. Event name `oblixa:sidebar-collapsed-change`.

**D. Exact aria-labels / accessible names (quoted):** `"Workspace"` (aside), `"Open navigation"`, `"Close navigation"`, `"Close navigation overlay"`, `"Navigation drawer"` (dialog), `"Breadcrumb"`, `"Footer links"`, `"Search workspace"`, `"Open command palette"`, `"Command palette"` (dialog), `"Account menu"` / `"Account menu for {name}"`, `"Account"` (DropdownMenu), `"Skip to main content"`, `"Open tools"`, `"Expand sidebar"` / `"Collapse sidebar"`, `"Your role in this workspace: {role}"`, `"Oblixa — go to dashboard"`, `"Focus search input"`, `"Clear search"`, `"{n} detail confirmation items need action"`, `"Contracts, {n} to review"`.

**E. Exact visible copy (quoted):** `"Oblixa"`, `"Contract follow-up"`, `"Workspace settings"`, `"Account security"`, `"Billing and access"`, `"Sign out"`, `"Account"`, `"Admin"` (sentence-case — never `"ADMIN"`), `"Tools"`, `"Core"` (sr-only), `"Security"` (footer link), `"Oblixa tracks contract follow-up after signature. It does not provide legal advice."`, `"No workspace linked"`, `"Workspace access"`, `"Ask a workspace admin to invite you to an organization."`, `"Skip to main content"`, breadcrumb leaves (`"Review queue"`, `"Dashboard"`, `"Contracts"`, etc.), search placeholder `"Search contracts, tasks, reports"`.

**F. Role/aria invariants:** desktop sidebar has NO `button name /^sign out$/i`; all `<nav>` `aria-labelledby` unique; collapse toggle `aria-expanded` defaults `"true"`, hidden on `/onboarding/*`; first/collapsed section heading is `sr-only`; collapsed badge `aria-hidden="true"` with count carried in the link's `aria-label`; account trigger `aria-expanded` toggles; footer has NO `button name /view/i`; Core never renders `Tools`/`Decisions`/`Campaigns`/`Assurance`.

**G. Nav order contract (sidebar-model.test.ts):** Core primary exactly `["Dashboard","Contracts","Tasks","Renewals","Evidence","Reports","Settings"]`; Tasks/Reports/Settings have no children; Contracts-active children exactly `["All contracts","Review queue"]`.

**H. Source-text pins (will break on refactor even if behavior unchanged):** `legal-footer.tsx` must not contain `href="/decisions|/campaigns|/assurance`; `command-palette.tsx` must contain `isCmdkHrefAllowed(...)` + `COMMAND_PALETTE_OPEN_EVENT`; `layout.tsx` must contain the three exact content-stack className strings (Part 1 §11).

**I. Tokens safe to restyle but referenced by name:** all `--shell-*`, `--sidebar-*`, `ui-sidebar-*`, `ui-topbar`, `ui-account-trigger`, `ui-avatar-tile`, `ui-footer-shell`, `ui-overlay-scrim`, `ui-chip-focus`, `ui-caps-1/2`, `ui-skip-link`, `ui-legal-links`. None are asserted by tests (except `sr-only` and `ui-` via the `layout.surface` className-string check) — you may freely re-skin them, but `--shell-drawer-w` and `--shell-mobile-trigger` are **currently undefined** and should be defined during the pass.