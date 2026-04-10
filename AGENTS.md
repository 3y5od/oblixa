<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Security checklist for new API routes

- **Full rubric:** See [docs/SECURITY_PASS_CHECKLIST.md](docs/SECURITY_PASS_CHECKLIST.md) (A–U: threat model, authz, crons, webhooks, CSP, dependencies, IR, etc.).

- **Auth:** `src/proxy.ts` does not protect `/api/*`. Every `route.ts` must authenticate (session, cron secret, capability token, etc.) and return 401/403 when appropriate.
- **Service role:** `createAdminClient()` bypasses RLS. Every query/mutation must filter by `organization_id` (or equivalent tenancy) from server-derived context—never trust client-supplied org IDs for authorization.
- **Inbound automation:** Use `isInboundAutomationAuthorized` from `src/lib/security/inbound-automation-token.ts` for Slack/email/integration callback routes; optional per-route env vars are documented in `.env.example`.
- **Regression tests:** Add or extend route tests for auth failures and, for org-scoped handlers, consider assertions in `src/app/api/security-org-scope-queries.test.ts` (or route-local tests) so IDOR-style regressions are caught in CI. New `route.ts` files should have a colocated `route.test.ts` or an entry in `scripts/api-route-test-allowlist.txt` if covered by a bundled test file.

## Operational UI (dashboard surfaces)

- **Primitives:** `src/lib/ui/operational-surface.ts` (tones, shell classes) and `src/components/ui/operational-summary-card.tsx` (`OperationalSummaryCard`, `OperationalSurfaceLinkCard`, `OperationalQueueRow`, `OperationalSectionHeader`, `OperationalMetricChip`).
- **Sections:** Use `ui-eyebrow` + `ui-section-title` (major sections may use `text-xl` on the title). At most one short `ui-muted-tight` line of supporting copy. Avoid “Why:” explanatory prose in queue rows; state the operational fact directly.
- **Metrics:** Prefer `OperationalSummaryCard` (use `variant="compact"` in dense grids). Put secondary facts in `OperationalMetricChip` rows or `breakdown`, not dot-joined sentences.
- **Hubs / shortcuts:** Use `OperationalSurfaceLinkCard` with an explicit action label (“View…”, “Open…”).
- **Tone:** Derive `OperationalTone` from real counts, severity, SLA breach, or failed runs—not decorative badges.
- **Auth / marketing / external token pages:** Keep shared radii and `ui-input` / `ui-card` tokens; do not use operational status badges unless tied to real server state.
- **Hygiene check:** `npm run audit:ui-operational` or `npm run audit:ui-operational:strict` (same as `npm run audit:ui-operational -- --strict`). The script flags, in `src/app/**/page.tsx` and `loading.tsx`: legacy `text-2xl font-semibold text-zinc-900` KPI tiles, `text-2xl` paired with `tabular-nums` on the same line, `Why:` prose in dashboard routes, and `<dd>` with `text-zinc-950` in `page.tsx` (hero-style description lists). It also flags `bg-white` in `src/components/layout/header.tsx` and `legal-footer.tsx` (Wave 2: use `bg-surface`). Prefer `OperationalSummaryCard` / `contract-hero-metrics` instead.
- **Focus:** Whole-card links and operational footer links use `ui-operational-focusable` (see `globals.css`). `ui-link` includes a visible `focus-visible` ring.

## Wave 2 UI (tokens, tables, modals, gates)

- **Surfaces:** Prefer `bg-canvas` for full-layout backdrops and `bg-surface` (or `ui-card` / `ui-panel`) for elevated panels. Dashboard route `page.tsx` files should not use raw `bg-white` for page chrome; use tokens. **`(dashboard)/layout.tsx`** applies **`.ui-page-stack`** to the main content wrapper so sibling sections share default vertical rhythm (pages may still use an inner `ui-page-stack` when they expose multiple top-level blocks). **`.ui-table-shell`** and **`.ui-toolbar`** use `border-[var(--border-subtle)]` and `bg-surface` (horizontal scroll lives on the shell).
- **Empty lists:** Primary queues/tables should use **`EmptyState`** (or the same copy/action pattern) instead of only a muted table row.
- **Modals / overlays:** Escape closes; opening moves focus inside (first control); closing returns focus to the trigger (`delete-contract-button`, mobile nav drawer, command palette).
- **Touch targets:** Dense filter chips and floating controls should meet at least ~40px hit area (`min-h-9`, padding) where feasible.
- **Heavy client blocks:** Use `next/dynamic` with `ssr: false` and a short loading line for large client-only visualizations (e.g. execution graph, health graph concentration).
- **SEO:** `(auth)/layout.tsx` and `external/layout.tsx` export default `metadata` (noindex). Root marketing metadata stays on `src/app/layout.tsx`.
- **E2E:** With `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`, `e2e/authenticated.spec.ts` runs Axe on a **matrix** of URLs after explicit `goto`, a **skip-link → `#main-content` focus** check, and a **390×844 viewport** smoke on `/dashboard`, `/contracts`, `/assurance/findings`, `/settings`, and `/reports` (document width overflow tolerance).
- **Visual regression:** Playwright screenshot baselines are **not** used in this repo (flaky across environments); rely on Axe + manual review. If that changes, document the baseline policy here.
