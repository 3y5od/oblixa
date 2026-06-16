I have all eight files digested. Here is the detailed visual digest.

---

# App-Shell Topbar / Breadcrumb / Search / Account / Footer — Visual Digest

## 1. `header.tsx` — Topbar shell + identity resolution

**File:** `C:/Users/dizho/oblixa/src/components/layout/header.tsx`

### Structural render
- Root `<header>` with `data-testid={shellTestIds.headerTopbar}`.
- One centered inner `<div>` that is a single flex row containing:
  1. `<TopbarBreadcrumb />` (left, breadcrumb nav — hidden below `lg`).
  2. A right-aligned cluster `<div>` holding: `<TopbarSearch />`, an optional **Tools** `<Link>`, and `<AccountMenu />`.

### Conditional branches
- **`showTools`** = `showUtilitiesLink && navSurface?.mode !== "core"`. The "Tools" link only renders when truthy. It is also `hidden ... md:inline-flex` so it never shows below the `md` breakpoint regardless.
- **`resolveAccountIdentity()`** computes:
  - `displayName` = real trimmed name, else literal `"Account"` (an email local-part is deliberately NOT treated as a name; names equal to `"name"` or `"—"` are rejected).
  - `initial` = first char of (realName ?? email ?? "") uppercased, else `"?"`.
  - `title` = realName ?? email ?? `"Account"` (used as hover tooltip).

### Exact className strings
- `<header>`:
  ```
  ui-topbar sticky top-0 z-30 shrink-0 px-4 md:px-6 xl:px-8
  ```
- Inner centered row:
  ```
  mx-auto flex h-[var(--shell-topbar-h)] w-full max-w-[var(--shell-content-max)] items-center gap-3 pl-12 md:gap-4 lg:pl-0
  ```
  → Height is the CSS var `--shell-topbar-h`; max width `--shell-content-max`. Note the `pl-12` (3rem left pad below `lg`, removed at `lg` via `lg:pl-0`) — this reserves space for the mobile sidebar/menu toggle that overlaps the topbar at small widths.
- Right cluster:
  ```
  flex min-w-0 flex-1 items-center justify-end gap-3
  ```
- **Tools link** (`<Link href="/more">`):
  ```
  ui-btn-ghost hidden h-10 shrink-0 items-center gap-1.5 px-3 py-0 text-[12.5px] font-semibold md:inline-flex
  ```
  - Wrench icon: `<Wrench className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />`

### Copy / aria
- Tools link text: **`Tools`**; `aria-label="Open tools"`.
- Account label fallback: **`Account`**.

### Tokens referenced
- `--shell-topbar-h` (topbar height), `--shell-content-max` (centered max width).
- Class hooks: `ui-topbar`, `ui-btn-ghost`.

---

## 2. `topbar/topbar-breadcrumb.tsx` — Route-aware breadcrumb trail

**File:** `C:/Users/dizho/oblixa/src/components/layout/topbar/topbar-breadcrumb.tsx`

### Structural render
- `<nav aria-label="Breadcrumb">` → optional leading **area medallion** `<span>` (icon tile) → `<ol>` of crumbs.
- Each crumb `<li>` renders, in order: a `ChevronRight` separator (only when `idx > 0`), then either a `<Link>` (if `crumb.href && !isLast`) or a `<span>` (the leaf / current page, or any crumb without href).

### Conditional branches
- **Whole nav is hidden below `lg`** (`hidden ... lg:flex`).
- **Area medallion** renders only if `AREA_ICON[crumbs[0].label]` resolves (Dashboard/Contracts/Tasks/Renewals/Evidence/Reports/Settings/Tools/Search). Otherwise no medallion.
- **Separator chevron** only between crumbs (`idx > 0`).
- **Link vs span**: parent crumbs with `href` and not last → link; the last crumb (and any href-less crumb) → span with `aria-current="page"` when last.
- `resolveBreadcrumb(pathname)` maps routes to crumb trails (see route table below). Trails are 1–3 crumbs deep. Fallback chain ends at `[{ label: "Workspace" }]`.

