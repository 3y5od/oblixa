Confirmed end-to-end: the seeded dev user authenticates successfully against local Supabase. A live authenticated shell preview is fully feasible right now. I have everything needed for an exhaustive digest.

---

# Oblixa — Run & Visual-Verify Readiness Digest

## TL;DR (run/verify feasibility)

**A live authenticated preview is feasible right now.** Both prerequisites are already satisfied on this machine:
- Local **Supabase is running** (`http://127.0.0.1:54321/auth/v1/health` → `200`; `npx supabase status` reports API/DB/Auth up; Supabase CLI `2.106.0` installed).
- The **Next.js dev server is already up** on `http://localhost:3000` (port 3000 → `200`).
- The seeded dev user **logs in successfully**: `dev@oblixa.local` / `dev-password-12345` returns an access token (user id `cd414c43-…`), and the seed grants it `admin` on the default org with a completed Core onboarding. So `getAuthContext()` will resolve and the `(dashboard)` shell will render an authenticated workspace.

There is **no in-code auth bypass / mock** — the shell requires a real (local) Supabase session and an org membership. The feasibility comes entirely from the running local Supabase + seeded user, not from a dev shortcut.

---

## 1. Dev server command and port
- **Command:** `npm run dev` → `next dev --turbopack` (alias `dev:turbo`; webpack fallback `dev:webpack` → `next dev --webpack`).
- **Default port:** `3000` (`http://localhost:3000`). `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`.
- Next.js **16.2.6**, React **19.2.6**, Tailwind CSS **v4** (`tailwindcss ^4.3.0` + `@tailwindcss/postcss`), TypeScript 5.
- A dev server is **already running** on 3000 — reuse it (or restart) rather than spawning a duplicate.

## 2. Test commands (runner = Vitest 4; Playwright 1.60 for e2e)
- **Logic/unit (node env):** `npm run test:logic` → `vitest run` (config `vitest.config.ts`, `environment: "node"`, includes `src/**/*.test.ts(x)`, **excludes** `*.ui.test.*`).
- **UI/component (jsdom):** `npm run test:ui` → `vitest run --config vitest.ui.config.ts` (`environment: "jsdom"`, includes `src/**/*.ui.test.ts(x)`, setup `./src/test-utils/setup-ui.ts`). The shell components (`header.tsx`, `sidebar.tsx`, `command-palette.tsx`, `legal-footer.tsx`, etc.) are covered here.
- **Both:** `npm test` → `test:logic && test:ui`.
- **Watch:** `npm run test:logic:watch` / `npm run test:ui:watch`.
- **Run a single file:**
  - Logic: `npx vitest run path/to/file.test.ts`
  - UI: `npx vitest run --config vitest.ui.config.ts path/to/file.ui.test.tsx`
  - (Filter within a file with `-t "test name"`.)
- **e2e:** `npm run test:e2e` (Playwright). Visual snapshot lanes exist (`test:e2e:visual*`, gated by `PLAYWRIGHT_VISUAL=1`); authenticated visual lanes (`test:e2e:visual:auth`, `…:shell`) require `PLAYWRIGHT_VISUAL_AUTH=1 PLAYWRIGHT_REUSE_AUTH_STORAGE=1` + `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`.
- **Note:** The `(dashboard)/**/page.surface.test.ts` files **pin shell/page copy** — they are logic tests (vitest node) that will fail if you change user-visible copy. Run them after copy edits.

## 3. Can the `(dashboard)` shell render locally? (auth model)
**Yes, but only with a real local Supabase session — there is no dev bypass or mock.**

