Confirmed: `--shell-drawer-w` and `--shell-mobile-trigger` are referenced by the mobile drawer/trigger but never defined in any CSS — so those `w-[var(--shell-drawer-w)]` / `h-[var(--shell-mobile-trigger)]` resolve to nothing (the elements size only by their `min-h-0`/content). There is exactly one CSS file (`globals.css`); the design system is Tailwind v4 with `@theme inline` (no `tailwind.config.*`).

I have everything. Here is the detailed digest.

---

# App-Shell Design Token & Visual Digest

## 0. Architecture summary

- **No `tailwind.config.*` exists.** This is **Tailwind v4** driven entirely by CSS: `@import "tailwindcss";` + an `@theme inline { … }` block at the top of `globals.css`. All theming is CSS-custom-property based.
- **One stylesheet:** `C:/Users/dizho/oblixa/src/app/globals.css` (4621 lines) is the only `.css` file under `src`. All `ui-*` utilities and tokens live there.
- **Light/dark:** themes are **NOT toggled by a class or JS** — they switch purely via `@media (prefers-color-scheme: dark)` on `:root`. There is no theme switcher, no `dark:` class strategy, no `data-theme`. `color-scheme: light` is the `:root` default; the dark media query sets `color-scheme: dark`. Plus `@media (prefers-reduced-motion)`, `(prefers-reduced-transparency)`, `(prefers-contrast: more)`, and `@media print` override blocks.

---

## 1. Fonts (root layout `src/app/layout.tsx` + `src/components/landing/lp-fonts.ts`)

Three Google fonts, wired via `next/font`, exposed as CSS variables on `<html>`:

| Role | Family | CSS variable | Weights / config |
|---|---|---|---|
| **Sans (display/body)** | `Plus_Jakarta_Sans` | `--font-sans-display` | weights `["400","500","600","700"]`, `display: "swap"` |
| **Mono** | `Geist_Mono` | `--font-geist-mono` | default |
| **Serif (editorial, landing only)** | `Source_Serif_4` | `--font-serif-display` | `display: "swap"`, `axes: ["opsz"]` |

`<html>` className: `` `${plusJakarta.variable} ${geistMono.variable} ${lpSerif.variable} h-full antialiased` ``
`<body>` className: `"relative flex min-h-full flex-col font-sans text-[var(--text-secondary)]"`

In `@theme inline`, these map to Tailwind font utilities:
```css
--font-sans: var(--font-sans-display), ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-geist-mono), ui-monospace, monospace;
```
**Note:** there is **no `--font-serif` in `@theme`** — the serif (`--font-serif-display`) is only consumed by landing (`lp-*`) scopes, not the app shell. Body sets `font-feature-settings: "cv02","cv03","cv04","cv11","ss01","liga" 1;`. Base body type: `text-[15px] leading-[1.6] antialiased`.

`themeColor` (viewport): light `#f7f8f5`, dark `#161a23`.

---

## 2. CSS custom properties (light `:root`, lines 43–143)

### Canvas / backgrounds
```css
--canvas: #f7f8f5;          /* porcelain — neutral editorial/proof ground */
--canvas-strong: #f1e6d2;   /* parchment — document/trust ground */
--canvas-deep: #e9eff3;     /* steel mist — operational band */
--surface: #fafbf9;
--surface-raised: #ffffff;
--surface-contrast: #edf0ef;
--surface-muted: #eef1f1;   /* cool chrome bands */
--surface-inset: #f4ecdb;   /* parchment source paper */
```

### Accent / blue + warm
```css
--accent: #2257d6;
--accent-strong: #0b49c8;   /* cobalt — actions and selection only */
--accent-soft: #dce7fa;
--accent-fg: #f4f7f8;
--accent-warm: #b76a12;     /* source amber */
```

### Text
```css
--text-primary: #11140f;    /* ink */
--text-secondary: #374151;  /* slate body */
--text-tertiary: #6b7280;   /* steel */
--text-inverse: #f7f8f5;
```

### Borders
```css
--border-subtle: #d3dade;
--border-strong: #aeb8c2;   /* directive rule gray */
--border-contrast: #939ea9;
--border-card: color-mix(in oklab, var(--border-subtle) 88%, transparent);
```

