# Oblixa UI Design Principles

This document defines the visual design system for every surface in Oblixa. It is the contract for any future agent or engineer touching page layouts, components, copy, typography, or aesthetic treatment.

The core principle:

> One vocabulary for every surface. Landing-grade on entry and hero moments; a calmer cousin on dense work surfaces. Mode-aware via tokens, never via literals. Status earns color; everything else stays quiet.

## 1. Scope

Applies to all 91 page surfaces and every component that can render inside them:

- Landing (`/`), marketing/legal (`/security`, `/terms`, `/privacy`, `/cookies`, `/accessibility`), auth (`/login`, `/signup`, `/forgot-password`, `/reset-password`), external (`/external/[token]`), error/not-found boundaries.
- Dashboard chrome (sidebar, topbar, legal footer) and every dashboard page (home, work, contracts/*, decisions, campaigns, assurance/*, settings/*, more, accounts, counterparties, reports, relationship workspaces, onboarding/calibration).
- Cards, panels, disclosures, badges, chips, status dots, form controls, dropdowns, buttons, empty states, loading skeletons, alert banners, navigation rails.

Any new surface or component MUST follow these principles or document explicitly why a deviation is required.

## 2. Visual Vocabulary

### 2.1 Surface tiers

Use the lightest tier that still communicates the right emphasis. Surfaces stack `flat → quiet → standard → raised → hero → luminous` from least to most emphatic.

| Tier | Class | When to use |
|---|---|---|
| **Quiet** | `.ui-card-quiet` | Inset content inside another card; dense rows; non-focal collections. |
| **Standard** | `.ui-card`, `.ui-panel` | Default content surface. Soft top-radial accent wash + single-direction linear gradient + faint inner highlight (light) or cool inset highlight (dark) + `shadow-1`. |
| **Raised** | `.ui-card-raised`, `.ui-page-shell` | Page-level content blocks. Stronger accent wash + refined inner highlight + `shadow-2` with subtle accent halo at the bottom. |
| **Hero** | `.ui-card-hero`, `.ui-page-header`, `.ui-hero-shell` | Landing-tier surfaces for entry pages, focal status cards, and primary CTAs. Mirrors `.landing-card-premium`: premium gradient, accent rail (via `.landing-card-rail::after` or `.ui-page-header--rail::after`), deeper shadow + larger accent halo. |
| **Luminous (rare)** | `.ui-page-luminous` + `__base` child, `.landing-luminous` + `__base/__glow/__grid` children | Only for landing-grade entry surfaces: landing page sections, auth pages, marketing legal articles, error/not-found boundaries, dashboard home empty state, onboarding wizard. Layered radial backdrops behind page content. Never inside productive work surfaces. |

### 2.2 Mode-aware highlight pattern

Every standard-or-raised tier surface has a 1px inset top highlight:

- **Light**: `inset 0 1px 0 rgba(255, 255, 255, 0.40–0.55)` — glass/pearl feel that varies in strength by tier.
- **Dark**: `inset 0 1px 0 oklch(0.92 0.04 270 / 0.04–0.08)` — cool inset highlight tuned for the navy backdrops.

### 2.3 Accent halo pattern

The "soft glow" that anchors hero CTAs, raised surfaces, and primary actions:

- **Light**: `0 14px 32px -22px color-mix(in oklab, var(--accent) 28%, transparent)` (subtle on raised) up to `0 18px 40px -16px color-mix(in oklab, var(--accent-strong) 50%, transparent)` (hero CTA).
- **Dark**: `0 18px 38px -22px oklch(0.55 0.18 268 / 0.32)` up to `0 24px 50px -18px oklch(0.55 0.18 268 / 0.55)`.

Primary buttons (`.ui-btn-primary`) ship with the accent halo baked in. Do not add additional shadows on top.

### 2.4 Eyebrow + icon-tile pattern

The canonical page-identity treatment, used at the top of every page and at the head of every focal section:

```tsx
<span
  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
  aria-hidden
>
  <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
</span>
<div className="min-w-0">
  <p>
    <span className="landing-eyebrow-dot text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
      {eyebrow}
    </span>
  </p>
  <h1 className="mt-1 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
    {title}
  </h1>
  <p className="mt-1.5 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
    {lead}
  </p>
</div>
```

- Icon tile is 36–44px square, rounded-xl, accent-tinted bg (`color-mix(in oklab, var(--accent-soft) 35–42%, var(--surface-raised))`), accent-tinted border, `text-[var(--accent-strong)]` icon glyph at `strokeWidth={1.85}`.
- Eyebrow is `landing-eyebrow-dot`: small caps `tracking-[0.18em]`, `text-[var(--accent-strong)]`, with a 6px glowing dot prefix.
- H1 sits 4px below the eyebrow, lead sits 6px below the h1.
- Canonical examples: `src/app/(marketing)/security/page.tsx`, `src/components/auth/auth-form.tsx`, `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/settings/health/page.tsx`.

### 2.5 Status dot pattern

Use status dots with soft halos for status indicators in metric cells, eyebrows, and row prefixes:

```tsx
<span
  aria-hidden
  className="inline-flex h-2 w-2 rounded-full"
  style={{
    background: "var(--success-ink)" /* or var(--warning-ink) / var(--danger-ink) */,
    boxShadow: "0 0 0 3px color-mix(in oklab, var(--success-soft) 42%, transparent)",
  }}