- `src/app/(dashboard)/layout.tsx` calls `getAuthContext()` (from `@/lib/supabase/server`). It also `notFound()`s if the `OBLIXA_PATHNAME_HEADER` is missing, and gates routes via `assertPagePathEligibleForContextOrNotFound`.
- `getAuthContext()` (in `src/lib/supabase/server.ts`) does `supabase.auth.getUser()`; **returns `null` if no user OR no org membership**. When `null`, `role` falls back to `"viewer"` and `navSurface` stays `null` (the shell renders chrome but no authenticated nav surface / per-org data). A fully authenticated workspace requires a logged-in user **with** an `organization_members` row.
- **No mock/bypass exists in code.** The only path to an authenticated shell locally is real Supabase auth.
- **Seeding (the supported path):**
  - `npm run seed:local-auth` → `scripts/seed-local-auth.mjs`. Refuses non-local Supabase URLs; requires Auth reachable. Upserts org `DEFAULT_ORG_ID`, sets the user as **admin**, full_name **"Maya Chen"**, Core workspace mode, onboarding `completed` (non-blocking), and seeds workspace data.
  - `npm run doctor:auth` → `scripts/check-local-auth-env.mjs` validates env + probes Auth.
- **Required env vars for an authenticated shell (all present in `.env.local`):**
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by admin client for membership/org lookups)
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  - `E2E_TEST_EMAIL=dev@oblixa.local`, `E2E_TEST_PASSWORD=dev-password-12345` (the seeded login)
  - Optional behavior gates: `REQUIRE_ACTIVE_SUBSCRIPTION` (unset → no billing gate), `ENABLE_DEMO_SEED`, feature flags `ENABLE_*` (default-on when unset → all V4/V5/V6 modules enabled).
- **Obstacle to a live preview:** the **only** real obstacle is "is local Supabase running + is the user seeded." Both are currently TRUE. To log into the browser: go to `/login` (or the auth route) and sign in with the seeded creds; then `/dashboard`, `/contracts`, `/work`, `/reports`, `/settings`, `/settings/security` all render. If Supabase were stopped, you'd run `npx supabase start` then `npm run seed:local-auth`.
- **Workspace mode caveat for redesign coverage:** the seeded org is **Core** mode (`workspace_mode: "core"`, advanced/assurance modules hidden). So by default the rail shows only the Core primary section; Advanced/Assurance/Tools nav and the topbar "Tools" link are hidden (`Header` hides Tools when `navSurface?.mode === "core"`). To exercise the full nav surface visually, switch the org to Advanced/Assurance mode (via `organizations.v6_org_settings_json`) or seed a non-Core org.

## 4. Lint / typecheck
- **Lint:** `npm run lint` → `eslint src e2e playwright.config.ts vitest.config.ts vitest.ui.config.ts next.config.ts --max-warnings 0` (zero-warning gate; eslint 9 + `eslint-config-next`).
- **Typecheck:** `npm run typecheck` → `tsc --noEmit`.
- **Fast combined gate:** `npm run check:quick` → migrations + cron parity + API route coverage + lint + typecheck + test.

## 5. Storybook / visual config
- **No Storybook** (no `.storybook/` config; the only `jest.config.js` hit is inside `node_modules/media-engine` — irrelevant).
- Visual verification options, in order of effort: (a) **live browser preview** against the running dev server (feasible now); (b) **Playwright visual snapshots** (`test:e2e:visual:auth*`, baselines in `e2e/*-snapshots/*.png`, regenerate with `…:update`); (c) **UI component tests** (`test:ui`) for structure/copy assertions without pixels.

---

# Shell visual inventory (verbatim classNames, copy, tokens)

Files: `src/app/(dashboard)/layout.tsx`, `src/app/globals.css`, `src/components/layout/**`.

## Design tokens (`src/app/globals.css`)

**Shell geometry tokens (`:root`, lines ~133-141):**
```
--shell-topbar-h: 4rem;
--shell-sidebar-w: 16rem;
--shell-sidebar-collapsed-w: 4rem;
--shell-collapsed-slot: 2.75rem;
--shell-content-max: 1440px;
--shell-avatar-size: 2rem;
--shell-account-menu-w: 19.5rem;
--shell-tooltip-w: 17rem;
--sidebar-icon-idle: color-mix(in oklab, var(--sidebar-muted) 92%, transparent);
```
(Also referenced but defined elsewhere: `--shell-mobile-trigger`, `--shell-drawer-w` — used by the mobile trigger/drawer.)