### Sidebar tokens (light = warm porcelain margin, NOT a dark rail)
```css
--sidebar: #edefe9;
--sidebar-surface: #f4f6f0;
--sidebar-border: #d8dcd2;
--sidebar-muted: #5f6f68;
--sidebar-fg: #18201d;
--sidebar-raised: #ffffff;
--sidebar-brand-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent);
--sidebar-heading: color-mix(in oklab, var(--sidebar-fg) 50%, transparent);
--sidebar-section-border: color-mix(in oklab, var(--sidebar-fg) 13%, transparent);
--sidebar-hover: color-mix(in oklab, var(--sidebar-fg) 6%, transparent);
--sidebar-focus: color-mix(in oklab, var(--sidebar-fg) 66%, var(--accent));
--sidebar-warn-ink: #8a5a00;
--sidebar-danger-ink: #8b2f2f;
--sidebar-icon-idle: color-mix(in oklab, var(--sidebar-muted) 92%, transparent);
```

### Status tones
```css
--success-soft: #dceee4;  --success-ink: #1f7a4d;  /* confirmed green */
--warning-soft: #f4e6c9;  --warning-ink: #b76a12;  /* source amber */
--danger-soft:  #f3dadd;  --danger-ink:  #8c1d2c;  /* oxblood */
--info-soft:    #e8ecef;  --info-ink:    #3f4954;  /* neutral steel waiting */
```

### Focus, shadows, tints
```css
--focus-ring: color-mix(in oklab, var(--accent) 62%, var(--surface));
--shadow-1: 0 1px 2px rgba(15,23,42,0.05), 0 10px 30px rgba(15,23,42,0.04);
--shadow-2: 0 16px 40px rgba(15,23,42,0.1), 0 2px 4px rgba(15,23,42,0.04);
--shadow-3: 0 26px 70px rgba(15,23,42,0.16), 0 6px 18px rgba(15,23,42,0.08);
--shadow-4: 0 34px 90px rgba(15,23,42,0.22), 0 14px 34px rgba(15,23,42,0.12);
--shadow-floating: 0 24px 60px -30px rgba(15,23,42,0.35), 0 8px 24px -12px rgba(15,23,42,0.12);
--shadow-glow: 0 14px 36px rgba(17,20,15,0.08);
--surface-tint:      color-mix(in oklab, var(--surface) 92%, white);
--surface-tint-soft: color-mix(in oklab, var(--surface) 96%, white);
--canvas-glow: transparent;            /* glow decor retired */
--canvas-glow-secondary: transparent;
```

### Motion (durations + easing)
```css
--ui-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
--ui-duration: 150ms;
--ui-duration-slow: 240ms;
--duration-fast: 100ms;
--duration-default: 160ms;
--duration-slow: 280ms;
```
*(Note: `--ui-ease-out` is the only easing token. There is no `--ui-ease-in`/`-in-out`. Under `prefers-reduced-motion`, all five duration tokens collapse to `0.01ms`.)*

### Spacing / z-index scale
```css
--space-xs:4px; --space-sm:8px; --space-md:12px; --space-lg:16px; --space-xl:24px;
--z-sticky:10; --z-popover:30; --z-sidebar:40; --z-modal:50; --z-toast:60;
```

### Shell geometry (the key layout tokens)
```css
--shell-topbar-h: 4rem;
--shell-sidebar-w: 16rem;             /* expanded rail width */
--shell-sidebar-collapsed-w: 4rem;    /* collapsed rail width */
--shell-collapsed-slot: 2.75rem;      /* collapsed icon tile square */
--shell-content-max: 1440px;
--shell-avatar-size: 2rem;
--shell-account-menu-w: 19.5rem;
--shell-tooltip-w: 17rem;
```
⚠️ **Two shell tokens are referenced but NEVER defined:** `--shell-drawer-w` (mobile drawer width) and `--shell-mobile-trigger` (mobile open-button size). They resolve to empty → those `w-[var(--shell-drawer-w)]` / `h-[var(--shell-mobile-trigger)]` utilities currently produce no width/height. **Flag for the redesign.**

### Radius scale (`@theme inline`, "v46 editorial geometry — low radii")
```css
--radius-sm: 0.1875rem;  /* 3px */
--radius-md: 0.25rem;    /* 4px */
--radius-lg: 0.375rem;   /* 6px */
--radius-xl: 0.5rem;     /* 8px */
--radius-2xl: 0.625rem;  /* 10px */
--radius-3xl: 0.75rem;   /* 12px */
--radius-4xl: 1rem;      /* 16px */
```
*(In practice most shell surfaces hardcode `border-radius: 4px` or `3px` rather than using these tokens — "3px controls, 4px artifacts, nothing balloon-shaped.")*