/>
```

Size: `h-2 w-2` (8px) for emphasis; `h-1.5 w-1.5` (6px) for inline punctuation. Always paired with a soft-color halo (`box-shadow` ring). Use status-tinted colors (success, warning, danger) only when they convey real state; otherwise use `var(--border-strong)` neutral.

### 2.6 Chip / pill vocabulary

| Use case | Pattern |
|---|---|
| **Status value chip** (e.g., "Core", "1 member", "Admin control") | Subtle accent tint: `border-[color:color-mix(in_oklab,var(--accent)_10%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,var(--surface-raised))] text-[var(--text-secondary)]` |
| **Warning state chip** (attention tone) | `border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_28%,var(--surface-raised))] text-[var(--warning-ink)]` |
| **Healthy state chip** | `border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] text-[var(--success-ink)]` |
| **Mode/meta chip** (page-header context) | `.ui-mode-chip` — rounded-full + accent-soft bg + accent-strong text + uppercase tracking-[0.12em] |
| **Inline section badge** (right of section header: role, member count, joined date) | `inline-flex shrink-0 self-start items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]` |
| **Count chip** (mono) | `font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]` — no border, no bg |
| **Count + action capsule** | `<ChipCapsule leftValue leftLabel rightVerb href tone>` — single bordered capsule split internally by a hairline; left segment carries count + label (8% tone tint), right segment carries verb + arrow (16% tone tint, hover-emphasized). One unit, one click target. See §2.10. |
| **Two-token caps chip** | `<ChipPair primary secondary tone>` — primary token at 700 weight + 0.14em, secondary at 500 weight + 0.12em. Whitespace separates them — no `·`. Replaces every `TOKEN · MODIFIER` chip. |
| **Key-value chip** | `<KeyValueChip label value tone>` — caps label + tabular value in a bordered pill. Used on KPI cards and stat strips. |
| **Time chip** | `<TimeChip date format>` — compact `4D` / `MAY 9` / `1H` / `NOW` with caps tracking, optional tone. Always includes a screen-reader aria-label with the full absolute date. |
| **Ratio chip** | `<RatioChip numerator denominator suffix>` — `1 / 1000` caps tabular with the slash in `font-mono` for visual differentiation. |
| **Action chip** | `<ActionChip verb href icon tone>` — caps verb + arrow pill, structured navigation target. Replaces inline prose CTAs ("Browse →"). |
| **Subtle count chip** | `<CountChip value emphasis tone>` — minimal numeric pill, `subtle` (transparent bg) or `strong` (tone-tinted bg). |
| **Status badge with stale-pulse** | `<StatusBadge status pulse>` — `pulse={true}` adds a 4s slow attention pulse (`.ui-status-badge-pulse`) for items that have aged past a freshness threshold. |

The new chip primitives live in `src/components/ui/chip-capsule.tsx`, `chip-pair.tsx`, `key-value-chip.tsx`, `time-chip.tsx`, `ratio-chip.tsx`, `action-chip.tsx`, `count-chip.tsx`. Prefer these over inline span constructions so the dashboard's chip vocabulary stays bounded.

### 2.7 Landing decorative primitives

Reserved for landing, auth, marketing legal, external token, and error/not-found surfaces. Do not use inside dashboard work pages.

- `.landing-luminous` + `__base` + `__glow` + `__grid` — full luminous backdrop with three radial+gradient layers
- `.landing-luminous__fade` — bottom fade for section transitions
- `.landing-header-backdrop` — ambient navy/pastel strip behind a header (17rem tall)
- `.landing-card-premium` — premium hero card with accent shadow halo
- `.landing-card-rail::after` — soft accent rail on the left edge
- `.landing-corner-ring` — dashed decorative ring in card corners (mode-aware opacity)
- `.landing-eyebrow-dot` — caps eyebrow + glowing accent dot
- `.landing-eyebrow-rule` — caps eyebrow + gradient rule

### 2.8 Caps tracking tiers

Caps text has three tiers, exposed as utility classes in `globals.css`. Use the class, not inline `tracking-[Xem]` + `font-weight` combinations.

| Tier | Class | Weight / tracking | Where |
|---|---|---|---|
| 1 (heroic) | `.ui-caps-1` | 700 / `letter-spacing: 0.18em` | Section / category eyebrows, ChipCapsule primary, page-lead capsule primaries |
| 2 (default) | `.ui-caps-2` | 600 / `0.14em` | Caps labels in chips, section-header metadata, KPI eyebrow |
| 3 (modifier) | `.ui-caps-3` | 500 / `0.12em` | In-chip secondaries, ChipPair secondary, tone/state qualifiers |

Always pair caps spans with `leading-none`. Control vertical rhythm via padding on the parent — never via the leading of the caps text itself.

### 2.9 Middle-dot rules (`·`)

The middle-dot is reserved for explicit "chapter break" separators. Bare `·` between caps tokens reads at low contrast as a period or stray punctuation. When you need to separate two caps tokens, pick one tactic:

| Tactic | When | How |
|---|---|---|
| **(A) Split into adjacent chips** | Count → verb pairs in CTAs | Two separate chips (or a `ChipCapsule` to bind them) |
| **(B) Drop dot, weight gradation** | Two caps tokens in one chip where the second modifies the first | `ChipPair` (primary 700/0.14em + secondary 500/0.12em, whitespace separator) |
| **(C) Keep dot via `.ui-dot-sep`** | Section eyebrows where the dot anchors a meaningful chapter break | Wrap dot in `.ui-dot-sep`: `margin-inline: 0.375rem; color: var(--text-secondary); font-weight: 500; vertical-align: -0.1em` |
| **(D) Drop dot entirely** | Cases where the second token is redundant | Render only the primary token |

Sites that legitimately keep the dot: page-header `WORKSPACE · LIVE` eyebrow, Pulse `MAY 13 · WED` value, workspace usage eyebrow `WORKSPACE · MAY 2026`. All use `.ui-dot-sep`.

For a 1px hairline divider inside cramped chips where neither whitespace nor a styled dot work: `.ui-rule-vert` (1px vertical hairline, hairline-color-mixed).

### 2.10 Count + action ChipCapsule

For page leads and any cause-and-effect pair where a count needs an action, use `<ChipCapsule>` from `src/components/ui/chip-capsule.tsx`. The capsule is **one** bordered surface split internally by a hairline at `55%` of the tone ink. The left segment carries `count + caps label` (8% tone tint, semibold caps); the right segment is the primary affordance (16% tone tint, bold caps, hover-emphasized arrow that translates 4px on hover). Both segments share one outer border and link to the same target. The reader's eye reads them as one cause-and-effect unit rather than two adjacent siblings.

```tsx
<ChipCapsule
  leftValue={openExceptions}
  leftLabel="EXCEPTIONS"
  rightVerb="TRIAGE"
  href="/contracts/exceptions?status=open"
  tone="danger"
/>
```

Apply `.ui-chip-focus` for keyboard accessibility (already baked into `ChipCapsule`).

### 2.11 Zero-state stat cells

A count of `0` next to a "needs action" label means **all clear, nothing required**. Communicate that affirmatively, not by greying everything out. Greying treats 0 as "no data"; tone-tinting treats it as "done".

Pattern for live metric cells:

```tsx
<div className="flex items-center gap-1.5">
  {/* Tone dot — always rendered, slot reserved for column alignment */}
  <span className="relative inline-flex h-2 w-2 min-w-[0.625rem] shrink-0 items-center justify-center" aria-hidden>
    {isZero ? (
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "color-mix(in oklab, var(--success-ink) 60%, transparent)" }} />
    ) : (
      /* active cell — tone-tinted dot with halo */ ...
    )}
  </span>
  <p className="ui-caps-2 text-[var(--text-tertiary)]">{label}</p>
</div>
<div className="mt-1.5 flex items-center gap-2">
  {isZero ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border" style={{
      borderColor: "color-mix(in oklab, var(--success-ink) 28%, var(--border-card))",
      background: "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
      color: "var(--success-ink)",
    }} aria-hidden>
      <Check className="h-3 w-3" strokeWidth={2.2} />
    </span>
  ) : null}
  <p className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em]" style={{
    color: isZero
      ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
      : numberColor(tone),
  }}>{value}</p>
</div>
<span className="inline-flex h-4 items-center rounded-md border px-1.5 ..." style={{
  borderColor: isZero
    ? "color-mix(in oklab, var(--success-ink) 24%, var(--border-card))"
    : "var(--border-card)",
  color: isZero
    ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
    : "var(--text-tertiary)",
}}>{unit}</span>
```

Three coordinated treatments for `isZero`:
- **Tone dot** — muted success (60% mix) in the always-reserved slot
- **Number** — `color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))` (muted green that pairs with the medallion)
- **Check medallion** — 24×24 tone-tinted rounded-md box with `Check` glyph at strokeWidth 2.2 immediately left of the number, anchoring the lone "0" visually
- **Unit chip** — border + text tint switch from neutral to muted-success

Never apply `opacity-*` to dim a zero card — the muted tone-tinting already de-emphasizes without washing out the green semantics.

Canonical implementation: `src/components/v4/command-center-role-metrics.tsx`.

## 3. Typography

Two font families, three semantic uses:

- **Sans (Plus Jakarta Sans, `var(--font-sans)`)** — all human-readable copy: headings, labels, body, button text, names, organization names.
- **Mono (Geist Mono, `var(--font-mono)`)** — technical strings only: timestamps, IDs, env-var keys, email addresses (in tables and read-only displays), file paths, counts in compact contexts.

Form controls MUST inherit `font-family: var(--font-sans)` (explicit on `.ui-input` / `.ui-input-compact` plus the global `input, select, textarea, button { font-family: inherit; }` rule). Browser user-agent stylesheets break this otherwise — the value font silently falls back to a system font and stops matching the label.

Type scale (use the closest value, do not invent new sizes):

| Use | Class |
|---|---|
| Display title (page h1) | `text-[1.75rem] sm:text-[2rem]` semibold leading-[1.1] tracking-tight |
| Hero status headline (workspace-status h2) | `text-[1.75rem] sm:text-[2.125rem] md:text-[2.4rem]` semibold leading-[1.1] tracking-[-0.01em] |
| Section title (h2 / h3) | `text-[1.05rem] sm:text-[1.4rem]` semibold tracking-tight |
| Subsection / card title | `text-[1.05rem]` semibold tracking-tight |
| Body lead | `text-[13.5–14.5px]` leading-snug-to-relaxed text-secondary |
| Row title | `text-[13.5px]` font-semibold tracking-tight text-primary |
| Body detail | `text-[12–12.5px]` leading-snug text-secondary |
| Tertiary hint | `text-[11.5px]` leading-snug text-tertiary |
| Eyebrow caps | `text-[10.5px]` font-semibold uppercase tracking-[0.18em] |
| Smallest caps label | `text-[10px]` font-semibold uppercase tracking-[0.16em] |
| Mono data | `font-mono text-[10.5–12.5px]` tabular-nums |
| Display stat number | `text-[2–2.5rem]` font-semibold leading-none tabular-nums tracking-[-0.02em] |

## 4. Color Tokens

All color decisions reference CSS variables at `:root` in `src/app/globals.css`. Mode flips happen exclusively via `@media (prefers-color-scheme: dark) :root { ... }`. **Never write literal `white` or `black` inside `color-mix(...)` — those don't flip with the color scheme and will silently produce light-on-white or dark-on-dark in the wrong mode.** Use `var(--surface-raised)` or `var(--text-primary)` as the mixing anchor instead.

Token families:

- `--canvas`, `--canvas-strong`, `--canvas-deep`, `--canvas-glow`, `--canvas-glow-secondary`
- `--surface`, `--surface-raised`, `--surface-muted`, `--surface-contrast`, `--surface-inset`
- `--accent`, `--accent-strong`, `--accent-soft`, `--accent-fg`
- `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`
- `--border-subtle`, `--border-strong`, `--border-contrast`
- `--sidebar`, `--sidebar-fg`, `--sidebar-muted`, `--sidebar-active`, `--sidebar-hover`
- `--success`, `--success-soft`, `--success-ink`; same shape for `--warning-*` and `--danger-*`
- `--shadow-1` through `--shadow-3`, `--shadow-glow`
- `--ui-duration`, `--ui-duration-slow`, `--ui-ease-out`

The accent family resolves to a blue-violet in light mode and a brighter blue-violet in dark mode. Status families (success/warning/danger) follow the same soft+ink pattern.

## 5. Page Architecture

### 5.1 Page identity (the page header)

Settings pages, dashboard hubs, marketing legal articles, and most authenticated surfaces use **flat inline identity** (no boxed `.ui-page-header` card):

```tsx
<header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
  <div className="flex min-w-0 items-start gap-3.5">
    <span className="inline-flex h-10 w-10 ..."><Icon /></span>
    <div className="min-w-0">
      <p><span className="landing-eyebrow-dot ...">{eyebrow}</span></p>
      <h1 className="mt-1 text-[1.75rem] sm:text-[2rem] ...">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-snug ...">{lead}</p>
    </div>
  </div>
  <dl className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
    {/* page-level metadata */}
  </dl>
