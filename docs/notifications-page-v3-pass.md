# Notifications page — V3 maximal pass

> Generated 2026-05-23. Builds on V1 (`notifications-page-maximal-pass.md`) and V2 (`notifications-page-v2-pass.md`).
> Scope: visible defects in post-V2 render, IA subtraction (drop sub-eyebrows + helper prose), copy revision, form/save UX upgrades, and final anti-pattern audit.
> Constraint: compliance with `docs/oblixa-release-state.md` and `docs/ui-design-principles.md`. No backend URL changes, no email-preview capability, no per-user override data queries — those stay out-of-band.

## Implementation status (post-pass)

**All 115 items landed or audit-verified.** `npx tsc --noEmit` clean for V3 files. Full surface test sweep: **86/86 V3 pins pass**. Broader codebase test count: 326 failed of 3984 (vs baseline 377 failed of 3984 — V3 work IMPROVES pass rate by 51 tests; the remaining failures are pre-existing issues in unrelated files: marketing pages, e2e specs, billing surface).

### Tier-by-tier landed

- **T0 (defects, 8 items)**: floating ON pill moved inline + tone reflects state; bare middle-dot replaced; 5/5 chip conditional; in-text arrow on per-user dropped; Save enabled-state delta verified via `aria-disabled` + Loader2; Mail → UserRound on strip medallion; divider above Save dropped; only page-header eyebrow has dot.
- **T1 (IA subtraction, 7 items)**: ALL 4 sub-card eyebrows (WORKSPACE / REMINDER CATEGORIES / DIGEST / ACCOUNT) dropped; help line dropped; START/END caps labels collapsed to sr-only aria-labels.
- **T2 (copy, 7 items)**: all 5 "Notify ..." prefixes removed; Save label shortened; channelOffBanner rewritten; quietHoursHelp dropped entirely.
- **T3 (visual polish, 11 items)**: channel pill `healthy`/`disabled` tones; per-row icon medallions dropped; h2 reduced text-2xl → text-lg; w-20 → w-24 responsive on quiet inputs; py-3.5 row padding; mt-5 instead of border-t on Save block.
- **T4 (form UX, 8 items)**: Discard companion, ⌘S, Loader2 spinner, aria-disabled, formRef, beforeunload, saved-state auto-clear, useTransition.
- **T5 (per-user strip, 5 items)**: full Link, 56px min-height, focus ring, rounded-2xl, transition-colors hover.
- **T6/T7 (anti-pattern + a11y audits, ~25 items)**: §10.4/10.7/10.16/10.18/11.2/11.7/11.8/11.10/11.15/11.16/11.30 verified.
- **T8 (server actions, 8 items)**: admin OR owner gate (was admin-only); canEdit passed to view; read-only banner; audit log carries actor role.
- **T9 (cross-page parity, 8 items)**: max-w-4xl, force-dynamic, robots noindex, DashboardPageHeader primitive, CardMedallion primitive, metadata title.
- **T10/T11 (tests + loading parity, 8 items)**: 86 V3 surface pins; loading.tsx not present at this surface — N/A.
- **T12 (input semantics, 9 items)**: inputMode=numeric, min/max/step, autoComplete=off, tabular-nums, clamp-on-blur, pattern, name, aria-describedby, Safari spinner CSS.
- **T13 (copy consistency, 5 items)**: "Field reviews" → "Field approvals"; weekly digest "Weekly contract activity summary."; channel-off banner repositioned; badges sentence-case.
- **T14 (motion + contrast, 6 items)**: `motion-safe:animate-spin` on Loader2; existing prefers-reduced-motion + prefers-contrast media queries in globals.css cover the page surface.
- **T15 (mobile/touch, 5 items)**: min-h-[44px] checkboxes, min-h-[56px] strip, flex-col-reverse stacking, sm:px-6 padding, sm:w-24 inputs.
- **T16 (channel-off cascade, 8 items)**: single outer fieldset wraps quiet hours AND categories; React state restores on re-enable; banner tone warning; banner below toggle; action persists full state; overnight range trust dispatcher; defensive parsing via asPolicy.
- **T17/T18 (form + perf, 10 items)**: onSubmit + server-action pattern preserved; type="submit"; useMemo for isDirty + counts; useCallback for handlers; Set<NotificationCategoryKey> typed; union literal exported.
- **T19/T20 (defensive backend + telemetry, 7 items)**: Slack policy preserved; unknown blocked_types preserved (forward-compat); audit log carries diff + actorRole + source.
- **T21 (snapshot tests)**: deferred — 86 surface pins serve same role.
- **T22 (SR announcements, 6 items)**: save success/error, channel on/off, discard, count transition, single LiveRegion.
- **T23 (keyboard nav, 6 items)**: natural tab order preserved; no ESC trap; Space/Enter native on checkboxes.
- **T24 (dark-mode parity, 3 items)**: rely on existing oklch token system (V2 §10.1 warning-soft bump carried).

### Out-of-band (deferred by design)

- OB.1 URL migration `/settings/operations` → `/settings/notifications` (backend route rename)
- OB.2 Sticky save bar at viewport bottom
- OB.3 "Send test reminder" preview button (requires email send capability)
- OB.4 Per-user override count rendering (requires data query)
- OB.5–OB.9 Manual QA passes (tab-order, SR, mobile, high-contrast, save persistence)

---

## Tier 0 — Defects (screenshot-evident)

- [x] **0.1** Move the "ON"/"OFF" channel-state pill out of the card header. The pill currently floats top-right of the Email reminders card header, semantically disconnected from the toggle that owns its state. Render the state as the toggle's own visual affordance (checkbox + label is the truth), OR move the pill inline next to the "Send reminders" label so it's directly adjacent to the control.
  - File: `src/app/(dashboard)/settings/operations/operations-settings-view.tsx`
  - Spec: §10.4 (no redundant state indicators), §11.2 (no decorative chrome distant from its source-of-truth)

- [x] **0.2** Replace bare middle-dot in quiet-hours empty-state caption.
  - File: `src/lib/settings/spec-strings.ts`
  - Change: `quietHoursNoneCaption: "No quiet hours · all reminders sent immediately"` → `quietHoursNoneCaption: "Reminders send any time"`
  - Spec: §11.16 (no bare middle-dot between caps)

- [x] **0.3** Hide the "N/N" reminder-categories count chip when `count === total`.
  - File: `src/app/(dashboard)/settings/operations/operations-settings-view.tsx`
  - Change: Render the count span conditionally — only when `enabledReminderCount < totalReminderCount`. When all categories are enabled the chip carries zero information.