### `@theme inline` color aliases (lines 15–40)
Every `--color-*` is just `var(--<name>)` so Tailwind emits utilities like `bg-canvas`, `text-text-primary`, `border-border-subtle`, `bg-sidebar`, `border-sidebar-border`, etc. Mapped names: `canvas, surface, surface-raised, surface-contrast, surface-muted, surface-inset, accent, accent-strong, accent-soft, accent-fg, text-primary, text-secondary, text-tertiary, border-subtle, border-strong, border-contrast, success-soft/ink, warning-soft/ink, danger-soft/ink, info-soft/ink, sidebar, sidebar-border`.

---

## 3. Dark theme (`@media (prefers-color-scheme: dark)`, lines 145–203)

Same token names, OKLCH values. Highlights (the dark rail IS dark here, unlike light):
```css
--canvas: oklch(0.13 0.02 258);  --canvas-strong: oklch(0.17 0.02 258);  --canvas-deep: oklch(0.10 0.02 258);
--surface: oklch(0.19 0.018 258);  --surface-raised: oklch(0.245 0.02 258);  --surface-contrast: oklch(0.29 0.018 258);
--accent: oklch(0.72 0.19 264);  --accent-strong: oklch(0.8 0.17 266);  --accent-soft: oklch(0.3 0.07 262);  --accent-fg: oklch(0.15 0.02 258);
--text-primary: oklch(0.96 0.006 250);  --text-secondary: oklch(0.84 0.014 252);  --text-tertiary: oklch(0.64 0.012 253);
--border-subtle: oklch(0.36 0.018 258);  --border-strong: oklch(0.46 0.022 258);
--sidebar: oklch(0.12 0.02 258);  --sidebar-surface: oklch(0.17 0.022 258);  --sidebar-raised: oklch(0.225 0.022 258);  --sidebar-border: oklch(0.27 0.02 258);  --sidebar-muted: oklch(0.71 0.018 254);  --sidebar-fg: oklch(0.96 0.006 252);
```
Dark shadows are black-based (e.g. `--shadow-1: 0 1px 2px rgba(0,0,0,0.24), 0 10px 28px rgba(0,0,0,0.16)`). Glow tokens stay `transparent`.

---

## 4. Shell utility classes (full CSS bodies)

### `.ui-app-shell` (the outermost shell div)
```css
.ui-app-shell { background: var(--canvas); }           /* light, line 2037 */
@media (prefers-color-scheme: dark) {
  .ui-app-shell { background: var(--canvas); position: relative; }  /* line 2163 */
}
```
"v46: flat porcelain — structure from rules, no ambient gradients." No orbs/grain/drift.

### `.ui-sidebar-surface` (the rail surface, lines 1522–1530)
```css
.ui-sidebar-surface {
  color: var(--sidebar-fg);
  background-color: var(--sidebar);             /* solid fallback first */
  background-image:
    linear-gradient(180deg,
      color-mix(in oklab, var(--sidebar-surface) 92%, var(--sidebar)) 0%,
      var(--sidebar) 100%);
}
```

### `.ui-page-stack` (the content wrapper inside `<main>`, lines 1035–1077)
```css
.ui-page-stack {
  @apply flex flex-col gap-6 md:gap-6;
  animation: ui-page-enter 200ms ease-out;
}
/* opt-in divided variant */
.ui-page-stack-divided > section + section,
.ui-page-stack-divided > header + section { position: relative; }
.ui-page-stack-divided > section + section::before,
.ui-page-stack-divided > header + section::before {
  content: ""; position: absolute; top: calc(-0.875rem - 1px); left: 0; right: 0;
  height: 1px; background: color-mix(in oklab, var(--border-subtle) 50%, transparent);
  pointer-events: none;
}
.ui-page-stack-divided > section + section::after,
.ui-page-stack-divided > header + section::after {     /* filled-diamond accent */
  content: ""; position: absolute; top: calc(-0.875rem - 3px); left: 50%;
  transform: translateX(-50%) rotate(45deg); width: 6px; height: 6px;
  background: color-mix(in oklab, var(--accent-strong) 55%, var(--canvas));
  border: 1px solid color-mix(in oklab, var(--accent-strong) 28%, transparent);
  border-radius: 1px; pointer-events: none;
}
.ui-page-stack-dense { @apply space-y-4 md:space-y-5; }
```
Page-enter keyframe: `from {opacity:0; translateY(2px)} to {opacity:1; translateY(0)}`.

