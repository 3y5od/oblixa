# Core mode verification — traceability and preconditions

This artifact implements the **preconditions matrix**, **doc §1–2 / §20–30 inventory pointers**, **manual / CS residual** checklist, and **automated test mapping** for Core mode verification. It is maintained for QA and release sign-off; it does not replace [docs/workspace-modes-core-advanced-assurance.md](../workspace-modes-core-advanced-assurance.md).

## Preconditions matrix (record per run)

| Dimension | Values to exercise |
| --------- | ------------------- |
| Org `workspace_mode` | `core` (required for Core verification) |
| Plan / billing | trial vs paid (caps: contracts, members, export rows) |
| Roles | admin, editor, viewer, ops_manager, legal_reviewer, finance_reviewer, manager |
| Feature flags | v5/v6 flags on and off; Core must still hide or gate Advanced/Assurance primary chrome per policy |
| `search_scope` | `match_mode`, `core_only` (validate Cmd-K / href eligibility; Advanced org + `core_only` for phased rollout) |
| Seeds | contracts, review queue, tasks, obligations, approvals, renewals, exceptions, evidence, report packs, subscriptions, saved views, mentions, reminders |
| Locale / TZ | non-UTC; optional RTL pseudo-locale (see e2e/rtl-ime-pseudo-locale-smoke.spec.ts) |
| Browsers | Chromium baseline; WebKit/Firefox when running device matrix |

## Doc inventory (§1–2, §20–30) — pointers

Walk [docs/workspace-modes-core-advanced-assurance.md](../workspace-modes-core-advanced-assurance.md) TOC §1–2, §20–30 and tick each row against product behavior. Key automation anchors:

| Doc section | Primary code / tests |
| ----------- | --------------------- |
| §1 Glossary | [src/lib/product-surface/types.ts](../../src/lib/product-surface/types.ts), context builder |
| §2 Mental model | Nav copy, dashboard blocks |
| §3 Plans / roles | [src/lib/navigation.ts](../../src/lib/navigation.ts), org billing UI |
| §20 Phased rollout | `search_scope`, nav role customization |
| §21–22 Semantics / empty states | Route guard, E2E authenticated.spec refinement |
| §23 Style guide Core | Marketing + dashboard strings (manual / content QA) |
| §24 FAQ | CS macros vs UI (manual parity) |
| §25 Role × mode | [nav-visibility.ts](../../src/lib/product-surface/nav-visibility.ts), refinement tests |
| §26–27 Sales / module labels | Settings product page |
| §28 Microcopy | Renewals / Slack integration copy |
| §29 Calibration | [src/lib/onboarding/calibration-map.ts](../../src/lib/onboarding/calibration-map.ts), `*.golden.test.ts` |
| §30 Summary | Cross-check after pass |

## Automated coverage map (Core-relevant)

| Area | Vitest / command |
| ---- | ---------------- |
| Product surface | `npx vitest run src/lib/product-surface/` |
| Dashboard gating | `npx vitest run src/app/(dashboard)/dashboard/dashboard-advanced-data-gating.test.ts` |
| Report packs API | `npx vitest run src/app/api/report-packs/` |
| Export / workspace mode | `npx vitest run src/app/api/export/contracts/route.test.ts` |
| V10 visibility | `npx vitest run src/lib/v10-visibility.v10.test.ts` |
| API workspace guard | `npx vitest run src/lib/product-surface/api-workspace-guard.test.ts` |
| Email degrade Core | `npx vitest run src/lib/email-workspace-degrade.test.ts` |
| New workspace defaults | `npx vitest run src/lib/supabase/new-workspace-defaults.test.ts` |
| Sidebar Core | `npx vitest run src/components/layout/sidebar.ui.test.tsx` |
| Navigation refinement | `npx vitest run src/lib/navigation.refinement.test.ts` |
| Landing / workflow | `npx vitest run src/lib/product-surface/landing-eligibility.test.ts` `src/lib/product-surface/workflow-destinations.test.ts` |
| Utility vs registry | `npx vitest run src/lib/product-surface/utility-surface.test.ts` `src/lib/product-surface/core-utility-layout-parity.test.ts` |
| Route inventory drift | `npm run check:route-inventory` |
| Semgrep V8 surface | `semgrep --config semgrep/oblixa-v8-surface.yml src/app/(dashboard)/layout.tsx` (or Docker `returntocorp/semgrep`); dashboard rule accepts `assertPagePathEligibleForContextOrNotFound` and legacy `assertPagePathEligibleOrNotFound` |

## E2E (when `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` set)

| Suite | Command |
| ----- | ------- |
| Core smoke | `npm run test:e2e:smoke` (V10 work hub: expand **Source queue diagnostics** before asserting **Review approvals** — links live in `<details>`) |
| Authenticated refinement | `npx playwright test e2e/authenticated.spec.ts` (requires `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; skipped in agent run when unset) |
| URL adversarial | `npm run test:e2e:adversarial` |
| A11y keyboard Cmd-K | `npx playwright test e2e/a11y.keyboard.spec.ts` |

Authenticated matrix expects **admin** user on Core for §10.4 utility URLs in A11y paths (or paths skip on redirect — see E2E implementation).

## Manual-only residual (human sign-off)

- Dashboard visual order and block density (Core).
- Marketing / first-load copy §22.1.
- FAQ §24 live product parity for CS.
- Print / PWA / clipboard tiers if not run in CI (defer with ticket).

## CS / Sales — FAQ §24 quick parity

Ensure in-app and help center text match doc answers for: Campaigns on Core, Assurance location, Autopilot visibility vs mutation, email/report pause on downgrade, search opens unroutable page, Persona on Core for restricted roles, Assurance preview, Evidence vs Assurance.