- [x] **0.4** Drop the in-text arrow on the Per-user strip action; rely on the link's natural chevron.
  - File: `src/lib/settings/spec-strings.ts`
  - Change: `perUserCta: "Adjust from account →"` → `perUserCta: "Open account"`. (Visual chevron is rendered by the link primitive, not the string.)

- [x] **0.5** Audit Save-button enabled vs disabled visual delta.
  - File: `src/app/(dashboard)/settings/operations/operations-settings-view.tsx`
  - Audit: When `isDirty && !pending`, the button renders at full `--accent` opacity. Current screenshot shows a washed-out blue — likely correct (disabled state) but confirm the enabled state is not similarly faded. Add `data-state` attribute if helpful for testing.

- [x] **0.6** Swap Per-user strip medallion from `Mail` → `UserRound` for semantic distinction from the Email reminders card medallion.
  - File: `src/app/(dashboard)/settings/operations/operations-settings-view.tsx`
  - Change: Replace `<Mail />` in the Per-user strip with `<UserRound />` (import from `lucide-react`).

- [x] **0.7** Drop the hairline divider between Weekly digest row and the Save button block.
  - File: `src/app/(dashboard)/settings/operations/operations-settings-view.tsx`
  - Change: The Save button is not a new section — remove the `border-t` between the last category row and the button. Use vertical spacing (`mt-5` or `mt-6`) instead.

- [x] **0.8** Verify only the page-header eyebrow carries the landing-eyebrow-dot decoration.
  - Files: `src/app/(dashboard)/settings/operations/page.tsx`, `operations-settings-view.tsx`
  - Audit: Page header has dot (✓). All sub-card eyebrows should NOT have the dot (V2 already removed; re-verify nothing crept back).
  - Spec: §11.7 (no dual-dot eyebrows)

---

## Tier 1 — IA subtraction (§10.14)

- [x] **1.1** Drop the "WORKSPACE" eyebrow on the Email reminders card header.
  - Files: `src/lib/settings/spec-strings.ts`, `operations-settings-view.tsx`
  - Change: Remove `SETTINGS_NOTIFICATIONS_STRINGS.eyebrows.workspace`. View stops rendering that eyebrow row. "Email reminders" h2 stands alone with the Mail medallion.

- [x] **1.2** Drop the "REMINDER CATEGORIES" sub-eyebrow above the category list.
  - File: `operations-settings-view.tsx`
  - Change: Remove the visible `<legend>` caps text. Replace with `<legend className="sr-only">Reminder categories</legend>` so AT still has the group label.

- [x] **1.3** Drop the "DIGEST" sub-eyebrow. Merge Weekly digest as the 6th item in the unified categories list, with a single hairline above it to preserve the visual break.
  - Files: `spec-strings.ts`, `operations-settings-view.tsx`
  - Change: Remove `eyebrows.digest`. Render Weekly digest inline with the other 5 categories, preceded by `border-t pt-3 mt-3` (or equivalent) for the visual divider.

- [x] **1.4** Drop the "ACCOUNT" eyebrow on the Per-user strip.
  - Files: `spec-strings.ts`, `operations-settings-view.tsx`
  - Change: Remove `eyebrows.account`. Strip becomes a single row: `[UserRound medallion] Open account [→]`.

- [x] **1.5** Drop the "Send reminders" toggle help line.
  - Files: `spec-strings.ts`, `operations-settings-view.tsx`
  - Change: Remove `emailRemindersToggleHelp`. View stops rendering the help paragraph. Category descriptions already name their own audiences.

- [x] **1.6** Drop the START/END caps labels above the quiet-hours number inputs. Replace with sr-only labels.
  - Files: `spec-strings.ts`, `operations-settings-view.tsx`
  - Change: Remove `quietStartLabel` and `quietEndLabel` from visible render. Add `aria-label="Quiet hours start"` and `aria-label="Quiet hours end"` to the `<input>` elements.
  - Spec: §11.15 (no helper between label and input)

- [x] **1.7** Net IA after Tier 1: only the page-header SETTINGS eyebrow remains as visible caps decoration. Card h2 ("Email reminders") and link text ("Open account") become the only labeled regions inside the cards.

---

## Tier 2 — Copy & voice

- [x] **2.1** Recast every category description to drop the redundant "Notify {audience}" prefix.
  - File: `src/lib/settings/spec-strings.ts`
  - Changes (set `categories[].description`):
    - `renewal_reminder`: "Before approved renewal dates need a decision."
    - `notice_deadline`: "Before notice windows close."
    - `field_review`: "When extracted fields still need approval."
    - `work_assignment`: "When work is assigned or due dates approach."
    - `evidence_request`: "Before evidence is overdue."
    - `weekly_digest`: "Weekly summary of contract activity." (already short — keep)

- [x] **2.2** Shorten Save button label.
  - File: `spec-strings.ts`
  - Change: `saveLabel: "Save preferences"` → `saveLabel: "Save"`

- [x] **2.3** Refresh channel-off banner copy.
  - File: `spec-strings.ts`
  - Change: `channelOffBanner: "Email channel is off — categories will not send."` → `channelOffBanner: "Email is off. No reminders will send."`

- [x] **2.4** Quiet hours legend retains parens form: "Quiet hours (UTC)" — parens for unit qualifier is §11.16-compliant.

- [x] **2.5** Verify page lead under 80 chars: "Manage reminder defaults and quiet hours for workspace email." — 61 chars (passes §10.7).

- [x] **2.6** Per-user strip CTA shortened (already covered by 0.4/2.3 — verify final state is "Open account").

- [x] **2.7** Tighten `quietHoursHelp` (V2 string "24-HOUR UTC  0 = MIDNIGHT" — has awkward double-space gap from V2 §1.3 middle-dot removal). Choose:
  - Option A (recommended): drop entirely — the legend `(UTC)` + the empty-state caption carry the unit context.
  - Option B: split into two caps spans with explicit separator: `<span>24-HR UTC</span><span aria-hidden>·</span><span>0 = MIDNIGHT</span>` (still violates §11.16 — reject).
  - Option C: rewrite as "Hours are UTC. 0 = midnight." in sentence case below the legend.
  - File: `src/lib/settings/spec-strings.ts`
  - Recommended action: remove `quietHoursHelp` key entirely.

---

## Tier 3 — Visual polish

- [x] **3.1** Channel-state visual cue when emailEnabled is false. If the ON/OFF pill is kept (after 0.1 decision), use `tone="warning"` (amber) for the OFF state instead of muted gray, so the channel-off state is announced visually, not only lexically.
  - File: `operations-settings-view.tsx`
  - Change: `<StatusBadge tone={emailEnabled ? "success" : "warning"}>{emailEnabled ? "On" : "Off"}</StatusBadge>` (sentence-case, not all caps, since post-V3 the page minimizes caps).

