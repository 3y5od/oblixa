# V10 spec trace matrix (P0 → P1 → P2)

High-level map from `docs/v10.md` to typed contracts and primary implementation surfaces. P2 items ship only where `V10_RELEASE_PRIORITY_TIERS` marks them as shipped P2.

| Spec area | Tier | Primary contracts / libs | Primary UI / routes |
|-----------|------|---------------------------|----------------------|
| §1 Release contract | P0 | `src/lib/v10-release-contract.ts`, `v10-release-evidence.ts` | CI: `check:v10-*`, `pipeline:verify` |
| §2 Evidence / fixtures | P0 | `v10-release-evidence.ts`, `v10-objective-measurements.ts` | Settings / health, cron evidence |
| §3 Governance & privacy | P0 | `v10-governance.ts`, `v10-hardening-contracts.ts`, `product-surface-settings.ts` | `settings/product`, API guards |
| §4.1 Activation | P0 | `v10-activation-state.ts`, import actions | Dashboard, import flows |
| §4.2 Work | P0 | `v10-read-models.ts` (`work_items`), `tasks.ts`, `v10-work-semantics.ts` | `work/page.tsx` |
| §4.3 Home | P0 | Dashboard data libs, read models | `dashboard/page.tsx`, operational cards |
| §4.4 Contract record | P0 | `v10-contract-health.ts`, next-action order in release contract | `contracts/[id]/page.tsx` |
| §4.5 Review / fields | P0 | Field states in release contract, `contracts.ts` | Contract review surfaces |
| §4.6 Renewals | P0 | `v10-renewal-posture.ts`, renewals API | `contracts/renewals` |
| §4.7 Evidence | P0 | `v10-evidence-collaboration.ts`, `api/evidence/*` | Evidence studio, submit route |
| §4.8 Approvals / exceptions | P0 | Approvals/exceptions actions, mutations catalog | Approvals, exceptions pages |
| §4.9 Command palette | P0 / P1 | `command-palette.tsx`, `api/command-palette/*` | Core + Adv/Ass domains in registry |
| §4.10 Reports / exports | P0 | `v10-report-export.ts`, export/report routes | Reports, export jobs |
| §4.11 Relationships | P1 | Relationship workspace components | Counterparty / account pages |
| §4.12 Advanced / Assurance | P1 | `v10-advanced-assurance-continuity.ts` | Decisions, assurance routes |
| §4.13 Settings / health | P0 | `settings/health`, product surface | Health dashboard |
| §4.14 Jobs / notifications | P0 / P1 | `v10-job-visibility.ts`, notification classes in contract | Job surfaces, settings |
| §4.15 Telemetry / objectives | P0 | `product-telemetry.ts`, `v10-objective-telemetry.ts` | Server actions, cron metrics |
| §4.16 A11y / perf | P0 | `v10-ui-state-contracts.ts`, route API catalog perf | Recoverable UI, E2E matrix |
| §5 Data contracts | P0 | `v10-release-contract.ts` §5 tables, migrations `057_*` | `v10-data-contracts.v10.test.ts` |
| §6 Acceptance gates | P0 | `V10_ACCEPTANCE_GATES`, section6 gate tests | Vitest `*section6*`, `check:v10-suite` |
| §7–8 Ops / continuity | P0 / P1 | `v10-operational-contracts.ts`, runbooks in release evidence | Ops docs, RC evidence |

**Unclassified §4 bullets:** track via `v10-implementation-checklist.ts` and `v10-final-gap-audit.ts` test suites; promote to this table when tied to a concrete route or lib.

**Maintenance:** When adding a new `V10_REQUIRED_READ_MODEL_KEYS` or `V10_MUTATION_CATALOG` entry, extend this table in the same PR.