**Radii (`@theme inline`):** `--radius-sm:0.1875rem` (3px), `--radius-md:0.25rem` (4px), `--radius-lg:0.375rem`, `--radius-xl:0.5rem`, `--radius-2xl:0.625rem`, `--radius-3xl:0.75rem`, `--radius-4xl:1rem`. Editorial low-radius system: "3px controls, 4px artifacts."

**Light-mode palette (`:root`) — "porcelain/parchment/ink/cobalt" editorial system:**
```
--canvas:#f7f8f5; --canvas-strong:#f1e6d2; --canvas-deep:#e9eff3;
--surface:#fafbf9; --surface-raised:#ffffff; --surface-contrast:#edf0ef;
--surface-muted:#eef1f1; --surface-inset:#f4ecdb;
--accent:#2257d6; --accent-strong:#0b49c8; --accent-soft:#dce7fa; --accent-fg:#f4f7f8; --accent-warm:#b76a12;
--text-primary:#11140f; --text-secondary:#374151; --text-tertiary:#6b7280; --text-inverse:#f7f8f5;
--border-subtle:#d3dade; --border-strong:#aeb8c2; --border-contrast:#939ea9;
```
**Sidebar tokens (light — a warm "porcelain margin" light rail, NOT dark in light mode):**
```
--sidebar:#edefe9; --sidebar-surface:#f4f6f0; --sidebar-border:#d8dcd2;
--sidebar-muted:#5f6f68; --sidebar-fg:#18201d; --sidebar-raised:#ffffff;
--sidebar-brand-shadow:0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent);
--sidebar-heading:color-mix(in oklab, var(--sidebar-fg) 50%, transparent);
--sidebar-section-border:color-mix(in oklab, var(--sidebar-fg) 13%, transparent);
--sidebar-hover:color-mix(in oklab, var(--sidebar-fg) 6%, transparent);
--sidebar-focus:color-mix(in oklab, var(--sidebar-fg) 66%, var(--accent));
--sidebar-warn-ink:#8a5a00; --sidebar-danger-ink:#8b2f2f;
```
**Status tones:** `--success-soft:#dceee4 / --success-ink:#1f7a4d`; `--warning-soft:#f4e6c9 / --warning-ink:#b76a12`; `--danger-soft:#f3dadd / --danger-ink:#8c1d2c`; `--info-soft:#e8ecef / --info-ink:#3f4954`. `--focus-ring:color-mix(in oklab, var(--accent) 62%, var(--surface))`.
**Shadows:** `--shadow-1 … --shadow-4`, `--shadow-floating`, `--shadow-glow` (see lines 102-108). **Motion:** `--ui-ease-out:cubic-bezier(0.2,0.8,0.2,1)`, `--ui-duration:150ms`, `--ui-duration-slow:240ms`.
**Dark mode** (`@media (prefers-color-scheme: dark)`, lines 145-203) redefines all of the above in `oklch()` — including a genuinely dark rail (`--sidebar:oklch(0.12 0.02 258)`). The shell is theme-reactive via `prefers-color-scheme` (no manual toggle in chrome).

## Dashboard layout (`src/app/(dashboard)/layout.tsx`)
- Root: `<div className="ui-app-shell flex min-h-dvh">` containing `<UiRouteProgress/>`, `<RefetchOnWindowFocus/>`, `<V9PageLoadReporter/>`, `<Sidebar/>`, then content column.
- Content column:
  `className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip [overflow-clip-margin:0.75rem] bg-transparent lg:shadow-[inset_8px_0_14px_-14px_color-mix(in_oklab,var(--text-primary)_22%,transparent)]"` with `data-app-content`.
- `<main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 overflow-x-clip [overflow-clip-margin:0.75rem] px-4 pb-5 pt-4 outline-none md:px-6 md:pb-6 md:pt-5 xl:px-8">` wrapping `<div className="ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip [overflow-clip-margin:0.75rem] pb-2">{children}</div>`.
- `metadata.robots = { index:false, follow:false }`. MFA redirect to `/settings/security?mfa=required` when `mfaRequired` and AAL < aal2.
- `.ui-app-shell { background: var(--canvas); }` (flat; orbs/grain retired).