</header>
```

Use the boxed `.ui-page-header.ui-page-header--rail` card ONLY when the page surface needs the same focal weight as its content (rare — usually only the dashboard home hero and onboarding entry pages need this).

**Never** put both a flat inline identity and a boxed page-header card on the same page. That creates two competing focal surfaces.

### 5.2 "Back to settings" / "Back to home" links

Settings sub-pages, marketing legal pages, and any pages with a clear parent route get a ghost-pill back link above the header:

```tsx
<Link
  href="/settings"
  className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
>
  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
  Back to settings
</Link>
```

Use `max-w-max`, not `w-fit` — `w-fit` is banned by the UI-quality test suite (see `src/lib/qa/ui-quality-sweep.test.ts`).

### 5.3 Page-stack spacing

Top-level page sections live inside `.ui-page-stack` (or `.ui-page-stack-dense` for tighter rhythms like the system-health page). Spacing between sections is owned by the stack; do not add `mt-*` to first-level children.

To tightly group a header with a filter row or a metadata strip, wrap them in a single `<div className="flex flex-col gap-4–5">` so they become one stack child (see `/more/page.tsx` and `/settings/health/page.tsx` for examples).

### 5.4 Section flow

Standard order on a content-heavy page:

1. **Back-link pill** (optional, when the page has a parent route)
2. **Flat page identity** (icon-tile + eyebrow + h1 + lead + right-aligned dl meta)
3. **Optional filter / search row** (grouped with identity via wrapper div)
4. **Focal content** (hero card, status panel, or primary action)
5. **Detail content** (grouped lists, disclosures, tables, forms)
6. **Optional admin-only footer** (collapsed `<details>` for advanced/operator-only info)

## 6. Disclosure Pattern

Collapsible sections use the flat horizontal-rule treatment, not card boxes:

```tsx
<details className="group">
  <summary className="flex cursor-pointer list-none items-center gap-3 border-y border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] py-3 outline-none transition-colors marker:hidden hover:border-[color:color-mix(in_oklab,var(--success)_18%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
    <span className="inline-flex h-7 w-7 ... rounded-lg">{icon}</span>
    <span className="flex min-w-0 flex-1 ...">{title}</span>
    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
  </summary>
  <div className="py-3 pl-10">
    {/* expanded content */}
  </div>
</details>
```

Two hairlines (top + bottom border-y on summary), no outer card. Indented content (`pl-10`) below. ChevronRight rotates 90° on open. Use native `<details>/<summary>` for keyboard semantics — do not replace with JS Disclosure components.

## 7. Components

### 7.1 Buttons

| Style | Class | When |
|---|---|---|
| Primary CTA | `.ui-btn-primary` | One per surface. Has the accent halo baked in. Don't add extra shadows. |
| Secondary | `.ui-btn-secondary` | Equal-weight peer to primary when both actions are commitments. |
| Ghost | `.ui-btn-ghost` | Tertiary actions, back-links, "Inspect diagnostics"–type secondary affordances. |
| Inline link | `.ui-link` | Anchor-style navigation inside prose, table cells, or directory rows. |

Primary and secondary should reach for a `rounded-full px-4 py-2 text-[13px]` pill shape when paired in an action row. Match heights so they baseline-align.

### 7.2 Inputs

All inputs use `.ui-input` (or `.ui-input-compact` for tighter rows). Both inherit the app font family. Leading icons go inside via absolute-positioned `<span>`:

```tsx
<div className="relative">
  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]" aria-hidden>
    <Mail className="h-3.5 w-3.5" />
  </span>
  <input type="email" className="ui-input pl-9 font-mono text-[12.5px]" />
</div>
```

- Email fields → `font-mono` (technical string)
- Name / org-name fields → default sans
- Read-only fields → reduce text color to `text-tertiary` + bg to `surface-muted` + add a "READ-ONLY" caps tag inline with the label

### 7.3 Dropdowns

**Never use a native `<select>` for any dropdown that needs custom-styled options.** The browser renders its own native menu when the select is clicked regardless of `appearance: none` styling on the closed state. Use a custom React combobox instead.

Canonical pattern: `src/components/settings/invite-member-form.tsx`'s `RoleDropdown`.

Requirements:
- Trigger is a `<button type="button">` styled as a rounded-full pill with leading icon + label + trailing `ChevronDown` (rotates 180° on open).
- Menu is a `<ul role="listbox">` rendered via `createPortal(menu, document.body)` so it escapes parent `overflow-hidden`.
- Position with `position: fixed` calculated from the trigger's `getBoundingClientRect()`.
- Hidden `<input type="hidden" name="..." value={selectedValue} />` carries the value into form submission.
- Keyboard support: ArrowDown/Up to navigate, Enter/Space to select, Escape to close + return focus to trigger, Tab to close + move focus.
- Click outside closes (mousedown listener on document, with refs for both trigger and portaled menu).
- Scroll / resize closes (since `position: fixed` doesn't follow the trigger).
- Each option shows `Check` icon when selected, plus label + 1-line description.

### 7.4 Forms

Form sections live in `.ui-card` (not `.ui-page-shell` — page-shell is for content blocks, not editor cards). Header pattern:

```tsx
<section className="ui-card overflow-hidden p-0">
  <header className="flex flex-col gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <p><span className="landing-eyebrow-dot ...">{eyebrow}</span></p>
      <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{lead}</p>
    </div>
    <span className="inline-flex shrink-0 self-start rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:self-auto">
      {/* role badge, member count, joined date, etc. */}
    </span>
  </header>
  <div className="p-5">
    {/* form content */}
  </div>