### Exact className strings
- Nav:
  ```
  hidden min-w-0 shrink items-center gap-2 lg:flex
  ```
- **Area medallion span** (icon tile):
  ```
  inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-strong)_40%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]
  ```
  - Icon inside: `<AreaIcon className="h-4 w-4" strokeWidth={1.85} />`
- Crumb list `<ol>`: `flex min-w-0 items-center gap-1.5`
- Crumb `<li>`: `flex min-w-0 items-center gap-1.5`
- **Separator** `ChevronRight`:
  ```
  h-3 w-3 shrink-0 text-[var(--text-tertiary)]
  ```
  with `strokeWidth={2}`, `aria-hidden`.
- **Link crumb** (parent, clickable):
  ```
  ui-nowrap-safe max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-[12.5px] font-medium leading-[1.1] text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
  ```
- **Leaf / current span**:
  ```
  max-w-[14rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]
  ```
  with `aria-current={isLast ? "page" : undefined}`.

### Visual treatment summary
- Leading area icon: 32×32 (`h-8 w-8`), `rounded-lg`, mixed-border (40% strong + subtle), raised surface fill, `--shadow-1`, secondary-text icon at 16px stroke 1.85.
- Separators: 12×12 chevrons in **tertiary** text color, stroke 2.
- Parent crumbs: **12.5px, font-medium, secondary text**, hover paints a contrast wash (`--surface-contrast` 55%) + promotes to primary text; focus ring uses `--focus-ring`.
- Leaf crumb: **12.5px, font-semibold, tracking-tight, primary text**, no link.
- Truncation: links cap at `max-w-[12rem]`, leaf at `max-w-[14rem]`, both `truncate`.

### Copy strings (all breadcrumb labels)
Static crumbs: `Contracts`, `Tasks`, `Reports`, `Settings`. Resolved leaf labels by route:
- `Dashboard`
- `Contracts` → `New contract` / `Import contracts` / `Review queue` / `Contract`
- `Renewals`
- `Evidence`
- `Tasks` → `Issues` / `Tasks` / `Requirements` / `Approvals`
- `Reports` → `Report history`
- `Settings` → leaf from `SETTINGS_LEAF`: `Security`, `Billing`, `Operations`, `Product`, `System health`, `Policy`; and `System health` → `Diagnostics` (3-deep)
- `Tools`, `Search`, `Set up workspace`, `Workspace` (fallback).
- `nav aria-label="Breadcrumb"`; leaf gets `aria-current="page"`.