## Sidebar (`src/components/layout/sidebar.tsx` + `sidebar/*`)
**Desktop aside:**
```
className=`ui-sidebar-surface sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex ${model.collapsed ? "w-[var(--shell-sidebar-collapsed-w)]" : "w-[var(--shell-sidebar-w)]"}`
aria-label="Workspace"
```
- Collapse state persists via `readSidebarCollapsedPreference`/`writeSidebarCollapsedPreference` (client-storage) + `useSyncExternalStore`; onboarding shell forces collapsed.
- Body wrapper: `"min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3"`; nav list `bodyCollapsed ? "space-y-2" : "space-y-1"`.

**`.ui-sidebar-surface`** (globals.css 1522): `color:var(--sidebar-fg)`; `background-color:var(--sidebar)`; `background-image: linear-gradient(180deg, color-mix(in oklab, var(--sidebar-surface) 92%, var(--sidebar)) 0%, var(--sidebar) 100%)`.

**`.ui-sidebar-link`** (1532): `@apply relative flex min-h-10 min-w-0 items-center gap-3 px-3 py-2 text-[13px] font-medium; border-radius:var(--radius-md); color:var(--sidebar-muted)`; transitions bg/color/border/shadow over `--ui-duration-slow`. At ≥1024px: `min-height:2.5rem; padding 0.4375rem` top/bottom.

**Link states:**
- `.ui-sidebar-link-idle { color:var(--sidebar-muted); }`; hover: `color:var(--sidebar-fg); background:color-mix(in oklab, var(--sidebar-hover) 70%, transparent)`.
- `.ui-sidebar-link-parent { color:var(--sidebar-fg); }` (active section header, no accent).
- `.ui-sidebar-link-active` (1567): `color:var(--sidebar-fg); background-color:var(--sidebar-raised); background-image: linear-gradient(90deg, color-mix(in oklab, var(--accent) 9%, transparent) 0%, color-mix(in oklab, var(--accent) 3%, transparent) 56%, transparent 88%); box-shadow:0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent)`. `::before` = 2px accent rail (`left:0; top:22%; bottom:22%; border-radius:0 3px 3px 0; background:var(--accent-strong); box-shadow:0 0 8px -1px color-mix(in oklab, var(--accent) 50%, transparent)`).
- `.ui-sidebar-link-active-rail` (collapsed, 1593): `background:color-mix(in oklab, var(--sidebar-raised) 86%, var(--accent))`; `::before` centered 2px accent bar.
- Sublinks: `.ui-sidebar-sublink-active { color:var(--sidebar-fg); background:color-mix(in oklab, var(--accent) 10%, transparent); box-shadow:inset 2px 0 0 color-mix(in oklab, var(--accent-strong) 60%, transparent); }`; `.ui-sidebar-sublink-idle`; `.ui-sidebar-sublink-indent { padding-left:calc(0.75rem + 16px + 0.75rem); }`.
- Focus ring (shared, 886): `box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 50%, var(--surface-raised)), 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)`.
- High-contrast/reduced-transparency overrides for `-active` exist (2228-2254).

**`SidebarNavItem`** collapsed wrapper class: `"mx-auto h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] justify-center px-0"`. Icon: `<Icon size={16} strokeWidth={1.75}>` colored `var(--accent-strong)` when selected-leaf, else `var(--sidebar-icon-idle)`. Iconless top rows render a marker dot: active `"bg-[var(--sidebar-fg)]"`, idle `"border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent"` (`h-1.5 w-1.5 rounded-full`). Label span `"ui-nowrap-safe min-w-0 flex-1"`. Parent chevron: `<ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]" strokeWidth={2}>`.