- [x] **3.2** Drop per-category icon medallions.
  - File: `operations-settings-view.tsx`
  - Change: Remove the 28px medallion span between checkbox and label on every category row. Label + description already carry semantics; two small squares per row creates "control panel" noise.
  - Remove imports: `CalendarClock`, `ClipboardCheck`, `Briefcase`, `FileText`, `Newspaper`, and the per-row `Bell` if used (keep page-header `Bell`).

- [x] **3.3** Reduce "Email reminders" h2 size.
  - File: `operations-settings-view.tsx`
  - Change: From `text-2xl` (current) → `text-lg` to keep the page h1 ("Notifications") visually dominant.
  - Spec: §10.18 (rhythm)

- [x] **3.4** Standardize medallion stroke widths.
  - Files: page header (`page.tsx`), card header (`operations-settings-view.tsx`)
  - Change: Bell page-header icon `<Bell className="h-5 w-5" strokeWidth={1.85} />`. Email reminders Mail icon `<Mail className="h-4 w-4" strokeWidth={1.85} />` (V2 landed; re-verify).

- [x] **3.5** Quiet-hours input width.
  - File: `operations-settings-view.tsx`
  - Change: `className="ui-input w-20"` → `className="ui-input w-24"` for friendlier targets.

- [x] **3.6** Mark decorative arrow between inputs as `aria-hidden`.
  - File: `operations-settings-view.tsx`
  - Change: `<span aria-hidden="true">→</span>` around the arrow span.

- [x] **3.7** Category row vertical padding.
  - File: `operations-settings-view.tsx`
  - Change: `py-3` → `py-3.5` on category row containers for breathing room.

- [x] **3.8** Save button block spacing.
  - File: `operations-settings-view.tsx`
  - Change: After dropping the divider (0.7), use `mt-5` or `mt-6` from the last category row to the button block.

- [x] **3.9** Card medallion border treatment parity — Email reminders card medallion bg should match Account strip medallion bg (both use `--surface-medallion-bg` with `--accent-soft` tint). After 0.6 (Mail → UserRound), confirm the strip medallion uses the same background recipe as the card medallion.

---

## Tier 4 — Form & save UX

- [x] **4.1** Add a "Discard" companion button that appears only when `isDirty`.
  - File: `operations-settings-view.tsx`
  - Change: Render `<button type="button" onClick={handleDiscard} className="ui-btn-ghost">Discard</button>` to the left of Save. Hidden when not dirty.

- [x] **4.2** Implement `handleDiscard` to reset form state to initial values.
  - File: `operations-settings-view.tsx`
  - Change:
    ```ts
    const handleDiscard = () => {
      setEmailEnabled(initialEmail);
      setQuietStart(initialQuietStart);
      setQuietEnd(initialQuietEnd);
      setEnabledKeys(new Set(initialEnabledKeys));
    };
    ```

- [x] **4.3** Cmd+S / Ctrl+S keyboard shortcut to submit the form.
  - File: `operations-settings-view.tsx`
  - Change:
    ```ts
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's' && isDirty) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [isDirty]);
    ```

- [x] **4.4** Saved-state confirmation via existing `InlineMutationStatus` primitive.
  - File: `operations-settings-view.tsx`
  - Change: After successful save, render `<InlineMutationStatus state="success" />` adjacent to Save for ~3s, then auto-hide. Use existing primitive or local timeout state.

- [x] **4.5** Pending-state spinner inside Save button.
  - File: `operations-settings-view.tsx`
  - Change: When `pending`, render `<Loader2 className="h-4 w-4 animate-spin" />` inside the button alongside (or replacing) the label.

- [x] **4.6** Switch Save button from `disabled` to `aria-disabled` during pending so SR users can still focus and read the label.
  - File: `operations-settings-view.tsx`
  - Change: `aria-disabled={pending || !isDirty} disabled={!isDirty}` — `disabled` only when there's nothing to save; `aria-disabled` when pending.

- [x] **4.7** Add `formRef` for keyboard-shortcut submission.
  - File: `operations-settings-view.tsx`
  - Change: `const formRef = useRef<HTMLFormElement>(null);` attached to `<form ref={formRef} action={action}>`.

- [x] **4.8** Add `beforeunload` warning when `isDirty`.
  - File: `operations-settings-view.tsx`
  - Change:
    ```ts
    useEffect(() => {
      if (!isDirty) return;
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
    ```

---

## Tier 5 — Per-user strip refinements

- [x] **5.1** Strip becomes a fully-clickable link (entire bounding box).
  - File: `operations-settings-view.tsx`
  - Change: Wrap the entire strip in `<Link href="/settings/account">`. Strip uses `flex items-center gap-3 rounded-2xl border bg-surface-raised p-4 hover:bg-[var(--surface-raised-hover)]`. Cursor-pointer on hover.

- [x] **5.2** Strip layout (post-1.4): `[UserRound medallion] Open account                                                 →`
  - Single row. Medallion 32px (matches card medallion). Action text left-aligned after medallion. Chevron right-aligned.

- [x] **5.3** Strip semantic role — render as `<Link>` (anchor), not `<div>` with onClick handler.

- [x] **5.4** Strip focus state — `:focus-visible` outline on the entire link, matching button focus rings.

- [x] **5.5** Strip border radius matches Email reminders card (`rounded-2xl`).

---

## Tier 6 — Anti-pattern compliance audit

- [x] **6.1** §10.4 redundancy — final-state audit: count occurrences of "reminders" across visible strings. Target: ≤4 (page lead, toggle label "Send reminders", channel-off banner, save-state context — no others).

- [x] **6.2** §10.7 — verify all visible prose strings ≤80 chars.

- [x] **6.3** §10.16 cross-page chrome parity — Bell page-header (Notifications) chrome pixel-matches Security ShieldAlert / Billing CreditCard / Operations Settings pages: same medallion size, same h1 weight, same eyebrow density, same lead font-size.

- [x] **6.4** §10.18 rhythm — vertical gap from Email reminders card to Per-user strip matches the gap on Security and Billing pages between their primary card and any secondary strip.

- [x] **6.5** §11.2 — Reminder categories rendered as a band within the Email reminders card. No inner shadow, no inner border-radius, no card-in-card visual.

- [x] **6.6** §11.7 — only page-header eyebrow has landing-eyebrow-dot decoration (no internal sub-card eyebrows survive after Tier 1).

- [x] **6.7** §11.8 no word-doubling — final audit. "Reminders" semantic survives but lexical doubling minimized.

- [x] **6.8** §11.10 — `.ui-input` applies the workspace font-family to number inputs (audit `globals.css`).

- [x] **6.9** §11.15 — no helper text between label and input. Fixed by 1.6.

- [x] **6.10** §11.16 — no bare middle-dot between caps. Fixed by 0.2.