### `.ui-topbar` (header chrome, lines 1900–1905)
```css
.ui-topbar {
  @apply relative border-b;
  backdrop-filter: none;
  border-bottom-color: var(--border-subtle);
  background: color-mix(in oklab, var(--canvas) 58%, var(--surface-raised));
}
```

### `.ui-shell-surface` (lines 494–500)
```css
.ui-shell-surface {
  @apply border;
  border-radius: 4px;
  border-color: color-mix(in oklab, var(--border-subtle) 90%, transparent);
  background: var(--surface-raised);
  box-shadow: none;
}
```

### Sidebar link system (the nav rows — lines 1532–1631)
```css
.ui-sidebar-link {
  @apply relative flex min-h-10 min-w-0 items-center gap-3 px-3 py-2 text-[13px] font-medium;
  border-radius: var(--radius-md);
  color: var(--sidebar-muted);
  transition-property: background-color, color, border-color, box-shadow;
  transition-duration: var(--ui-duration-slow);
  transition-timing-function: var(--ui-ease-out);
}
@media (min-width: 1024px) {
  .ui-sidebar-link { min-height: 2.5rem; padding-top: 0.4375rem; padding-bottom: 0.4375rem; }
}
.ui-sidebar-link-idle   { color: var(--sidebar-muted); }
.ui-sidebar-link-parent { color: var(--sidebar-fg); }   /* expanded section header */

.ui-sidebar-link-active {                                /* selected leaf — lifts to white "record" */
  position: relative; color: var(--sidebar-fg);
  background-color: var(--sidebar-raised);
  background-image: linear-gradient(90deg,
    color-mix(in oklab, var(--accent) 9%, transparent) 0%,
    color-mix(in oklab, var(--accent) 3%, transparent) 56%, transparent 88%);
  box-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent);
}
.ui-sidebar-link-active::before {                        /* left accent rail */
  content: ""; position: absolute; left: 0; top: 22%; bottom: 22%; width: 2px;
  border-radius: 0 3px 3px 0; background: var(--accent-strong);
  box-shadow: 0 0 8px -1px color-mix(in oklab, var(--accent) 50%, transparent);
  pointer-events: none;
}
.ui-sidebar-link-active-rail {                           /* collapsed variant */
  @apply relative;
  background: color-mix(in oklab, var(--sidebar-raised) 86%, var(--accent));
  box-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 8%, transparent);
}
.ui-sidebar-link-active-rail::before {
  content: ""; @apply absolute left-1.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full;
  background: var(--accent-strong); top: 50%; bottom: auto; width: 2px;
}
.ui-sidebar-link-idle:hover {
  color: var(--sidebar-fg);
  background: color-mix(in oklab, var(--sidebar-hover) 70%, transparent);
}
.ui-sidebar-sublink-active {                             /* child rows */
  color: var(--sidebar-fg);
  background: color-mix(in oklab, var(--accent) 10%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in oklab, var(--accent-strong) 60%, transparent);
}
.ui-sidebar-sublink-idle { color: var(--sidebar-muted); }
.ui-sidebar-sublink-idle:hover {
  color: var(--sidebar-fg);
  background: color-mix(in oklab, var(--sidebar-hover) 70%, transparent);
}
.ui-sidebar-sublink-indent { padding-left: calc(0.75rem + 16px + 0.75rem); }
```
Sidebar-link focus ring is shared (lines 880–892):
```css
.ui-sidebar-link:focus-visible { /* (among others) */
  outline: none;
  box-shadow:
    0 0 0 1px color-mix(in oklab, var(--accent) 50%, var(--surface-raised)),
    0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
  transition: box-shadow 100ms ease-out;
}
```
Accessibility overrides: under `prefers-reduced-transparency`, `.ui-sidebar-link-active` drops the gradient for a flat `color-mix(...accent 26%, var(--sidebar-surface))`. Under `prefers-contrast: more`, active rows get `inset 0 0 0 2px currentColor`.

### Print: shell hidden via these selectors (only defined here, lines 2184–2189)
```css
.ui-app-shell-nav, .ui-app-shell-sidebar, .ui-app-shell aside[aria-label], .ui-btn-ghost { display: none !important; }
```
(`.ui-app-shell-nav`/`.ui-app-shell-sidebar` classes are referenced only in print; no component currently emits them.)

---

## 5. `(dashboard)/layout.tsx` — structural render & verbatim classNames