**`SidebarBrand`** (`sidebar/sidebar-brand.tsx`):
- Brand tile `BRAND_TILE_CLASS`: `"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[15px] font-bold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]"`. Glyph = **"O"**.
- Header row: `"flex h-16 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-3"`.
- Copy: wordmark **"Oblixa"** (`text-[15px] font-bold leading-none tracking-tight text-[var(--sidebar-fg)]`); category line **"Contract follow-up"** (`text-[10.5px] font-medium leading-none tracking-[0.02em] text-[var(--sidebar-muted)]`). aria-label (collapsed) **"Oblixa — go to dashboard"**, links to `/dashboard`. Mobile close button aria-label **"Close navigation"**.

**`SidebarSection`** (`sidebar/sidebar-section.tsx`): section spacing `variant==="rail"?"mt-2": first?"mt-0 pt-0":"mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5"`. Heading `<h2>`: when visible `"ui-caps-1 px-3 text-[10px]"` with `style={{color:"var(--sidebar-heading)"}}`; else `sr-only`. Item group spacing `"space-y-0.5"` (+ `mt-2` for index 1 and last in first section).

**`SidebarFooter`** (`sidebar/sidebar-footer.tsx`): bottom bar `"flex h-12 shrink-0 items-center justify-between gap-2 border-t border-[var(--sidebar-section-border)] px-3"`. Role chip with `<Building2 size={14}>` + `ROLE_LABEL` map (`Owner/Admin/Member/Viewer/Operator`), text `"truncate text-[11.5px] font-medium leading-none"`. Collapse button: `<PanelLeftClose size={18} strokeWidth={1.85}>` (expanded) / `<PanelLeftOpen>` (collapsed), classes `"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"`. aria-labels **"Collapse sidebar"** / **"Expand sidebar"**; title **"Collapse sidebar (⌘\\)"** / **"Expand sidebar (⌘\\)"**; role tooltip **"Your role in this workspace: {Role}"**.

**`SidebarBadge`** (`sidebar/sidebar-badge.tsx`): tones `obligations`→`--sidebar-danger-ink`, `reviewQueue|approvals`→`--sidebar-warn-ink`, else neutral `--sidebar-fg`. Collapsed: `"absolute -right-1 -top-1 inline-flex h-[1.05rem] … rounded-full border text-[9px] font-semibold leading-none tabular-nums ring-2 ring-[var(--sidebar)]"`. Expanded labeled chip: `"ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold leading-none"`. Noun copy: "review(s)", "approval(s)", "requirement(s)", "alert(s)" (e.g. **"1 review"**, **"3 approvals"**).

**`CollapsedTooltip`** (`sidebar/collapsed-tooltip.tsx`): portaled `position:fixed`, `maxWidth:var(--shell-tooltip-w)`, class `"pointer-events-none z-[70] truncate whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)]"`.

**Mobile (`sidebar/mobile-drawer.tsx`):**
- Trigger: `"fixed left-4 top-[max(0.625rem,env(safe-area-inset-top))] z-40 inline-flex h-[var(--shell-mobile-trigger)] w-[var(--shell-mobile-trigger)] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)] … hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"`, `<Menu size={18}>`, aria-label **"Open navigation"**.
- Drawer: `role="dialog" aria-modal="true" aria-label="Navigation drawer"`, outer `"fixed inset-0 z-50 flex lg:hidden"`; aside `"ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[var(--shell-drawer-w)] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]"`; scrim button `"ui-overlay-scrim h-full flex-1 …"`, aria-label **"Close navigation overlay"**.

**`SidebarMobileAccount`** (`sidebar/sidebar-account.tsx`): label **"Account"** (`ui-caps-1 px-3 pb-1.5 text-[10px]`, `color:var(--sidebar-heading)`). Sign-out button hover: `"hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))]"`, `<LogOut size={18}>` + **"Sign out"**.