</section>
```

Never duplicate copy between the section lead and the field helper text. If the section header already says "Used in navigation, invites, exports, and billing", the field doesn't need to repeat it.

Helper text under field labels should be moved into the label itself as an inline caps tag (e.g., `<label>Email <span className="text-[10px] uppercase tracking-[0.14em] text-tertiary">READ-ONLY</span></label>`) rather than a paragraph between label and input.

### 7.5 Tables

Tables use `.ui-table-shell` outer wrapper + `.ui-table-header` for column headings + `.ui-table-row` for rows. Email-like values get `font-mono text-[12.5px]`. Role values get the accent-soft pill with uppercase tracking-[0.14em] caps.

For directory-style content (list of settings with current values + actions), prefer **grouped lists** over tables. The grouped-list pattern: section caps label + count chip on a hairline, then rows of `[title + chip] / [detail] / [action]` with the detail on a second line under the title. See `src/app/(dashboard)/settings/settings-page-sections.tsx`'s `SettingsDirectory`.

### 7.6 Metric cells

For "X of Y" stat displays (hero cards, dashboard summaries):

```tsx
<div>
  <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
    <span aria-hidden className="inline-flex h-2 w-2 rounded-full" style={{ background: toneColor, boxShadow: toneHalo }} />
    {label}
  </dt>
  <dd className="mt-2 flex items-baseline gap-2">
    <span className="text-[2.25rem] font-semibold leading-none tabular-nums tracking-[-0.02em]" style={{ color: toneColor }}>
      {value}
    </span>
    {total != null ? (
      <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
        of {total}
      </span>
    ) : null}
  </dd>
</div>
```

Use a 2-cell layout for two-stat metrics. Add a `sm:divide-x` hairline between cells. Never mix numeric cells with text-only "status" cells in the same strip — move status info to the section's subtitle or a separate row.

For multi-cell metric strips (5 cells across, dashboard-style), use the **zero-state stat cell** pattern from §2.11: every cell has a reserved tone-dot slot (so caps labels align across cells), active cells render the tone-tinted dot with halo, zero cells render a small success-soft dot + a `Check` medallion next to the number + a muted success-tinted unit chip. Reserved-slot principle (§10.9) keeps the column edges stable as values change.

### 7.6.1 KPI cards (focal stat cards)

For the "What needs action now" KPI row and similar focal stat surfaces, use `<KpiCardWithSparkline>` from `src/components/ui/kpi-card-with-sparkline.tsx`. Key contract:

- **Eyebrow** — caps label tone-tinted to the card's status tone.
- **Icon medallion** — 36×36 tone-tinted rounded-xl, sits inline with the count baseline.
- **Count** — `text-[2.5rem]` (narrow) or `text-[3rem]` (`wide={true}` for col-spanned cards), tone-colored, `leading-none tabular-nums tracking-[-0.02em]`.
- **Sparkline** — only render when `hasHistoricalData={true}`. Don't reserve placeholder space when no real series exists — leave the count to expand.
- **Metric chips** — 2–3 `<KeyValueChip>` chips below the count. Wide cards get 3 chips (label + priority + horizon); narrow cards get 2.
- **Action row** — `actionLabel →` followed by a vertical hairline + count pill (narrow cards only — wide cards suppress the trailing chip because the action label already contains the count via the `... · N` suffix).

Wide cards inherit the same anatomy at scaled sizes (eyebrow 12px, count 3rem, sparkline 120×28, corner ring 24×24).

Anti-pattern: prose "hint" paragraphs below the count (truncated with `...` on narrow widths). Use `<KeyValueChip>` rows instead — see §11.21.

### 7.7 Status badges

Use `<StatusBadge status={...}>` from `src/components/ui/status-badge.tsx`. Tones: `healthy`, `info`, `warning`, `critical`, `empty`. Always paired with a status-aware accent rail or icon for non-color reinforcement.

Banned: bare colored pills as the only status signal. WCAG color-only signals are not acceptable.

## 8. States

### 8.1 Empty states

Flat treatment when the empty state is the expanded content of a disclosure or sub-section:

```tsx
<div className="flex items-start gap-4 py-6">
  <span className="inline-flex h-10 w-10 ...">{icon}</span>
  <div className="min-w-0 flex-1">
    <p><span className="landing-eyebrow-dot ...">{eyebrowState}</span></p>
    <p className="mt-1 text-[15px] font-semibold tracking-tight">{heading}</p>
    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
  </div>
</div>
```

Premium card treatment when the empty state IS the focal content of a page (no setup yet, no policies, no plan):

```tsx
<section className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8">
  <div aria-hidden className="landing-corner-ring" style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }} />
  <div className="flex items-start gap-4">
    <span className="inline-flex h-11 w-11 ...">{icon}</span>
    <div className="min-w-0 flex-1">
      <p><span className="landing-eyebrow-dot ...">{eyebrow}</span></p>
      <h2 className="mt-1 text-xl sm:text-[1.4rem] font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-secondary">{body}</p>
      <div className="mt-5 flex flex-wrap gap-x-1 gap-y-2">
        <Link className="ui-btn-primary ...">{primaryAction}</Link>
        <Link className="ui-btn-ghost ...">{secondaryAction}</Link>
      </div>
    </div>
  </div>
</section>
```

### 8.2 Active-risk hero card

Status-aware accent rail on the left edge, status-tinted icon medallion, huge headline, impact paragraph, primary + secondary CTAs, "at a glance" metric strip below a hairline. See `src/app/(dashboard)/settings/health/page.tsx` for the canonical pattern.

### 8.3 Error / not-found boundaries

Use `landing-luminous` backdrop + `.ui-hero-shell` premium card + warning-tinted icon tile + eyebrow ("System notice" / "Wrong turn") + heading + body + retry/back actions. See `src/app/global-error.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`.

### 8.4 Loading

Standard skeleton: `.ui-skeleton` for individual placeholder shapes. Wrap in `.ui-loading-panel` for full route-loading fallbacks.

### 8.5 Activity feed rows

Activity rows are icon + caps verb + caps detail + `<TimeChip>`, never prose. Use a bounded verb vocabulary so the dashboard's verbs stay consistent — `EXTRACTED`, `APPROVED`, `REJECTED`, `EDITED`, `UPLOADED`, `CREATED`, `DELETED`, `COMPLETED`, `ASSIGNED`, `SIGNED OFF`, `REVIEWED` (see `src/lib/ui-copy.ts` `CAPS_VERBS`).

```tsx
<li className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-baseline gap-2.5 py-1.5">
  <Icon className="h-3.5 w-3.5 self-center" strokeWidth={1.85} style={{ color: toneInk }} aria-hidden />
  <p className="inline-flex items-baseline gap-1.5 truncate text-[10.5px] uppercase tracking-[0.12em] leading-tight">
    <span className="ui-caps-1" style={{ color: toneInk }}>{verb}</span>
    {detail ? <span className="ui-caps-3 text-[var(--text-secondary)] tabular-nums">{detail}</span> : null}
  </p>
  <TimeChip date={timestamp} className="shrink-0 min-w-[2.75rem] justify-end" />
</li>
```

Contract titles inside activity rows render as bordered chips with responsive `max-w` (`10rem / 14rem / 18rem` by breakpoint). The verb's tone-ink color anchors the row's semantic intent. Time chips include an `aria-label` with the full absolute date.

Canonical: `src/components/ui/activity-feed.tsx` + `src/components/dashboard/team-activity-feed.tsx`.

### 8.6 Hover-revealed structured affordance

Replace static chevrons at the end of rows with a hover-revealed caps action chip that telegraphs intent. A trailing `›` doesn't tell the user what clicking does; `OPEN →` does.

```tsx
<span
  aria-hidden
  className="opacity-0 transition-opacity group-hover:opacity-100"
>
  <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
    OPEN
    <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
  </span>