Server component. Resolves auth/role/nav-surface, MFA-gates, then renders:

**Outer shell:**
```jsx
<div className="ui-app-shell flex min-h-dvh">
```
Contains (non-visual): `<UiRouteProgress />`, `<RefetchOnWindowFocus />`, `<V9PageLoadReporter />`, then `<Sidebar role v5Flags navSurface showToolsLink />`.

**Content column** (note the inset shadow on the left edge at `lg`):
```jsx
<div
  data-app-content
  className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip [overflow-clip-margin:0.75rem] bg-transparent lg:shadow-[inset_8px_0_14px_-14px_color-mix(in_oklab,var(--text-primary)_22%,transparent)]"
>
```
Inside: `<Header … />`, `<CommandPaletteLoader … />`, then:

**Main region:**
```jsx
<main
  id={MAIN_CONTENT_ID}
  tabIndex={-1}
  className="flex-1 overflow-x-clip [overflow-clip-margin:0.75rem] px-4 pb-5 pt-4 outline-none md:px-6 md:pb-6 md:pt-5 xl:px-8"
>
  <div className="ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip [overflow-clip-margin:0.75rem] pb-2">
    {children}
  </div>
</main>
<LegalFooter />
```
Metadata: `robots: { index: false, follow: false }`. Branches: `notFound()` if no pathname; MFA redirect to `/settings/security?mfa=required`; `role` defaults to `"viewer"`; `showHeaderUtilitiesLink` gates the Tools link.

---

## 6. `Sidebar` (`src/components/layout/sidebar.tsx`) — structure & treatment

Client component. Collapse state from `localStorage` via `useSyncExternalStore`. Three render modes: **desktop expanded**, **desktop collapsed**, **mobile drawer**. On `/onboarding` it force-collapses (`effectiveCollapsed`).

**Desktop `<aside>`** (verbatim — note width swaps on collapse, the only place `--shell-sidebar-w` / `--shell-sidebar-collapsed-w` are consumed):
```jsx
<aside
  aria-label="Workspace"
  data-testid={shellTestIds.sidebarDesktop}
  className={`ui-sidebar-surface sticky top-0 hidden h-dvh max-h-dvh min-h-0 shrink-0 flex-col border-r border-[var(--sidebar-border)] motion-safe:transition-[width] motion-safe:duration-[var(--ui-duration-slow)] motion-safe:ease-[var(--ui-ease-out)] motion-reduce:transition-none lg:flex ${
    model.collapsed ? "w-[var(--shell-sidebar-collapsed-w)]" : "w-[var(--shell-sidebar-w)]"
  }`}
>
```
**Body wrapper:** `"min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-3"`. Nav container: `bodyCollapsed ? "space-y-2" : "space-y-1"`.
**Copy / aria:** `aria-label="Workspace"`.

### `SidebarBrand` (`sidebar/sidebar-brand.tsx`)
Brand tile class (shared, verbatim):
```js
const BRAND_TILE_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[15px] font-bold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]";
```
- **Collapsed:** `<div className="flex h-16 shrink-0 items-center justify-center border-b border-[var(--sidebar-section-border)] px-2">`; link adds `transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`; glyph `O`. aria-label: **"Oblixa — go to dashboard"**.
- **Expanded:** `<div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-3">`; link `"group flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"`. Wordmark: `"truncate text-[15px] font-bold leading-none tracking-tight text-[var(--sidebar-fg)]"` → **"Oblixa"**; sub-line `"mt-1 truncate text-[10.5px] font-medium leading-none tracking-[0.02em] text-[var(--sidebar-muted)]"` → **"Contract follow-up"**.
- **Mobile close button:** `"ui-icon-button border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_3%,transparent)] p-2 text-[var(--sidebar-muted)] hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"`, `<X size={18}>`, aria-label **"Close navigation"**.

### `SidebarSection` (`sidebar/sidebar-section.tsx`)
- `<section>` class: `rail` → `"mt-2"`; first → `"mt-0 pt-0"`; else `"mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5"`.
- Heading `<h2>`: hidden (`"sr-only"`) when collapsed or first; else `"ui-caps-1 px-3 text-[10px]"` with inline `style={{ color: "var(--sidebar-heading)" }}`.
- `<nav>` spacing: collapsed/hidden-heading → `"space-y-1.5"`, else `"mt-2 space-y-1.5"`.
- Item wrapper grouping: `space-y-0.5` plus `mt-2` for 2nd item and last item in the first (Core) section.