## Header / topbar (`src/components/layout/header.tsx` + `topbar/*`)
**`<header>`:** `"ui-topbar sticky top-0 z-30 shrink-0 px-4 md:px-6 xl:px-8"`. Inner row: `"mx-auto flex h-[var(--shell-topbar-h)] w-full max-w-[var(--shell-content-max)] items-center gap-3 pl-12 md:gap-4 lg:pl-0"` (the `pl-12` reserves space for the mobile menu trigger).
**`.ui-topbar`** (globals.css 1900): `@apply relative border-b; backdrop-filter:none; border-bottom-color:var(--border-subtle); background:color-mix(in oklab, var(--canvas) 58%, var(--surface-raised))`.
- **Tools link** (hidden in Core / when `/more` empty): `"ui-btn-ghost hidden h-10 shrink-0 items-center gap-1.5 px-3 py-0 text-[12.5px] font-semibold md:inline-flex"`, `<Wrench className="h-3.5 w-3.5" strokeWidth={1.85}>` + **"Tools"**, aria-label **"Open tools"**, `href="/more"`.

**`TopbarBreadcrumb`** (`topbar/topbar-breadcrumb.tsx`): `<nav aria-label="Breadcrumb" className="hidden min-w-0 shrink items-center gap-2 lg:flex">`. Leading area medallion: `"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-strong)_40%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]"` with `<AreaIcon className="h-4 w-4" strokeWidth={1.85}>`. Crumb links: `"ui-nowrap-safe max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-[12.5px] font-medium leading-[1.1] text-[var(--text-secondary)] … hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"`. Current crumb: `"max-w-[14rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]"` with `aria-current="page"`. Separator `<ChevronRight className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2}>`. Crumb copy examples: **Dashboard**, **Contracts / New contract**, **Contracts / Import contracts**, **Contracts / Review queue**, **Renewals**, **Evidence**, **Tasks / Issues**, **Tasks / Requirements**, **Tasks / Approvals**, **Reports / Report history**, **Settings / Security|Billing|Operations|Product|System health|Policy**, **Tools**, **Search**, **Set up workspace**, fallback **"Workspace"**.

**`TopbarSearch`** (`topbar/topbar-search.tsx`): wrapper `"min-w-0 flex-1 sm:max-w-[22rem] md:max-w-[26rem]"`. Uses `<SearchField variant="chrome">`, aria-label **"Search workspace"**, placeholder **"Search contracts, tasks, reports"** (tight: **"Search"**), `kbdHint={{meta:"⌘", key:"K"}}` (dropped when tight; ≥360px wide), `ariaKeyShortcuts="Meta+K Control+K"`. Enter → `/search?q=…`.

**`AccountMenu`** (`account-menu.tsx`): trigger `"ui-account-trigger ui-chip-focus group"`. Avatar span `"ui-avatar-tile h-[var(--shell-avatar-size)] w-[var(--shell-avatar-size)] rounded-[0.6rem] text-[12px] font-semibold"`. Name span `"hidden min-w-0 max-w-[8.5rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:block"`. Chevron rotates via `group-aria-expanded:rotate-180`. Panel width `w-[var(--shell-account-menu-w)]`, `z-[60]`, `align="end"`.
- Menu item class (`itemClass`): `"ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] hover:text-[var(--text-primary)] focus-visible:bg-[…] focus-visible:text-[var(--text-primary)] focus-visible:outline-none"`.
- Copy: header shows displayName (or **"Account"**), email (`font-mono text-[11px] … text-[var(--text-tertiary)]`), role chip; section label **"Account"** (`ui-caps-2`). Items: **"Workspace settings"** (`/settings`, `<Settings>`), **"Account security"** (`/settings/security`, `<ShieldCheck>`), **"Billing and access"** (`/settings/billing`, `<CreditCard>`, owner/admin only), **"Sign out"** (form → `signOut`, `<LogOut>`, danger hover `color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))`). aria-label **"Account menu for {name}"** / **"Account menu"**. Identity: a bare email local-part is never shown as a name → falls back to **"Account"**.