</span>
```

Use this pattern in Recent contracts rows, activity rows, and any list where the row is itself a link target. The static chevron is dropped entirely (not faded), because the structured chip takes its place on hover.

### 8.7 Compact dashboard empty state

For empty right-rail panels (Quick access, Pinned views, Recently viewed) use `<DashboardEmptyState>` from `src/components/dashboard/dashboard-empty-state.tsx`. It pairs a Lucide icon with a caps label + optional caps hint + structured action button — no prose paragraphs.

This is distinct from the page-level `<EmptyState>` (which uses the larger empty-state premium card from §8.1). Dashboard-empty-state is the compact inline variant for panel bodies.

## 9. Light / Dark Mode

Mode flips happen exclusively via tokens. Authoring rules:

- Every color value MUST resolve through a CSS variable. No hard-coded hex, no Tailwind slate-200, no literal RGB.
- `color-mix(in oklab, ...)` blends must use `var(--surface-raised)` or `var(--text-primary)` as the mixing anchor, never literal `white` or `black`. Literal anchors don't flip with the mode.
- Test every new surface in both modes before merging. Watch for: white-on-white, dark-on-dark, status colors invisible against status-tinted backgrounds, focus rings invisible at low contrast.
- Most utilities don't need an explicit `@media (prefers-color-scheme: dark)` override because their colors resolve through tokens. Add an explicit dark block only when the gradient embeds literal anchors that can't be tokenized (e.g., subtle white inner highlights that should flip to cool insets in dark).

The dashboard chrome wrapper class is `.ui-app-shell`. Marketing/auth/external/error pages live inside `.landing-root` so the marketing footer crown, header backdrop, and luminous treatments apply via cascade.

## 10. Aesthetic Principles

### 10.1 Calmer cousin

Productive work surfaces (contracts list, work queue, settings sub-pages, dashboard tables) use the **same color vocabulary** as the landing page but **drop the decoration**: no glow layers, no grid patterns, no corner rings, no orbit ornaments, no marquees. Surfaces still have premium gradients and accent halos but stay quiet.

Landing-grade decoration is reserved for entry surfaces (landing page, auth, marketing legal, external token, errors) and rare hero moments inside the dashboard (empty-state welcome cards, onboarding wizard).

### 10.2 Status earns color

Color is a state signal, not a decoration. Reserve accent colors for:
- Active risk (warning amber, danger red on hero cards and metric cells)
- Healthy state confirmation (success green on cleared counts)
- Primary actions (accent blue on CTAs)
- Interactive affordance (accent blue on links, hover states)

Everything else stays in the `--text-primary` / `--text-secondary` / `--text-tertiary` neutral scale.

### 10.3 Mode is not a chrome indicator

The dashboard chrome already displays the workspace mode. Pages MUST NOT redundantly display the workspace mode in their header chips, eyebrows, or metadata strips. The Product experience setting in `/settings` is allowed to show the mode AS its current value (since the setting controls the mode) — but no other page should mention it.

This rule applies to body prose too: avoid phrasings like "Core workspace. No visible settings need attention." in favor of mode-agnostic copy like "No visible settings need attention."

### 10.4 Eliminate redundancy

If a section header lead and a field helper text say the same thing, drop one. If a chip's content + label create awkward word doubling ("PLAN No plan"), rephrase or drop the label. If a directory row description repeats the action label, tighten or remove. The page should never tell the user the same thing twice.

### 10.5 No card-within-card

When sub-grouping content inside a card, use `border-t` hairlines, not nested card borders. Card-within-card creates a "wall of boxes" feel and dilutes hierarchy. The Invite teammate form inside the Team access card uses a `border-t pt-4` divider, not a nested `rounded-lg border bg-surface-muted` widget.

### 10.6 Single focal surface per page

Pages have ONE focal surface (hero card, premium card, or focal stat panel). Multiple sequential `.ui-page-shell` cards stacked in the page stack are fine for content density, but only one should carry the page's primary attention. Make the focal surface the loudest visual element; let everything else recede.

### 10.7 No small plain text

Never write helper sentences in `text-[var(--text-secondary)]` or `text-[var(--text-tertiary)]` at 11.5px next to a primary CTA or under a count. The eye reads small prose as noise, then drifts. Replace with caps-tracking spans, structured chips (§2.6), or accent action links with chevrons. The dashboard ships zero prose paragraphs longer than 80 characters between structured elements.

This means: KPI cards have **no `hint` prop** — use `<KeyValueChip>` rows. Right-rail panels have **no descriptive sentences** under the count — use key/value rows. Empty states have **no "you haven't done X yet" sentences** — use icon + caps label + action button.

### 10.8 Weight gradation over middle-dot separators

When two caps tokens belong inside one chip, drop the `·` and use weight gradation: primary at 700/0.14em + secondary at 500/0.12em with a 6px gap. This pattern is what `<ChipPair>` encapsulates. The dot survives **only** at chapter-break separators (page eyebrows, multi-day pulse rows) where it has air, contrast, and `.ui-dot-sep` styling. See §2.9 for the full triage rubric.

### 10.9 Always-reserved slots for column alignment

When a row prefix (tone dot, icon, status indicator) renders conditionally, the absent case must still occupy the same width as the present case. Render a transparent placeholder of identical dimensions, not nothing. This keeps column edges of multi-row surfaces stable across cells.

Concrete examples:
- Live-metric tone dot slot uses `min-w-[0.625rem]` even when no dot renders.
- Pulse value chip always renders the dot span — `background: transparent` when no tone signal is needed.
- Step pills (setup nudge) always reserve a 20×20 medallion slot regardless of which icon (Check or step glyph) fills it.

### 10.10 Tone-tinted zero states (not greyed out)

A count of `0` next to a "needs action" label means **all clear**, not "no data". Communicate that affirmatively with the §2.11 pattern: muted success dot + green Check medallion + muted-success number + tone-tinted unit chip. Never `opacity-*` to dim a zero card — the muted tone-tinting already de-emphasizes without washing out the green semantics, and `opacity-60` on the whole card kills the tone-coding you just established.

Greyed-out zero treats "0 exceptions" as a data hole. Tone-tinted zero treats it as the desired outcome. Pick the latter.

### 10.11 Tabular nums on every count

`tabular-nums` applies to every digit rendered inside chips, pills, ratios, stat displays, time chips, count badges, ratio chips, and progress percentages. Without it, "12 → 23 → 9" reflows column widths as values change and the digit columns of stat strips visibly dance.

### 10.12 Em-dash for "no value yet"

`—` (U+2014 em-dash) is the universal token for "no value to render". Used inside chips (`NO DATA`, `STATUS —`), in ratio placeholders, in dormant step indicators (`STEP 3 —`). Never hyphen (`-`) — too short, reads as a typo. Never en-dash (`–`) — visually similar but used elsewhere for numeric ranges.

### 10.13 Structured over prose for inventory + action

When a surface communicates "X items need Y", use `<ChipCapsule>` (§2.10) rather than a sentence + link. `2 EXCEPTIONS · TRIAGE →` rendered as one capsule reads as a single cause-and-effect unit; the same content as a prose sentence ("2 exceptions need triage. Continue →") forces the reader to parse syntax to extract the count + action. Capsules also let the dashboard scale to 1, 2, 3 simultaneous chips by stacking siblings, where prose would require sentence rephrasing.

### 10.14 Subtraction is a design move

When a surface feels cluttered, awkward, or "off," the fix is usually removal, not addition. Audit decorative elements; remove any that don't earn their visual weight. Aurora bars stacked on top of accent gradient hairlines, floor-to-ceiling tone columns at 8% opacity, half-styled pull quotes, `aspect-[16/9]` constraints on small-content mocks, abstract decoration SVGs competing with badge stamps for the same corner — all add source-code surface area for negligible visual return.

The polish pass for any surface should begin with a subtraction audit: list every decorative element on the page, and challenge each one to defend its visual weight. Anything that fails that challenge gets removed before any new addition is considered.

Pull quotes, drop caps, ornament glyphs, ambient particles, decorative SVGs at low opacity, animated underlines on phase headers, "scroll to explore" cues at the bottom of an obviously-scrollable page — all of these have been removed from production surfaces during polish passes because they did not survive subtraction audits. They added complexity, not signal.

### 10.15 Don't repeat positioning across pages

The landing page sets the product positioning. Inner pages should declare their **own** job, not re-state the landing page's main pitch. A `/product` hero that begins with "Track renewals, obligations, and owners from signed contracts." duplicates content users have already absorbed on the landing page. Instead, the product tour declares "Here's how it fits together" — its job is to walk through the workflow, not to re-sell the product.

Same logic for sibling marketing pages:
- `/product` declares the tour structure ("Here's how it fits together.")
- `/pricing` declares pricing ("Simple pricing for contract tracking.")
- `/security` declares trust ("Built for sensitive contract records.")
- `/contact` declares the channel ("Book a setup call.")

The hero h1 on each inner page is page-specific. Repeating the landing pitch on an inner page is wasted real estate.

### 10.16 Cross-page chrome parity

Pages within the same surface family share the same chrome recipe. Marketing surfaces (`/product`, `/pricing`, `/security`, `/contact`) share:
- Same h1 scale (`text-[2.25rem] sm:text-[3.25rem]` for hero h1s, or `text-[2rem] sm:text-[2.75rem]` for the secondary marketing pages).
- Same CTA cluster pattern (primary `ui-btn-primary` + ghost `ui-btn-ghost`, with 21-day microcopy underneath).
- Same eyebrow style (`landing-eyebrow-dot` + caps tracking).
- Same `landing-card-premium` card chrome for all top-level cards.
- Same gradient accent hairline at the very top of the page.

Dashboard surfaces share their own chrome recipe via `.ui-app-shell`. Pages that drift from their cohort lose visual coherence — a visitor who navigates from /pricing to /product should feel they're on the same site, with the same hand at the design wheel.

When a marketing page needs a structural divergence (e.g., the /product tour gets an anchor nav strip and a vertical timeline rail that the other marketing pages don't have), the divergence should be additive on top of the shared chrome, not a replacement of it.

### 10.17 Paired content shares width

Two visually-related surfaces stacked vertically (e.g., a section card and its mock preview, a chart and its legend, a hero and its CTA strip) must share width to read as connected. A 1200px section card immediately above a 700px centered mock card reads as misplaced — the mock looks like a different feature on a different page.

Either match widths in a single column (both surfaces fill the same content column), or render them side-by-side at lg+ as a 2-column grid (`lg:grid-cols-[3fr_2fr]` with the section on the left, preview on the right). Side-by-side is preferred when the surfaces have a clear cause-and-effect relationship — the visual adjacency reinforces the conceptual one.

When the surfaces are conceptually related but ARE rendered at different widths (rare), make the visual relationship explicit through other means: a connector line, a tone-coded border, a shared eyebrow caps strip above both. Don't leave the reader to infer the relationship from spatial guesswork.

### 10.18 Visual rhythm via layout variation

A page that is N cards stacked vertically in a centered column reads as monotonous, regardless of card content quality. The fix is not widening the column — it's varying the layout.

Alternate full-width cards with 2-column splits. Group some cards into a 3- or 4-cell strip. Render some sections side-by-side with their preview. The rhythm of "full / split / full / split / split / full / split" breaks the centered-column monotony without sacrificing readability.

Canonical example: `/product`'s 7 section cards. Phase 01 (sections 1-2) renders full-width. Phase 02 (sections 3-5) renders each section side-by-side with its preview mock at lg+. Phase 03 has §6 full-width and §7 + its mock side-by-side. The reader's eye experiences alternation: full / full / split / split / split / full / split. That alternation itself is information — phase 01 is "the entry," phase 02 is "the daily flow with previews," phase 03 is "the output."

## 11. Anti-Patterns

Do not do any of the following.

### 11.1 Native browser selects for custom dropdowns

`<select>` opens the OS-rendered dropdown menu regardless of CSS styling on the closed state. If the menu options need accent-tinted hover, descriptions, multi-select, or any other custom rendering, you must build a React combobox (see §7.3).

### 11.2 Boxed-header-inside-boxed-header

A `.ui-page-header` card immediately followed by another `.ui-page-shell` or `.ui-card-hero` creates two competing focal surfaces. Either flatten the outer header to inline (preferred) or move the focal content inline below a single header card.

### 11.3 Diagonal alignment via items-end + mixed-height children

`flex items-end justify-between` between a tall left group and a short right badge puts the badge at the title block's bottom edge, creating a diagonal feel (icon top-left, badge bottom-right). Use `items-start` so both groups align to the top edge.

### 11.4 Literal white / black in color-mix

`color-mix(in oklab, var(--surface) 90%, white)` does not flip in dark mode — the `white` stays white. Result: dark-on-dark or invisible text. Always use `var(--surface-raised)` or another token as the mixing anchor.

### 11.5 Long ISO timestamps in tight cell badges

`"Latest extraction completed 2026-05-09T14:40:15.682Z."` in a fixed-width chip blows out the row layout. Use a right-aligned mono span with `truncate` and `title={fullValue}` for hover, OR shorten the timestamp display before rendering.

### 11.6 Donut charts at disproportionate ratios

A donut showing 1 affected of 12 total is 92% green with an 8% amber tick — visually meaningless. Use big tabular-nums numbers in a 2-cell strip (`1 of 12` / `11 of 12`) instead.

### 11.7 Dual-dot eyebrows

`landing-eyebrow-dot` adjacent to a `StatusBadge` (which also has a dot prefix) creates two adjacent dots in the same row — visual noise. Either drop the eyebrow's dot (use plain caps) or separate them with a thin vertical rule (`<span className="hidden h-3 w-px ... sm:inline-block" />`).

### 11.8 Word doubling in label + value pairs

"PLAN No plan" doubles the word "plan." Rephrase at the display layer (`viewModel.planLabel === "No plan" ? "Free" : viewModel.planLabel`) or drop the label when the value is self-explanatory.

### 11.9 Uppercase via ui-mode-chip for proper names

The `.ui-mode-chip` class applies `text-transform: uppercase`. Org names like "name's Organization" render as "NAME'S ORGANIZATION" — visual shouting. Use a non-uppercase chip class for any user-supplied content.

### 11.10 Native input fonts

If `.ui-input` doesn't set `font-family` and the global `input, select, textarea { font-family: inherit }` reset isn't applied, the input value silently renders in the browser's user-agent font (often `-apple-system` or `BlinkMacSystemFont`) while labels render in Plus Jakarta. They look different. Always set `font-family: var(--font-sans)` on `.ui-input` and `.ui-input-compact`.

### 11.11 Tailwind `w-fit` / `h-fit` / `fit-content`

Banned by `src/lib/qa/ui-quality-sweep.test.ts` because they break in some browser/transform combinations. Use `max-w-max` instead.

### 11.12 Dropdown menus rendered inside overflow-hidden parents

A `position: absolute` dropdown panel inside a card with `overflow: hidden` (used for rounded-corner clipping) gets clipped at the card edge. Use React Portal (`createPortal(menu, document.body)`) with `position: fixed` coordinates from the trigger's bounding rect (see §7.3).

### 11.13 Workspace mode badges in page chrome

The mode is already in the dashboard chrome. Adding it as a chip on every settings/feature/health/billing page is redundant.

### 11.14 Cards solely for visual decoration

Don't wrap a flat list of items in a `.ui-card` just to give it a border. If the content is reference material (e.g., the `/more` destinations directory), drop the card and group with eyebrow caps + hairline border-bottom instead.

### 11.15 Helper paragraphs between label and input

`<label>Field name</label><p>One-line helper</p><input />` adds vertical space and rarely communicates more than the label already does. Either fold the helper into the label as an inline caps tag, or drop it if the section lead already covers the context.

### 11.16 Bare middle-dot between caps tokens

`<span>EXTRACTED</span> · <span>FIELDS</span>` reads at low contrast as stray punctuation or a period fragment. Either drop the dot (Tactic B/D — `ChipPair` with weight gradation), split into two adjacent chips (Tactic A — `ChipCapsule` for count+action), or wrap the dot in `.ui-dot-sep` if it anchors a real chapter break (Tactic C). See §2.9.

### 11.17 Floating numbers without a visual anchor

A large stat number (`text-[2rem]+`) sitting alone in a cell with no icon medallion or chip next to it reads as orphaned. Anchor it with a tone-tinted medallion (§2.11 Check medallion for zero states, §7.6.1 icon medallion for KPI cards). The reader's eye needs a fixed horizontal landmark; whitespace alone makes the number drift.

### 11.18 Duplicate count in label + trailing chip

`TRIAGE EXCEPTIONS · 2` action label + a separate trailing count chip `2` shows the same number twice. Pick one location: either the inline count in the label (used on wide cards via the `· N` suffix) **or** the trailing pill (used on narrow cards). `KpiCardWithSparkline` suppresses the trailing pill automatically when `wide={true}`.

### 11.19 Identical unit labels across adjacent cells

Two metric cells with `OPEN` as the unit label make the reader question whether they're the same metric. Differentiate: `OPEN` for OBLIGATIONS, `ACTIVE` for tasks, `AWAITING` for approvals. A 5-cell strip should have five distinct unit tokens.

### 11.20 Greying out zero cells with `opacity-*`

`opacity-60` on an entire zero metric card washes out the success-tinted unit chip, the green check medallion, and the muted-success number that you just carefully toned to communicate "all clear". Drop the opacity rule; let the coordinated tone-tinting do the de-emphasis. See §10.10.

### 11.21 Prose hints in count / KPI cards

A 1–2 sentence "why this matters" paragraph below the count (e.g., `<p>Risk and blocker records that still need an owner or resolution path.</p>`) truncates with `...` on narrow widths, competes with the number for attention, and ages poorly. Replace with `<KeyValueChip>` rows that surface structured facts (`OLDEST 5D`, `PRIORITY HIGH`, `HORIZON URGENT`). `KpiCardWithSparkline` has no `hint` prop — only `metrics: KpiCardMetric[]`.

### 11.22 Static chevron at row's right edge

A bare `›` at the end of a row doesn't communicate what clicking does. Replace with the §8.6 hover-revealed structured affordance (`OPEN →`, `EDIT →`, `VIEW N →`). The row is still a link target; the chevron just becomes a structured caps chip that telegraphs intent on hover. Drop the static chevron entirely — don't fade it.

### 11.23 Prose-paragraph empty states

`<p>You haven't pinned any saved searches yet. Browse contracts →</p>` inside a right-rail panel reads as a sentence the user has to parse. Replace with `<DashboardEmptyState>` (§8.7): icon + caps label + optional caps hint + structured action button. The visual hierarchy of icon → label → action is faster to scan than a sentence.