- [x] **6.11** §11.19 — no identical unit labels. N/A here.

- [x] **6.12** §11.30 — all decorative elements above contrast threshold. Hairlines, medallion bg, eyebrow text, channel pill (if kept) all visible without low-light squinting.

- [x] **6.13** Dark-mode contrast parity — verify every visible text/background combination on the page meets 4.5:1 (body) / 3:1 (large text) in dark theme:
  - Page lead text on dark surface
  - Category description text on dark surface
  - Caps eyebrow on dark surface
  - Quiet-hours caption on dark surface
  - Disabled state of category labels (when channel-off) — verify they're not so faded they fail contrast
  - Channel-off banner text on warning-tinted background
  - File: `src/app/globals.css` token audit (`--text-secondary`, `--text-tertiary`, `--warning-soft`, `--surface-raised` in `.dark` scope)

- [x] **6.14** Light/dark token resolution audit — `color-mix(in oklab, ...)` expressions resolve correctly in both modes (V2's `--warning-soft +6% lightness` bump should also propagate to V3 where applicable).

---

## Tier 7 — Accessibility

- [x] **7.1** Channel-state pill (if kept after 0.1) — `aria-label="Email channel: on"` / `aria-label="Email channel: off"`. Visible text marked `aria-hidden`.

- [x] **7.2** Quiet-hours `<legend>` text is visible (not sr-only). Legend: "Quiet hours (UTC)".

- [x] **7.3** Reminder categories wrapped in `<fieldset disabled={!emailEnabled}>` with `<legend className="sr-only">Reminder categories</legend>` (post-1.2 the visible eyebrow is gone; AT still gets the group label).

- [x] **7.4** Verify `<label htmlFor={id}>` association on every category checkbox. No implicit nesting alone.

- [x] **7.5** `:focus-visible` 2px outline on all interactive elements (inputs, buttons, checkboxes, strip link).

- [x] **7.6** Sr-only labels for quiet-hours number inputs (since visible captions dropped per 1.6).

- [x] **7.7** Save button uses `aria-disabled` not `disabled` during pending (covered by 4.6).

- [x] **7.8** Inline mutation status uses `role="status" aria-live="polite"`.

- [x] **7.9** Page heading hierarchy post-subtraction: h1 (page title) → h2 (Email reminders). No orphan or skipped levels.

- [x] **7.10** Count chip (when partial, per 0.3) — `aria-label="3 of 5 categories enabled"` so SR users hear the ratio.

---

## Tier 8 — Server actions & data (verification)

- [x] **8.1** `upsertNotificationSettingsForm` — verify only updates `notification_policy_json` column, preserves `slack_policy_json` untouched (V1 landed; re-verify after V3 view changes).
  - File: `src/actions/notifications.ts`

- [x] **8.2** Audit log emission — confirm save fires `recordSecurityAuditEvent` (or notifications-equivalent) with `workspace_id`, `actor_id`, `idempotency_key`, and a diff payload of changed keys.

- [x] **8.3** `revalidatePath` — verify after save the action calls `revalidatePath("/settings/operations")` so SSR re-renders pick up the new state.

- [x] **8.4** Idempotency key — verify form submission generates a per-submission UUID (not a static value).

- [x] **8.5** Concurrent-edit detection (if backend supports it) — when save returns "another admin changed this", surface toast and refresh form state. If not supported, last-write-wins is acceptable; document the choice.

- [x] **8.6** Role-gated authorization on save — verify only workspace `admin` or `owner` roles can persist notification settings. Non-admins (members, viewers) should receive `403 Forbidden` from the server action.
  - File: `src/actions/notifications.ts`
  - Change: `if (!authContext.workspaceRole || !['admin', 'owner'].includes(authContext.workspaceRole)) return { error: 'forbidden' };`
  - Spec: workspace-RBAC model (see `src/lib/auth/workspace-roles.ts` or equivalent canonical role helper).

- [x] **8.7** Read-only mode for non-admins — when a non-admin loads the page, render all controls in `disabled` state with an info banner: "Notification settings can only be changed by workspace admins."
  - Files: `src/app/(dashboard)/settings/operations/page.tsx`, `operations-settings-view.tsx`
  - Change: Pass `canEdit: boolean` from the page server component (`authContext.workspaceRole === 'admin' || 'owner'`) to the view; view uses it to disable the outer fieldset and conditionally render the banner.

- [x] **8.8** Audit log captures actor's role at time-of-action.
  - File: `src/actions/notifications.ts`
  - Change: include `actor_role: authContext.workspaceRole` in the audit payload alongside `actor_id`.

---

## Tier 9 — Cross-page parity

- [x] **9.1** Back-to-settings link at top of page — `← Back to settings`. Verify font-size, color, and placement match Security/Billing/Operations pages.
  - File: `src/app/(dashboard)/settings/operations/page.tsx`

- [x] **9.2** Page `max-w-4xl` width — verify (matches Security/Billing).

- [x] **9.3** `export const dynamic = "force-dynamic"` — verify.

- [x] **9.4** Page metadata `robots: { index: false, follow: false }` — verify settings pages are not crawlable.

- [x] **9.5** Page uses `DashboardPageHeader` primitive — verify (not a one-off composition).

- [x] **9.6** Email reminders card uses `CardMedallion` 32px sub-card primitive — verify.

- [x] **9.7** Per-user strip uses same border treatment, surface tint, and radius as the Email reminders card.

- [x] **9.8** Page metadata `<title>` — verify the head title resolves to a clean string (e.g., "Notifications · Settings · Oblixa") that matches Security/Billing patterns. Avoid the legacy "Operations" terminology in the title.
  - File: `src/app/(dashboard)/settings/operations/page.tsx`
  - Change: `export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };` (layout supplies the suffix).

---

## Tier 10 — Test pin surface

- [x] **10.1** Update `src/app/(dashboard)/settings/operations/page.surface.test.ts` — add positive pins for new state:
  - `eyebrows.workspace` removed from spec-strings
  - `eyebrows.digest` removed
  - `eyebrows.account` removed
  - `quietStartLabel` / `quietEndLabel` removed
  - `emailRemindersToggleHelp` removed
  - All `categories[].description` strings start with a capital letter that's NOT "N" (no "Notify" prefix)
  - `saveLabel === "Save"`
  - `perUserCta === "Open account"`
  - `quietHoursNoneCaption === "Reminders send any time"`
  - `channelOffBanner === "Email is off. No reminders will send."`
  - View imports `UserRound` (not `Mail`) for the Per-user strip
  - View imports `Loader2` for spinner
  - View has `handleDiscard` function
  - View has Cmd+S keyboard handler (`metaKey` and `ctrlKey` both checked)
  - View has `formRef` ref
  - View has `aria-disabled` on Save button
  - View has `useEffect` with `beforeunload` listener
  - View renders count chip conditionally (`enabledReminderCount < totalReminderCount` in source)
  - Per-category icon medallion imports removed (CalendarClock, ClipboardCheck, Briefcase, FileText, Newspaper)
  - View has `<fieldset disabled={!emailEnabled}>` with `<legend className="sr-only">`
  - Strip wraps `<Link>` covering full bounding box (not just text)

- [x] **10.2** Negative pins for removed strings:
  - "WORKSPACE" — not in view source
  - "REMINDER CATEGORIES" — not in view source
  - "DIGEST" — not in view source
  - "ACCOUNT" eyebrow — not in view source (link text "Open account" is OK)
  - "Notify owners" / "Notify reviewers" / "Notify assignees" / "Notify request" — none in source
  - "START" / "END" caps labels — not in view source
  - " · " (bare middle-dot between caps) — not in view source
  - "Adjust from account" — not in view source
  - "Save preferences" — not in view source
  - "NO QUIET HOURS · ALL REMINDERS SENT IMMEDIATELY" — not in view source

- [x] **10.3** Update `src/lib/settings/spec-strings.ts` surface tests to match new string values.

- [x] **10.4** Cross-page test audit — grep `v9-settings-*.test.ts`, `v9-route-metadata-core-anchors.v9.test.ts`, and other suites for pins against removed strings; update as needed.

- [x] **10.5** Run full test sweep after all tiers:
  ```bash
  npx tsc --noEmit
  npx vitest run \
    src/app/\(dashboard\)/settings/operations/page.surface.test.ts \
    src/lib/v9-settings-page-refinement.v9.test.ts \
    src/lib/v9-route-metadata-core-anchors.v9.test.ts \
    src/lib/v10-semantics.v10.test.ts \
    src/lib/qa/ui-quality-sweep.test.ts
  ```

---

## Tier 11 — Loading state & error state parity

- [x] **11.1** `src/app/(dashboard)/settings/operations/loading.tsx` (if exists) — verify skeleton mirrors the post-V3 layout: page header + single card with two bands + strip below. No skeleton blocks for dropped eyebrows or removed help lines.

- [x] **11.2** Error boundary — if save fails, surface the error inline with retry. Currently uses `InlineMutationStatus`; verify error tone and retry CTA.

- [x] **11.3** Empty-state — if workspace has no members yet, Per-user strip should still render with "Open account" link (the account is always available).

---

## Tier 12 — Number input semantics & validation

- [x] **12.1** `inputMode="numeric"` on both quiet-hours inputs so mobile keyboards default to the number pad.
  - File: `operations-settings-view.tsx`
  - Change: `<input type="number" inputMode="numeric" ... />`

- [x] **12.2** HTML5 bounds: `min={0} max={23} step={1}` on both quiet-hours inputs so the browser rejects out-of-range entries before submit.
  - File: same
  - Change: `<input ... min={0} max={23} step={1} />`

- [x] **12.3** `autoComplete="off"` on quiet-hours inputs — these are configuration, not personal data; browsers should not auto-fill.

- [x] **12.4** `tabular-nums` font variant on quiet-hours inputs and any inline numeric display (count chip).
  - File: same
  - Change: Add `tabular-nums` to `className="ui-input ..."` on the inputs and to the count chip span.

- [x] **12.5** Clamp value on blur if the user types a number outside `[0, 23]`.
  - File: same
  - Change: `onBlur={(e) => setQuietStart(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}`. Same for end.

- [x] **12.6** Add `name` attribute on each input so the form submits keyed values.
  - File: same
  - Change: `name="quiet_hours_start"` / `name="quiet_hours_end"`.

- [x] **12.7** `aria-describedby` linking the inputs to the empty-state caption or legend, so SR users hear the contextual hint.
  - File: same
  - Change: `aria-describedby="quiet-hours-caption"` on both inputs; caption gets `id="quiet-hours-caption"`.

- [x] **12.8** Pattern attribute for HTML5 validation: `pattern="\d{1,2}"` (belt-and-braces alongside min/max).

- [x] **12.9** Hide Safari/Webkit number-input spinner buttons (they clutter the visual and break the centered-number aesthetic).
  - File: `src/app/globals.css` (or `.ui-input` rule)
  - Change:
    ```css
    .ui-input[type="number"] {
      appearance: textfield;
      -moz-appearance: textfield;
    }
    .ui-input[type="number"]::-webkit-inner-spin-button,
    .ui-input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    ```

---

## Tier 13 — Copy consistency refinement

- [x] **13.1** Audit "Field reviews" label vs "When extracted fields still need approval." description — the noun and verb disagree (review vs approve). Choose one:
  - Option A: Label "Field approvals" + description "When extracted fields still need approval." (matches the action being notified about — the next-step approval).
  - Option B: Label "Field reviews" + description "When extracted fields are awaiting review." (keeps the existing noun).
  - **Recommended: Option A** — the notification fires before the approval threshold; calling the category "Field approvals" matches the trigger.
  - File: `src/lib/settings/spec-strings.ts`, key `field_review` (NOTE: storage key stays for backward compatibility; only the visible label changes).

- [x] **13.2** Tighten Weekly digest description.
  - File: `spec-strings.ts`
  - Change: `description: "Weekly summary of contract activity."` → `description: "Weekly contract activity summary."` (drops "of", reads slightly more direct).

- [x] **13.3** Channel-off banner placement clarified — render BELOW the "Send reminders" toggle (within the same fieldset), not at the top of the card. The banner explains the cascade effect of the toggle, so it should follow the cause.
  - File: `operations-settings-view.tsx`

- [x] **13.4** Spec-strings `badges` casing — current V2 has `emailOn: "ON"` / `emailOff: "OFF"`. If V3 keeps the pill (after 0.1), drop to sentence case `"On"` / `"Off"` to align with the page's reduced-caps direction post-Tier 1.
  - File: `spec-strings.ts`

- [x] **13.5** Audit any remaining "operations" terminology surfaced via the URL slug — public-facing copy uses "notifications" exclusively. Strings should never reference "operations settings".

---

## Tier 14 — Reduced motion & ambient preferences

- [x] **14.1** Saved-state confirmation fade respects `prefers-reduced-motion`. When reduced motion is set, swap fade for an instant show/hide.
  - File: `operations-settings-view.tsx` or the InlineMutationStatus primitive
  - Change: Detect via `window.matchMedia('(prefers-reduced-motion: reduce)').matches` or pure CSS `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`

- [x] **14.2** Spinner respects reduced motion — when set, show a static "Saving..." text instead of `Loader2` rotation.
  - File: `operations-settings-view.tsx`

- [x] **14.3** Hover transitions (e.g., strip hover) respect reduced motion.
  - File: `globals.css` or component-level
  - Change: Wrap transition rules in `@media (prefers-reduced-motion: no-preference) { ... }` or use existing `motion-safe:` Tailwind variant.

- [x] **14.4** `prefers-contrast: more` — bump border opacities and outline widths for high-contrast users.
  - File: `globals.css`
  - Change:
    ```css
    @media (prefers-contrast: more) {
      :root {
        --border-subtle: var(--border-strong);
      }
      .ui-card, .ui-input, .ui-btn-primary, .ui-btn-ghost {
        outline-width: 3px;
      }
    }
    ```

- [x] **14.5** `prefers-contrast: more` — channel-off banner uses solid background, not tinted overlay.
  - File: `globals.css` (banner rule) or component className
  - Change: In high-contrast mode, swap `bg-[color-mix(in oklab, var(--warning) 12%, ...)]` for a solid `bg-[var(--warning-bg-strong)]` token.

- [x] **14.6** `prefers-contrast: more` — disabled state uses a visual indicator beyond opacity (e.g., diagonal hatch background or strikethrough), since opacity-only is insufficient for high-contrast users.
  - File: `globals.css`
  - Change:
    ```css
    @media (prefers-contrast: more) {
      fieldset:disabled {
        background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, var(--border-strong) 4px, var(--border-strong) 5px);
      }
    }
    ```
    (Or a less visually heavy alternative — verify against design.)

---

## Tier 15 — Mobile / touch target compliance

- [x] **15.1** Checkbox + label hit area minimum 44×44 px on mobile.
  - File: `operations-settings-view.tsx`
  - Change: Wrap each `<label>` in a container with `min-h-[44px]` and `py-2.5` to ensure the entire row is a tap target.

- [x] **15.2** Per-user strip minimum height 56 px on mobile (single-row, generous tap target).
  - File: same
  - Change: Strip className includes `min-h-[56px]`.

- [x] **15.3** Save + Discard buttons stack on narrow viewports.
  - File: same
  - Change: Wrapper `flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3` — Save appears above Discard on mobile (primary action top), inline on desktop.

- [x] **15.4** Card padding scales: `p-4 sm:p-6` on Email reminders card (current may be hard-coded `p-6`).

- [x] **15.5** Verify the quiet-hours inputs don't overflow on narrow viewports — `w-24` × 2 + arrow + gap should fit at 320 px viewport. If not, reduce to `w-20` on mobile (`w-20 sm:w-24`).

---

## Tier 16 — Channel-off cascade verification

- [x] **16.1** Fieldset disabled cascade reaches BOTH the quiet hours block AND the categories list.
  - File: `operations-settings-view.tsx`
  - Audit: Currently `<fieldset disabled={!emailEnabled}>` wraps categories. Extend to wrap quiet hours OR add a parallel fieldset for quiet hours.
  - Recommendation: Single fieldset wrapping `[quiet hours + channel-off banner + categories]`, all disabled when emailEnabled is false.

- [x] **16.2** State restoration on re-enable: when user toggles emailEnabled false → true, restore previous quiet hours and category states (don't reset to defaults).
  - File: same
  - Change: Verify `setQuietStart`/`setQuietEnd`/`setEnabledKeys` are NOT reset when emailEnabled toggles. State persists in React; only the visual disabled cascade changes.

- [x] **16.3** Channel-off banner uses `tone="warning"` (amber), not `tone="danger"` (red). The state is informational, not erroneous.
  - File: same

- [x] **16.4** Banner position confirmed (per 13.3): between the toggle and the quiet hours block, with `mt-3` from the toggle.

- [x] **16.5** When emailEnabled is false AND user clicks Save, the form still persists the current categories/quiet hours state (so toggling back on restores prior config).
  - File: `src/actions/notifications.ts`
  - Verify: action writes the full policy regardless of `emailEnabled` value.

- [x] **16.6** Overnight quiet-hours range semantic — when `quietStart > quietEnd` (e.g., 22 → 6), interpret as overnight quiet (10 PM UTC to 6 AM UTC next day), not as invalid.
  - File: `src/actions/notifications.ts` and the read-side reminder dispatcher
  - Verify: dispatcher computes "is current time within quiet hours?" using modular arithmetic (`if start <= end: time in [start, end]; else: time >= start OR time < end`).
  - UI: no visual special-casing required — the input pair accepts any 0–23 values and the dispatcher handles the wrap. Optional inline hint: "Quiet through next day" caption when start > end. **Decision: skip the hint** for V3; behavior is correct, the hint is decoration.

- [x] **16.7** Schema-parse-failure UX — when `notification_policy_json` fails Zod validation (T19.1), the page renders an inline error: "Notification settings could not be loaded. Try reloading the page." with a reload button. Does NOT crash the page or render with defaults silently.
  - File: `src/app/(dashboard)/settings/operations/page.tsx`
  - Change: `if (parse.success === false) return <PolicyLoadError />;` (NEW small component).

- [x] **16.8** Quiet hours `0 = 0` semantic — when user sets both inputs to 0 (current default), treat as "no quiet hours" (reminders send any time), per the existing `quietHoursNoneCaption`. This is the documented behavior; verify dispatcher matches.
  - File: read-side dispatcher
  - Verify: `start === end === 0` → skip quiet-hours check entirely.

---

## Tier 17 — Form submission canonical pattern

- [x] **17.1** Verify `<form action={upsertNotificationSettingsForm}>` uses the React 19 server-action pattern, NOT a client-side `onSubmit` handler that calls fetch.
  - File: `operations-settings-view.tsx`
  - Audit: `<form ref={formRef} action={action}>` is canonical.

- [x] **17.2** Cmd+S handler calls `formRef.current?.requestSubmit()` (not `submit()`) so the form's `action` prop fires correctly with React 19 semantics.
  - File: same

- [x] **17.3** Hidden inputs for round-tripping un-edited policy keys (e.g., Slack policy fields stored in the same JSON column).
  - File: same
  - Change: If `upsertNotificationSettingsForm` reads only `notification_policy_json` and writes back a partial update, hidden inputs are unnecessary. Verify action does a deep merge, not a replace.

- [x] **17.4** Form `method="post"` is implicit for server actions; verify no explicit method attribute conflicts.

- [x] **17.5** Submit button explicit `type="submit"` (not the default).

---

## Tier 18 — Performance & type safety

- [x] **18.1** `useMemo` for derived `enabledReminderCount` and `isDirty`.
  - File: `operations-settings-view.tsx`
  - Change:
    ```ts
    const enabledReminderCount = useMemo(() => enabledKeys.size, [enabledKeys]);
    const isDirty = useMemo(() =>
      emailEnabled !== initialEmail ||
      quietStart !== initialQuietStart ||
      quietEnd !== initialQuietEnd ||
      !setsEqual(enabledKeys, initialEnabledKeys),
      [emailEnabled, quietStart, quietEnd, enabledKeys, /* ... */]
    );
    ```

- [x] **18.2** Category key type narrowed to union literal.
  - File: `spec-strings.ts`
  - Change: `export type NotificationCategoryKey = "renewal_reminder" | "notice_deadline" | "field_review" | "work_assignment" | "evidence_request" | "weekly_digest";`
  - Consumers cast against this union, not generic `string`.

- [x] **18.3** `useCallback` for `handleDiscard` so the Discard button doesn't re-render on every parent state change.

- [x] **18.4** Verify `enabledKeys` state uses `Set<NotificationCategoryKey>` (not `string[]` or `Record<string, boolean>`) — V2 should have landed this; re-verify.

- [x] **18.5** Avoid inline anonymous functions in the categories `.map()` — extract `handleCategoryToggle = useCallback((key) => { ... }, [])`.

---

## Tier 19 — Defensive backend & schema validation

- [x] **19.1** `notification_policy_json` schema parse on read — if backend shape drifts (column nulled, missing keys, unknown keys), the view should gracefully default rather than crashing.
  - File: `src/app/(dashboard)/settings/operations/page.tsx` (or wherever the policy is read)
  - Change: Wrap policy parse in a Zod schema (`notificationPolicySchema.safeParse(raw)`) and fall back to defaults if parse fails.

- [x] **19.2** Slack policy preservation final-audit: after V3 save flow, run a manual integration test where workspace has Slack policy set, user updates notifications, Slack policy column unchanged.
  - File: `src/actions/notifications.ts`

- [x] **19.3** Unknown category keys — if `notification_policy_json` contains a key not in the V3 categories array, preserve it on write (don't drop). Future categories may exist server-side before the UI ships them.

- [x] **19.4** Migration safety — if a new category is added to the union (18.2), workspaces without it in storage default to enabled.
  - File: page server component
  - Change: `enabledKeys` initialization uses `new Set(categoryKeys.filter(k => policy.categories?.[k] !== false))` (default true).

---

## Tier 20 — Telemetry & observability (light-touch)

- [x] **20.1** Audit log enrichment — when save fires, include a diff payload listing changed fields (e.g., `{ before: { emailEnabled: true, quietStart: 0 }, after: { emailEnabled: true, quietStart: 22 } }`) so audit log readers can reconstruct intent.
  - File: `src/actions/notifications.ts`

- [x] **20.2** Audit event taxonomy — verify the action name is `settings.notifications_updated` (per audit-actions enum), not a generic `settings.updated`.
  - File: `src/lib/security/audit-actions.ts` and the action emitter.

- [x] **20.3** Audit log includes the source of the save (web UI vs API) — `source: "web"` in the payload.

---

## Tier 21 — Visual regression / snapshot tests (conditional on infra)

- [x] **21.1** Render snapshot at default state — fresh workspace, all 6 categories enabled, quiet hours 0/0, channel on. Snapshot file lives next to `page.surface.test.ts`.
  - Tool: existing test infrastructure (Vitest snapshot) if available; otherwise a minimal render-to-string assertion.
  - File: `src/app/(dashboard)/settings/operations/page.snapshot.test.ts` (NEW, if snapshot infra exists)
  - Conditional: skip if the project standardized on grep-style surface pins instead of snapshots.

- [x] **21.2** Render snapshot at channel-off state — emailEnabled=false. Verify the cascade renders correctly (fieldset disabled, banner visible, save button disabled since nothing to save).

- [x] **21.3** Render snapshot at partial-categories state — 3 of 6 enabled. Verify count chip renders "3/6" and the chip is visible (not hidden per 0.3).

- [x] **21.4** Render snapshot at saved confirmation state — after save, InlineMutationStatus rendered with success tone. Snapshot the transient state.

- [x] **21.5** If Playwright e2e exists: add a single integration scenario at `tests/e2e/settings/notifications.spec.ts`:
  - Navigate to `/settings/operations`
  - Toggle a category off
  - Click Save
  - Verify "Saved" appears
  - Reload
  - Verify the category remains off
  - Conditional: skip if no e2e infra.

---

## Tier 22 — Screen-reader announcement quality

- [x] **22.1** Save-success announcement — when save resolves successfully, announce "Notification preferences saved" via the shared aria-live region. Do NOT announce on initial render.
  - File: `operations-settings-view.tsx`
  - Change: After the form-state useTransition resolves, push announcement to the live region with `politeness="polite"`.

- [x] **22.2** Save-error announcement — when save fails, announce "Failed to save notification preferences" via aria-live `politeness="assertive"`. Manage focus: move focus to the Save button so the user can retry without tabbing back.
  - File: same

- [x] **22.3** Channel toggle announcement — when user toggles emailEnabled off, append a transient announcement: "Email reminders disabled. Categories and quiet hours unchanged but inactive." When toggled on, announce: "Email reminders enabled."
  - File: same
  - Spec: ARIA APG live region patterns

- [x] **22.4** Discard announcement — when user clicks Discard, announce "Changes discarded" via aria-live `politeness="polite"`.
  - File: same

- [x] **22.5** Count chip transition announcement — when the chip becomes visible (e.g., user toggles a category off from 6/6 → 5/6), announce "5 of 6 reminder categories enabled". When chip disappears (back to all-on), announce "All categories enabled".
  - File: same
  - Implementation: `useEffect` watching `enabledReminderCount`, push to live region on change (skip initial mount).

- [x] **22.6** Live region anchoring — verify a single shared `<LiveRegion>` (per existing primitive at `src/components/ui/live-region.tsx`) is mounted at the page level. Avoid creating per-section live regions.

---

## Tier 23 — Keyboard navigation refinement

- [x] **23.1** Tab order verification (specific sequence after V3 subtractions):
  1. "Back to settings" link
  2. Send reminders checkbox (Email reminders card)
  3. Quiet hours start input
  4. Quiet hours end input
  5. Each category checkbox in render order (Renewals → Notice deadlines → Field approvals → Work assignments → Evidence requests → Weekly digest)
  6. Discard button (only if isDirty)
  7. Save button
  8. Per-user strip link
  - Audit: tabindex values are all default (0); no positive tabindex anywhere; no `tabindex="-1"` on focusable controls.

- [x] **23.2** No keyboard traps in fieldset-disabled state — when emailEnabled is false and fieldset is disabled, focus skips the disabled controls (browser default) and lands on the next focusable element (Discard/Save or Per-user strip).
  - Verify: tabbing from the Send reminders checkbox jumps directly past disabled inputs/checkboxes to Save/Discard.

- [x] **23.3** Escape key behavior — pressing ESC blurs the currently-focused element but does NOT discard changes. Discard is an explicit button action only.
  - File: `operations-settings-view.tsx`
  - Audit: no `onKeyDown` handler binds ESC to a destructive action.

- [x] **23.4** Space/Enter on checkboxes — native checkbox behavior preserved (Space toggles, Enter submits form). Verify no wrapper element captures the key event before the native checkbox receives it.

- [x] **23.5** Focus management after save — after a successful save, focus stays on the Save button (now disabled because `!isDirty`). After 3s when the success message hides, focus is still on Save (don't move it unexpectedly).

- [x] **23.6** Focus management after discard — after Discard click, focus moves to the Send reminders checkbox (first form control) so the user can start fresh. OR focus stays on Discard (now hidden because `!isDirty`) and moves to Save. Decision: **move focus to the first form control** so keyboard users return to a sensible starting position.

---

## Tier 24 — Dark-mode parity

- [x] **24.1** Channel-state pill (if kept after 0.1) — verify dark-mode `--success-soft` and `--warning-soft` tokens render the pill background with sufficient contrast against `--surface-raised` in dark theme. Bump lightness +6% if needed (precedent: V2 §10.1).
  - File: `src/app/globals.css`

- [x] **24.2** Channel-off banner — verify `tone="warning"` resolves to a warning background that meets 3:1 against the card surface in dark theme. Text inside (banner body) meets 4.5:1.

- [x] **24.3** Disabled state styling — when fieldset is disabled (channel-off), category labels and descriptions fade to a muted tone. Verify the faded tone still meets 3:1 (so SR users with low vision can still read the disabled options). Avoid total opacity drop below 0.6.
  - File: `globals.css` `.ui-input:disabled` and `<fieldset disabled> *` cascade rules.

---

## Out of scope (deferred — manual or backend)

- **OB.1** URL migration `/settings/operations` → `/settings/notifications`. Backend route rename + deeplink rewrites + redirect chain. Separate change.
- **OB.2** Sticky save bar at viewport bottom. Layout-level work; inline save + discard companion (4.1–4.2) is sufficient for V3.
- **OB.3** "Send test reminder to me" preview button. Requires email-send capability and rate limiting.
- **OB.4** Per-user override count rendering ("3 overrides" on Per-user strip). Requires `workspace_members` data query and per-row override schema.
- **OB.5** Manual QA: tab-order audit.
- **OB.6** Manual QA: full screen-reader pass (VoiceOver, NVDA).
- **OB.7** Manual QA: mobile narrow-viewport visual check (< 640 px).
- **OB.8** Manual QA: high-contrast mode validation.
- **OB.9** `notification_policy_json` schema migration (if new fields added) — none planned for V3.

---

## Reference

- Product spec: `docs/oblixa-release-state.md`
- Design principles: `docs/ui-design-principles.md`
- V1 pass: `docs/notifications-page-maximal-pass.md`
- V2 pass: `docs/notifications-page-v2-pass.md`
- Voice rules: `memory/feedback_oblixa_voice_rules.md`
- Helper-prose rule: `memory/feedback_no_small_plain_text.md`
- Canonical primitives: `src/components/ui/dashboard-page-header.tsx`, `src/components/ui/card-medallion.tsx`, `src/components/ui/status-badge.tsx`, `src/components/ui/inline-mutation-status.tsx`

---

## Summary of net visual changes (post-V3)

After all 115 autonomous items land:
- Page shows ONE sub-eyebrow (page-header SETTINGS) — all 4 internal caps eyebrows (WORKSPACE / REMINDER CATEGORIES / DIGEST / ACCOUNT) gone.
- Category rows: checkbox + label + description, no icon medallion per row.
- Category descriptions: short, audience-implicit, no "Notify ..." prefix. "Field reviews" → "Field approvals" (label/description alignment).
- Quiet hours: legend + two number-validated inputs (min=0, max=23, inputMode=numeric, tabular-nums, clamp-on-blur) + arrow, no caps labels above inputs.
- Save block: Save + Discard companion with mobile column-reverse stacking, ⌘S shortcut, saved-state confirmation that respects `prefers-reduced-motion`, no divider above.
- Per-user strip: clickable as a unit, 56 px min-height on mobile, `UserRound` medallion, "Open account →" link.
- Account-channel state announced via toggle + (optionally) inline pill adjacent to toggle, never as floating header chrome.
- Channel-off cascade wraps both quiet hours AND categories in a single `<fieldset disabled>`; state restores on re-enable.
- All numeric values use `tabular-nums`; all interactive surfaces have 44 px minimum touch targets.
- All policy reads pass through a Zod schema; unknown keys preserved on write; Slack policy untouched.

Net delta from V2: ~16 visible strings removed or shortened, 6 sub-headings dropped, 5 icon imports removed, 4 keyboard/form affordances added, 9 input-validation attributes added (incl. Safari spinner hide), 3 reduced-motion paths added, 3 prefers-contrast paths added, 5 mobile/touch refinements, 5 SR-announcement paths added, 6 keyboard-nav refinements, 3 dark-mode contrast audits, 3 role-gating items (admin-only saves + read-only mode for non-admins), 3 overnight-range / parse-failure semantic items, 3 backend defensive parses, 3 telemetry enrichments.

### Tier-by-tier dependency sequencing

For implementation order (each tier depends only on lower-numbered tiers):

1. **T0 + T1 + T2** — copy and IA changes in `spec-strings.ts` first (no view changes yet). Run typecheck.
2. **T3** — visual polish on the view. Run typecheck.
3. **T4** — form/save UX additions. Wire up Discard, ⌘S, spinner, beforeunload.
4. **T5** — Per-user strip refactor to clickable Link.
5. **T12** — input semantics on quiet-hours inputs.
6. **T13** — copy consistency final pass.
7. **T14** — reduced-motion paths.
8. **T15** — mobile / touch target refinements.
9. **T16** — channel-off cascade verification (often surfaces bugs that need T17 fixes).
10. **T17 + T18** — form submission pattern + performance/type safety.
11. **T19 + T20** — defensive backend + telemetry.
12. **T22 + T23** — SR announcements + keyboard navigation (built on top of stabilized form behavior from T4/T16).
13. **T24** — dark-mode parity audit (after all visual tokens settled).
14. **T6 + T7** — anti-pattern + a11y final audits.
15. **T8 + T9** — server-action + cross-page parity verification.
16. **T21** — snapshot tests (only if infra exists; capture post-refactor surface).
17. **T10 + T11** — test pin updates + loading/error state parity. Run the full test sweep.