### `SidebarNavItem` (`sidebar/sidebar-nav-item.tsx`)
Link base: `ui-sidebar-link`; when collapsed & top-level adds `"mx-auto h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] justify-center px-0"`. State class resolution:
- child → `ui-sidebar-sublink-indent text-[12.5px]` + (`ui-sidebar-sublink-active` | `ui-sidebar-sublink-idle`)
- collapsed → (`ui-sidebar-link-active-rail` | `ui-sidebar-link-idle`)
- parent-expanded → `ui-sidebar-link-parent`
- else → (`ui-sidebar-link-active` | `ui-sidebar-link-idle`)

Icon: `<Icon size={16} strokeWidth={1.75} className="shrink-0">` with inline color = `var(--accent-strong)` (selected leaf), `undefined` (parent), else `var(--sidebar-icon-idle)`. No-icon top-level rows render a marker dot: `"h-1.5 w-1.5 shrink-0 rounded-full"` + active `"bg-[var(--sidebar-fg)]"` / idle `"border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent"`. Label span: `"ui-nowrap-safe min-w-0 flex-1"`. Parent chevron: `<ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]" strokeWidth={2}>`. `aria-current="page"` on exact-active; `aria-label` = collapsed label when collapsed. Tooltip hover delay = **350ms**.

### `SidebarBadge` (`sidebar/sidebar-badge.tsx`)
Tone styles (inline) by `tone`:
- `obligations` → color `var(--sidebar-danger-ink)`, bg `…13%`, border `…40%`.
- `reviewQueue`/`approvals` → `var(--sidebar-warn-ink)` (same 13%/40%).
- else → `var(--sidebar-fg)` 80% color / 9% bg / 20% border.

Collapsed chip: `"absolute -right-1 -top-1 inline-flex h-[1.05rem] items-center justify-center rounded-full border text-[9px] font-semibold leading-none tabular-nums ring-2 ring-[var(--sidebar)]"` (+ `w-[1.05rem]` single-digit / `min-w-[1.05rem] px-1` multi). Expanded chip: `"ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold leading-none"`. **Copy:** noun is "review/approval/requirement/alert" pluralized — chips read e.g. **"1 review"**, **"3 approvals"**, **"2 requirements"**.

### `SidebarFooter` (`sidebar/sidebar-footer.tsx`)
- **Collapsed:** `"flex h-12 shrink-0 items-center justify-center border-t border-[var(--sidebar-section-border)] px-2"`; expand button `"inline-flex h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"`, `<PanelLeftOpen size={18} strokeWidth={1.85}>`. aria-label **"Expand sidebar"**, title **"Expand sidebar (⌘\)"**.
- **Expanded:** `"flex h-12 shrink-0 items-center justify-between gap-2 border-t border-[var(--sidebar-section-border)] px-3"`; role pill `"inline-flex min-w-0 items-center gap-1.5 text-[var(--sidebar-muted)]"` with `<Building2 size={14}>` + label text `"truncate text-[11.5px] font-medium leading-none"`; aria/title **"Your role in this workspace: {Owner|Admin|Member|Viewer|Operator}"**. Collapse button `"inline-flex h-8 w-8 shrink-0 …"` (same hover/focus tokens), `<PanelLeftClose size={18} strokeWidth={1.85}>`, aria-label **"Collapse sidebar"**, title **"Collapse sidebar (⌘\)"**.
- `ROLE_LABEL` map: owner→Owner, admin→Admin, member→Member, viewer→Viewer, operator→Operator.

### `SidebarMobileAccount` (`sidebar/sidebar-account.tsx`)
Wrapper `"border-t border-[var(--sidebar-section-border)] px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"`. Heading `"ui-caps-1 px-3 pb-1.5 text-[10px]"` inline `color: var(--sidebar-heading)` → **"Account"**. Sign-out button: `"group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[13px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"`, `<LogOut size={18} strokeWidth={1.85}>` → **"Sign out"**.

### `MobileNavigationTrigger` + `MobileDrawer` (`sidebar/mobile-drawer.tsx`)
- **Trigger** (verbatim): `"fixed left-4 top-[max(0.625rem,env(safe-area-inset-top))] z-40 inline-flex h-[var(--shell-mobile-trigger)] w-[var(--shell-mobile-trigger)] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)] transition-colors duration-[var(--ui-duration)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"`, `<Menu size={18}>`, aria-label **"Open navigation"**. ⚠️ `--shell-mobile-trigger` undefined → no width/height applied.
- **Drawer container:** `"fixed inset-0 z-50 flex lg:hidden"`, `role="dialog" aria-modal="true" aria-label="Navigation drawer"`. Panel `<aside>`: `"ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[var(--shell-drawer-w)] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]"` ⚠️ `--shell-drawer-w` undefined. Scrim button: `"ui-overlay-scrim h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"`, aria-label **"Close navigation overlay"**.