### 11.24 Action labels that wrap to two lines

`REVIEW RECENT ACTIVITY →` wraps to two lines on narrow KPI cards because it exceeds the available width. Shorten to a one-line verb (`REVIEW ACTIVITY`) or apply `whitespace-nowrap` defensively as a backstop. Wrapping mid-phrase ("REVIEW RECENT / ACTIVITY") reads as broken.

### 11.25 Repeating landing-page positioning on inner pages

A `/product` hero h1 like "Track renewals, obligations, and owners from signed contracts." duplicates the landing page's main pitch. Users have already absorbed that on the landing page; repeating it on the product tour is wasted real estate. Each page declares its own job — the product tour declares "Here's how it fits together," the pricing page declares pricing, etc. See §10.15.

### 11.26 Numeral above icon stack within a card

When a card has both a section number (`1`) and an icon medallion, stacking them vertically with the number above the icon creates a redundant visual identity that reads as awkward. Pick one:

- **Drop the standalone numeral and inline the number into the eyebrow** as a tabular-nums prefix (`1 ● Replace the spreadsheet`). The medallion alone carries the visual identity on the left. This is the canonical pattern for the /product section cards.
- **Drop the icon and put the number alone inside the medallion.** The numbered circle becomes the section's visual identity. Use when the icon doesn't add semantic information beyond the number.

