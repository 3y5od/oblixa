Those two tokens (`--shell-drawer-w`, `--shell-mobile-trigger`) are referenced only in the components but never defined in CSS — they resolve to their fallback (empty/invalid), meaning the width/size effectively comes from elsewhere or is a latent token. Worth flagging. I now have everything needed. Here is the digest.

---

# Sidebar Subcomponent Visual Digest

All paths absolute under `C:/Users/dizho/oblixa/src/components/layout/sidebar/`. Many components defer visual treatment to `@layer`-defined utility classes in `C:/Users/dizho/oblixa/src/app/globals.css`; those definitions and all referenced design tokens are inlined at the end (§ Tokens & Utility Classes) since they are load-bearing for the redesign.

**Icon system (global):** [lucide-react](https://lucide.dev). Nav glyphs render at `size={16} strokeWidth={1.75}`. Footer/account/brand-close use `size={18}` (footer toggles `strokeWidth={1.85}`, role icon `size={14} strokeWidth={1.85}`). Chevron disclosure `h-3.5 w-3.5 strokeWidth={2}`. All icons `aria-hidden`.

---

## 1. `sidebar-brand.tsx` — brand lockup

**Imports:** `Link` (next), `X` (lucide). **Props:** `mobile`, `collapsed`, `onCloseMobile`, `closeButtonRef`.

**Shared brand tile constant** (`BRAND_TILE_CLASS`) — neutral tile, accent reserved for nav:
```
inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[15px] font-bold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]
```

**Branch A — collapsed desktop** (`collapsed && !mobile`): outer container
```
flex h-16 shrink-0 items-center justify-center border-b border-[var(--sidebar-section-border)] px-2
```
Single `Link href="/dashboard"` = `BRAND_TILE_CLASS` + appended:
```
transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]
```
Content: `<span aria-hidden>O</span>`. **aria-label:** `"Oblixa — go to dashboard"`.

**Branch B — expanded / mobile:** outer container
```
flex h-16 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-3
```
`Link href="/dashboard"`:
```
group flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]
```
Inside: tile `<span className={BRAND_TILE_CLASS} aria-hidden>O</span>` then a stacked wordmark lockup `<span className="flex min-w-0 flex-col leading-none">`:
- Wordmark **"Oblixa"**: `truncate text-[15px] font-bold leading-none tracking-tight text-[var(--sidebar-fg)]`
- Category line **"Contract follow-up"**: `mt-1 truncate text-[10.5px] font-medium leading-none tracking-[0.02em] text-[var(--sidebar-muted)]`

**Mobile-only close button** (rendered when `mobile`), uses `closeButtonRef`:
```
ui-icon-button border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_3%,transparent)] p-2 text-[var(--sidebar-muted)] hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]
```
Glyph `<X size={18} aria-hidden />`. **aria-label:** `"Close navigation"`.

**Copy:** "Oblixa", "Contract follow-up", "O". **Tokens:** `--sidebar-fg`, `--sidebar-section-border`, `--sidebar-brand-shadow`, `--accent`, `--sidebar-focus`, `--sidebar-hover`, `--sidebar-muted`.

---

## 2. `sidebar-nav-item.tsx` — nav rows (the core row treatment)

**"use client".** Imports `Link`, `ChevronDown`, `iconByKey`, `SidebarBadge`, `CollapsedTooltip`. **Props:** `item: SidebarItemModel`, `collapsed`, `child=false`, `onNavigate`, `tooltipHref`, `setTooltipHref`.

**State logic (drives which class applies):**
- `Icon = item.icon ? iconByKey[item.icon] : null`
- `tooltipId = \`sidebar-tooltip-${item.href.replace(/[^a-z0-9]+/gi, "-")}\``
- `tooltipVisible = collapsed && tooltipHref === item.href`
- `isParentExpanded = !child && !collapsed && item.children.length > 0` — section header showing subnav; brighter text + chevron, **no accent**.
- `selected = !child && item.active && !isParentExpanded` — the accent leaf.
- Tooltip timing: hover delay **350ms** (`setTimeout`), immediate on focus; cleared on blur/leave/unmount.

**`childClass` resolution (exact branches):**
- child → `` ui-sidebar-sublink-indent text-[12.5px] `` + (`item.active ? "ui-sidebar-sublink-active" : "ui-sidebar-sublink-idle"`)
- collapsed top-level → `item.active ? "ui-sidebar-link-active-rail" : "ui-sidebar-link-idle"`
- `isParentExpanded` → `"ui-sidebar-link-parent"`
- active leaf → `"ui-sidebar-link-active"`
- else → `"ui-sidebar-link-idle"`

**Root `<Link>` className:**
```
ui-sidebar-link {collapsed && !child ? "mx-auto h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] justify-center px-0" : ""} {childClass}
```
Attributes: `prefetch={item.prefetch}`, `onClick={onNavigate}`, focus/blur/mouseenter/mouseleave wired only when `collapsed`. `aria-current={item.exactActive ? "page" : undefined}`, `aria-label={collapsed ? item.collapsedLabel : undefined}`, `aria-describedby={tooltipVisible ? tooltipId : undefined}`, `data-sidebar-href={item.href}`.

**Icon render** (`<Icon size={16} strokeWidth={1.75} className="shrink-0" />`) with inline `style.color`:
```
color: selected ? "var(--accent-strong)"
      : isParentExpanded ? undefined            // inherits currentColor (sidebar-fg)
      : "var(--sidebar-icon-idle)"
```

**No-icon top-level marker** (empty-ring vs filled dot — `1.5×1.5` dot):
```
h-1.5 w-1.5 shrink-0 rounded-full {item.active
  ? "bg-[var(--sidebar-fg)]"
  : "border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent"}
```
(child without icon renders nothing.)

**Label** (expanded only): `<span className="ui-nowrap-safe min-w-0 flex-1">{item.name}</span>`.

**Trailing element (expanded):**
- if `isParentExpanded`: `<ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]" strokeWidth={2} aria-hidden />`
- else: `<SidebarBadge badge={item.badge} collapsed={false} />`

**Collapsed:** badge rendered inline right after icon (`<SidebarBadge badge={item.badge} collapsed />`); tooltip `<CollapsedTooltip id={tooltipId} label={item.collapsedLabel} anchorRef={linkRef} />` when `tooltipVisible`.

**Tokens:** `--accent-strong`, `--sidebar-icon-idle`, `--sidebar-fg`, `--sidebar-muted`, `--shell-collapsed-slot`. **Copy:** `item.name`, `item.collapsedLabel` (data-driven).

---

## 3. `sidebar-badge.tsx` — count chips (tone / amber / collapsed-dot)

**Imports:** `CSSProperties`, `SidebarBadgeModel`. **Props:** `badge?`, `collapsed`. Returns `null` if no badge.

**Tone → inline style** (`navCountToneStyle`) — token-driven, all via `color-mix`:
- `tone === "obligations"`: color `var(--sidebar-danger-ink)`, background `color-mix(in oklab, var(--sidebar-danger-ink) 13%, transparent)`, borderColor `color-mix(in oklab, var(--sidebar-danger-ink) 40%, transparent)`.
- `tone === "reviewQueue" || "approvals"` (**amber**): color `var(--sidebar-warn-ink)`, background `color-mix(in oklab, var(--sidebar-warn-ink) 13%, transparent)`, borderColor `color-mix(in oklab, var(--sidebar-warn-ink) 40%, transparent)`.
- else (neutral): color `color-mix(in oklab, var(--sidebar-fg) 80%, transparent)`, background `color-mix(in oklab, var(--sidebar-fg) 9%, transparent)`, borderColor `color-mix(in oklab, var(--sidebar-fg) 20%, transparent)`.

**Object-type noun** (`navCountNoun`): reviewQueue→"review", approvals→"approval", obligations→"requirement", else→"alert"; pluralized with `s` when `value !== 1`. Yields "1 review", "3 approvals", etc.

**Collapsed branch** — compact dot nudged into the rail gutter; `single = badge.displayValue.length === 1`:
```
absolute -right-1 -top-1 inline-flex h-[1.05rem] items-center justify-center rounded-full border text-[9px] font-semibold leading-none tabular-nums ring-2 ring-[var(--sidebar)] {single ? "w-[1.05rem]" : "min-w-[1.05rem] px-1"}
```
`aria-hidden="true"`, `title={badge.label}`, `style={toneStyle}`. Content `{badge.displayValue}`.

**Expanded branch** — labeled chip:
```
ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold leading-none
```
`style={toneStyle}`, `aria-label={badge.label}`, `title={badge.label}`. Inner: `<span className="tabular-nums">{badge.displayValue}</span>` + `<span className="font-medium tracking-tight">{navCountNoun(...)}</span>`.

**Tokens:** `--sidebar-danger-ink`, `--sidebar-warn-ink`, `--sidebar-fg`, `--sidebar` (the collapsed ring uses the rail base color). **Copy:** `badge.label`, `badge.displayValue`, computed noun.

---

## 4. `sidebar-section.tsx` — section + heading + grouping

**Props:** `section`, `collapsed`, `onNavigate`, `tooltipHref`, `setTooltipHref`, `first`. Returns `null` if `section.items.length === 0`. `hideHeadingVisually = collapsed || first`.

**`<section>` className (variant/first logic):**
- `section.variant === "rail"` → `"mt-2"`
- else if `first` → `"mt-0 pt-0"`
- else → `"mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5"`

**`<h2 id={`${section.id}-heading`}>`:** className `hideHeadingVisually ? "sr-only" : "ui-caps-1 px-3 text-[10px]"`; inline `style` when visible `{ color: "var(--sidebar-heading)" }`. Text `{section.label}`.

**`<nav aria-labelledby={`${section.id}-heading`}>`:** className `collapsed ? "space-y-1.5" : hideHeadingVisually ? "space-y-1.5" : "mt-2 space-y-1.5"`.

**Per-item wrapper** (`<div>` keyed by href) — subtle grouping: `space-y-0.5` + (`!collapsed && first && (i === 1 || i === section.items.length - 1) ? "mt-2" : ""`) — adds breathing room after Dashboard and before the final item (Settings). Renders `SidebarNavItem`, then (when `!collapsed`) maps `item.children` to child `SidebarNavItem`s (`child`, `collapsed={false}`).

**Tokens:** `--sidebar-section-border`, `--sidebar-heading`. **Copy:** `section.label`.

---

## 5. `sidebar-footer.tsx` — collapse control + role display (desktop only)

**Imports:** `Building2`, `PanelLeftClose`, `PanelLeftOpen` (lucide); `shellTestIds`; `DESKTOP_SIDEBAR_BODY_ID`. **Props:** `collapsed`, `isOnboarding`, `role?`, `onToggleCollapsed`.

**Role mapping** (`ROLE_LABEL`): owner→"Owner", admin→"Admin", member→"Member", viewer→"Viewer", operator→"Operator". `roleLabel` is `null` if role missing/unknown. Toggle is suppressed entirely during `isOnboarding`.

**Collapsed branch:** container
```
flex h-12 shrink-0 items-center justify-center border-t border-[var(--sidebar-section-border)] px-2
```
Toggle button (when not onboarding):
```
inline-flex h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]
```
`data-testid={shellTestIds.sidebarCollapseToggle}`, `aria-controls={DESKTOP_SIDEBAR_BODY_ID}` (`"desktop-sidebar-body"`), `aria-expanded={false}`, **aria-label** `"Expand sidebar"`, **title** `"Expand sidebar (⌘\)"`. Glyph `<PanelLeftOpen size={18} strokeWidth={1.85} />`.

**Expanded branch:** container
```
flex h-12 shrink-0 items-center justify-between gap-2 border-t border-[var(--sidebar-section-border)] px-3
```
**Role pill** (when `roleLabel`): `<span>`
```
inline-flex min-w-0 items-center gap-1.5 text-[var(--sidebar-muted)]
```
`aria-label`/`title` = `` `Your role in this workspace: ${roleLabel}` ``. Icon `<Building2 size={14} strokeWidth={1.85} className="shrink-0" />`; label `<span className="truncate text-[11.5px] font-medium leading-none" aria-hidden>{roleLabel}</span>`. When no role: `<span aria-hidden />` placeholder (keeps justify-between balanced).

**Toggle button** (expanded, when not onboarding):
```
inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]
```
`aria-expanded={true}`, **aria-label** `"Collapse sidebar"`, **title** `"Collapse sidebar (⌘\)"`. Glyph `<PanelLeftClose size={18} strokeWidth={1.85} />`.

**Copy:** "Owner/Admin/Member/Viewer/Operator", "Expand sidebar", "Collapse sidebar", "Expand sidebar (⌘\)", "Collapse sidebar (⌘\)", "Your role in this workspace: {role}". **Tokens:** `--sidebar-section-border`, `--shell-collapsed-slot`, `--sidebar-muted`, `--sidebar-hover`, `--sidebar-fg`, `--sidebar-focus`.

---

## 6. `collapsed-tooltip.tsx` — floating rail label

**"use client".** Portaled to `document.body`, `position: fixed` (escapes rail overflow + topbar). Computes position in `useLayoutEffect` from `anchorRef.getBoundingClientRect()`: `left = r.right + 8`, `top` clamped to `Math.min(Math.max(8, r.top + r.height/2), window.innerHeight - 8)`. Renders `null` until positioned.

**`<span>`** inline style: `{ position:"fixed", top, left, transform:"translateY(-50%)", maxWidth:"var(--shell-tooltip-w)" }`. className:
```
pointer-events-none z-[70] truncate whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)]
```
`id={id}`, `aria-hidden="true"` (decorative — link's `aria-label` carries the name). Content `{label}`.

**Note:** uses **content-surface** tokens, not sidebar tokens, so it reads as an overlay above the dark/porcelain rail. **Tokens:** `--shell-tooltip-w`, `--border-subtle`, `--surface-raised`, `--text-primary`, `--shadow-2`.

---

## 7. `sidebar-account.tsx` — mobile account (sign-out)

**Imports:** `LogOut` (lucide), `signOut` action, `shellTestIds`. Mobile-only; desktop sign-out lives in the topbar menu (single source).

**Container:**
```
border-t border-[var(--sidebar-section-border)] px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
```
**Heading "Account":** `<p className="ui-caps-1 px-3 pb-1.5 text-[10px]" style={{ color: "var(--sidebar-heading)" }}>`.

**`<form action={signOut}>` → submit button:**
```
group flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-[13px] font-medium text-[var(--sidebar-muted)] transition-[background-color,color] duration-[var(--ui-duration)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_18%,transparent)] hover:text-[color:color-mix(in_oklab,var(--danger-ink)_82%,var(--sidebar-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]
```
`data-testid={shellTestIds.sidebarSignOut}`. Content: `<LogOut size={18} strokeWidth={1.85} className="shrink-0" />` + `<span>Sign out</span>`.

**Copy:** "Account", "Sign out". **Tokens:** `--sidebar-section-border`, `--sidebar-heading`, `--radius-lg`, `--sidebar-muted`, `--ui-duration`, `--danger-ink`, `--sidebar-fg`, `--sidebar-focus`. (Hover uses the page-content `--danger-ink` oxblood, not the badge's `--sidebar-danger-ink`.)

---

## 8. `mobile-drawer.tsx` — mobile trigger + drawer chrome

**Imports:** `Menu` (lucide), `shellTestIds`. Two exported components.

**`MobileNavigationTrigger`** (fixed FAB, `lg:hidden`):
```
fixed left-4 top-[max(0.625rem,env(safe-area-inset-top))] z-40 inline-flex h-[var(--shell-mobile-trigger)] w-[var(--shell-mobile-trigger)] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)] transition-colors duration-[var(--ui-duration)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden
```
`data-testid={shellTestIds.sidebarMobileOpen}`, **aria-label** `"Open navigation"`. Glyph `<Menu size={18} />`. Uses **content-surface** tokens (raised surface, not sidebar).

**`MobileDrawer`** root `<div>` (`role="dialog"`, `aria-modal="true"`, **aria-label** `"Navigation drawer"`, `data-testid={shellTestIds.sidebarMobileDrawer}`):
```
fixed inset-0 z-50 flex lg:hidden
```
**Panel `<aside>`:**
```
ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[var(--shell-drawer-w)] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]
```
Renders `{children}`.
**Scrim button** (closes drawer):
```
ui-overlay-scrim h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
```
`onClick={onClose}`, **aria-label** `"Close navigation overlay"`.

**Copy:** "Open navigation", "Navigation drawer", "Close navigation overlay". **Tokens:** `--shell-mobile-trigger`, `--border-subtle`, `--surface-raised`, `--text-secondary`, `--shadow-1`, `--ui-duration`, `--accent`, `--border-strong`, `--text-primary`, `--focus-ring`, `--shell-drawer-w`, `--sidebar-border`.

---

## 9. `constants.ts`

```ts
export const DESKTOP_SIDEBAR_BODY_ID = "desktop-sidebar-body";
export const COLLAPSED_PREF_EVENT = "oblixa:sidebar-collapsed-change";
```
No styling. `DESKTOP_SIDEBAR_BODY_ID` is the `aria-controls` target of the footer collapse toggle; `COLLAPSED_PREF_EVENT` is the broadcast event name for collapse-state sync.

---

## 10. `sidebar-icons.ts` — icon registry

Maps `SidebarItemModel["icon"]` keys → lucide components (`iconByKey`). Exhaustive record (includes cmd-K-only destinations that never render in the rail):

`dashboard→LayoutDashboard, review→SearchCheck, contracts→FileText, tasks→ListChecks, renewals→CalendarClock, exceptions→BellRing, evidence→FileCheck2, reports→BarChart3, decisions→BadgeCheck, campaigns→Megaphone, assurance→Shield, relationships→GitBranch, programs→Boxes, settings→Settings, billing→CreditCard, more→Grid2x2, profile→UserRound, "workspace-identity"→Building2, team→Users, imports→Upload, "security-account"→ShieldCheck, notifications→Bell, export→Download, "review-fields"→ClipboardCheck`.

Size/stroke are set by the consumer (NavItem: 16 / 1.75), not here.

---

# Tokens & Utility Class Definitions (from `globals.css`)

### Sidebar / shell / accent tokens — light (`:root`) → dark (`@media prefers-color-scheme: dark`)

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#2257d6` | `oklch(0.72 0.19 264)` |
| `--accent-strong` | `#0b49c8` (cobalt; selection/actions only) | `oklch(0.8 0.17 266)` |
| `--sidebar` | `#edefe9` | `oklch(0.12 0.02 258)` |
| `--sidebar-surface` | `#f4f6f0` | `oklch(0.17 0.022 258)` |
| `--sidebar-raised` | `#ffffff` | `oklch(0.225 0.022 258)` |
| `--sidebar-border` | `#d8dcd2` | `oklch(0.27 0.02 258)` |
| `--sidebar-fg` | `#18201d` | `oklch(0.96 0.006 252)` |
| `--sidebar-muted` | `#5f6f68` | `oklch(0.71 0.018 254)` |
| `--sidebar-heading` | `color-mix(in oklab, var(--sidebar-fg) 50%, transparent)` | `…52%…` |
| `--sidebar-section-border` | `color-mix(in oklab, var(--sidebar-fg) 13%, transparent)` | `…11%…` |
| `--sidebar-hover` | `color-mix(in oklab, var(--sidebar-fg) 6%, transparent)` | `…10%…` |
| `--sidebar-focus` | `color-mix(in oklab, var(--sidebar-fg) 66%, var(--accent))` | `…70%…` |
| `--sidebar-icon-idle` | `color-mix(in oklab, var(--sidebar-muted) 92%, transparent)` | (same) |
| `--sidebar-warn-ink` (amber) | `#8a5a00` | `oklch(0.86 0.12 84)` |
| `--sidebar-danger-ink` (oxblood) | `#8b2f2f` | `oklch(0.79 0.14 22)` |
| `--sidebar-brand-shadow` | `0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent)` | (same) |
| `--shell-collapsed-slot` | `2.75rem` | (same) |
| `--shell-tooltip-w` | `17rem` | (same) |

**Content-surface tokens used by tooltip / mobile trigger / mobile account:** `--surface-raised` `#ffffff` (dark `oklch(0.245 …)`); `--surface-contrast` `#edf0ef`; `--surface-muted` `#eef1f1`; `--text-primary` `#11140f`; `--text-secondary` `#374151`; `--text-tertiary` `#6b7280`; `--border-subtle` `#d3dade`; `--border-strong` `#aeb8c2`; `--danger-ink` `#8c1d2c` (oxblood); `--focus-ring` `color-mix(in oklab, var(--accent) 62%, var(--surface))`; `--shadow-1` `0 1px 2px rgba(15,23,42,.05), 0 10px 30px rgba(15,23,42,.04)`; `--shadow-2` `0 16px 40px rgba(15,23,42,.1), 0 2px 4px rgba(15,23,42,.04)`; `--radius-md` `0.25rem`; `--radius-lg` `0.375rem`; `--ui-duration` `150ms`; `--ui-duration-slow` `240ms`; `--ui-ease-out` `cubic-bezier(0.2, 0.8, 0.2, 1)`.

### `.ui-sidebar-link` (base nav row)
```css
.ui-sidebar-link { /* @apply */ position: relative; display:flex; min-height:2.5rem; min-width:0;
  align-items:center; gap:0.75rem; padding:0.5rem 0.75rem; font-size:13px; font-weight:500;
  border-radius: var(--radius-md); color: var(--sidebar-muted);
  transition-property: background-color,color,border-color,box-shadow;
  transition-duration: var(--ui-duration-slow); transition-timing-function: var(--ui-ease-out); }
@media (min-width:1024px){ .ui-sidebar-link{ min-height:2.5rem; padding-top:0.4375rem; padding-bottom:0.4375rem; } }
```

### `.ui-sidebar-link:focus-visible` (focus ring — double-ring, accent)
```css
outline:none;
box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 50%, var(--surface-raised)),
            0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
transition: box-shadow 100ms ease-out;
```

### State variants
```css
.ui-sidebar-link-idle  { color: var(--sidebar-muted); }
.ui-sidebar-link-idle:hover { color: var(--sidebar-fg);
  background: color-mix(in oklab, var(--sidebar-hover) 70%, transparent); }

.ui-sidebar-link-parent { color: var(--sidebar-fg); } /* parent-expanded header, no accent */

/* Selected leaf: near-white "record" lifted from porcelain, left accent wash + accent rail */
.ui-sidebar-link-active { position:relative; color: var(--sidebar-fg);
  background-color: var(--sidebar-raised);
  background-image: linear-gradient(90deg,
    color-mix(in oklab, var(--accent) 9%, transparent) 0%,
    color-mix(in oklab, var(--accent) 3%, transparent) 56%, transparent 88%);
  box-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 9%, transparent); }
.ui-sidebar-link-active::before { content:""; position:absolute; left:0; top:22%; bottom:22%;
  width:2px; border-radius:0 3px 3px 0; background: var(--accent-strong);
  box-shadow: 0 0 8px -1px color-mix(in oklab, var(--accent) 50%, transparent); pointer-events:none; }

/* Collapsed-rail selected: flat centered wash + short centered rail bar */
.ui-sidebar-link-active-rail { position:relative;
  background: color-mix(in oklab, var(--sidebar-raised) 86%, var(--accent));
  box-shadow: 0 1px 2px color-mix(in oklab, var(--sidebar-fg) 8%, transparent); }
.ui-sidebar-link-active-rail::before { content:""; position:absolute; left:0.375rem; top:50%;
  height:1rem; width:2px; transform:translateY(-50%); border-radius:9999px; background: var(--accent-strong); }

/* Sublinks */
.ui-sidebar-sublink-active { color: var(--sidebar-fg);
  background: color-mix(in oklab, var(--accent) 10%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in oklab, var(--accent-strong) 60%, transparent); }
.ui-sidebar-sublink-idle { color: var(--sidebar-muted); }
.ui-sidebar-sublink-idle:hover { color: var(--sidebar-fg);
  background: color-mix(in oklab, var(--sidebar-hover) 70%, transparent); }
.ui-sidebar-sublink-indent { padding-left: calc(0.75rem + 16px + 0.75rem); } /* aligns child label under parent label */
```
**`prefers-reduced-transparency`** override: `.ui-sidebar-link-active { background-image:none; background-color: color-mix(in oklab, var(--accent) 26%, var(--sidebar-surface)); }`.

### Other utilities
```css
.ui-sidebar-surface { color: var(--sidebar-fg); background-color: var(--sidebar);
  background-image: linear-gradient(180deg,
    color-mix(in oklab, var(--sidebar-surface) 92%, var(--sidebar)) 0%, var(--sidebar) 100%); }

.ui-icon-button { display:inline-flex; min-height:2.5rem; min-width:2.5rem; align-items:center;
  justify-content:center; border:1px solid; padding:0.5rem 0.625rem; font-size:0.875rem;
  border-radius:3px; color: var(--text-secondary);
  border-color: color-mix(in oklab, var(--border-subtle) 88%, transparent); background: var(--surface-raised);
  transition: color/border-color/background-color/box-shadow/transform var(--ui-duration) var(--ui-ease-out); }
.ui-icon-button:hover { color: var(--text-primary);
  border-color: color-mix(in oklab, var(--border-strong) 84%, transparent); box-shadow: var(--shadow-1); }

.ui-caps-1 { font-weight:700; letter-spacing:0.18em; text-transform:uppercase; }
.ui-nowrap-safe { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.ui-overlay-scrim { background: color-mix(in oklab, #18181b 64%, transparent);
  backdrop-filter: blur(12px); animation: ui-overlay-scrim-enter 150ms ease-out; }
@media (prefers-reduced-motion: reduce){ .ui-overlay-scrim{ animation:none; } }
/* later override */ .ui-overlay-scrim { backdrop-filter:none; } /* reduced-transparency */
```

---

# Cross-cutting notes for the redesign

- **Accent discipline:** accent (`--accent` / `--accent-strong`) is reserved for the *selected leaf* only — the brand tile, parent-expanded headers, and idle rows are all neutral (`--sidebar-fg` / `--sidebar-muted`). The selected row is treated as a near-white "record" lifted off the porcelain margin via `--sidebar-raised` + a 90° accent wash + a 2px left accent rail with glow.
- **Two tooltip/overlay surfaces deliberately break from sidebar tokens** (`collapsed-tooltip`, mobile trigger, mobile account hover) — they use content-surface tokens so they read as overlays/content, not rail.
- **Badge tones:** neutral = `--sidebar-fg` mixes; amber/"needs attention" (reviewQueue + approvals) = `--sidebar-warn-ink`; escalated/obligations = `--sidebar-danger-ink`. Collapsed badge is a `1.05rem` pill nudged `-right-1 -top-1` with a `ring-2 ring-[var(--sidebar)]` to punch it off the rail; expanded badge always carries an object-type noun ("1 review").
- **⚠️ Undefined tokens:** `--shell-drawer-w` (mobile drawer panel width) and `--shell-mobile-trigger` (FAB size) are referenced in `mobile-drawer.tsx` but are **not defined anywhere in `globals.css`** (only `--shell-collapsed-slot` and `--shell-tooltip-w` exist). They currently resolve to invalid/empty, so the drawer width and trigger box-size fall back to intrinsic/auto sizing. If the redesign touches the mobile drawer, define these tokens (or replace with literals).
- **Test-id hooks** (do not break during restyle): `shellTestIds.sidebarCollapseToggle`, `.sidebarSignOut`, `.sidebarMobileOpen`, `.sidebarMobileDrawer`; plus `aria-controls="desktop-sidebar-body"` and `data-sidebar-href` on nav rows.