### `CollapsedTooltip` (`sidebar/collapsed-tooltip.tsx`)
Portaled to `document.body`, `position: fixed`, `maxWidth: var(--shell-tooltip-w)`. Class: `"pointer-events-none z-[70] truncate whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)]"`. `aria-hidden`.

---

## 7. `Header` (`src/components/layout/header.tsx`) — structure & treatment

```jsx
<header
  data-testid={shellTestIds.headerTopbar}
  className="ui-topbar sticky top-0 z-30 shrink-0 px-4 md:px-6 xl:px-8"
>
  <div className="mx-auto flex h-[var(--shell-topbar-h)] w-full max-w-[var(--shell-content-max)] items-center gap-3 pl-12 md:gap-4 lg:pl-0">
    <TopbarBreadcrumb />
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      <TopbarSearch />
      {/* Tools link — only when showTools */}
      <Link href="/more" prefetch={false}
        className="ui-btn-ghost hidden h-10 shrink-0 items-center gap-1.5 px-3 py-0 text-[12.5px] font-semibold md:inline-flex"
        aria-label="Open tools">
        <Wrench className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> Tools
      </Link>
      <AccountMenu … />
    </div>
  </div>
</header>
```
`pl-12` on mobile leaves room for the fixed mobile trigger; resets to `lg:pl-0`. **Copy:** Tools link text **"Tools"**, aria-label **"Open tools"**. `showTools = showUtilitiesLink && navSurface?.mode !== "core"`.

### `AccountMenu` (`src/components/layout/account-menu.tsx`)
Uses shared `DropdownMenu` (portaled `role="menu"`), `align="end"`, `zIndexClassName="z-[60]"`, `widthClassName="w-[var(--shell-account-menu-w)]"`.

**Trigger button:** `className="ui-account-trigger ui-chip-focus group"`, `aria-label` = **"Account menu for {name}"** or **"Account menu"**, `title` = full name/email. Avatar: `"ui-avatar-tile h-[var(--shell-avatar-size)] w-[var(--shell-avatar-size)] rounded-[0.6rem] text-[12px] font-semibold"` (shows initial). Name span: `"hidden min-w-0 max-w-[8.5rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:block"`. Chevron: `"hidden h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--ui-duration)] group-aria-expanded:rotate-180 sm:block"`.

Shared menu item class (verbatim):
```js
const itemClass =
  "ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] focus-visible:text-[var(--text-primary)] focus-visible:outline-none";
```
**Menu body:** header row (avatar `ui-avatar-tile h-9 w-9 rounded-[0.7rem] text-[13px]`, name `"…text-[13px] font-semibold…text-[var(--text-primary)]"`, email `"ui-nowrap-safe font-mono text-[11px] leading-snug tracking-[0.02em] text-[var(--text-tertiary)]"`, role pill `"mt-1.5 inline-flex max-w-max items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] font-semibold leading-none tracking-[0.01em] text-[var(--text-secondary)]"`). Divider: `"mx-1 my-1 block h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]"`. Section label `"ui-caps-2 px-2.5 pb-0.5 pt-1 text-[10px] text-[var(--text-tertiary)]"` → **"Account"**.

**Menu copy / destinations:** **"Workspace settings"** (`/settings`, `Settings` icon) · **"Account security"** (`/settings/security`, `ShieldCheck`) · **"Billing and access"** (`/settings/billing`, `CreditCard`, owner/admin only) · **"Sign out"** (form action `signOut`, `LogOut`, danger hover: `hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] hover:text-[var(--danger-ink)]`). All menu icons `h-4 w-4 strokeWidth={1.85}`.

---

## 8. Supporting `ui-*` shell classes referenced by chrome (verbatim bodies)