Don't render both as separate vertical blocks on the left edge of the card. The redundancy reads as half-finished design.

### 11.27 Half-styled editorial decoration

Pull quotes, drop caps, ornament glyphs, and decorative wordmarks that aren't fully styled read as copy-paste mistakes. A short italic sentence with a tiny `"` glyph and no decorative framing reads as "I forgot to finish styling this." A `:first-letter` drop cap that just floats next to body text without a tone-tinted background or generous indent reads as a styling bug.

Decision rubric for any editorial flourish:

- **Remove**: if the surface doesn't earn a magazine-style editorial moment, drop the flourish entirely. Most operational SaaS pages should remove. Pull quotes and drop caps were removed from `/product` precisely because they did not survive this rubric.
- **Commit fully**: 3rem+ serif font for pull quotes, 8-px tone-tinted left border, decorative `❝` glyph at 6rem behind the text, attribution byline below. Drop caps need a height of exactly 3 body lines, a tone-tinted background square, and a right margin so body text doesn't crash into the letter. Apply only at major narrative breakpoints, not as decoration sprinkled through the page.

There's no in-between. Half-committed flourishes are worse than no flourish at all.

### 11.28 Aspect ratios that force empty space

A mock component constrained to `aspect-[16/9]` with only 3 rows of content inside it produces ~80% empty dark canvas. Reads as obstructive and confusing — the reader's first reaction is "where's the content?"

Aspect ratios are valuable when:
- Embedding actual screenshots with known dimensions.
- Embedding video frames or iframes that need to maintain proportions.
- Maintaining horizontal alignment of a row of mock thumbnails.

Aspect ratios are anti-patterns when:
- Applied to CSS-rendered mocks with variable inner density.
- Forcing height on a small-content preview that would otherwise be tight.
- Used as a "make the mock look bigger" device.

Drop the aspect ratio; let height match content. If you want the mock to feel substantive, add more rows of mock UI — don't pad it with empty canvas.

### 11.29 Leading zeros on small numerical sequences

"01" through "07" prefixes for a 7-section sequence reads as decorative heaviness. Leading zeros communicate "this is a large indexed sequence" (chapter 01 of 99, slide 01 of 20). For small sequences (1-9), the leading zero is visual noise that doesn't earn the extra glyph.

Use plain "1" through "7" for product-tour sections. Apply the same rule to phase numbers (`Phase 1`, not `Phase 01`). The exception is when the number is part of a fixed-width tabular layout where leading-zero padding genuinely keeps columns aligned (rare in marketing copy).

### 11.30 Decorative elements at sub-threshold opacity

A 4-px floor-to-ceiling color column at 8% opacity along the page edge is invisible to most users and contributes clutter only to the source code. Either bump intensity to >12% so the decoration actually decorates, or remove the element entirely. Sub-threshold decoration is the worst of both worlds: it adds CSS complexity, fills the source with `pointer-events-none` decorative spans, and rewards no casual viewing.