### Tokens referenced
- `--border-strong`, `--border-subtle`, `--surface-raised`, `--surface-contrast`, `--shadow-1`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--focus-ring`.

---

## 3. `topbar/topbar-search.tsx` — Chrome (committed) search wrapper

**File:** `C:/Users/dizho/oblixa/src/components/layout/topbar/topbar-search.tsx`

### Structural render
- A single wrapper `<div ref={wrapRef}>` containing one `<SearchField variant="chrome" />`.

### Conditional branches (width-driven via ResizeObserver)
- `TIGHT_SEARCH_WIDTH = 360`. When the field's measured width `> 0 && < 360`, `tight = true`:
  - Placeholder collapses from **`Search contracts, tasks, reports`** → **`Search`**.
  - `kbdHint` (the `⌘ K` badge) is dropped (`undefined`) so it never clips.
- This is **width-driven, not viewport-driven** — it reacts to the room left after breadcrumb + account cluster claim theirs.

### Exact className string
- Wrapper:
  ```
  min-w-0 flex-1 sm:max-w-[22rem] md:max-w-[26rem]
  ```
  → Grows to fill, capped at 22rem (`sm`) / 26rem (`md`+).

### SearchField props passed
- `variant="chrome"`, `name="q"`, `testId={shellTestIds.headerSearch}`.
- `ariaLabel="Search workspace"`.
- `placeholder={tight ? "Search" : "Search contracts, tasks, reports"}`.
- `kbdHint={tight ? undefined : { meta: "⌘", key: "K" }}`.
- `ariaKeyShortcuts="Meta+K Control+K"`.
- `onClear={() => undefined}` (enables clear-X + Esc affordance).
- `onSubmit`: trims, slices to 200 chars, then `router.push("/search?q=…")` (or bare `/search` when empty).

### Copy / aria
- Placeholders: **`Search contracts, tasks, reports`** / **`Search`**.
- `aria-label="Search workspace"`, `aria-keyshortcuts="Meta+K Control+K"`.
- Keyboard hint chip glyphs: **`⌘`** + **`K`**.

### Behavioral note for redesign
- Clicking the chrome input **focuses it** — it does NOT open the cmd-K overlay. `⌘K` opens the palette via a global binding elsewhere (`command-palette-loader.tsx`). Enter navigates to the `/search` page.

---

## 4. `account-menu.tsx` — Account trigger + dropdown panel

**File:** `C:/Users/dizho/oblixa/src/components/layout/account-menu.tsx`

### Structural render
- Wrapped in shared `<DropdownMenu>` (owns portal, positioning, roving keyboard, dismissal).
  - `ariaLabel="Account"`, `align="end"`, `zIndexClassName="z-[60]"`, `widthClassName="w-[var(--shell-account-menu-w)]"`.
- **Trigger** (render-prop `<button>`): avatar tile + name span + chevron.
- **Panel contents** (children of DropdownMenu), in order:
  1. **Identity header** row: large avatar tile + name + email + role badge.
  2. Divider span.
  3. Eyebrow label `Account`.
  4. Menu items: `Workspace settings`, `Account security`, and (conditionally) `Billing and access`.
  5. Divider span.
  6. Sign-out `<form action={signOut}>` with a destructive-hover `<button>`.

### Conditional branches
- **`roleLabel`**: role trimmed/lowercased, then first-letter-capitalized (Owner/Admin/Member/Viewer). Null if no role → badge not rendered.
- **`canManageBilling`** = role is `owner` or `admin` → only then is the "Billing and access" item rendered.
- **`ariaLabel`** on trigger: `Account menu for ${displayName}` when there's a real name, else `Account menu`.
- **Email line** only renders when `email` present.
- Name span + chevron in trigger are `hidden ... sm:block` — **below `sm` the trigger is avatar-only** (no name, no chevron).

### Exact className strings

**Shared item class** (`itemClass`, used by Workspace settings / Account security / Billing):
```
ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] focus-visible:text-[var(--text-primary)] focus-visible:outline-none
```

**Trigger button:**
```
ui-account-trigger ui-chip-focus group
```
- **Trigger avatar tile**:
  ```
  ui-avatar-tile h-[var(--shell-avatar-size)] w-[var(--shell-avatar-size)] rounded-[0.6rem] text-[12px] font-semibold
  ```
- **Trigger name span**:
  ```
  hidden min-w-0 max-w-[8.5rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:block
  ```
- **Trigger chevron** (`ChevronDown`):
  ```
  hidden h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--ui-duration)] group-aria-expanded:rotate-180 sm:block
  ```
  `strokeWidth={2}` — rotates 180° when the menu is open (`group-aria-expanded:rotate-180`).

**Identity header row:**
```
flex items-start gap-2.5 px-2 py-2
```
- **Header avatar tile** (larger):
  ```
  ui-avatar-tile h-9 w-9 rounded-[0.7rem] text-[13px] font-semibold
  ```
- **Name `<p>`**:
  ```
  ui-text-compact-wrap text-[13px] font-semibold tracking-tight text-[var(--text-primary)]
  ```
- **Email `<p>`** (monospace):
  ```
  ui-nowrap-safe font-mono text-[11px] leading-snug tracking-[0.02em] text-[var(--text-tertiary)]
  ```
  with `title={email}`.
- **Role badge `<span>`**:
  ```
  mt-1.5 inline-flex max-w-max items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] font-semibold leading-none tracking-[0.01em] text-[var(--text-secondary)]
  ```

**Divider span** (used twice):
```
mx-1 my-1 block h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]
```

**Eyebrow label `<p>`** (`Account`):
```
ui-caps-2 px-2.5 pb-0.5 pt-1 text-[10px] text-[var(--text-tertiary)]
```

**Menu item icons** (Settings / ShieldCheck / CreditCard): `h-4 w-4 shrink-0 text-[var(--text-tertiary)]` with `strokeWidth={1.85}`.

**Sign-out button** (destructive variant — note it does NOT use `itemClass`; danger hover instead of accent):
```
ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] hover:text-[var(--danger-ink)] focus-visible:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] focus-visible:text-[var(--danger-ink)] focus-visible:outline-none
```
- LogOut icon: `<LogOut className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden />` (inherits text color, so it goes danger on hover).

### Visual treatment summary
- **Panel width** is the CSS var `--shell-account-menu-w`; the panel surface/shadow/border are owned by the shared `DropdownMenu` component (not visible in this file) — the panel z-index is `z-[60]`.
- **Two avatar sizes**: trigger uses `--shell-avatar-size` at `rounded-[0.6rem]`/12px text; the header uses fixed `h-9 w-9` (36px) at `rounded-[0.7rem]`/13px text. Both use the `ui-avatar-tile` class for their fill.
- **Items**: 12.5px, font-medium, secondary text, min 40px tall (`min-h-10`), `rounded-lg`, `px-2.5 py-2`, `gap-2.5`. Hover/focus paint an **accent-soft 30% over surface** wash and promote text to primary. Icons stay tertiary.
- **Sign-out** is the only item with a **danger** hover (`--danger-ink` 12% wash, danger text).
- **Dividers**: 1px hairlines at `--border-subtle` 85% opacity, inset `mx-1 my-1`.
- **Role badge**: bordered pill (`--border-subtle`), `--surface-muted` fill, 10.5px semibold secondary text, slight letter-spacing.
- **Email**: monospace, 11px, tertiary, with `ui-nowrap-safe` (clip risk — see below).

### Right-edge clipping risk
- Trigger name span is capped at `max-w-[8.5rem]` + `truncate` → long display names truncate, won't push layout.
- Email uses `ui-nowrap-safe` (no `truncate`) inside a `min-w-0` parent that is bounded by `--shell-account-menu-w`; a long email relies on the panel width + `ui-nowrap-safe` to not overflow. The `title={email}` gives the full value on hover. **Watch this when re-theming panel width** — narrowing `--shell-account-menu-w` could clip the mono email.

### Copy strings
- Trigger `aria-label`: **`Account menu for ${displayName}`** or **`Account menu`**.
- DropdownMenu `ariaLabel`: **`Account`**.
- Eyebrow: **`Account`**.
- Items: **`Workspace settings`**, **`Account security`**, **`Billing and access`**, **`Sign out`**.
- Role badge values: **`Owner` / `Admin` / `Member` / `Viewer`** (sentence-cased from input).

### Tokens referenced
- `--shell-account-menu-w`, `--shell-avatar-size`, `--ui-duration`.
- `--accent-soft`, `--surface`, `--surface-muted`, `--border-subtle`, `--danger-ink`.
- `--text-primary`, `--text-secondary`, `--text-tertiary`.
- Class hooks: `ui-account-trigger`, `ui-chip-focus`, `ui-avatar-tile`, `ui-text-compact-wrap`, `ui-nowrap-safe`, `ui-caps-2`.

---

## 5. `legal-footer.tsx` — Authenticated-shell trust footer strip

**File:** `C:/Users/dizho/oblixa/src/components/layout/legal-footer.tsx`

### Structural render
- `<footer id="legal-footer">` → centered inner `<div>` → a `<p>` (Info icon + boundary sentence) and `<LegalLinks variant="compact" />`.

### Layout behavior
- Inner div stacks vertically on mobile, becomes a justified row at `md` (`flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4`).
- The sentence `<p>` aligns `items-start` on mobile (icon nudged with `mt-px`), `items-center` at `md`.

### Exact className strings
- **Footer**:
  ```
  ui-footer-shell shrink-0 px-4 py-2 md:px-6
  ```
- **Centered inner div**:
  ```
  mx-auto flex max-w-[1680px] flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4
  ```
- **Sentence `<p>`**:
  ```
  flex min-w-0 items-start gap-1.5 text-[11px] leading-snug text-[var(--text-tertiary)] md:items-center
  ```
- **Info icon**: `<Info size={11} strokeWidth={1.85} aria-hidden className="mt-px shrink-0 text-[var(--text-tertiary)] md:mt-0" />`
- **Sentence text span**: `<span className="ui-text-wrap">`.
- **LegalLinks**: `<LegalLinks variant="compact" className="shrink-0 gap-x-4 gap-y-1" aria-label="Footer links" />`.

### Visual treatment summary
- A single quiet 11px line, tertiary text, `leading-snug`, on the `ui-footer-shell` background (background/border owned by that class). Padding `px-4 py-2` (→ `md:px-6`). Max content width **1680px** (note: wider than the topbar's `--shell-content-max`).
- 11px Info glyph at stroke 1.85, tertiary, `shrink-0`.

### Copy strings
- Sentence (exact): **`Oblixa tracks contract follow-up after signature. It does not provide legal advice.`**
- Footer links `aria-label`: **`Footer links`**.

### Tokens / class hooks
- `--text-tertiary`; class hooks `ui-footer-shell`, `ui-text-wrap`.

---

## 6. `legal-links.tsx` — Footer link list (compact + full variants)

**File:** `C:/Users/dizho/oblixa/src/components/layout/legal-links.tsx`

### Structural render
- `<nav>` (class `ui-legal-links` + passed `className`) containing a `<Link>` per item.

### Conditional branches
- **`variant="compact"`** (the authenticated footer) → only first **3** links (`Security`, `Privacy`, `Terms`), **title-case** (no uppercase), size `text-[11px] tracking-[0.01em]`.
- **`variant="full"`** (marketing) → all **7** links, **`uppercase`**, size `text-[10.5px] tracking-[0.14em]` (wider eyebrow tracking).

### Full link set (in order)
`Security` (`/security`), `Privacy` (`/privacy`), `Terms` (`/terms`), `Acceptable use` (`/acceptable-use`), `Accessibility` (`/accessibility`), `Cookies` (`/cookies`), `Contact` (`/contact`).

### Exact className strings
- Nav: `ui-legal-links ${className}` (footer passes `shrink-0 gap-x-4 gap-y-1`).
- **Each link** (base, with `caseClass` + `sizeTracking` appended):
  ```
  ui-nowrap-safe rounded-sm font-semibold leading-none text-[var(--text-tertiary)] no-underline transition-colors duration-[var(--ui-duration)] hover:text-[var(--accent-strong)] hover:underline hover:decoration-from-font hover:underline-offset-[3px] focus-visible:text-[var(--accent-strong)] focus-visible:underline focus-visible:decoration-from-font focus-visible:underline-offset-[3px]
  ```
  - `caseClass` = `""` (compact) or `"uppercase"` (full).
  - `sizeTracking` = `text-[11px] tracking-[0.01em]` (compact) or `text-[10.5px] tracking-[0.14em]` (full).

### Visual treatment summary
- Links: **font-semibold, tertiary text, no underline at rest**. Hover/focus → text becomes `--accent-strong` + underline appears (decoration-from-font, 3px offset). `ui-nowrap-safe` keeps each label from wrapping mid-word.
- Default nav `aria-label="Legal and policies"` (footer overrides to `Footer links`).

### Tokens / class hooks
- `--text-tertiary`, `--accent-strong`, `--ui-duration`; class hooks `ui-legal-links`, `ui-nowrap-safe`.

---

## 7. `search/search-field.tsx` — Shared search-input primitive (chrome/overlay/page)

**File:** `C:/Users/dizho/oblixa/src/components/search/search-field.tsx`

### Structural render
- `<form role="search" aria-label={ariaLabel} className="relative w-full">` containing:
  1. **Leading icon button** (`type="button"`, `tabIndex={-1}`) — clicking focuses + selects the input. Wraps a `Search` lucide icon.
  2. The **`<input type="search">`**.
  3. A right-aligned trailing `<span>` cluster holding: optional **clear-X button** (only when value + `onClear`), then a pointer-events-none `<span>` with `trailing` content + the **kbd-hint chips**.

### Variant / conditional branches
- **Three size variants** via `sizeClass`:
  - `page`: `ui-input min-h-13 pl-12 pr-16 text-[16px]`
  - `overlay`: `ui-input min-h-11 pl-11 pr-12 text-[14px]`
  - `chrome` (the topbar): `ui-input min-h-10 pl-11 pr-12 text-sm`
- **Icon size**: `page` → `h-5 w-5`; else `h-4 w-4`. Icon left offset is `left-4` in all cases.
- **Combobox semantics** (`comboboxEnabled`): defaults `true` for overlay/page, **`false` for chrome** (chrome stays a plain search input — no `role=combobox`, no `aria-expanded/autocomplete/controls/activedescendant`).
- **kbd hint resolution** (`effectiveKbdHint`):
  - If `isOpen` → `{ meta: "", key: "Esc" }`.
  - Else if `current.length > 0 && onClear` → `{ meta: "", key: "Esc" }` (so typed text shows an Esc-to-clear hint).
  - Else → the passed `kbdHint` (chrome passes `⌘ K`, or `undefined` when tight).
- **Clear-X button** renders only when `current.length > 0 && onClear`.

### Exact className strings
- Form: `relative w-full`.
- **Leading icon button** (template literal):
  ```
  absolute ${iconLeftClass} top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] focus:outline-none
  ```
  - `aria-label="Focus search input"`. Icon: `<Search className="${iconSizeClass}" strokeWidth={1.85} />`.
- **Input**: `${sizeClass} w-full` (e.g. chrome → `ui-input min-h-10 pl-11 pr-12 text-sm w-full`).
- **Trailing cluster span**:
  ```
  absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5
  ```
- **Clear-X button**:
  ```
  inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]
  ```
  - X icon: `<X className="h-3.5 w-3.5" strokeWidth={2} />`, `aria-label="Clear search"`.
- **Hint wrapper span**: `pointer-events-none flex items-center gap-1`.
- **kbd-hint chip group span**:
  ```
  hidden items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:inline-flex
  ```
  → **Hidden below `sm`** (kbd chips only show at `sm`+). Each glyph is a `<kbd className="ui-kbd">`.

### Input attributes / behavior worth noting for redesign
- `type="search"`, `inputMode="search"`, `enterKeyHint="search"`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}`, `maxLength={MAX_QUERY_LENGTH}` (120).
- Right padding (`pr-16` page / `pr-12` overlay+chrome) reserves room so value/placeholder never collide with the kbd chips + clear-X.
- Sanitizes input (strips control/bidi/zero-width chars), gates IME composition, sanitizes paste.