## Footer (`src/components/layout/legal-footer.tsx`)
`<footer id="legal-footer" className="ui-footer-shell shrink-0 px-4 py-2 md:px-6">`; inner `"mx-auto flex max-w-[1680px] flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4"`. Line: `<Info size={11} strokeWidth={1.85}>` + copy **"Oblixa tracks contract follow-up after signature. It does not provide legal advice."** (`text-[11px] leading-snug text-[var(--text-tertiary)]`). Plus `<LegalLinks variant="compact">`.

## Primary nav copy (`src/lib/navigation.ts`)
**Primary groups (`PRIMARY_NAV_GROUPS`):** `"Workspace"` (rendered as **"Core"** in the sidebar via `localPrimaryLabel`), `"Advanced"` (`/decisions`, `/campaigns`, `/contracts/programs`, `/relationship-workspaces`), `"Assurance"` (`/assurance`), `"Tools"` (`/more`). Section labels in the model: **"Core"**, **"Workflow queues"**, **"My views"**, **"Workspace"**.

**Primary items (name — description — href):**
- **Dashboard** — "What needs action, what is due, and what you own." — `/dashboard`
- **Contracts** — "Every contract you've added, with renewal and notice dates." — `/contracts` (children: **All contracts** `/contracts`; **Review queue** `/contracts/review`)
- **Tasks** — "Follow-up tasks, approvals, contract requirements, issues, and evidence requests." — `/work`
- **Renewals** — "Upcoming renewal and notice dates."
- **Evidence** — "Evidence requests, collection, and audit trail."
- **Decisions / Campaigns / Assurance / Relationships / Reports / Tools** (Advanced/Assurance — hidden in Core), plus operations items: **Intake, Approvals, Obligations, Programs, Execution graph, Collaboration, Review cadence, Analytics, Data quality, Maintenance, Watchlists, Persona dashboard, Settings**. Assurance children gate on flags `v6AssuranceCore / v6ControlPolicies / v6AdaptivePlaybooks / v6ReviewBoards / v6Autopilot / v6Segments`. Overflow row copy: **"Browse all queues"** (`/more?section=workflows`).

---

## Practical run/verify recipe
1. Local Supabase + dev server are already up; seeded `dev@oblixa.local` logs in. To preview: open `http://localhost:3000`, sign in with `dev@oblixa.local` / `dev-password-12345`, then visit `/dashboard`, `/contracts`, `/work`, `/reports`, `/settings`, `/settings/security`.
2. If Supabase is ever stopped: `npx supabase start` → `npm run seed:local-auth` (validate with `npm run doctor:auth`).
3. The seeded org is **Core** mode → only the Core nav section, no Tools/Advanced/Assurance chrome. To verify the full rail visually, flip `organizations.v6_org_settings_json.workspace_mode` to `advanced`/`assurance` (and clear `advanced_modules_hidden`/`assurance_modules_hidden`) for the default org.
4. For non-pixel verification: `npm run test:ui` (shell components), `npm run lint`, `npm run typecheck`, and the `page.surface.test.ts` copy-pin tests after any copy change. For pixel baselines: `npm run test:e2e:visual:auth` (needs the seeded creds + the visual env flags).

Key file paths: `C:/Users/dizho/oblixa/src/app/(dashboard)/layout.tsx`, `C:/Users/dizho/oblixa/src/app/globals.css`, `C:/Users/dizho/oblixa/src/components/layout/sidebar.tsx` (+ `sidebar/*`, `topbar/*`, `header.tsx`, `account-menu.tsx`, `legal-footer.tsx`), `C:/Users/dizho/oblixa/src/lib/supabase/server.ts`, `C:/Users/dizho/oblixa/src/lib/navigation.ts`, `C:/Users/dizho/oblixa/src/components/layout/sidebar-model.ts`, `C:/Users/dizho/oblixa/scripts/seed-local-auth.mjs`, `C:/Users/dizho/oblixa/scripts/check-local-auth-env.mjs`, `C:/Users/dizho/oblixa/.env.local`, `C:/Users/dizho/oblixa/vitest.config.ts`, `C:/Users/dizho/oblixa/vitest.ui.config.ts`.