Same logic for: aurora bars stacked on top of accent hairlines (one will do), atmospheric blobs at < md viewports (they're already invisible at mobile widths), bottom-left mirrored corner rings when there's already a top-right one (symmetric decoration without intent), and gradient overlays at < 6% opacity that exist only in the dev tools inspector.

If a decorative element can be removed without anyone noticing, it should be removed.

### 11.31 Centered-column pages without layout variation

A page that places every section, card, and mock inside a single `max-w-*` centered column at the same width reads as "clustered in the middle" on wide viewports — large empty margins on both sides + monotonous vertical scrolling. The fix isn't always to widen the column (that has its own readability costs); the fix is to vary the layout.

See §10.18 for the rhythm pattern. Pages that have only ever rendered as a single column at a single width should be audited for opportunities to break the rhythm: pair cards with their previews side-by-side, group related metrics into a horizontal strip, render some sections at 60/40 split with their explanation column, render full-bleed strips at strategic moments.

## 12. Canonical References

When in doubt, look at the canonical implementation:

| Pattern | File |
|---|---|
| Flat page identity | `src/app/(dashboard)/settings/page.tsx` |
| Hero card with rail + status + stat strip | `src/app/(dashboard)/settings/health/page.tsx` |
| Marketing legal article (luminous + premium card + icon-led sections) | `src/app/(marketing)/security/page.tsx` |
| Auth form with hero variant + custom inputs + accent halo CTA | `src/components/auth/auth-form.tsx` |
| Custom React combobox dropdown | `src/components/settings/invite-member-form.tsx` |
| Icon-led directory of destinations | `src/app/(dashboard)/more/page.tsx` |
| Empty-state premium card with corner ring | `src/app/(dashboard)/settings/policy/page.tsx` (PolicyGroups empty branch) |
| Grouped-list directory | `src/app/(dashboard)/settings/settings-page-sections.tsx` (SettingsDirectory) |
| Error / not-found boundary | `src/app/global-error.tsx`, `src/app/not-found.tsx` |
| Premium pricing card with live Stripe data | `src/app/(dashboard)/settings/billing/page.tsx` |
| Dashboard page composition (category eyebrows + right rail + sortable sections) | `src/components/dashboard/dashboard-lower.tsx`, `src/components/dashboard/dashboard-right-rail.tsx` |
| KPI card with sparkline + metric chip strip + action row | `src/components/ui/kpi-card-with-sparkline.tsx` |
| Page-lead ChipCapsule (count + action capsule) | `src/components/ui/chip-capsule.tsx` |
| ChipPair (weight gradation, no middle-dot) | `src/components/ui/chip-pair.tsx` |
| Time / Ratio / KeyValue / Count / Action chip primitives | `src/components/ui/time-chip.tsx`, `ratio-chip.tsx`, `key-value-chip.tsx`, `count-chip.tsx`, `action-chip.tsx` |
| Live portfolio metric strip with zero-state Check medallion | `src/components/v4/command-center-role-metrics.tsx` |
| Mini calendar with today ring + event-count chip | `src/components/ui/mini-calendar.tsx` |
| Right-rail Pulse panel (key/value rows with reserved tone-dot slot) | `src/components/dashboard/pulse-panel.tsx` |
| Right-rail Data quality (arc + tone-coded metric bars + 0%-pulse) | `src/components/dashboard/data-quality-score.tsx` |
| Activity feed (caps verb + detail + TimeChip) | `src/components/ui/activity-feed.tsx`, `src/components/dashboard/team-activity-feed.tsx` |
| Compact panel-level empty state | `src/components/dashboard/dashboard-empty-state.tsx` |
| Sortable + collapsible section wrappers | `src/components/dashboard/sortable-section.tsx`, `src/components/dashboard/collapsible-section.tsx` |
| Sticky mini-toolbar (slides in on scroll) | `src/components/dashboard/sticky-mini-toolbar.tsx` |
| Cursor-following accent glow + dashboard keyboard shortcuts | `src/components/dashboard/cursor-glow.tsx`, `src/components/dashboard/dashboard-keyboard-shortcuts.tsx` |
| Caps vocabulary + relative-time formatter | `src/lib/ui-copy.ts` |
| Marketing tour page with phase-grouped sections + paired previews + alternating layout | `src/app/(marketing)/product/page.tsx` |
| Cross-page chrome parity (shared hero / CTA / eyebrow / card recipe across marketing surfaces) | `/product` + `/pricing` + `/security` + `/contact` (all under `src/app/(marketing)/`) |
| Scroll-spy anchor nav with segmented progress + keyboard ← / → + ARIA live region | `src/components/landing/product-anchor-nav.tsx` |
| Inline product preview mocks (no aspect-ratio padding, content-driven height, faux chrome bar) | `src/components/landing/product-mocks.tsx` |

## 13. Testing

Tests pin specific design-contract substrings (page titles, key copy, structural assertions). When evolving the design, update tests to reflect the new contract — don't preserve a literal that no longer matches the intent. Test files near the relevant code:

- `src/app/(dashboard)/settings/settings-page-refinement.test.ts`
- `src/app/(dashboard)/settings/health/settings-health-visible-impact.v9.test.ts`
- `src/components/auth/auth-form.ui.test.tsx`
- `src/components/landing/marketing-site-chrome.ui.test.tsx`
- `src/lib/qa/ui-quality-sweep.test.ts`

The `ui-quality-sweep` test enforces structural anti-patterns globally (e.g., the `w-fit` / `h-fit` ban). Treat its assertions as hard constraints.

## 14. When You Add A New Surface

Before merging, verify:

1. The page has exactly **one** focal surface (hero card or premium content area).
2. The page identity uses the **flat inline** pattern unless the page is a landing-grade entry (auth, marketing legal, error, dashboard home empty).
3. **No workspace mode** is displayed in the chrome, header chips, or page metadata.
4. **Mono font** is used for emails, timestamps, IDs, env-var keys; sans for everything else.
5. **No native `<select>`** is used for any dropdown with custom options.
6. All `color-mix(...)` blends use **token anchors**, never literal `white`/`black`.
7. Status colors are used **only for status signals**, not decoration.
8. Hover/focus states exist on every interactive element and meet WCAG AA contrast in both modes.
9. The surface renders correctly in both **light and dark mode** — toggle OS preference and verify.
10. The page uses **existing utilities** wherever possible (`.ui-card`, `.ui-page-header`, `.ui-btn-primary`, `.landing-eyebrow-dot`, `.landing-card-premium`); only invent new classes when an existing one doesn't cover the case.
11. **No prose paragraphs longer than 80 characters** between structured elements. Replace with `<KeyValueChip>` / `<ChipPair>` / `<DashboardEmptyState>` (§10.7).
12. **No bare `·` middle-dots** between caps tokens. Either drop the dot + use weight gradation (`<ChipPair>`), split into adjacent chips (`<ChipCapsule>`), or wrap the dot in `.ui-dot-sep` for chapter-break separators (§2.9).
13. **No `opacity-*` on zero metric cards**. Use the §2.11 tone-tinted zero-state pattern (Check medallion + muted-success number + tinted unit chip) instead.
14. **No prose hints** under counts in KPI cards (`hint` prop removed from `KpiCardWithSparkline`). Use `metrics: KpiCardMetric[]` instead (§7.6.1).
15. **No static chevrons** at the right edge of list rows. Use the §8.6 hover-revealed structured `OPEN →` chip.
16. **Tabular-nums** on every count, ratio, percentage, duration (§10.11).
17. **Em-dash (`—`)** for "no value" markers — never hyphen or en-dash (§10.12).
18. **Always-reserved slots** for conditional row prefixes (tone dots, icons, status indicators) so column edges stay stable (§10.9).
19. **Caps tier utility classes** (`.ui-caps-1/2/3`) instead of inline `tracking-[Xem]` + `font-weight` combinations (§2.8).
20. **One chip primitive per use case** — use `<ChipCapsule>` / `<ChipPair>` / `<KeyValueChip>` / `<TimeChip>` / `<RatioChip>` / `<ActionChip>` / `<CountChip>` instead of inline span constructions.
21. **No repeated landing-page positioning** in inner-page hero h1s. Each page declares its own job — the product tour declares the tour, pricing declares pricing, security declares trust. The landing pitch belongs only on the landing page (§10.15).
22. **Chrome parity with sibling pages** — marketing surfaces share hero h1 scale, CTA cluster pattern, eyebrow style, and `landing-card-premium` recipe. Dashboard surfaces share `.ui-app-shell`. Diverge only additively, with an inline comment justifying the divergence (§10.16).
23. **Subtraction audit before any addition**. Before adding decorative elements (pull quotes, aurora bars, ornament glyphs, decorative SVGs), audit existing decoration on the page and remove anything below the visibility / signal threshold. New decoration must clear the same bar (§10.14).
24. **No standalone numeral + icon vertical stack** within a card. Inline the section number into the eyebrow as a tabular-nums prefix; let the medallion own the visual identity on the left (§11.26).
25. **No half-styled editorial decoration**. Pull quotes, drop caps, and ornaments either commit fully (3rem+ serif, decorative framing, attribution byline) or get removed entirely. No in-between (§11.27).
26. **No `aspect-[16/9]` constraints on small-content mocks**. Let height match content. Aspect ratios are for real screenshots and video frames, not CSS-rendered preview cards (§11.28).
27. **No leading zeros on small numerical sequences** (1-9). "1" not "01," "Phase 2" not "Phase 02." Leading zeros are decorative noise on small sequences (§11.29).
28. **No sub-threshold decorative elements**. If a 4-px tone column at 8% opacity is invisible to casual viewing, either bump intensity above 12% or remove the element. Sub-threshold decoration is source-code clutter with no visual return (§11.30).
29. **Paired content shares width**. A section card and its preview mock that stack vertically must share width — or render side-by-side as a 2-column grid at lg+ (§10.17).
30. **Vary the layout to break centered-column monotony**. A page that's N cards stacked in a single column at the same width reads as tedious regardless of card quality. Alternate full-width / split / strip / full-width rhythms (§10.18).