```css
.ui-btn-ghost {                                  /* Tools link, header */
  @apply min-h-10 border border-transparent px-3.5 py-2 text-sm font-medium motion-safe:active:scale-[0.99];
  border-radius: 3px; color: var(--text-secondary); background: transparent;
}
.ui-btn-ghost:hover { color: var(--text-primary); background: color-mix(in oklab, var(--surface-contrast) 60%, transparent); }

.ui-account-trigger {                            /* account button */
  @apply inline-flex h-10 max-w-[14rem] shrink-0 items-center gap-2 rounded-full border px-1.5 pr-2.5 text-left transition-colors;
  border-color: color-mix(in oklab, var(--border-subtle) 86%, transparent);
  background: var(--surface-raised); box-shadow: none;
}
.ui-account-trigger:hover {
  border-color: color-mix(in oklab, var(--accent) 28%, var(--border-subtle));
  background: color-mix(in oklab, var(--accent-soft) 18%, var(--surface-raised));
}

.ui-avatar-tile {                                /* avatar seal — ink outline, cobalt center */
  @apply flex items-center justify-center border; box-shadow: none;   /* shared with ui-icon-tile */
  @apply h-10 w-10; border-radius: 4px;                                /* shared sizing */
  border-color: color-mix(in oklab, var(--text-primary) 92%, transparent);
  background: var(--accent-strong); color: #f4f7f8;
}

.ui-icon-button {                                /* mobile close btn base */
  @apply inline-flex min-h-10 min-w-10 items-center justify-center border px-2.5 py-2 text-sm;
  border-radius: 3px; color: var(--text-secondary);
  border-color: color-mix(in oklab, var(--border-subtle) 88%, transparent);
  background: var(--surface-raised);
  /* transitions on color/border/bg/shadow/transform @ var(--ui-duration) */
}
.ui-icon-button:hover { color: var(--text-primary); border-color: color-mix(in oklab, var(--border-strong) 84%, transparent); box-shadow: var(--shadow-1); }

.ui-overlay-scrim {                              /* mobile drawer scrim */
  background: color-mix(in oklab, #18181b 64%, transparent);
  backdrop-filter: blur(12px);
  animation: ui-overlay-scrim-enter 150ms ease-out;
}

.ui-caps-1 { font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }   /* section headings */
.ui-caps-2 { font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
.ui-caps-3 { font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; }

.ui-chip-focus:focus-visible { outline: 2px solid color-mix(in oklab, var(--accent) 60%, transparent); outline-offset: 2px; border-radius: inherit; }
.ui-nowrap-safe { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

`LegalFooter` uses `.ui-footer-shell` (flat paper, one ink hairline top via `::before`) and `.ui-legal-links` (`flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium; color: var(--text-tertiary)`).

---

## 9. Keyframes available to the shell
`ui-skeleton-shimmer`, `ui-page-enter` (used by `.ui-page-stack`), `ui-route-progress`, `ui-overlay-scrim-enter` (used by `.ui-overlay-scrim`), `ui-stat-value-enter`, `ui-details-reveal`, `ui-status-badge-pulse`, `ui-app-shell-orbs` (defined but the shell is flat now — orbs retired).

---

## 10. Key takeaways for the redesign

1. **Theme = OS preference only.** No toggle exists; any redesign adding a manual light/dark switch must introduce a class/data-attr strategy (currently absent).
2. **Light-mode sidebar is a warm porcelain margin (`#edefe9`), not a dark rail** — dark mode is the only place the rail goes dark. The shell deliberately diverges sidebar color per scheme.
3. **Accent (`--accent-strong: #0b49c8` cobalt) is reserved for actions + selection only** (active nav rail, primary buttons, links). Everything else is steel/ink/parchment.
4. **Geometry is intentionally low-radius:** 3px controls, 4px artifacts; most surfaces hardcode `border-radius: 3px/4px` rather than the radius tokens.
5. **Two undefined shell tokens** (`--shell-drawer-w`, `--shell-mobile-trigger`) leave the mobile drawer and its trigger un-sized — worth defining as part of any shell redesign.
6. **Single source of truth for sign-out is the topbar `AccountMenu`**; the mobile drawer has its own `SidebarMobileAccount` sign-out; the desktop footer carries only collapse + role.

**Files of record:** `src/app/globals.css` · `src/app/layout.tsx` · `src/app/(dashboard)/layout.tsx` · `src/components/layout/{header,account-menu,legal-footer}.tsx` · `src/components/layout/sidebar.tsx` · `src/components/layout/sidebar/{sidebar-brand,sidebar-footer,sidebar-section,sidebar-nav-item,sidebar-badge,sidebar-account,mobile-drawer,collapsed-tooltip,constants}.tsx/.ts` · `src/components/landing/lp-fonts.ts`.