### Copy / aria
- Default `placeholder`: **`Type to filter destinations…`** (chrome overrides per `topbar-search.tsx`).
- Default `ariaLabel`: **`Search workspace`**.
- Leading button `aria-label`: **`Focus search input`**.
- Clear button `aria-label`: **`Clear search`**.
- Kbd hint glyphs: meta (e.g. `⌘`) + key (`K` / `Esc`).

### Tokens / class hooks
- `ui-input`, `ui-kbd` (class hooks for the input chrome + kbd chip).
- `--text-tertiary`, `--text-secondary`, `--surface-muted`, `--accent`.

---

## 8. `search/nav-icon.tsx` — Icon-token → lucide glyph resolver

**File:** `C:/Users/dizho/oblixa/src/components/search/nav-icon.tsx`

### Structural render
- **No JSX / no markup.** Pure mapping module. Exports:
  - `ICON_BY_KEY` — `Record<NavItem["icon"], LucideIcon>` mapping nav-item icon tokens to lucide icons (one source of truth shared by sidebar, search results, and any future surface).
  - `DEFAULT_NAV_ICON = Compass` — fallback so every nav row renders a glyph at a stable left edge (preserves scan rhythm).
  - `resolveNavIcon(item)` — returns `ICON_BY_KEY[item.icon]` or `DEFAULT_NAV_ICON`.

### Token → glyph map (full)
`dashboard`→LayoutDashboard, `review`→SearchCheck, `contracts`→Files, `tasks`→ListTodo, `renewals`→CalendarClock, `exceptions`→BellRing, `evidence`→FileCheck2, `reports`→BarChart3, `decisions`→BadgeCheck, `campaigns`→Megaphone, `assurance`→Shield, `relationships`→GitBranch, `programs`→Boxes, `settings`→Settings, `billing`→CreditCard, `more`→Grid2x2, `profile`→UserRound, `workspace-identity`→Building2, `team`→Users, `imports`→Upload, `security-account`→ShieldCheck, `notifications`→Bell, `export`→Download, `review-fields`→ClipboardCheck. Fallback: **Compass**.

- **No copy, no className, no design tokens** in this file. It is bundling-conscious (static per-icon imports, not the dynamic namespace import). Relevant to a redesign only as the canonical glyph vocabulary — note these are **different glyphs** from the breadcrumb's `AREA_ICON` map (e.g. breadcrumb Contracts = `FileText`; nav Contracts = `Files`), so a unified icon system would need to reconcile the two maps.

---

## Cross-cutting tokens to define/redesign

| Token | Used by | Role |
|---|---|---|
| `--shell-topbar-h` | header | topbar row height |
| `--shell-content-max` | header | centered content max width |
| `--shell-account-menu-w` | account-menu | dropdown panel width |
| `--shell-avatar-size` | account-menu | trigger avatar size |
| `--ui-duration` | account-menu, legal-links | transition timing |
| `--focus-ring` | breadcrumb | focus-visible ring color |
| `--shadow-1` | breadcrumb medallion | tile shadow |
| `--surface-raised` / `--surface-contrast` / `--surface-muted` / `--surface` | breadcrumb, account-menu, search | fills / hover washes |
| `--border-strong` / `--border-subtle` | breadcrumb, account-menu | borders, dividers |
| `--accent` / `--accent-soft` / `--accent-strong` | search, account-menu, legal-links | hover/focus accents |
| `--danger-ink` | account-menu | sign-out destructive hover |
| `--text-primary` / `--text-secondary` / `--text-tertiary` | all | text hierarchy |

**Shared `ui-*` class hooks** (defined in `globals.css`, not these files — visual chrome lives there): `ui-topbar`, `ui-btn-ghost`, `ui-account-trigger`, `ui-chip-focus`, `ui-avatar-tile`, `ui-input`, `ui-kbd`, `ui-footer-shell`, `ui-legal-links`, `ui-nowrap-safe`, `ui-text-wrap`, `ui-text-compact-wrap`, `ui-caps-2`. **For a full visual redesign you must also inspect `src/app/globals.css`** — the actual borders, backgrounds, blur, and shadows for the topbar/footer/avatar/input live behind these class hooks, not in the component files above.

**Type-scale note:** the topbar leans heavily on a single repeated size — **`text-[12.5px]`** (breadcrumb crumbs, Tools link, account name, menu items) — with the chrome search at `text-sm`, kbd chips / role-eyebrow / footer at 10–11px. Any new scale should treat 12.5px as the dominant chrome body size.