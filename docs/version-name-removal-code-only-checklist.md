# Version Name Removal Code-Only Checklist

This document describes what can be implemented autonomously in code to remove `v1`, `v2`, `v3`, and similar version names from the repository. It is a planning and review artifact only. Runtime code, build code, tests, and scripts must not read this file as configuration.

Current versioned naming inventory, from the repository ratchet after the latest SQL policy forward-migration blueprint pass, is:

- `14,072` version-token hits.
- `1,147` files containing at least one hit.
- `110` path-level hits, all currently classified as manual or compatibility-sensitive.
- Highest-volume labels remain concentrated in release evidence, compatibility, assurance, control-plane, and product-surface areas.

The objective is to reduce this to zero where code-only changes are safe, and to stage compatibility work for surfaces that cannot be renamed by code alone.

High-volume path buckets currently include:

| Bucket | Approximate path-hit count | Cleanup class |
| --- | ---: | --- |
| `src/app/api` | 69 | Compatibility-sensitive API and cron routes |
| `src/lib/current/release/read-model clusters` | 0 | Safe local batch completed for reviewed current-release module paths |
| Legacy telemetry shim | 1 | Compatibility re-export retained; implementation moved to neutral assurance module |
| Decision-intelligence internal directory | 0 | Safe internal directory batch completed |
| `src/lib/product-surface` | 0 | Safe product-surface path batch completed; remaining hits are content-only |
| `supabase/migrations` | 37 | Historical migration ledger and SQL object staging |
| `src/lib/v4` | 0 | Safe internal directory batch completed |
| `scripts` | 0 | Local tooling renamed; legacy package-script aliases remain queued |
| `src/lib/qa` | 0 | Safe local QA path batch completed; remaining hits are content-only |
| `e2e` | 0 | Local E2E specs renamed; remaining hits are content-only compatibility references |
| `src/components` | 0 | Safe component path batch completed; retained versioned names are symbol/content compatibility aliases |

Latest verified pass:

- Added `check:sql-policy-forward-migration-blueprint` and `write:sql-policy-forward-migration-blueprint` with `artifacts/supabase/sql-policy-forward-migration-blueprint.json` and `supabase/sql/policy-forward-migration-blueprint.sql`.
- The SQL policy forward-migration blueprint is generated from predicate-equivalence evidence, SQL policy alias readiness, neutral table-view alias evidence, SQL staging, verification SQL, security automation coverage, and the compatibility queue; it does not read this checklist as configuration.
- Blueprint coverage now covers all `33` retained SQL policy rows with future policy-capable target requirements, required linked-verification contexts, legacy/neutral policy identities, command/role metadata, normalized predicates, validation commands, owner/reason metadata, queue coverage, and manual follow-up.
- Generated policy forward-migration SQL is non-executing and deterministic: it emits per-policy future DDL placeholders as comments plus `select` statements only. It rejects executable policy/table DDL, grants, writes, backfills, and legacy removals.
- Forward-migration readiness still covers `75` staged SQL rows: `42` alias-added rows (`9` function wrappers plus `33` table views) and `33` policy rows blocked by neutral-view policy migration constraints, now requiring both predicate-equivalence and blueprint coverage with `0` issues.
- Final checklist reconciliation now classifies `9` checklist objective families: `5` code-only-complete families, `1` retained-legacy blocked family, `1` forward-migration family, `1` external-or-production cutover family, and `1` final-zero blocked family, with `0` issues.
- Refreshed drifted deterministic artifacts only through explicit `write:*` commands: SQL policy forward-migration blueprint, forward-migration readiness, local content rewrite manifest, code-only closure, remaining-local contract closure, unchecked-objective readiness, final checklist reconciliation, and versioned naming baseline/removal queue.
- Registered the new artifact and generated SQL output in generated artifact hygiene and baseline ownership, and wired the new check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and the comprehensive security pipeline.
- Verified with focused `node --test` for SQL policy forward-migration blueprint, forward-migration readiness, final reconciliation, generated artifact hygiene, hardening wiring, pipeline wiring, change-impact, production evidence, and PR summary tests, plus read-only SQL/readiness/artifact wiring checks.
- Did not create neutral RLS policies, duplicate legacy policies, remove legacy SQL policies, apply migrations to production, run linked Supabase verification, remove legacy package-script aliases, public/API/cron routes, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, or production environment keys.

Previous SQL table-view alias pass:

- Added forward-only migration `089_sql_neutral_table_view_aliases.sql` to stage neutral read-only compatibility views for the `33` staged data-bearing SQL table rows.
- Each neutral table view uses `security_invoker = true`, delegates to the retained legacy table, revokes public access, and preserves the current grant boundary: `32` member-readable aliases grant `select` to `authenticated` and `service_role`, while `mutation_idempotency` grants `select` only to `service_role`.
- Added `check:sql-neutral-table-view-aliases` and `write:sql-neutral-table-view-aliases` with `artifacts/supabase/sql-neutral-table-view-aliases.json`; the artifact reports `33` table aliases, `32` member-readable aliases, `1` service-role-only alias, and `0` issues.
- Updated SQL object staging, SQL verification SQL, SQL security automation coverage, compatibility removal queue, migration manifest, migration organization, Supabase fingerprint, forward-migration readiness, unchecked-objective readiness, code-only closure, and final checklist reconciliation artifacts only through explicit `write:*` commands.
- Forward-migration readiness covered `75` staged SQL rows: `42` alias-added rows (`9` function wrappers plus `33` table views) and `33` policy rows blocked on predicate-equivalence migration and linked verification, with `0` issues.
- Registered the new artifact in generated artifact hygiene and baseline ownership, and wired the new check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and the comprehensive security pipeline.
- Verified with focused `node --test` for SQL table-view alias generation/safety and wiring tests, plus SQL staging, forward-migration readiness, final reconciliation, compatibility queue, artifact hygiene, hardening wiring, change-impact, production evidence, and PR summary checks.
- Did not remove legacy package-script aliases, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, production environment keys, duplicate SQL policies, apply migrations to production, or run linked Supabase verification.

Previous forward-migration readiness and final reconciliation pass:

- Added `check:versioned-forward-migration-readiness` and `write:versioned-forward-migration-readiness` with `artifacts/compatibility/versioned-forward-migration-readiness.json`.
- The forward-migration readiness artifact is generated from SQL object staging, SQL verification SQL, SQL security automation coverage, compatibility queue, migration manifest/domain/fingerprint artifacts, and public runtime readiness; it does not read this checklist as configuration.
- Forward-migration readiness now covers `75` staged SQL rows: `9` alias-added functions, `33` data-bearing table/view rows blocked on safe backfill or table/view alias migration, and `33` policy rows blocked on predicate-equivalence migration and linked verification, with `0` issues.
- Added `check:versioned-final-checklist-reconciliation` and `write:versioned-final-checklist-reconciliation` with `artifacts/compatibility/versioned-final-checklist-reconciliation.json`.
- The final checklist reconciliation artifact is generated from code-owned objective taxonomy plus current closure/readiness artifacts, queues, allowlists, SQL staging, public runtime readiness, and package-script readiness; it does not read this checklist as configuration.
- Final reconciliation now classifies `7` checklist objective families: `3` code-only-complete families, `1` retained-legacy blocked family, `1` forward-migration family, `1` external-or-production cutover family, and `1` final-zero blocked family, with `0` issues.
- Registered both new artifacts in generated artifact hygiene and baseline ownership.
- Wired both new checks into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Verified with focused `node --test` for the new readiness/reconciliation scripts and wiring tests, plus versioned-name, SQL staging, compatibility queue, artifact hygiene, hardening wiring, change-impact, production evidence, and PR summary checks.
- Did not remove legacy package-script aliases, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, production environment keys, or apply linked/production Supabase changes.

Previous public runtime and SQL function alias pass:

- Added `check:versioned-public-runtime-dual-read` and `write:versioned-public-runtime-dual-read` with `artifacts/compatibility/versioned-public-runtime-dual-read.json`.
- The public runtime dual-read artifact is generated from route inventory, OpenAPI/PWA preservation checks, content contracts, queues, and allowlists; it does not read this checklist as configuration.
- Public runtime readiness now covers `6` public families: `2` dual-read-present route families and `4` queue-covered public/PWA metadata families, with `0` issues.
- Added forward-only migration `088_sql_neutral_function_aliases.sql` to stage neutral wrappers for the `9` non-data-bearing SQL functions already listed in SQL rename staging. The migration keeps legacy functions available, preserves wrapper delegation, avoids table or policy aliases, and is not applied to production in this pass.
- Updated SQL reference, SQL rename staging, SQL verification SQL, SQL security automation, compatibility removal queue, code-only closure, unchecked-objective readiness, migration manifest, migration organization, Supabase fingerprint, and versioned naming artifacts only through explicit `write:*` commands.
- SQL staging now covers `75` rows with `9` function aliases marked `alias_added`; the `33` table entries and `33` policy entries remain forward-migration or linked-verification work.
- The unchecked-objective readiness artifact now reports `4` implemented families, `1` alias-ready family, `1` queue-covered public runtime family, `1` forward-migration boundary, `2` external-or-production cutover boundaries, `0` remaining safe actions, and `0` issues.
- Wired the new public runtime dual-read check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Verified with focused `node --test` for the new readiness and SQL alias safety scripts, SQL/staging checks, versioned-name/compatibility/preservation/artifact checks, and migration artifact checks.
- Did not remove legacy package-script aliases, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, production environment keys, or apply linked/production Supabase changes.

Previous unchecked-objective readiness pass:

- Added `check:versioned-unchecked-objective-readiness` and `write:versioned-unchecked-objective-readiness` with `artifacts/compatibility/versioned-unchecked-objective-readiness.json`.
- The unchecked-objective readiness artifact is generated from code-owned taxonomy plus current inventories, queues, allowlists, SQL staging, route/OpenAPI/PWA checks, additive-alias preservation, code-only closure, and local-surface regression artifacts; it does not read this checklist as configuration.
- The readiness artifact classifies `9` still-unchecked code-only objective families as `implemented`, `queue_covered`, `alias_ready`, `requires_runtime_dual_read`, `requires_forward_migration`, or `requires_external_or_production_cutover`.
- Current readiness evidence reports `4` implemented families, `1` alias-ready family, `1` runtime-dual-read boundary, `1` forward-migration boundary, `2` external-or-production cutover boundaries, `0` remaining safe actions, and `0` issues.
- Wired the new readiness check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Refreshed drifted deterministic artifacts only through explicit `write:*` commands: unchecked-objective readiness, content contracts, local content rewrite manifest, package-script readiness, alias usage neutrality, open/code-only/remaining-local closure, and dependent versioned naming artifacts.
- Verified with focused `node --test` for the new readiness script and wiring tests, versioned-name/compatibility/preservation/artifact checks, and content coverage checks.
- Did not remove legacy package-script aliases, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, production environment keys, or apply linked/production Supabase changes.

Previous SQL/runtime alias pass:

- Added static local type coverage for the neutral organization settings compatibility view through `OrganizationSettingsCompatibilityViewRow` and `OrgSettingsStorageRow`; this does not claim production Supabase type generation.
- Routed the assurance autopilot page through the neutral `OrgSettingsPanel` component and `readOrgSettingsJsonFromRow(orgRow)` helper while retaining the legacy SQL column in the local select and write path.
- Kept `OrgV6SettingsPanel` as a compatibility alias for the neutral `OrgSettingsPanel` implementation.
- Extended `check:versioned-compatibility-equivalence` with org-settings runtime alias evidence proving neutral and legacy organization settings shapes resolve through the same reader, the page no longer directly reads the legacy column, and the retained component alias is present.
- Refreshed the versioned naming baseline to `13,600` hits and `1,140` files with `0` delta, `0` violations, and `0` reductions.
- Added forward-only migration `087_organization_settings_compatibility_view.sql`, which creates the neutral `public.organization_settings.org_settings_json` compatibility view over the retained `public.organizations.v6_org_settings_json` column with `security_invoker = true`.
- Added neutral-first runtime parsing for organization settings rows through `readOrgSettingsJsonFromRow`; existing legacy column reads and writes remain accepted, and no production migration was applied.
- Extended `check:versioned-additive-alias-preservation` and `artifacts/compatibility/versioned-additive-alias-preservation.json` to prove the SQL compatibility view exists, keeps the legacy seed write present, does not drop the legacy column, and has `1` covered SQL alias target with `0` issues.
- Refreshed affected deterministic artifacts only through explicit `write:*` commands, including versioned naming baseline/removal queue, SQL object reference inventory, content contracts, removal queues, local/remaining/detail/manual/code-only closure artifacts, neutral naming rules, and additive alias preservation artifacts.
- Verified with focused `node --test`, targeted `vitest run` for organization settings and onboarding calibration, SQL/staging checks, versioned-name/compatibility/artifact checks, `npm run typecheck`, and `npm run lint`.
- Did not remove legacy package-script aliases, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, production environment keys, or apply linked/production Supabase changes.

Previous remaining-local closure pass:

- Added `check:versioned-remaining-local-contract-closure` and `write:versioned-remaining-local-contract-closure` with `artifacts/compatibility/versioned-remaining-local-contract-closure.json`; it proves `10` remaining local contract objective families are classified with `8` coverage-proven families, `1` runtime-alias boundary, and `1` retained-legacy package-script boundary.
- Strengthened selector/accessibility equivalence tests for `RecoverableState` and `ContractEvidenceRequirementsPanel`; old and neutral selector attributes resolve to the same element without adding DOM ids, ARIA label references, or described-by references.
- Registered the remaining-local contract closure artifact and check in package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Refreshed drifted deterministic artifacts through explicit `write:*` commands only: local content rewrite manifest, code-only closure, and remaining-local contract closure.
- Verified the remaining-local contract closure pass with focused `node --test`, targeted `vitest run` for selector/accessibility compatibility, versioned-name/artifact checks, and the required hardening wiring tests.
- Did not remove legacy package-script aliases, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, PWA/public metadata names, style/copy keys, seed payload keys, or production environment keys.

Previous additive compatibility-readiness pass:

- Added `check:versioned-additive-alias-preservation` and `write:versioned-additive-alias-preservation` with `artifacts/compatibility/versioned-additive-alias-preservation.json`; it proves additive neutral aliases for the remaining code-owned selector/scanner surfaces covered in this pass.
- Added the neutral active Semgrep scanner pack `semgrep/oblixa-surface.yml` and rewired CI, SARIF generation, local Semgrep runners, release evidence checks, and security pipelines to use it; the old surface packs remain retained as inactive compatibility metadata for historical SARIF, suppressions, and dashboards.
- Added neutral DOM selector aliases alongside retained legacy attributes for `RecoverableState` and `ContractEvidenceRequirementsPanel`, covering `11` old/new selector pairs with targeted component/UI tests.
- Tightened Semgrep rulepack integrity so active rulepacks must be neutral, legacy rulepacks must remain present, and legacy rulepacks cannot be active in CI or SARIF workflows.
- Registered the additive-alias preservation artifact and check in package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Refreshed only drifted deterministic artifacts through explicit `write:*` commands: versioned naming baseline/removal queue, exported-symbol inventory, content-contract inventory, local content rewrite manifest, compatibility removal queue, content/remaining/detailed/manual/open coverage, local-surface regression, code-only closure, and additive-alias preservation.
- Verified the additive compatibility pass with focused `node --test`, targeted `vitest run` including UI config where required, `npm run check:semgrep-rulepack-integrity -- --strict`, versioned-name/compatibility/artifact checks, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- Did not add public PWA/metadata aliases, style-token aliases, copy-key aliases, seed payload dual-read behavior, production migrations, provider/dashboard changes, traffic/scheduler changes, secret rotation, or legacy public-name removals.

Previous verified pass highlights:

- Added `check:versioned-code-only-closure` and `write:versioned-code-only-closure` with `artifacts/compatibility/versioned-code-only-closure.json`; it proves `10` code-only objective families have closure evidence with `5` coverage-proven families, `1` retained-legacy blocked family, `1` runtime-alias dependent family, `1` forward-migration dependent family, and `2` external-or-production cutover dependent families.
- The code-only closure artifact reports `0` pending safe actions and `0` issues after aggregating safe rename, exported-symbol alias, local content rewrite, package-script readiness, alias-usage neutrality, env/flag alias, open-objective closure, compatibility-equivalence, and compatibility-removal queue evidence.
- Registered the closure artifact and check in package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Verified the closure pass with focused `node --test`, `npm run check:versioned-code-only-closure`, compatibility/versioned-name/artifact checks, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- Did not remove legacy package scripts, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, or production environment keys.

- Added `check:versioned-alias-usage-neutrality` and `write:versioned-alias-usage-neutrality` with `artifacts/compatibility/versioned-alias-usage-neutrality.json`; it covers `79` retained aliases, proves `79` queue-covered aliases, and reports `0` issues while preserving compatibility-sensitive legacy names.
- Added `check:versioned-env-flag-aliases` and `write:versioned-env-flag-aliases` with `artifacts/compatibility/versioned-env-flag-aliases.json`; it covers `22` neutral-first/legacy-second feature-flag aliases for `ENABLE_V3_*`, `ENABLE_V5_*`, and `ENABLE_V6_*`.
- Added neutral feature-flag env keys in runtime code and `.env.example`, with neutral-first precedence and legacy fallback for all covered feature flags.
- Renamed the remaining manifest-proven local app and API test filenames from versioned names to neutral names while leaving public route directories and runtime paths untouched.
- Extended alias equivalence and neutrality evidence across package-script aliases, exported symbols, telemetry metadata, env fallbacks, route metadata, SQL staging metadata, and legitimate-version preservation.
- Updated loading-contract files surfaced by the renamed tests so every dashboard loading boundary has status/live/busy semantics and the work/review skeleton contracts remain aligned.
- Refreshed deterministic artifacts only through explicit `write:*` commands, including versioned naming baseline/removal queue, safe rename manifest, content contracts, content coverage, local content rewrite manifest, compatibility removal queue, neutral naming rules, alias usage neutrality, and env flag aliases.
- Wired the new alias neutrality and env-flag alias checks into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, and the comprehensive security pipeline.
- Verified with focused `node --test`, targeted `vitest run`, `npm run typecheck`, `npm run lint`, versioned-name/compatibility/artifact checks, and `git diff --check`.
- Did not remove legacy package scripts, public/API/cron routes, SQL objects, telemetry persisted names, provider-facing names, or production environment keys.

Earlier verified pass highlights:

- Added `check:versioned-open-objective-closure` and `write:versioned-open-objective-closure` with `artifacts/compatibility/versioned-open-objective-closure.json`; it proves `10` open objective families are either coverage-proven, retained legacy blocked, runtime-alias dependent, or production/external-cutover dependent.
- Added read-only `check:versioned-compatibility-equivalence`; it verifies all `37` retained package-script aliases bridge to neutral commands, neutral commands do not call retained legacy aliases, exported-symbol compatibility aliases are present, telemetry/env/route/SQL staging metadata remains queue-covered, and legitimate version formats stay preserved.
- Added `check:versioned-local-surface-regression` and `write:versioned-local-surface-regression` with `artifacts/compatibility/versioned-local-surface-regression.json`; it covers local test tags, skip metadata, visual snapshot prefixes, fixture/evidence keys, DOM/test selectors, style tokens, copy/localization keys, QA registries, source-owned config ids, and static-analysis rule ids.
- Wired the open-objective closure, compatibility-equivalence, and local-surface-regression checks into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- Refreshed `artifacts/compatibility/versioned-open-objective-closure.json`, `artifacts/compatibility/versioned-local-surface-regression.json`, and drifted dependent content-contract artifacts only through explicit `write:*` commands.
- Added `check:versioned-export-download-contracts` and `write:versioned-export-download-contracts` with `artifacts/compatibility/versioned-export-download-contracts.json`.
- Export/download coverage now reports `171` contracts across CSV/PDF/report/content-disposition/signed-link/export-import categories, `109` manual-only contracts, `109` queue-covered manual contracts, and `0` remaining safe-action contracts.
- Added `check:sql-rename-verification-sql` and `write:sql-rename-verification-sql` with `artifacts/supabase/sql-rename-verification-sql.json`; it emits `75` read-only verification statements for `9` functions, `33` policies, and `33` tables from SQL rename staging.
- Added `check:sql-security-automation-coverage` and `write:sql-security-automation-coverage` with `artifacts/supabase/sql-security-automation-coverage.json`; it covers `63` SQL security automation rows with queue coverage for `9` function grants, `42` RLS policies, and `12` security helpers.
- Added `check:migration-history-version-exceptions` and `write:migration-history-version-exceptions` with `artifacts/supabase/migration-history-version-exceptions.json`; it classifies `37` versioned migration filenames as immutable ledger evidence with owner/reason metadata.
- Added `check:seed-versioned-name-queue-coverage` and `write:seed-versioned-name-queue-coverage` with `artifacts/supabase/seed-versioned-name-queue-coverage.json`; it confirms the retained seed versioned SQL key is manual-only and queue-covered.
- Switched repo-local callers of the legacy operational runbook artifact export to the neutral `OPS_ARTIFACT_RUNBOOK` export while keeping the legacy export as a compatibility alias.
- Refined export/download classification so persisted SQL fields, even in local test stubs, stay manual-only and queued rather than being treated as local rewrite candidates.
- Compatibility removal queue coverage now includes `1,486` content-contract alias entries, `171` export/download contract entries, `63` SQL security automation entries, `37` migration-history filename entries, and `1` seed versioned-name entry.
- Refreshed deterministic artifacts through explicit `write:*` commands only, including content contracts, content-surface coverage, remaining-surface coverage, detailed-objective coverage, manual-surface closure, export/download contracts, SQL verification SQL, SQL security automation coverage, migration-history exceptions, seed queue coverage, compatibility removal queue, neutral naming rules, and versioned naming baseline/removal queue.
- Added `check:versioned-package-script-readiness` and `write:versioned-package-script-readiness` with `artifacts/compatibility/versioned-package-script-readiness.json`.
- Package-script readiness now reports `37` retained legacy aliases, `0` ready for removal, `37` locally ready aliases still retained by policy, and `0` repo-local or documentation blocking references.
- Added `check:neutral-naming-rules` and `write:neutral-naming-rules` with `artifacts/compatibility/neutral-naming-rules.json`; the rule artifact currently covers `3,501` rename/queue candidates with `0` issues.
- Added `check:versioned-manual-surface-closure` and `write:versioned-manual-surface-closure` with `artifacts/compatibility/versioned-manual-surface-closure.json`.
- Manual surface closure now covers `16` manual families, with `12` coverage-proven families, `4` retained legacy families, `0` uncovered manual rows, and `0` remaining safe-action rows.
- Tightened `check:compatibility-removal-queue` so compatibility-sensitive current scanner rows depend on content-surface coverage and manual-surface closure evidence before the queue can pass.
- Wired the readiness, neutral-rule, and manual-closure checks into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary, generated artifact hygiene, the comprehensive security pipeline, and focused unit tests.
- Added `check:versioned-detailed-objective-coverage` and `write:versioned-detailed-objective-coverage` with `artifacts/compatibility/versioned-detailed-objective-coverage.json`.
- Added read-only `check:versioned-public-contract-preservation` and `check:versioned-source-config-preservation` for public metadata/PWA/OpenAPI/route alias preservation and source-owned config/scanner/supply-chain preservation.
- Proved `14` detailed objective families: `13` coverage-proven families plus the retained legacy package-script family with `37` aliases and `0` ready for removal.
- Expanded legitimate-version preservation metadata to `16` allowlist entries, including ASVS, SPDX, CycloneDX, SLSA, SARIF/VEX, Node/Postgres, BCP 47 locale tags, WCAG/CSS Color, Unicode/Intl, provider protocol/signature formats, cryptographic envelopes, and artifact schema versions.
- Current content-contract inventory reports `2,920` contracts, `13,468` hits, and `1,228` manual-only contracts; content-surface, remaining-surface, and detailed-objective coverage report `0` uncovered manual rows and `0` remaining safe-action rows.
- Compatibility removal queue coverage now includes `1,506` content-contract alias entries; package-script aliases remain callable because readiness evidence still shows manual follow-up is required.
- Wired the detailed/public/source-config checks into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary, the comprehensive security pipeline, generated artifact hygiene, and focused unit tests.
- Added `check:versioned-remaining-surface-coverage` and `write:versioned-remaining-surface-coverage` with `artifacts/compatibility/versioned-remaining-surface-coverage.json`.
- Proved `28` remaining completion-category surfaces have current queue, allowlist, validation-command, and manual-boundary evidence; the retained legacy package-script category remains explicitly blocked with `37` aliases and `0` ready for removal.
- Tightened legitimate-version preservation checks for fake cryptographic/provider/schema values: `enc:v1:`, `enc:v2:`, Slack `v0=`, Stripe `v1=`, provider `oauth.v2`, and generated artifact `schemaVersion`.
- Added local-content rewrite tests proving the cleanup tooling refuses cryptographic envelope prefixes, provider signatures, provider endpoint versions, and artifact schema version fields.
- Refreshed deterministic content and version artifacts after this pass through explicit write commands only: `write:versioned-content-contracts`, `write:versioned-local-content-rewrites`, `write:compatibility-removal-queue`, `write:versioned-content-surface-coverage`, `write:versioned-remaining-surface-coverage`, `write:versioned-naming-baseline`, and `write:versioned-naming-removal-queue`.
- Current remaining-surface coverage still reports `0` uncovered manual contracts and `0` remaining safe-action rows.
- Wired `check:versioned-remaining-surface-coverage` into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary, the comprehensive security pipeline, generated artifact hygiene, and focused unit tests.
- Reconciled deterministic drift from the removed `docs/current-release.md` artifact references by refreshing `scripts/versioned-naming-baseline.json`, `scripts/versioned-naming-removal-queue.json`, `artifacts/compatibility/versioned-content-contract-inventory.json`, `artifacts/compatibility/versioned-local-content-rewrite-manifest.json`, and `artifacts/compatibility/removal-queue.json` only through explicit `write:*` commands.
- Expanded content-contract classification with `44` concrete sub-surfaces and top-level owner, reason, `manualOnly`, removal strategy, validation command, suggested neutral name, and manual follow-up metadata for every row.
- Added `check:versioned-content-surface-coverage` and `write:versioned-content-surface-coverage` with `artifacts/compatibility/versioned-content-surface-coverage.json`.
- Verified content-surface coverage now reports `42` sub-surfaces, `2,904` contracts, `1,208` manual-only contracts, `0` uncovered manual contracts, and `0` remaining safe-action rows.
- Added `check:versioned-local-content-rewrites` and `write:versioned-local-content-rewrites` with `artifacts/compatibility/versioned-local-content-rewrite-manifest.json`.
- Applied the final manifest-proven safe local content title rewrite in `src/lib/per-db-index-migration.test.ts`; the local content rewrite manifest now reports `0` pending rewrites and `2,904` refused/manual rows.
- Tightened local content rewrite detection so fixture strings inside test files are not mistaken for executable test titles.
- Expanded compatibility removal queue coverage to `1,486` content-contract alias entries while keeping docs out of runtime/config semantics.
- Added package-script readiness status/blocker metadata and stale old-name checks to compatibility removal queues.
- Wired `check:versioned-local-content-rewrites` and `check:versioned-content-surface-coverage` into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary, and generated artifact hygiene.
- Applied `381` safe local rename-plan entries with `0` pending entries.
- Removed every remaining non-manual repo-local path-level version name found by the current scanner; remaining path hits are manual or compatibility-sensitive surfaces such as API routes, historical migrations, external contracts, and the legacy telemetry shim.
- Added `check:versioned-exported-symbol-aliases` and `write:versioned-exported-symbol-aliases` for deterministic neutral alias generation.
- Added neutral internal exports for every current non-manual, non-conflicting exported-symbol candidate while preserving deprecated compatibility aliases.
- Added a neutral assurance telemetry module and kept the legacy telemetry import path as a compatibility re-export.
- Added `check:versioned-exported-symbols` and `write:versioned-exported-symbols` with `artifacts/compatibility/versioned-exported-symbol-inventory.json`.
- Added `check:versioned-content-contracts` and `write:versioned-content-contracts` with `artifacts/compatibility/versioned-content-contract-inventory.json`.
- Exported-symbol inventory now reports `1,147` versioned symbols, `1,135` neutral aliases added, `0` alias candidates remaining, and `12` queue-only entries.
- Content-contract inventory now reports `2,920` contracts, `13,468` hits, and `1,228` manual-only contracts.
- Added neutral environment fallbacks for `DECISION_PACKET_BUCKET`, `NEXT_PUBLIC_SUPPORT_DIAGNOSTICS`, and `NEXT_PUBLIC_INLINE_QUEUE_ACTIONS` while keeping `V5_DECISION_PACKET_BUCKET`, `NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS`, and `NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS` readable as legacy compatibility keys.
- Expanded the compatibility removal queue with exported-symbol aliases, environment-key aliases, and content-contract aliases; current generated coverage includes `1,153` exported-symbol alias entries and `1,486` content-contract alias entries.
- Refreshed deterministic versioned naming, compatibility queue, route inventory, telemetry inventory, and SQL object artifacts only through explicit `write:*` commands.
- Wired the new checks into CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary, and generated artifact hygiene.
- Verified with targeted `node --test`, targeted `vitest run`, `npm run typecheck`, `npm run lint`, `npm run check:versioned-naming`, `npm run check:versioned-exported-symbol-aliases`, route/API/cron checks, artifact hygiene, baseline registry, hardening CI wiring, production evidence summary, PR summary, and final diff hygiene.
- Did not run linked production checks, apply production migrations, rotate secrets, change provider dashboards, change traffic, or remove legacy public names.

## Boundaries

Autonomous code-only work can:

- Rename local-only tests, fixtures, internal helpers, internal modules, scripts, and documentation.
- Update imports, package scripts, CI jobs, allowlists, baselines, generated artifacts, and reports.
- Add neutral aliases for package scripts, telemetry inputs, API routes, cron routes, SQL views/functions, and other compatibility-sensitive names.
- Add migrations that stage database aliases or compatibility views for later production application.
- Add checks that fail when new versioned names are introduced.
- Generate deterministic reports and removal queues.

Autonomous code-only work cannot:

- Apply migrations to production.
- Remove production-facing database objects that may already exist.
- Remove public API paths, cron URLs, webhook URLs, telemetry event names, or provider callback paths without a compatibility window.
- Update production scheduler/provider/dashboard configuration.
- Claim production consumers have migrated without linked read-only evidence.
- Rewrite historical migration ledger state in production.

## Completion Definition

- [x] `npm run check:versioned-naming` has a zero-target mode or an explicit staged baseline for remaining compatibility-sensitive debt.
- [x] No local-only versioned filenames remain.
- [ ] No local-only versioned package script names remain.
- [x] No package metadata key, package export/import alias, package binary name, workspace name, TypeScript path alias, or test/build resolver alias contains a product version label unless compatibility queued.
- [x] No SBOM component alias, provenance subject, attestation predicate id, release artifact provenance key, license allowlist id, or supply-chain waiver id contains a product version label unless classified as a legitimate ecosystem version.
- [x] No local-only versioned E2E test tags remain for the renamed compatibility/current-product Playwright batch.
- [x] No local-only versioned environment variable names remain without neutral aliases in the current content-contract inventory scope.
- [x] No authorization role helper, capability key, feature-family key, entitlement boundary, workspace-mode setting, or plan-gate identifier contains a product version label unless compatibility queued.
- [x] No billing provider catalog key, product lookup key, price lookup key, checkout metadata key, subscription status mapping, invoice metadata key, or payment entitlement mapping contains a product version label unless compatibility queued.
- [x] No local-only versioned CI job names, workflow labels, or matrix variables remain for the renamed local script/E2E batch.
- [x] No deployment/runtime config resource name, Sentry release label, source-map upload label, container/compose resource name, or build artifact name contains a product version label unless classified.
- [x] No internal-only source module names contain version labels.
- [x] No public token prefix, signed-link scope marker, invite/callback state key, OAuth state parameter key, or external-action token contract contains a product version label unless compatibility queued.
- [x] No frontend page route segment, navigation href, redirect target, rewrite source/target, deep-link destination, route-state key, or hash-anchor contract contains a product version label unless compatibility queued.
- [x] No edge proxy matcher, middleware policy key, unauthenticated path policy entry, safe-redirect parameter, auth handshake header, correlation header, or proxy evidence key contains a product version label unless compatibility queued.
- [x] No third-party integration connector id, provider account mapping key, sync cursor key, external record mapping key, or connector field alias contains a product version label unless compatibility queued or classified as a provider protocol version.
- [x] No audit action enum, security event type, evidence key, release evidence id, compliance evidence id, audit detail JSON key, or governance evidence artifact contains a product version label unless compatibility queued or classified as immutable historical evidence.
- [x] No exported TypeScript symbol or barrel export contains a product version label unless it is a documented compatibility alias or queue-only retained name.
- [x] No internal-only diagnostic IDs, response headers, or problem codes contain version labels.
- [x] No browser security-policy directive value, Trusted Types policy name, reporting endpoint group, CSP report field, or browser-isolation rollout key contains a product version label unless classified as a standards or browser API version.
- [x] No internal-only operational keys, cache keys, rate-limit keys, lock keys, hash anchors, or model-version strings contain version labels.
- [x] No async queue name, worker class, job payload schema, retry outcome, dead-letter key, lease key, job visibility field, or poison-message classification contains a product version label unless compatibility queued.
- [x] No browser-persisted storage key, cookie name, service-worker cache name, cross-tab channel name, `postMessage` event type, or URL state key contains a product version label unless compatibility queued.
- [x] No storage bucket name, object-path prefix, artifact key, or artifact-kind literal contains a product version label unless it is compatibility queued.
- [x] No API payload field, response envelope marker, persisted JSON key, metric name, SLO dashboard key, alert identifier, DOM data attribute, DOM id, ARIA attribute, or test selector contains a product version label unless it is compatibility queued.
- [x] No SSE event name, stream route id, realtime channel name, WebSocket topic, broadcast topic, subscription filter key, presence key, or stream heartbeat/error code contains a product version label unless compatibility queued or protocol-owned.
- [x] No server action export name, form action id, `FormData` field name, hidden input name, submitter value, action-state key, validation error key, or mutation result envelope contains a product version label unless compatibility queued.
- [x] No OpenAPI component, JSON Schema `$id` or `$ref`, schema registry key, generated client type, generated SDK helper, or Zod-derived public contract contains a product version label unless compatibility queued.
- [x] No inbound import template id, parser field alias, upload metadata key, import job status, row error code, dedupe key, or field-mapping preset contains a product version label unless compatibility queued.
- [x] No domain workflow state, transition id, rule-engine key, policy DSL schema, playbook seed marker, or state-machine registry key contains a product version label unless compatibility queued or classified as legitimate customer/domain versioning.
- [x] No design token, CSS custom property, theme key, semantic color token, theme metadata field, or style-system registry entry contains a product version label unless it is compatibility queued.
- [x] No command palette item key, search index model key, ranking term, autocomplete token, recent-item key, or discoverability registry entry contains a product version label unless compatibility queued.
- [x] No Supabase seed row, local reset fixture, source-owned QA registry key, source-owned allowlist entry, or static-analysis rule id contains a product version label unless classified.
- [x] No outbound notification template, integration message identifier, Slack block/action id, export filename, CSV header, PDF metadata field, or downloaded artifact name contains a product version label unless compatibility queued.
- [x] No email sender identity, provider tag/category, `List-*` header value, unsubscribe route key, bounce/reply routing key, or email authentication evidence id contains a product version label unless compatibility queued or classified as a mail standard version.
- [x] No AI prompt template, model-facing instruction, structured-output schema name, tool/function-call schema, or eval fixture identifier contains a product version label unless classified.
- [x] No public SEO metadata, social preview metadata, app-install metadata, public asset URL, sitemap/robots output, canonical URL entry, or structured-data payload contains a product version label unless compatibility queued.
- [x] No PWA manifest field, `.well-known` association file path, app-link association id, service-worker registration scope, install shortcut id, icon purpose/name, or offline install contract contains a product version label unless compatibility queued or standards-owned.
- [x] No locale route segment, translation key, copy/spec-string registry key, pseudo-locale fixture, or localized metadata key contains a product version label unless classified.
- [x] Versioned exported symbols are inventoried with owner, reason, suggested neutral name, compatibility action, and artifact drift checks.
- [x] Versioned content contracts are inventoried with surface class, sub-surface class, owner, reason, suggested neutral name, manual-only status, manual follow-up, and artifact drift checks.
- [x] Versioned content sub-surfaces have deterministic coverage evidence for owner coverage, queue coverage, allowlist coverage, validation command coverage, remaining safe-action count, and package-script readiness.
- [x] Versioned remaining completion-category surfaces have deterministic coverage evidence with queue coverage, allowlist coverage, validation-command coverage, manual-boundary status, and package-script readiness blockers.
- [x] Versioned detailed objective families have deterministic coverage evidence with public contract preservation, source-owned config preservation, queue coverage, allowlist coverage, validation-command coverage, and package-script readiness blockers.
- [x] Public metadata, PWA/well-known, OpenAPI/schema, route/deep-link, source-owned config, scanner, QA registry, and supply-chain evidence surfaces have preservation checks that fail on uncovered current rows.
- [x] All current non-manual, non-conflicting exported-symbol candidates have neutral names while retaining legacy compatibility aliases.
- [x] `check:versioned-exported-symbol-aliases` reports `0` pending aliases and `0` blocked aliases.
- [x] `V5_DECISION_PACKET_BUCKET`, `NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS`, and `NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS` have neutral fallbacks and queue metadata.
- [x] All compatibility-sensitive versioned names covered by the current scanners have neutral aliases and removal-queue metadata.
- [x] All generated artifacts and baselines have been refreshed only through explicit write commands.
- [x] Safe local content rewrites have deterministic manifest tooling, zero pending rewrites, and explicit refusal metadata for current scanner scope.
- [x] Manual content-contract rows in the current scanner scope have queue, allowlist, or documentation-only coverage; uncovered manual rows fail `check:versioned-content-surface-coverage`.
- [x] Remaining non-doc manual/current scanner rows have queue, legitimate-version allowlist, or explicit manual-boundary evidence; uncovered current rows fail `check:versioned-remaining-surface-coverage`.
- [x] All changed tests, checks, and reports pass without production credentials.
- [x] Remaining nonzero versioned names, if any, are explicitly marked as manual production follow-up.
- [x] Legitimate non-product version references are allowlisted with owner, reason, and review date.
- [x] Every rename batch has before/after counts and a rollback note.
- [x] Standards references such as ASVS `V1`-`V14`, IPv4/IPv6, OAuth versions, and dependency versions are preserved through explicit allowlist classification.
- [x] Cryptographic/provider/artifact-schema version formats are preserved by allowlist coverage and cleanup-tool refusal tests.
- [x] Code-only closure evidence is generated from code-owned taxonomies and current artifacts, reports `0` pending safe actions, and classifies remaining objectives as coverage-proven or blocked by retained legacy compatibility, runtime-alias, forward-migration, or external/production-cutover constraints.
- [x] The code-only closure check is wired into CI, hardening parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- [x] Remaining local contract closure evidence is generated from code-owned taxonomies and current artifacts, reports `0` issues, and classifies current local contract objectives as coverage-proven, runtime-alias blocked, or retained-legacy blocked.
- [x] The remaining-local contract closure check is wired into CI, hardening parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- [x] Public runtime dual-read readiness evidence is generated from route, OpenAPI/PWA, public-contract, content-contract, queue, and allowlist artifacts; it reports `2` dual-read-present route families, `4` queue-covered public/PWA families, and `0` issues.
- [x] Neutral SQL function alias staging is complete for the `9` non-data-bearing staged SQL functions, with static safety tests, queue metadata, generated verification SQL, and no production migration application.
- [x] Neutral SQL table-view alias staging is complete for the `33` data-bearing staged SQL table rows, with read-only `security_invoker` views, bounded grants, static safety tests, queue metadata, generated verification SQL, and no production migration application.
- [x] SQL policy rename work remains explicitly staged as forward-migration or linked-verification follow-up rather than claimed complete by code-only changes.
- [x] SQL policy alias readiness evidence is generated from SQL staging, neutral table-view alias evidence, SQL security automation coverage, verification SQL, compatibility queue, and legacy migration SQL; it reports `33` policy rows blocked by `neutral_target_is_view_requires_policy_migration` and `0` issues.
- [x] SQL policy predicate-equivalence staging evidence is generated from SQL policy readiness, SQL staging, neutral table-view alias evidence, verification SQL, SQL security automation coverage, compatibility queue, and legacy migration SQL; it reports `33` retained policy rows, normalized predicate metadata, `32` manual auth-context SELECT comparison blocks, `1` manual non-SELECT placeholder, and `0` issues.
- [x] SQL policy forward-migration blueprint evidence is generated from predicate-equivalence evidence, SQL policy readiness, neutral table-view alias evidence, SQL staging, verification SQL, SQL security automation coverage, and compatibility queue; it reports `33` retained policy rows, `33` comment-only future DDL placeholders, `32` auth-context linked verification contexts, `1` non-SELECT manual context, and `0` issues.
- [x] Forward-migration readiness evidence is generated from SQL staging, verification SQL, SQL security automation coverage, SQL policy alias readiness, SQL policy predicate-equivalence, SQL policy forward-migration blueprint, compatibility queue, migration manifest/domain/fingerprint artifacts, and public runtime readiness; it reports `42` alias-added SQL rows, `33` policy rows requiring forward migration, and `0` issues.
- [x] Final checklist reconciliation evidence is generated from code-owned objective taxonomy and current closure/readiness artifacts; it reports `5` code-only-complete families, `1` retained-legacy blocked family, `1` forward-migration family, `1` external-or-production cutover family, `1` final-zero blocked family, and `0` issues.
- [x] SQL neutral table-view alias, SQL policy alias readiness, SQL policy predicate-equivalence, SQL policy forward-migration blueprint, forward-migration readiness, and final checklist reconciliation checks are wired into package scripts, CI, hardening parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.

## Neutral Naming Rules

Use these rules so independent batches converge on the same vocabulary.

- [x] Replace product phase labels such as `v10` with feature or domain names, not with another release label.
- [x] Prefer nouns that describe durable responsibility: `release-evidence`, `read-models`, `work-inbox`, `product-surface`, `assurance`, `cron`, `route-inventory`.
- [x] Use `current`, `compatibility`, `legacy`, or `release` only for transitional package scripts and test selectors.
- [x] Avoid `next`, `new`, `latest`, `modern`, or `future` because they age into the same problem.
- [x] Use `legacy` only when the old name remains externally callable.
- [x] Keep third-party or standards versions intact when they are not product phase labels, such as `IPv6`, `OAuth 2`, dependency versions, schema versions, protocol versions, or browser API versions.
- [x] Require every old-to-neutral rename to have one canonical neutral name before implementation starts.
- [x] Prefer one neutral name across path, package script, test tag, telemetry alias, and report output when they refer to the same concept.

## Objective 1. Full Inventory And Classification

Production risk reduced: prevents accidental removal of externally visible contracts while pursuing broad cleanup.

- [x] Generate a full versioned-name inventory from `scripts/versioned-naming-baseline.json`.
- [x] Classify every hit as:
  - [x] Local-only test.
  - [x] Internal source module.
  - [x] Internal script.
  - [x] Package script.
  - [x] Package metadata, package export/import alias, binary name, workspace name, TypeScript path alias, or test/build resolver alias.
  - [x] SBOM component alias, provenance subject, attestation predicate id, release artifact provenance key, license allowlist id, or supply-chain waiver id.
  - [x] Test tag.
  - [x] API route.
  - [x] Cron route.
  - [x] Webhook or provider callback.
  - [x] Public token prefix, signed-link scope marker, invite/callback state key, OAuth state parameter key, or external-action token contract.
  - [x] Frontend page route segment, navigation href, redirect target, rewrite source/target, deep-link destination, route-state key, or hash-anchor contract.
  - [x] Edge proxy matcher, middleware policy key, unauthenticated path policy entry, safe-redirect parameter, auth handshake header, correlation header, proxy evidence key, or Vercel route metadata contract.
  - [x] Third-party integration connector id, provider account mapping key, sync cursor key, external record mapping key, connector field alias, or integration fixture id.
  - [x] Telemetry or audit event.
  - [x] Audit action enum, security event type, evidence key, release evidence id, compliance evidence id, audit detail JSON key, or governance evidence artifact.
  - [x] SQL object.
  - [x] Migration filename.
  - [x] Migration SQL content.
  - [x] Generated artifact or baseline.
  - [x] Documentation.
  - [x] Third-party protocol/version reference that should remain.
  - [x] Environment variable or feature flag.
  - [x] Authorization role helper, capability key, feature-family key, entitlement boundary, workspace-mode setting, plan gate, or product-surface route inventory key.
  - [x] Billing provider catalog key, product lookup key, price lookup key, checkout metadata key, subscription status mapping, invoice metadata key, or payment entitlement mapping.
  - [x] CI workflow, job, matrix, or artifact name.
  - [x] Deployment/runtime config, Sentry release label, source-map upload label, container/compose resource name, or build artifact name.
  - [x] Diagnostic ID, response header, or problem-code string.
  - [x] Browser security-policy directive value, Trusted Types policy name, reporting endpoint group, CSP report field, or browser-isolation rollout key.
  - [x] Visual snapshot, skip metadata, or test evidence key.
  - [x] Rate-limit key, cache key, lock key, queue key, job key, or persistence key.
  - [x] Async queue name, worker class, job payload schema, retry outcome, dead-letter key, lease key, job visibility field, or poison-message classification.
  - [x] URL hash anchor, query parameter, API scope, or model-version literal.
  - [x] Storage bucket, object-path prefix, artifact storage path, artifact kind, or artifact key.
  - [x] Exported TypeScript type, interface, enum, constant, function, class, or barrel export.
  - [x] API payload field, response envelope marker, or persisted JSON key.
  - [x] SSE event name, stream route id, realtime channel name, WebSocket topic, broadcast topic, subscription filter key, presence key, or stream heartbeat/error code.
  - [x] Server action export name, form action id, `FormData` field name, hidden input name, submitter value, action-state key, validation error key, or mutation result envelope.
  - [x] OpenAPI component, JSON Schema `$id` or `$ref`, schema registry key, Zod-derived contract, event schema catalog key, or generated client type.
  - [x] Inbound import template id, parser field alias, upload metadata key, import job status, row error code, dedupe key, or field-mapping preset.
  - [x] Domain workflow state, transition id, rule-engine key, policy DSL schema, playbook seed marker, state-machine registry key, or workflow config payload key.
  - [x] Observability metric, counter, SLO dashboard key, trace label, or alert identifier.
  - [x] Command palette item key, search index model key, ranking term, autocomplete token, recent-item key, or discoverability registry entry.
  - [x] DOM data attribute, DOM id, ARIA attribute, test id, or selector contract.
  - [x] Supabase seed row, local reset fixture, or demo/sample data key.
  - [x] Source-owned QA registry, coverage allowlist, static-analysis rule id, scanner pack, or policy config key.
  - [x] Outbound email, notification, Slack, webhook, or integration message template/identifier.
  - [x] Email sender identity, provider tag/category, `List-*` header value, unsubscribe route key, bounce/reply routing key, or email authentication evidence id.
  - [x] AI prompt template, model-facing instruction, structured-output schema, tool/function-call schema, eval fixture, or model-bound extraction contract.
  - [x] Export/download filename, CSV column/header, PDF metadata field, report artifact title, or attachment name.
  - [x] Public SEO metadata, Open Graph/Twitter metadata, app-install metadata, public asset URL, sitemap/robots entry, canonical URL, or JSON-LD structured-data payload.
  - [x] PWA manifest field, `.well-known` association file path, app-link association id, service-worker registration scope, install shortcut id, icon purpose/name, or offline install contract.
  - [x] Locale route segment, translation key, copy/spec-string registry key, pseudo-locale fixture, or localized metadata key.
- [x] Emit a deterministic JSON report with counts by class, owner, and removal strategy.
- [x] Add a check that every versioned-name hit has a class and strategy.
- [x] Add tests for the classifier.
- [x] Include a suggested neutral name for every renameable hit.
- [x] Include a `manualOnly` flag for items that cannot be removed by repository changes alone.

Default verification:

- `npm run report:versioned-naming-cleanup`
- `npm run check:versioned-naming`
- `node --test scripts/check-versioned-naming*.test.mjs`

## Objective 1.1. Legitimate Version Reference Allowlist

Production risk reduced: avoids corrupting standards, dependency, and protocol references while removing product version labels.

- [x] Add a reviewed allowlist for legitimate version references that should remain.
- [x] Require owner, reason, source class, and review date.
- [x] Distinguish product phase labels from:
  - [x] Protocol versions.
  - [x] Dependency versions.
  - [x] Database schema artifact versions.
  - [x] Browser/API versions.
  - [x] Runtime, container, and platform versions such as `node:20`, `postgres:16`, and Vercel/GitHub deployment identifiers.
  - [x] IPv4/IPv6 and network terminology.
  - [x] Regulatory or legal version identifiers.
  - [x] Customer-authored document, contract, invoice, order-form, policy, or record version labels.
  - [x] Domain object version labels such as policy publication `v1` when UI text is describing the user's record lifecycle rather than a product phase.
  - [x] Cryptographic envelope versions such as `enc:v1:` and `enc:v2:`.
  - [x] Signature scheme versions such as Slack `v0=` and Stripe `v1=` signatures.
  - [x] Provider endpoint versions such as Slack `oauth.v2`.
  - [x] Provider model identifiers, embedding model identifiers, tokenizer versions, and eval benchmark versions when they name third-party APIs or measurement protocols rather than product phases.
  - [x] Repository artifact `schemaVersion` fields that version artifact format rather than product phase.
- [x] Fail when an allowlist entry is stale or no longer matches a repository hit.
- [x] Add fixtures for false positives and true product-version hits.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:versioned-naming-removal-queue`
- `node --test scripts/check-versioned-naming*.test.mjs`

## Objective 1.2. Cryptographic, Provider, And Artifact Schema Version Preservation

Production risk reduced: prevents a version-name cleanup from breaking decryption, signature verification, provider OAuth flows, or generated artifact compatibility.

- [x] Inventory version-like strings that are operational format versions, including:
  - [x] Integration token prefixes such as `enc:v1:` and `enc:v2:`.
  - [x] Active token key ids and key-version metadata.
  - [x] Slack signing bases and signatures such as `v0=`.
  - [x] Stripe signature components such as `v1=`.
  - [x] Provider URLs such as Slack `oauth.v2` endpoints.
  - [x] `schemaVersion`, `schema_version`, and `schemaVersion: "1.0.0"` fields in generated artifacts and payload schemas.
- [x] Classify these as cryptographic format, provider protocol, schema format, fixture, or product phase label.
- [x] Require owner, reason, validation command, and review date for every preserved cryptographic/provider/schema version entry.
- [x] Add fake-value tests proving preserved cryptographic, provider URL, provider signature, and artifact schema version strings are classified and refused by cleanup tooling.
- [x] Fail if a product phase label is added to this allowlist without an explicit compatibility-removal queue entry.
- [x] Fail if cleanup tooling tries to rename encryption envelope prefixes, provider signature versions, provider endpoint versions, or artifact schema-version constants.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:static-secret-safety`
- `npm run check:secrets-env-token-quality`
- `npm run check:token-security-quality`
- Token crypto, Slack signing, webhook, and artifact-schema tests.

Manual follow-up intentionally excluded:

- Re-encrypting production integration tokens.
- Rotating token encryption keys.
- Changing provider signature or OAuth endpoint versions.
- Rewriting artifact schemas consumed by external tooling.

## Objective 2. Zero-Target Ratchet Mode

Production risk reduced: prevents new version labels while cleanup is in progress.

- [x] Add a strict mode to `check:versioned-naming` that treats unclassified versioned names as failures.
- [x] Add a `scripts/versioned-naming-removal-queue.json` artifact with owner, reason, surface, compatibility class, validation command, and target removal phase.
- [x] Add `check:versioned-naming-removal-queue`.
- [x] Add `write:versioned-naming-removal-queue`.
- [x] Fail when queue entries are stale, missing metadata, or refer to removed files.
- [x] Fail when new versioned names appear outside the queue.
- [x] Wire the check into CI and hardening CI parity.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:versioned-naming-removal-queue`
- `npm run check:hardening-ci-wiring`

## Objective 3. Local-Only Test Filename Renames

Production risk reduced: removes version debt from safe local surfaces without changing runtime behavior.

- [x] Rename path-only test files approved by the safe-rename planner with names like `*.v9.test.ts`, `*.v10.test.ts`, `v7-*`, `v8-*`, `v9-*`, and `v10-*`.
- [x] Rename manifest-proven local `src/app` and `src/app/api` test filenames such as route-test and page-surface test files while preserving runtime route directories and handlers.
- [x] Rename E2E files with version labels, including:
  - [x] `e2e/current-product-core-smoke.spec.ts`.
  - [x] `e2e/current-product-device-matrix.chromium.spec.ts`.
  - [x] `e2e/current-product-device-matrix.firefox.spec.ts`.
  - [x] `e2e/current-product-device-matrix.webkit.spec.ts`.
  - [x] `e2e/compatibility-core-smoke.spec.ts`.
  - [x] `e2e/compatibility-visual-optional.spec.ts`.
  - [x] `e2e/assurance.spec.ts`.
  - [x] `e2e/external-surfaces.spec.ts`.
  - [x] `e2e/workflow-surfaces.spec.ts`.
  - [x] `e2e/workflow-hubs.spec.ts`.
- [x] Update all manifest-listed fixed-string references in package scripts, test manifests, trace maps, allowlists, and generated test registries.
- [x] Run targeted tests for each rename batch.
- [x] Refresh the versioned naming baseline only after tests pass.

Default verification:

- Targeted `vitest run` for renamed tests.
- Targeted `playwright test` command references for renamed E2E files.
- `npm run check:versioned-naming`
- `git diff --check`

## Objective 3.1. Automated Local Rename Executor

Production risk reduced: makes broad local-only renames repeatable and auditable instead of manual path churn.

- [x] Extend the safe rename tooling into a general dry-run rename planner.
- [x] Require every planned rename to include old path, new path, surface, reason, and expected reference updates.
- [x] Refuse migrations, API routes, cron routes, webhooks, telemetry, generated artifacts, provider config, and SQL object names unless an explicit compatibility mode is requested.
- [x] Rewrite relative imports for moved files.
- [x] Rewrite fixed-string references only when the reference is local-only and listed in the plan.
- [x] Emit a JSON move manifest with before/after path counts.
- [x] Add write mode behind an explicit `write:*` command.
- [x] Add tests for dry-run, write mode, refusal classes, import rewrites, stale plans, and deterministic manifests.

Default verification:

- `npm run check:versioned-naming-safe-renames`
- New rename-planner check command.
- Targeted tests for each moved batch.

## Objective 4. Internal Source Module Renames

Production risk reduced: removes version labels from internal implementation names while preserving imports.

- [x] Rename `src/lib/v10-*` modules to domain names.
  - [x] Completed the reviewed safe release, read-model, audit, closure, hardening, QA, and path-level local source batches.
  - [x] Moved the objective telemetry implementation to a neutral path and kept persisted telemetry names unchanged.
- [x] Rename `src/lib/v9-*` modules to domain names.
  - [x] Renamed the local compatibility spec-trace, PR-body rollup, QA, field-provenance, release-contract, and current/compatibility test clusters to neutral names.
- [x] Rename `src/lib/v6/*`, `src/lib/v5/*`, and `src/lib/v4/*` directories or files when they are internal-only.
  - [x] Moved the assurance telemetry implementation to `src/lib/assurance/telemetry.ts`.
  - [x] Kept the legacy telemetry import path as a compatibility re-export because persisted metric keys still use legacy names.
- [x] Rename `src/lib/product-surface/v7-*` and `src/lib/product-surface/v8-*` files to neutral product-surface names.
- [x] Rename `src/actions/v4*` and `src/actions/v10*` files to neutral action names.
- [x] Rename versioned component paths under:
  - [x] `src/components/v4`.
  - [x] `src/components/dashboard`.
    - [x] Renamed non-telemetry dashboard component paths in the safe batch.
    - [x] Renamed the telemetry compact component path and retained `V5TelemetryCompact` as a deprecated compatibility export.
  - [x] `src/components/ui`.
  - [x] `src/components/work`.
  - [x] `src/components/layout`.
  - [x] `src/components/reports`.
- [x] Update imports and path aliases for the reviewed safe local rename batches.
- [x] Update tests that assert file existence or exact path strings for the reviewed safe local rename batches.
- [x] Update static-analysis allowlists and generated source inventories for the reviewed safe local rename batches.
- [x] Confirmed `npm run check:versioned-naming-safe-renames` reports `381` applied entries, `0` pending entries, and `0` issues.

Default verification:

- `npm run typecheck`
- Targeted `vitest run` for affected modules.
- `npm run check:versioned-naming`
- `npm run check:documentation-runtime-dependencies`

## Objective 4.1. Exported TypeScript Symbol And Barrel Export Cleanup

Production risk reduced: removes version labels from source contracts without breaking imports across modules, scripts, tests, or generated type references.

- [x] Inventory exported symbols whose public names contain product version labels, including:
  - [x] Types and interfaces such as `V10DepthContract`.
  - [x] Constants such as `V10_*` and `V9_*`.
  - [x] Functions such as `getV10*`, `v8*`, and `v9*`.
  - [x] Classes and enums, if present.
  - [x] Barrel exports that re-export versioned names from neutral files.
- [x] Classify each exported symbol as internal-only, cross-module repository API, test-only fixture, script-only helper, or generated artifact input.
- [x] Add neutral exported names before removing old names for every current non-manual, non-conflicting alias candidate.
  - [x] `V9_DUE_SOON_DAYS` -> `DUE_SOON_DAYS`.
  - [x] `V10RecoverableState` -> `RecoverableState`.
  - [x] `V5SignalQualityDisplayRow` -> `SignalQualityDisplayRow`.
  - [x] `V6OrgSettingsJson` / `getV6OrgSettingsJson` -> `OrgSettingsJson` / `getOrgSettingsJson`.
  - [x] Product-surface `V8*` aliases now have neutral eligibility, surface, feature, and exemption names.
  - [x] Completed for touched safe-path symbols: `TelemetryCompact`, `EmptyStateTelemetryLink`, and `installFrozenTime`.
- [x] Keep old exported names as deprecated aliases for generated neutral alias coverage when call sites span multiple domains or when generated files still reference them.
  - [x] Completed for touched compatibility aliases: `V5TelemetryCompact`, `V10EmptyStateTelemetryLink`, and `installV9FrozenTime`.
- [x] Add deterministic alias executor coverage with explicit `check:versioned-exported-symbol-aliases` and `write:versioned-exported-symbol-aliases` modes.
- [x] Refresh the exported-symbol inventory so `aliasCandidateCount` is `0` and retained old names are represented as compatibility aliases or queue-only entries.
- [x] Update imports in small, reviewable batches so type errors identify missed references.
- [x] Update barrel exports and index files to prefer neutral names while preserving generated compatibility aliases.
- [x] Add removal queue metadata for generated old exported-symbol aliases that remain callable.
- [x] Add tests proving old and neutral exports resolve to equivalent behavior where aliases remain.
  - [x] Targeted moved-cluster tests pass for the touched telemetry, contract-filter, calendar, onboarding, billing, objective-telemetry, and hardening files.
  - [x] Alias executor unit tests cover declaration aliasing, conflict detection, deterministic write output, and generated artifact drift.
  - [x] `check:versioned-compatibility-equivalence` validates retained exported-symbol compatibility aliases against their neutral exports where importable or statically aliasable.
- [x] Add a check that newly exported source symbols cannot use product version labels unless explicitly allowlisted as protocol, dependency, or standards versions.

Default verification:

- `npm run typecheck`
- `npm run check:versioned-naming`
- `npm run check:versioned-exported-symbols`
- `npm run check:versioned-exported-symbol-aliases`
- `npm run check:compatibility-removal-queue`
- Targeted `vitest run` for affected symbol owners.

Manual follow-up intentionally excluded:

- Removing exported compatibility aliases before all repository references and generated artifacts have migrated.
- Claiming external package consumers have migrated without separate evidence.

## Objective 4.2. Versioned Content Contract Inventory

Production risk reduced: makes content-level version labels visible without treating every string as safely renameable.

- [x] Add `check:versioned-content-contracts` and `write:versioned-content-contracts`.
- [x] Emit `artifacts/compatibility/versioned-content-contract-inventory.json` only through explicit write mode.
- [x] Classify content-level hits across environment keys, provider/crypto formats, telemetry events, SQL objects, API/cron contracts, app-route contracts, OpenAPI/schema names, DOM/test selectors, package metadata, CI contracts, E2E contracts, tooling contracts, documentation contracts, and source content.
- [x] Classify every current content-level hit into a concrete `subSurfaceClass`, including package metadata, supply-chain evidence, deployment/runtime config, auth/capability keys, billing/provider contracts, route/deep-link contracts, proxy/middleware contracts, audit/evidence keys, diagnostics/problem codes, browser policy keys, operational/cache/rate-limit keys, async/queue contracts, browser storage/cookie/cache keys, storage/artifact paths, export/download names, SQL/security objects, seed/fixture keys, public metadata/PWA contracts, standards/compliance references, source-owned config/registry IDs, local copy/test text, DOM/test selectors, style tokens, and localization keys.
- [x] Require `surfaceClass`, `subSurfaceClass`, owner, reason, `manualOnly`, removal strategy, validation command, manual follow-up, and suggested neutral name for every content-contract row.
- [x] Keep compatibility-sensitive content contracts manual-only until aliases, queues, or external evidence exist.
- [x] Generate removal-queue coverage for current non-doc content-contract alias entries without using the checklist document as configuration.
- [x] Refresh the content-contract artifact after the `docs/current-release.md` baseline reduction through `npm run write:versioned-content-contracts`.
- [x] Add tests for classifier output, legitimate crypto/provider/schema preservation, stale artifact drift, and explicit write/check separation.
- [x] Wire the check into CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and generated artifact hygiene.

Default verification:

- `npm run check:versioned-content-contracts`
- `npm run check:generated-artifact-hygiene`
- `npm run check:hardening-ci-wiring`
- `npm run check:ci-change-impact`

## Objective 4.3. Local Content Rewrite Guardrails

Production risk reduced: removes only manifest-proven local text while refusing runtime identifiers, public contracts, SQL, telemetry, env keys, provider config, OpenAPI, generated artifacts, and manual rows.

- [x] Add `check:versioned-local-content-rewrites` and `write:versioned-local-content-rewrites`.
- [x] Emit `artifacts/compatibility/versioned-local-content-rewrite-manifest.json` only through explicit write mode.
- [x] Restrict rewrites to hash-matched line-level documentation copy, executable test titles, and script comments.
- [x] Refuse identifiers, exported names, route paths, SQL strings, telemetry persisted names, env keys without dual-read support, provider config, public assets, OpenAPI wire names, package-lock/dependency versions, generated artifacts, checklist docs, and manual rows.
- [x] Apply manifest-proven safe local content rewrites for the current pass; the final manifest reports `0` pending rewrites.
- [x] Tighten test-title detection so string fixtures inside tests are refused instead of rewritten.
- [x] Include old value, neutral value, path, line/hash evidence, rewrite type, validation command, rollback note, and before/after counts for every planned rewrite.
- [x] Add tests for local rewrite planning, refusal classes, exact line-level rewrite behavior, stale artifact drift, and current manifest acceptance.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and generated artifact hygiene.

Default verification:

- `npm run check:versioned-local-content-rewrites`
- `npm run check:versioned-content-contracts`
- `npm run check:compatibility-removal-queue`
- `node --test scripts/check-versioned-local-content-rewrites.test.mjs`

## Objective 4.4. Content Surface Coverage Evidence

Production risk reduced: proves every current content sub-surface is classified, queued or allowlisted when manual, and blocked from silent drift.

- [x] Add `check:versioned-content-surface-coverage` and `write:versioned-content-surface-coverage`.
- [x] Emit `artifacts/compatibility/versioned-content-surface-coverage.json` only through explicit write mode.
- [x] Summarize every current `subSurfaceClass` with owner coverage, queue coverage, allowlist coverage, validation command coverage, manual-only count, and remaining safe-action count.
- [x] Fail if current content-contract rows lack required top-level metadata.
- [x] Fail if current non-doc manual content-contract rows lack removal-queue or legitimate-version allowlist coverage.
- [x] Include package-script readiness totals so retained versioned script aliases stay blocked until external references are gone.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and generated artifact hygiene.

Default verification:

- `npm run check:versioned-content-surface-coverage`
- `npm run check:versioned-content-contracts`
- `npm run check:compatibility-removal-queue`
- `node --test scripts/check-versioned-content-surface-coverage.test.mjs`

## Objective 4.5. Remaining Surface Coverage Evidence

Production risk reduced: proves remaining checklist completion categories are backed by current scanner evidence instead of optimistic manual status.

- [x] Add `check:versioned-remaining-surface-coverage` and `write:versioned-remaining-surface-coverage`.
- [x] Emit `artifacts/compatibility/versioned-remaining-surface-coverage.json` only through explicit write mode.
- [x] Build the artifact from existing inventories, queues, allowlists, route/telemetry/SQL artifacts, and content-surface coverage; do not read checklist docs as configuration.
- [x] Map remaining completion-category surfaces to content-contract sub-surface coverage, queue coverage, allowlist coverage, validation-command coverage, and manual-boundary status.
- [x] Fail if any completed category has uncovered manual rows, missing required metadata, pending safe-action rows, or missing validation-command coverage.
- [x] Include package-script readiness blockers for all retained versioned package-script aliases while keeping the aliases callable.
- [x] Add tests for deterministic artifact generation, drift detection, uncovered manual rows, category completion blockers, and package-script readiness evidence.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, and the comprehensive security pipeline.

Default verification:

- `npm run check:versioned-remaining-surface-coverage`
- `npm run check:versioned-content-surface-coverage`
- `npm run check:compatibility-removal-queue`
- `node --test scripts/check-versioned-remaining-surface-coverage.test.mjs`

## Objective 4.6. Manual Surface Closure Evidence

Production risk reduced: proves remaining manual-only surfaces are either classified, queued, allowlisted, or explicitly retained for manual cutover.

- [x] Add `check:versioned-manual-surface-closure` and `write:versioned-manual-surface-closure`.
- [x] Emit `artifacts/compatibility/versioned-manual-surface-closure.json` only through explicit write mode.
- [x] Build the artifact from current inventories, queues, allowlists, route/OpenAPI/PWA checks, telemetry inventory, SQL staging, and content-contract artifacts; do not read checklist docs as configuration.
- [x] Cover public token/callback, stream/realtime, cron, telemetry, observability, audit/evidence, diagnostics/headers, browser security policy, operational literals, async queues, browser/client state, storage/export, SQL/security, seed-only names, docs/external/PWA, and local fixture/content surfaces.
- [x] Fail if any covered manual surface has uncovered current rows, missing validation evidence, or remaining safe repo-local action.
- [x] Keep legacy public routes, SQL objects, telemetry persisted names, provider identifiers, package-script aliases, and other compatibility names callable/readable until queue status permits removal.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, and the comprehensive security pipeline.

Default verification:

- `npm run check:versioned-manual-surface-closure`
- `npm run check:compatibility-removal-queue`
- `node --test scripts/check-versioned-closure-readiness.test.mjs`

## Objective 4.7. Open Objective Closure Evidence

Production risk reduced: proves remaining open code-only objectives are not silently stuck or misclassified.

- [x] Add `check:versioned-open-objective-closure` and `write:versioned-open-objective-closure`.
- [x] Emit `artifacts/compatibility/versioned-open-objective-closure.json` only through explicit write mode.
- [x] Build from a code-owned objective taxonomy plus current inventories, queues, allowlists, route/OpenAPI/PWA checks, telemetry inventory, SQL staging, and content-contract artifacts; do not read checklist docs as configuration.
- [x] Classify every objective as `coverage_proven`, `retained_legacy_blocked`, `requires_runtime_alias`, or `requires_production_or_external_cutover`.
- [x] Fail if a code-only objective has current scanner rows without queue, allowlist, manual-boundary classification, owner, reason, validation command, and manual follow-up.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.
- [x] Add focused tests for objective generation, missing evidence failures, deterministic output, and wiring.

Default verification:

- `npm run check:versioned-open-objective-closure`
- `npm run check:versioned-content-contracts`
- `npm run check:versioned-manual-surface-closure`
- `npm run check:compatibility-removal-queue`
- `node --test scripts/check-versioned-closure-readiness.test.mjs`

## Objective 4.8. Compatibility Equivalence Evidence

Production risk reduced: proves retained compatibility aliases are intentional bridges rather than untested stale names.

- [x] Add read-only `check:versioned-compatibility-equivalence`.
- [x] Verify all `37` retained package-script aliases delegate to neutral commands and no neutral command delegates back to a retained legacy alias.
- [x] Verify old and neutral exported-symbol aliases resolve to the same static value/reference where importable or aliasable.
- [x] Verify telemetry neutral aliases normalize to retained persisted compatibility names while dashboards remain unmigrated.
- [x] Verify env fallback, route alias, and SQL staging metadata remains present and queue-covered.
- [x] Preserve ASVS, OAuth, Slack/Stripe signature versions, SPDX/SBOM/SARIF/VEX, runtime versions, and `schemaVersion` strings as legitimate versions.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and the comprehensive security pipeline.

Default verification:

- `npm run check:versioned-compatibility-equivalence`
- `npm run check:versioned-package-script-readiness`
- `npm run check:versioned-exported-symbols`
- `npm run check:telemetry-event-inventory`
- `npm run check:version-reference-allowlist`

## Objective 4.9. Local Surface Regression Evidence

Production risk reduced: blocks new local-only product version labels without rewriting compatibility-sensitive runtime contracts.

- [x] Add `check:versioned-local-surface-regression` and `write:versioned-local-surface-regression`.
- [x] Emit `artifacts/compatibility/versioned-local-surface-regression.json` only through explicit write mode.
- [x] Cover test tags, skip metadata, visual snapshot prefixes, fixture/evidence keys, DOM/test selectors, style tokens, copy/localization keys, QA registries, source-owned config ids, and static-analysis rule ids.
- [x] Fail new product-version labels unless they are queued, allowlisted as legitimate non-product versions, or explicitly manual-boundary classified.
- [x] Refuse public routes, API/cron routes, SQL objects, telemetry persisted names, provider ids, storage paths, public assets, persisted wire fields, and package-script aliases.
- [x] Wire the check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, generated artifact hygiene, baseline ownership, and the comprehensive security pipeline.

Default verification:

- `npm run check:versioned-local-surface-regression`
- `npm run check:versioned-content-surface-coverage`
- `npm run check:versioned-remaining-surface-coverage`
- `npm run check:compatibility-removal-queue`
- `node --test scripts/check-versioned-closure-readiness.test.mjs`

## Objective 5. Script File Renames

Production risk reduced: removes version labels from local tooling while preserving operator commands through aliases.

- [x] Rename scripts such as:
  - [x] `scripts/check-release-evidence.mjs`.
  - [x] `scripts/check-migration-smoke-current.mjs`.
  - [x] `scripts/check-release-suite-current.mjs`.
  - [x] `scripts/check-release-promotable.mjs`.
  - [x] `scripts/check-release-inventory-lock.mjs`.
  - [x] `scripts/check-previous-release-suite.mjs`.
  - [x] `scripts/check-product-surface-vocabulary.mjs`.
  - [x] `scripts/audit-product-surface-cross-surface-hrefs.mjs`.
  - [x] `scripts/audit-compatibility-cross-surface-hrefs.mjs`.
  - [x] `scripts/render-compatibility-pr-body-rollup.mjs`.
  - [x] `scripts/rebuild-read-models.mjs`.
  - [x] `scripts/rebuild-read-models-nightly-gate.mjs`.
  - [x] `scripts/lib/current-required-indexes.mjs`.
- [x] Update package scripts and CI references.
- [x] Keep old package-script command names as aliases until removal queue validation passes.
- [x] Add tests for script alias coverage and stale command references.

Default verification:

- `npm run check:npm-script-integrity`
- `npm run check:checks-integrity-meta`
- `npm run check:hardening-ci-wiring`
- `node --test` for renamed script tests.

## Objective 6. Package Script Name Cleanup

Production risk reduced: prevents CI and human commands from depending on version labels.

- [x] Replace versioned command names with neutral names for:
  - [x] `test:e2e:compatibility`.
  - [x] `test:e2e:current-product`.
  - [x] `test:e2e:current-product:matrix`.
  - [x] `test:vitest:current-product`.
  - [x] `test:e2e:compatibility:visual`.
  - [x] `report:release-pr-body-rollup`.
  - [x] `check:surface:*`.
  - [x] `check:previous-release-suite`.
  - [x] `check:release-*`.
  - [x] `rebuild:read-models`.
  - [x] `check:rebuild-read-models-nightly-gate`.
- [x] Keep temporary compatibility aliases that call neutral names, not the other way around.
- [x] Update CI, docs, PR templates, evidence summaries, and hardening reports for the neutral E2E commands in this batch.
- [x] Add a check that no new package script key contains a version label.
- [x] Add a removal queue entry for every legacy script alias.
- [x] Add `check:versioned-package-script-readiness` and `write:versioned-package-script-readiness`.
- [x] Emit `artifacts/compatibility/versioned-package-script-readiness.json` only through explicit write mode.
- [x] Report exact blocking references, neutral command, readiness status, validation commands, and removal condition for each retained legacy package-script alias.
- [x] Keep all `37` legacy package-script aliases callable; none are marked ready for removal in this pass.

Default verification:

- `npm run check:compatibility-removal-queue`
- `npm run check:versioned-package-script-readiness`
- `npm run check:npm-script-integrity`
- `npm run check:hardening-ci-wiring`

### Objective 6.1. Package Script Readiness-To-Removal Pass

Production risk reduced: proves the retained versioned package-script aliases are no longer required by repo-local callers while keeping the aliases available for external compatibility.

- [x] Replace repo-local references to the `37` retained legacy package-script aliases with neutral package-script names in source-owned configs, scripts, reports, tests, recommendations, and PR/evidence templates.
- [x] Keep checklist/status documentation as documentation-only evidence, not runtime or implementation configuration.
- [x] Make all `37` retained legacy package-script aliases bridge from old command name to neutral command name.
- [x] Keep neutral package-script commands canonical; none of the neutral commands call the retained legacy aliases.
- [x] Extend package-script readiness output with blocker categories: `repo_local`, `docs_only`, `generated_artifact`, `external_or_manual`, and `ready_for_removal`.
- [x] Refresh `artifacts/compatibility/versioned-package-script-readiness.json`; it reports `repoLocalReferenceCount: 0`, `localReadyForRemovalCount: 37`, and `readyForRemovalCount: 0`.
- [x] Update the compatibility removal queue to consume readiness evidence and reject any package-script alias marked `ready_for_removal` while repo-local blockers remain.
- [x] Add tests proving readiness blocker classification, old-to-neutral package-script bridge equivalence, and stale/unsafe ready-state rejection.
- [x] Refresh dependent deterministic artifacts through explicit write commands only: package-script readiness, compatibility removal queue, versioned naming baseline/removal queue, content contracts, local content rewrite manifest, content surface coverage, remaining surface coverage, detailed objective coverage, manual surface closure, and neutral naming rules.
- [ ] Remove the retained legacy package-script aliases from `package.json`; this remains blocked until external runbooks, branch protection, CI references outside this repo, and manual compatibility evidence approve removal.

### Objective 6.2. Package Script Compatibility-Readiness Pass

Production risk reduced: proves no repository documentation, config, source, script, generated-governance artifact, or test still instructs operators to use retained versioned package-script aliases.

- [x] Replace remaining non-historical checklist/status mentions of retained package-script aliases with their neutral command names.
- [x] Keep the retained aliases callable in `package.json` as old-to-neutral bridges.
- [x] Add tests proving the current repository readiness artifact has `blockingReferenceCount: 0`, `repoLocalReferenceCount: 0`, and `docsOnlyReferenceCount: 0`.
- [x] Add tests proving no neutral package script depends on a retained legacy package-script alias.
- [x] Add tests proving package metadata has no versioned `exports`, `imports`, `bin`, resolver alias, workspace alias, or generated declaration alias.
- [x] Add telemetry compatibility tests proving every neutral product telemetry alias normalizes to a retained persisted compatibility event name.
- [x] Refresh deterministic versioned naming, compatibility queue, content coverage, remaining coverage, detailed coverage, manual closure, and readiness artifacts through explicit write commands only.
- [x] Leave removal of the retained package-script aliases unchecked until external runbooks, branch protection, and manual compatibility evidence approve removal.

Default verification:

- `node --test scripts/check-versioned-closure-readiness.test.mjs scripts/check-compatibility-removal-queue.test.mjs`
- `npm run check:versioned-package-script-readiness`
- `npm run check:compatibility-removal-queue`
- `npm run check:versioned-content-contracts`
- `npm run check:versioned-content-surface-coverage`
- `npm run check:versioned-remaining-surface-coverage`
- `npm run check:versioned-detailed-objective-coverage`

## Objective 6.0.1. Package Metadata And Module Resolution Contract Cleanup

Production risk reduced: removes product version labels from package and resolver contracts without breaking imports, local binaries, workspace tooling, generated clients, or downstream package consumers.

- [x] Inventory versioned package/module-resolution surfaces, including:
  - [x] `package.json` `name`, `description`, `keywords`, `bin`, `exports`, `imports`, `files`, `types`, `typesVersions`, `browser`, and package-manager metadata.
  - [x] Workspace package names, internal package aliases, package-manager catalog keys, and lockfile package aliases.
  - [x] TypeScript `paths`, `baseUrl` expectations, `types` package names, project references, and generated declaration output paths.
  - [x] Next.js, Vitest, Playwright, ESLint, tsup, Babel, Jest, or bundler resolver aliases that can be imported by tests, scripts, or generated code.
  - [x] CLI binary names, shebang entrypoint names, local command shims, and script-owned package export fixtures.
- [x] Classify each hit as public package identity, internal workspace identity, local CLI contract, package subpath export, TypeScript resolver contract, test/build resolver alias, generated type path, lockfile-only dependency version, or legitimate dependency/runtime version.
- [x] Preserve legitimate dependency versions, semver ranges, Node/package-manager versions, lockfile integrity metadata, package protocol versions, and TypeScript `typesVersions` semantics when they describe ecosystem versions rather than product phase names.
- [ ] Add neutral package export/import aliases before changing source imports when package subpaths, local binaries, generated declarations, or test/build resolvers may still reference old names.
- [x] Keep old package metadata aliases accepted during a compatibility window when CI, local scripts, generated code, IDE caches, or downstream package consumers may still resolve them.
- [ ] Update source imports, test imports, generated declaration references, resolver configs, and package-script callers to prefer neutral package and alias names.
- [ ] Add tests proving old and neutral package aliases resolve to the same module, binary entrypoints execute the same code, generated declaration paths remain valid, and dependency/lockfile version metadata is not rewritten as product debt.
- [x] Add removal queue metadata for old package exports, import aliases, binary names, workspace aliases, resolver paths, and generated type paths retained for compatibility.
- [x] Add a check that new package metadata and resolver identifiers cannot contain product version labels unless explicitly classified as legitimate dependency/runtime versions.

Default verification:

- `npm run check:npm-script-integrity`
- `npm run check:dependency-confusion-guards`
- `npm run check:dependency-policy`
- `npm run check:generated-artifact-hygiene`
- `npm run check:versioned-naming`
- TypeScript, bundler, and targeted import-resolution tests when aliases change.

Manual follow-up intentionally excluded:

- Publishing renamed packages, binaries, or generated clients to external registries.
- Removing old public package exports or binary names before downstream consumers have migrated.
- Rewriting dependency lockfile semver or integrity metadata as product-version cleanup.

## Objective 6.0.2. Supply Chain, SBOM, Provenance, And Attestation Cleanup

Production risk reduced: removes product version labels from security evidence artifacts without corrupting dependency versions, SBOM semantics, provenance subjects, license evidence, or attestation verification.

- [x] Inventory versioned supply-chain evidence surfaces, including:
  - [x] SBOM component aliases, package URLs, CycloneDX metadata, SPDX document ids, VEX/SARIF references, and dependency graph labels.
  - [x] SLSA provenance subjects, attestation predicate ids, release artifact names, reproducible-build evidence keys, and CI provenance report ids.
  - [x] Cosign/Rekor verification fixture names, container signing stubs, provenance hash-chain ids, and generated attestation manifests.
  - [x] License allowlist ids, copyleft graph waiver ids, dependency risk buckets, dependency sunset report keys, and supply-chain waiver registry ids.
  - [x] Generated debugging/sweep provenance rows and source-owned supply-chain taxonomy references.
- [x] Classify each hit as dependency ecosystem version, package identity, SBOM schema version, provenance subject, attestation predicate, license evidence id, waiver id, generated evidence artifact, local fixture, or product phase label.
- [x] Preserve legitimate ecosystem version references such as SPDX versions, CycloneDX versions, SLSA levels, npm/pnpm/yarn versions, package semver, container image tags, purl versions, VEX/SARIF versions, and provider attestation schema versions.
- [ ] Add neutral source-owned evidence ids before renaming any artifact key used by CI provenance, release evidence, SBOM diff baselines, license allowlists, or waiver registries.
- [ ] Keep old evidence ids resolvable during a compatibility window when historical CI runs, release artifacts, generated SBOMs, or audit evidence may still reference them.
- [x] Refresh generated supply-chain artifacts only through explicit write commands, and record the owning command in batch evidence.
- [ ] Add tests proving neutralized evidence ids do not change package identity, dependency version interpretation, SBOM validity, license decisions, attestation verification, reproducible-build hashes, or waiver expiry semantics.
- [x] Add removal queue metadata for old supply-chain evidence ids, release artifact provenance keys, attestation subjects, license allowlist ids, and waiver ids retained for compatibility.
- [x] Add a check that new supply-chain evidence identifiers cannot contain product version labels unless explicitly classified as legitimate ecosystem, schema, package, or protocol versions.

Default verification:

- `npm run check:license-sbom`
- `npm run check:sbom-integrity`
- `npm run check:sbom-formats-vex-sarif`
- `npm run check:release-artifact-provenance`
- `npm run check:supply-chain-waivers`
- `npm run check:dependency-policy`
- `npm run check:generated-artifact-hygiene`
- `npm run check:compatibility-removal-queue`

Manual follow-up intentionally excluded:

- Re-signing, re-publishing, or replacing historical production release artifacts.
- Rewriting external registry metadata, provenance attestations, Rekor transparency entries, or third-party SBOM archives.
- Reclassifying dependency or ecosystem versions as product-version debt.

## Objective 6.1. Environment Variable And Feature Flag Cleanup

Production risk reduced: removes version labels from configuration without breaking deployed environments.

- [x] Inventory versioned environment keys and feature flags through the content-contract inventory, including examples such as:
  - [x] `NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS`.
  - [x] `NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS`.
  - [x] `ENABLE_V3_*`.
  - [x] `ENABLE_V5_*`.
  - [x] `ENABLE_V6_*`.
  - [x] `PLAYWRIGHT_V10_MATRIX`.
  - [x] `V10_MIGRATION_SMOKE_*`.
  - [x] `V10_REBUILD_READ_MODEL_URL`.
  - [x] `V5_DECISION_PACKET_BUCKET`.
- [x] Add neutral env aliases while continuing to accept old names for the Playwright device-matrix compatibility key, decision-packet bucket key, inline queue actions key, support diagnostics key, and the covered `ENABLE_V3_*`, `ENABLE_V5_*`, and `ENABLE_V6_*` feature flags.
- [x] Define precedence when old and neutral variables are both set for the decision-packet bucket key, inline queue actions key, support diagnostics key, and covered feature-flag keys.
- [x] Update `.env.example` for the Playwright device-matrix compatibility key, decision-packet bucket key, inline queue actions key, support diagnostics key, and covered feature-flag keys.
- [x] Add removal queue entries for old environment keys covered by this pass.
- [x] Add tests that old and neutral decision-packet bucket, inline queue actions, support diagnostics, and covered feature-flag env keys produce equivalent runtime behavior, with neutral values taking precedence.
- [x] Add a check that new env keys cannot contain product version labels unless allowlisted as legitimate standards/dependency versions or classified in the content-contract inventory.

Default verification:

- `npm run check:env-contract-hygiene`
- `npm run check:env-example-parity`
- `npm run check:security-env-contract`
- `npm run check:next-public-surface`
- `npm run check:versioned-content-contracts`
- Env-specific unit tests.

Manual follow-up intentionally excluded:

- Updating production environment variables.
- Removing old production environment variables.

## Objective 6.2. CI Workflow Label And Matrix Cleanup

Production risk reduced: removes version labels from CI controls while preserving job behavior and required-check continuity.

- [x] Rename workflow step labels covered by this pass, including `Playwright V10 release smoke`.
- [ ] Rename CI env variables and matrix fields with neutral aliases before removing old names.
- [ ] Update required check documentation and branch-protection evidence without assuming remote GitHub settings changed.
- [x] Update generated QA taxonomy/config files touched by the neutral E2E command batch.
- [ ] Add compatibility queue entries for old CI-visible check names when external branch protection may depend on them.
- [x] Add tests that hardening CI wiring recognizes neutral commands.

Default verification:

- `npm run check:hardening-ci-wiring`
- `npm run check:github-workflows-security`
- `npm run check:checks-integrity-meta`
- `npm run check:ci-change-impact`

Manual follow-up intentionally excluded:

- Updating GitHub branch protection required-check names.
- Removing old workflow check names that may still be required remotely.

## Objective 6.3. Deployment And Runtime Config Cleanup

Production risk reduced: removes product version labels from deploy-time identifiers without breaking source-map correlation, runtime config, containerized local tooling, or platform integration.

- [x] Inventory versioned deployment/runtime config surfaces, including:
  - [x] `next.config.*`, Sentry config, Vercel config, Docker/compose files, and hosting-specific config files.
  - [x] Sentry release names, source-map upload labels, deploy artifact names, and build cache/dist identifiers.
  - [x] Container image names, service names, network names, volume names, and local chaos/test stack identifiers.
  - [x] Runtime env passthrough keys exposed by build config, including client-visible release identifiers.
  - [x] Platform monitor, cron monitor, and deployment health-check names.
- [x] Classify each hit as internal build config, deployed platform contract, observability correlation key, source-map/debugging contract, local-only container resource, or legitimate runtime/platform version.
- [x] Preserve legitimate runtime and container versions such as `node:20`, `postgres:16`, dependency versions, platform API versions, and commit SHA release identifiers.
- [ ] Add neutral deployment/resource names only with compatibility aliases or redirecting metadata when external platforms, source maps, or dashboards may already reference the old value.
- [ ] Keep old Sentry release/source-map labels queryable until source maps and deployed release windows have aged out.
- [ ] Add tests proving Sentry release resolution, runtime env passthrough, source-map upload config, and local compose/test stacks still work after neutral naming.
- [x] Add removal queue metadata for old deployment/runtime identifiers retained for compatibility.
- [x] Add a check that new deployment/runtime config cannot introduce product version labels unless classified as legitimate platform/runtime versions.

Default verification:

- `npm run check:env-contract-hygiene`
- `npm run check:static-secret-safety`
- `npm run check:generated-artifact-hygiene`
- Sentry release/config tests.
- Deployment config and compose-file smoke tests when touched.

Manual follow-up intentionally excluded:

- Changing production hosting configuration or dashboard resource names.
- Rewriting historical Sentry releases, source-map uploads, or deploy artifacts.
- Claiming external observability dashboards have migrated without linked evidence.

## Objective 6.4. Authorization, Entitlement, And Capability Key Cleanup

Production risk reduced: removes product version labels from access-control contracts without widening roles, bypassing entitlement gates, or breaking persisted workspace configuration.

- [x] Inventory versioned authorization and entitlement surfaces, including:
  - [x] Role-ranking helpers, role/capability inventories, and server action/API capability checks.
  - [x] Product-surface feature-family keys, route inventory keys, API workspace eligibility maps, and route guard denial classes.
  - [x] Workspace mode fields, organization settings JSON keys, nav-role settings, and feature visibility configuration.
  - [x] Plan, entitlement, billing-sync, and promotion gate identifiers.
  - [x] Capability-token route labels, invite/access-flow identifiers, and support/admin bypass markers.
- [x] Classify each hit as authorization decision input, entitlement decision input, nav visibility configuration, persisted organization setting, billing/provider contract, route eligibility matrix, or local-only test fixture.
- [ ] Add neutral aliases and dual-read logic before changing writer names for persisted org settings, entitlement state, or route eligibility contracts.
- [x] Keep old role/capability/feature-family names accepted until all repository references, generated route matrices, and production settings have migrated.
- [ ] Add tests proving old and neutral names produce identical allow/deny decisions, denial classes, audit details, and route eligibility output.
- [ ] Add static checks that neutralization does not broaden access, skip workspace-mode checks, bypass plan gates, or hide required service-role boundaries.
- [x] Add removal queue metadata for every old authorization, entitlement, capability, route inventory, or workspace-mode key retained for compatibility.
- [x] Add a check that new access-control identifiers cannot contain product version labels unless classified as legitimate external version references.

Default verification:

- `npm run check:role-capability-inventory`
- `npm run check:api-workspace-eligibility`
- `npm run check:feature-flag-security-bypass`
- `npm run check:feature-flag-lifecycle`
- `npm run check:surface:suite`
- `npm run report:api-workspace-route-matrix`
- Product-surface, role, route guard, and entitlement tests.

Manual follow-up intentionally excluded:

- Updating production organization settings or billing/provider entitlement configuration.
- Removing old access-control keys before production data and dashboards have migrated.
- Claiming authorization equivalence in production without linked read-only evidence.

## Objective 6.4.1. Billing, Subscription, And Provider Catalog Contract Cleanup

Production risk reduced: removes product version labels from billing/provider contracts without breaking checkout, portal access, invoice lookup, subscription entitlement sync, webhook replay, or provider catalog mapping.

- [x] Inventory versioned billing/provider identifiers, including:
  - [x] Stripe product ids, price ids, lookup keys, catalog aliases, and source-owned product/price mapping fixtures.
  - [x] Checkout session metadata keys, portal return-state keys, subscription metadata, invoice metadata, and receipt/export identifiers.
  - [x] Subscription status mapping keys, plan-to-entitlement mapping keys, trial/grace-period gate keys, and billing-sync cursors.
  - [x] Stripe webhook event classes, idempotency keys, replay fixtures, signature test fixtures, and provider event inventory artifacts.
  - [x] Billing route tests, billing UI test ids, billing analytics dimensions, and generated billing support-export fields.
- [x] Classify each hit as provider catalog contract, checkout/portal contract, subscription entitlement input, persisted billing row, webhook replay contract, invoice/export contract, local-only fixture, or legitimate provider/protocol version.
- [x] Preserve legitimate provider and protocol version references such as Stripe API versions, Stripe signature `v1=`, SDK versions, webhook schema versions, and tax/compliance standard versions.
- [ ] Add neutral source-owned aliases before changing any lookup key, metadata key, entitlement mapping, or webhook replay identifier used by stored billing rows or provider callbacks.
- [x] Keep old billing identifiers accepted during a compatibility window when provider dashboards, active subscriptions, historical invoices, webhook retries, support exports, or audit records may still reference them.
- [ ] Define precedence when old and neutral billing env keys, product aliases, price aliases, or metadata keys are both present.
- [ ] Add tests proving old and neutral billing identifiers resolve to the same plan, entitlement, checkout behavior, portal behavior, webhook idempotency behavior, invoice lookup, and redacted support output.
- [x] Add removal queue metadata for old billing provider catalog keys, checkout metadata keys, subscription mappings, invoice keys, and webhook replay identifiers retained for compatibility.
- [x] Add a check that new billing/provider identifiers cannot contain product version labels unless explicitly classified as legitimate provider, protocol, tax, or compliance versions.

Default verification:

- `npm run check:env-contract-hygiene`
- `npm run check:compatibility-removal-queue`
- `npm run check:route-provider-dependencies`
- `npm run check:stripe-webhook-idempotency`
- Billing, Stripe route, portal, checkout, invoice, and entitlement-sync tests.

Manual follow-up intentionally excluded:

- Updating Stripe products, prices, lookup keys, webhook endpoints, dashboard metadata, or billing portal configuration.
- Rewriting production subscription rows, invoice metadata, billing audit rows, or webhook replay history.
- Removing old billing aliases before active subscriptions, retry windows, invoices, and provider dashboards have migrated.

## Objective 6.5. Command Palette And Discoverability Search Cleanup

Production risk reduced: removes product version labels from user-facing discovery contracts without breaking command search, recents, route ranking, or persisted search-index rows.

- [x] Inventory versioned discoverability/search surfaces, including:
  - [x] Command palette item ids, Cmd-K route names, quick-action keys, and jump targets.
  - [x] Search index table names, model keys, source classes, ranking terms, and autocomplete tokens.
  - [x] Recent-item storage keys, hidden-destination filters, and route eligibility metadata used by search.
  - [x] Discoverability registries, route-to-feature mappings, and global search labels.
  - [x] Import/export search affordances and upload/spreadsheet template discovery labels.
- [x] Classify each hit as persisted search row, browser storage key, route discovery contract, user-visible label, ranking-only token, generated registry entry, or local-only test fixture.
- [ ] Add neutral search/index constants and dual-read mappings before changing writers for persisted search rows or browser recents.
- [x] Keep old command/search keys searchable until persisted rows, recents, generated route matrices, and support workflows have migrated.
- [ ] Add tests proving old and neutral command/search keys return the same eligible results, preserve org scope, respect hidden destinations, and keep ranking stable.
- [ ] Add static checks that neutral names do not expose hidden routes, bypass workspace eligibility, or leak prohibited source text into ranking terms.
- [x] Add removal queue metadata for every old command palette, search-index, recent-item, ranking, autocomplete, or discoverability key retained for compatibility.
- [x] Add a check that new discoverability/search contracts cannot contain product version labels unless classified as legitimate external version references.

Default verification:

- `npm run check:client-storage-sensitivity`
- `npm run check:command-reference-integrity`
- `npm run check:api-workspace-eligibility`
- `npm run check:sql-object-reference-inventory`
- Command palette, search route, product-surface, and read-model refresh tests.

Manual follow-up intentionally excluded:

- Rewriting production search-index rows or browser storage.
- Removing old search keys before production recents and generated rows have aged out.
- Claiming production command/search usage has migrated without linked read-only evidence.

## Objective 7. Test Tag Cleanup

Production risk reduced: avoids version-grep coupling in local and CI test selection.

- [x] Replace tags like `@v9` and `@v10` with neutral tags such as:
  - [x] `@compatibility`.
  - [x] `@current-product`.
  - [ ] `@release`.
  - [ ] `@visual`.
  - [ ] Domain-specific tags.
- [x] Update Playwright grep commands.
- [x] Update test metadata and snapshots that include tag labels for the renamed E2E batch.
- [x] Add a check that new test tags do not match `@v[0-9]+`.

Default verification:

- `npm run test:e2e:smoke`
- Neutral tag-specific Playwright commands.
- `npm run check:versioned-naming`

## Objective 8. API Route Compatibility Staging

Production risk reduced: avoids breaking public paths, scheduled jobs, or external consumers during route renames.

- [x] Add neutral route aliases for versioned API route paths.
- [x] Keep old route paths as compatibility wrappers.
- [x] Update route inventory to mark old paths as legacy aliases.
- [x] Update API route auth index.
- [x] Update OpenAPI paths.
- [x] Update route tests to cover both old and neutral paths.
- [x] Update PR summaries and production evidence output to list compatibility-sensitive alias and manual follow-up status.
- [x] Add removal queue entries for each old route path.
- [x] Add static deprecation metadata to legacy route wrappers without removing them.
- [x] Add tests that old and neutral routes call the same handler logic.
- [x] Add a check that neutral aliases do not weaken auth, rate limiting, org scoping, CSRF, or cron authentication.

Affected route families include:

- [x] `/api/cron/v4/*`.
- [x] `/api/cron/v5/*`.
- [x] `/api/cron/v6/*`.
- [x] `/api/cron/v10/*`.
- [x] `/api/workspace/v6-settings`.
- [ ] Versioned route tests such as `route.v10.test.ts` and `*.v9.test.ts`.

Default verification:

- `npm run check:compatibility-route-inventory`
- `npm run check:api-route-auth-route-index`
- `npm run check:cron-route-auth`
- `npm run check:scheduled-cron-route-wrappers`
- Route-specific tests.

Manual follow-up intentionally excluded:

- Production scheduler cutover.
- Provider webhook/dashboard path changes.
- Removal of old route paths.

## Objective 8.1. Alias Deprecation Evidence

Production risk reduced: makes compatibility aliases measurable without requiring provider changes.

- [x] Add a static inventory of legacy alias wrappers and their neutral targets.
- [ ] Add response headers or structured logs for legacy route aliases when doing so is safe and non-secret.
- [ ] Add tests proving deprecation metadata is present on legacy aliases and absent on primary neutral routes.
- [x] Add evidence summary output that separates local alias metadata from linked production observation and removal.
- [x] Keep alias observation local/static by default; do not claim production traffic has stopped using old routes.

Default verification:

- `npm run check:compatibility-route-inventory`
- Route alias tests.
- `npm run report:production-evidence-summary`

## Objective 8.1.1. Frontend Page Route, Navigation, And Deep-Link Compatibility Staging

Production risk reduced: removes product version labels from user-facing route contracts without breaking bookmarks, navigation, redirects, search/discovery rows, support links, or notification deep links.

- [ ] Inventory versioned frontend route contracts, including:
  - [ ] Next.js page route segments, route groups when surfaced through generated metadata, static redirects, rewrites, middleware matchers, and canonical route helpers.
  - [ ] Navigation item hrefs, sidebar route registries, command-palette destinations, search-index hrefs, recent-item route keys, and route eligibility matrices.
  - [ ] Notification, email, Slack, calendar, report, and support deep links that point into app pages.
  - [ ] Hash anchors, tab state keys, query parameter names, route-state keys, onboarding wizard steps, and saved-view destination keys.
  - [ ] Route coverage TSV rows, route universe artifacts, E2E route matrices, href audit allowlists, sitemap entries, and public-route generated artifacts.
- [ ] Classify each hit as public page route, authenticated app route, redirect/rewrite contract, navigation registry key, generated route artifact, deep-link contract, hash/query state, local-only fixture, or legitimate standards/domain version.
- [ ] Add neutral page routes and redirect aliases before changing route producers when old URLs may exist in bookmarks, emails, notifications, support docs, search rows, or browser history.
- [ ] Keep old route segments and deep-link destinations accepted during a compatibility window when customer links, deployed notifications, saved views, support scripts, or generated route artifacts may still reference them.
- [ ] Define migration behavior for persisted route references, including redirect-only compatibility, route-state translation, saved-view copy-forward, search-index backfill, regenerated artifacts, or manual production follow-up.
- [ ] Update navigation registries, href eligibility checks, command/search destinations, route matrices, sitemap/canonical metadata, notification link builders, and E2E route fixtures to prefer neutral routes.
- [ ] Add tests proving old and neutral routes preserve auth, workspace eligibility, redirect safety, route state, hash targets, metadata, noindex/canonical behavior, search discoverability, and notification deep-link behavior.
- [ ] Add removal queue metadata for old page routes, redirect aliases, rewrite aliases, navigation hrefs, deep-link destinations, hash anchors, and route-state keys retained for compatibility.
- [ ] Add a check that new frontend route and deep-link identifiers cannot contain product version labels unless explicitly classified as legitimate standards, locale, or customer/domain version references.

Default verification:

- `npm run check:surface:hrefs:strict`
- `npm run check:deeplink-destination-policy`
- `npm run check:route-universe`
- `npm run check:route-state-coverage`
- `npm run check:next-public-surface`
- `npm run check:public-seo-surface`
- `npm run check:compatibility-removal-queue`
- Route, navigation, command-palette, notification, sitemap, and E2E route tests.

Manual follow-up intentionally excluded:

- Removing old page routes before bookmarks, notifications, support links, and saved views have migrated.
- Updating external docs, customer-owned links, browser bookmarks, support scripts, or analytics funnels.
- Claiming production traffic has stopped using old routes without linked read-only evidence.

## Objective 8.1.2. Edge Proxy, Middleware Matcher, And Auth Redirect Contract Cleanup

Production risk reduced: removes product version labels from edge routing and proxy auth contracts without widening anonymous access, weakening redirect validation, losing correlation headers, or breaking Vercel route metadata.

- [ ] Inventory versioned edge proxy and middleware contracts, including:
  - [ ] `src/proxy.ts` matchers, Next.js middleware/proxy config, unauthenticated path policy entries, public route arrays, and route skip patterns.
  - [ ] Auth handshake headers, correlation headers, forwarded pathname headers, proxy cache-control markers, and edge runtime instrumentation labels.
  - [ ] Safe-redirect query parameters, post-auth redirect destinations, callback redirect parameters, sign-out redirect targets, and return-to helpers.
  - [ ] Vercel route metadata, cron path metadata that intersects proxy policy, security proxy matrix artifacts, and public route matrix rows.
  - [ ] Proxy path-policy tests, open-redirect guard tests, middleware metadata checks, marketing public-path alignment checks, and E2E redirect fixtures.
- [ ] Classify each hit as edge matcher contract, anonymous-access policy, redirect parameter, auth handshake header, correlation/header contract, platform route metadata, generated proxy evidence artifact, local-only fixture, or legitimate platform/protocol version.
- [ ] Preserve legitimate platform and protocol versions such as Edge Runtime versions, Vercel platform versions, HTTP versions, and provider callback API versions when they are not product phase labels.
- [ ] Add neutral proxy policy names and redirect aliases before changing producers when old paths or redirect parameters may exist in bookmarks, callbacks, emails, support scripts, browser history, or provider return URLs.
- [ ] Keep old redirect parameters, policy keys, proxy evidence keys, headers, and matcher aliases accepted during a compatibility window when auth callbacks, sign-out flows, open browser tabs, or deployed route metadata may still reference them.
- [ ] Define migration behavior for proxy/auth redirect state, including redirect-only compatibility, safe parameter translation, header aliasing, matrix regeneration, expiry-only compatibility, or manual production follow-up.
- [ ] Update proxy path policy, marketing public paths, Vercel metadata checks, open-redirect guards, security proxy matrix generation, route matrices, and E2E redirect fixtures to prefer neutral names.
- [ ] Add tests proving old and neutral proxy/redirect identifiers preserve auth gating, anonymous route boundaries, open-redirect rejection, callback domain strictness, correlation headers, cache behavior, route metadata alignment, and crawler/static asset bypass expectations.
- [ ] Add removal queue metadata for legacy proxy matchers, unauthenticated path policy keys, redirect parameters, auth headers, correlation headers, route metadata keys, and proxy evidence artifact keys retained for compatibility.
- [ ] Add a check that new proxy, middleware, redirect, and auth handshake identifiers cannot contain product version labels unless explicitly classified as legitimate platform, protocol, or provider versions.

Default verification:

- `npm run check:middleware-vercel-metadata`
- `npm run check:open-redirect-guards`
- `npm run check:compatibility-route-inventory`
- `npm run check:auth-callback-guardrails`
- `npm run check:callback-domain-strictness`
- `npm run report:security-proxy-matrix`
- Proxy path-policy, public-path alignment, post-auth redirect, sign-out redirect, and E2E auth redirect tests when affected.

Manual follow-up intentionally excluded:

- Changing deployed provider callback URLs, CDN/edge platform routing, Vercel project settings, or production auth provider redirect allowlists.
- Removing old redirect parameters or proxy policy aliases before callbacks, bookmarks, support scripts, and browser history have aged out.
- Claiming production edge traffic or callback usage has migrated without linked read-only evidence.

## Objective 8.2. API Payload, Response Envelope, And Persisted JSON Field Cleanup

Production risk reduced: removes version labels from data shapes without breaking clients, stored JSON blobs, webhook payloads, or replay/idempotency records.

- [ ] Inventory versioned runtime data-shape contracts, including:
  - [ ] Response markers such as `v10MutationResponse`.
  - [ ] Response body fields such as nested `v10` retry details.
  - [ ] Request body fields and route payload fields that include product version labels.
  - [ ] Persisted JSON keys such as `v6_assurance_context_json`, `v6_effectiveness_json`, `v6_scope_json`, and related counters.
  - [ ] Schema identifiers that mix product phase names with real schema versions.
  - [ ] Test fixtures that assert exact versioned payload keys.
- [ ] Classify each field as internal-only, public API, webhook/provider contract, persisted database JSON, analytics payload, or test fixture.
- [ ] Add neutral field names and dual-read compatibility before changing writers.
- [ ] Keep legacy field names in responses during a compatibility window when clients or replay fixtures may depend on them.
- [ ] For persisted JSON keys, add forward-only backfill plans or reader fallback logic before writer cutover.
- [ ] Preserve legitimate schema/protocol versions such as `schema_version: "v1"` when the version identifies an external contract rather than a product phase.
- [ ] Add removal queue metadata for every legacy payload field that remains accepted or emitted.
- [ ] Add tests proving old and neutral fields produce equivalent behavior and do not loosen validation.
- [ ] Add a check that new public payload fields cannot contain product version labels unless explicitly classified as legitimate schema/protocol versions.

Default verification:

- `npm run check:api-problem-json`
- `npm run check:runtime-health-probe-contracts`
- `npm run check:compatibility-removal-queue`
- `npm run check:sql-object-reference-inventory`
- Route-specific contract tests.

Manual follow-up intentionally excluded:

- Removing legacy response fields before production consumers have migrated.
- Rewriting production persisted JSON blobs without an approved migration/backfill window.
- Reclassifying external schema versions as product-version debt.

## Objective 8.2.1. Schema Registry And Generated Client Contract Cleanup

Production risk reduced: removes product version labels from machine-readable schema contracts without breaking generated clients, validators, webhook consumers, event catalogs, or schema reference integrity.

- [ ] Inventory versioned schema-contract surfaces, including:
  - [ ] OpenAPI paths, operation ids, component schemas, parameter schemas, response schemas, tags, and example names.
  - [ ] JSON Schema `$id`, `$anchor`, `$defs`, `$ref`, `title`, schema filenames, and generated schema artifacts.
  - [ ] Zod-derived runtime validators, inferred public types, schema export names, and server-action validation contracts.
  - [ ] Event schema catalogs, outbox/webhook schema names, fixture schema ids, and replay validation schemas.
  - [ ] Generated client, generated SDK, typed route helper, schema bootstrap, and API smoke-test type names.
- [ ] Classify each hit as public schema contract, internal validator, generated artifact, event schema, generated client type, public example, local-only fixture, or legitimate protocol/schema version.
- [ ] Preserve legitimate contract-version fields such as `schema_version`, OpenAPI version metadata, JSON Schema draft versions, provider API versions, and dependency/runtime validator versions when they describe external protocols rather than product phase names.
- [ ] Add neutral schema ids, component names, generated type names, and validator aliases before changing producers or generated clients.
- [ ] Keep old schema ids and refs resolvable during a compatibility window when stored events, webhook payloads, replay fixtures, external clients, or generated SDKs may still reference them.
- [ ] Refresh generated schema artifacts and clients only through explicit write commands, and record the owning command in batch evidence.
- [ ] Add tests proving old and neutral schema names validate equivalent payloads, `$ref` graphs remain closed, generated clients compile, examples stay valid, and replay fixtures still parse.
- [ ] Add removal queue metadata for legacy schema ids, component names, generated types, event schema keys, and validator aliases retained for compatibility.
- [ ] Add a check that new schema-contract identifiers cannot contain product version labels unless explicitly classified as legitimate schema/protocol versions.

Default verification:

- `npm run check:openapi-spec-contract`
- `npm run check:openapi-yaml-integrity`
- `npm run check:openapi-route-coverage`
- `npm run check:generated-artifact-hygiene`
- `npm run check:compatibility-removal-queue`
- Schema-specific tests such as JSON Schema, Zod parity, event schema, generated-client, and route contract tests.

Manual follow-up intentionally excluded:

- Publishing regenerated SDKs or generated clients to external consumers.
- Removing old schema ids before replay/event history and external clients have migrated.
- Claiming external client compatibility without consumer evidence.

## Objective 8.2.2. Domain Workflow, Rule, And Policy DSL Contract Cleanup

Production risk reduced: removes product version labels from domain execution contracts without breaking persisted policy JSON, workflow state machines, playbook seeds, rule evaluation, external-action workflows, or audit replay.

- [ ] Inventory versioned domain execution contracts, including:
  - [ ] Workflow state names, transition ids, workflow destination keys, workflow config payload keys, and external-action workflow markers.
  - [ ] Control-policy schemas, policy registry keys, rule-engine identifiers, rule evaluation result keys, policy simulation payload keys, and policy diff markers.
  - [ ] Playbook seed names, work-item type keys, task/action type keys, approval/exception state machine keys, and lifecycle transition diagnostic ids.
  - [ ] Cron workflow route metadata, workflow tier coverage rows, route coverage tags, and generated workflow evidence artifacts.
  - [ ] Domain fixtures that intentionally model customer-authored policy versions or document lifecycle versions.
- [ ] Classify each hit as persisted workflow state, domain DSL schema, rule-engine contract, state-machine transition, playbook seed, generated workflow artifact, local-only fixture, or legitimate customer/domain version reference.
- [ ] Preserve legitimate customer and domain version references such as policy publication versions, control-policy draft versions, customer document versions, and schema fields that version a domain record rather than the product implementation.
- [ ] Add neutral aliases and dual-read parsing before changing writers for persisted workflow state, policy JSON, playbook seeds, rule evaluation output, or external-action workflow config.
- [ ] Keep old workflow and policy identifiers accepted during a compatibility window when stored policies, pending tasks, active external links, audit records, scheduled cron runs, or replay fixtures may still reference them.
- [ ] Define migration behavior for persisted domain DSL data, including read-through fallback, copy-forward on next write, staged SQL backfill, expiry-only compatibility, or manual production follow-up.
- [ ] Add tests proving old and neutral workflow/policy identifiers produce equivalent eligibility, state transitions, rule outcomes, audit details, org scoping, idempotency, and replay behavior.
- [ ] Add removal queue metadata for old workflow states, transition ids, policy schema keys, rule-engine identifiers, playbook seeds, and generated workflow artifacts retained for compatibility.
- [ ] Add a check that new domain execution contract identifiers cannot contain product version labels unless classified as legitimate customer/domain versioning or schema/protocol versioning.

Default verification:

- `npm run check:workflow-destinations`
- `npm run check:workflow-tier-coverage`
- `npm run check:idempotency-policy`
- `npm run check:compatibility-removal-queue`
- `npm run check:sql-object-reference-inventory`
- Targeted workflow, policy, playbook, external-action, and state-transition tests.

Manual follow-up intentionally excluded:

- Rewriting production policy JSON, pending workflow rows, active external-action links, audit history, or scheduled workflow state.
- Removing old workflow/policy readers before active states and links have expired or been migrated.
- Reclassifying customer-authored policy/document versions as product-version debt without domain-owner review.

## Objective 8.2.3. Inbound Import, Parser, And Mapping Template Contract Cleanup

Production risk reduced: removes product version labels from data-ingestion contracts without breaking saved spreadsheet templates, parser aliases, import retries, dedupe behavior, row-level diagnostics, or customer upload workflows.

- [ ] Inventory versioned inbound import contracts, including:
  - [ ] Upload route names, import template ids, spreadsheet template names, parser mode keys, field-mapping preset keys, and column alias registries.
  - [ ] Import job status values, retry status values, row error codes, diagnostic ids, dedupe candidate keys, and import audit event ids.
  - [ ] Uploaded file metadata keys, source-file artifact keys, content-type allowlist ids, row-limit fixture names, and parser security fixture ids.
  - [ ] Saved import mappings, source-owned demo CSVs, generated sample spreadsheets, import wizard state keys, and onboarding upload fixtures.
  - [ ] Import/export parity fixtures and downstream spreadsheet compatibility checks that share CSV headers or schema markers.
- [ ] Classify each hit as public upload route contract, parser alias, spreadsheet template contract, saved mapping key, persisted import row, diagnostic/error code, security allowlist id, local-only fixture, or legitimate file-format/schema version.
- [ ] Preserve legitimate file-format and parser versions such as CSV dialect versions, MIME versions, JSON/Excel/OpenXML versions, parser library versions, and customer-authored document version labels.
- [ ] Add neutral parser aliases, field-mapping aliases, and import job readers before changing writers when old keys may exist in saved mappings, import rows, retry payloads, or customer spreadsheets.
- [ ] Keep old import identifiers accepted during a compatibility window when pending jobs, failed-job retries, saved templates, downloaded sample files, or support diagnostics may still reference them.
- [ ] Define migration behavior for persisted import state, including read-through fallback, copy-forward on retry, regenerate-on-download, expiry-only compatibility, or manual production follow-up.
- [ ] Add tests proving old and neutral import identifiers preserve parser validation, upload security, row limits, dedupe detection, retry eligibility, row error rendering, audit details, org scoping, and CSV formula safety.
- [ ] Add removal queue metadata for old import templates, parser aliases, upload metadata keys, row error codes, dedupe keys, and mapping presets retained for compatibility.
- [ ] Add a check that new inbound import and parser identifiers cannot contain product version labels unless explicitly classified as legitimate file-format, parser, schema, or customer-domain versions.

Default verification:

- `npm run check:upload-security-guards`
- `npm run check:parser-risk-controls`
- `npm run check:import-boundaries`
- `npm run check:export-security-guards`
- `npm run check:compatibility-removal-queue`
- Import route, parser, upload wizard, failed-job retry, and CSV/spreadsheet template tests.

Manual follow-up intentionally excluded:

- Rewriting production import job rows, saved mappings, uploaded file metadata, or failed-job retry payloads.
- Removing legacy parser aliases before pending imports, saved templates, and customer spreadsheets have migrated.
- Updating customer-owned spreadsheets or external import automations.

## Objective 8.2.4. Server Action, Form Field, And Action State Contract Cleanup

Production risk reduced: removes product version labels from server action and form contracts without breaking progressive enhancement, pending browser submissions, saved drafts, validation, org scoping, step-up checks, idempotency, or action-state rendering.

- [ ] Inventory versioned server action and form contracts, including:
  - [ ] Server action export names, action registry ids, action result envelope keys, mutation names, and idempotency keys derived from action names.
  - [ ] `FormData` field names, hidden input names, submitter button `name`/`value` pairs, form ids, action-state keys, validation error keys, and optimistic UI state markers.
  - [ ] Form components, async action buttons, confirmation controls, action chips, local form fixtures, and UI tests that assert exact form or action names.
  - [ ] Server action inventory artifacts, auth-contract allowlists, org-scope allowlists, negative-test fixtures, and action complexity reports.
  - [ ] Route handlers or adapters that bridge browser form submissions into server actions or shared mutation handlers.
- [ ] Classify each hit as public form contract, server action export contract, `FormData` field, submitter contract, action-state key, validation error key, auth/org-scope guard, UI-only fixture, or legitimate standards/domain version.
- [ ] Add neutral action aliases and dual-read form parsing before changing handlers when old field names may exist in browser history, pending submissions, saved drafts, replay fixtures, support steps, or tests.
- [ ] Keep old action names and form fields accepted during a compatibility window when deployed pages, open browser tabs, saved drafts, or external support automation may still submit them.
- [ ] Define migration behavior for persisted action/form state, including read-through fallback, copy-forward on next submit, regenerated form defaults, expiry-only compatibility, or manual production follow-up.
- [ ] Update action inventories, form helpers, validation schemas, negative tests, org-scope tests, auth-contract checks, and UI fixtures to prefer neutral action and field names.
- [ ] Add tests proving old and neutral action/form identifiers preserve validation, CSRF behavior, org scoping, step-up gating, idempotency, result envelopes, optimistic UI state, and error rendering.
- [ ] Add removal queue metadata for legacy action exports, form fields, hidden inputs, submitter values, action-state keys, validation error keys, and result envelope keys retained for compatibility.
- [ ] Add a check that new server action and form contract identifiers cannot contain product version labels unless explicitly classified as legitimate standards, schema, or domain versions.

Default verification:

- `npm run check:server-actions-inventory`
- `npm run check:server-action-auth-contract`
- `npm run check:server-action-org-scope`
- `npm run check:server-action-negative-tests`
- `npm run check:server-action-exports`
- `npm run check:server-action-complexity`
- `npm run check:compatibility-removal-queue`
- Targeted server action, form validation, action-state, and UI tests.

Manual follow-up intentionally excluded:

- Rewriting production pending form/action payloads, saved drafts, audit rows, support scripts, or replay history.
- Removing old action/form aliases before pending submissions, deployed pages, and open user sessions have drained.
- Claiming external browser automation or customer-owned form integrations have migrated without evidence.

## Objective 8.3. Outbound Notification And Integration Message Cleanup

Production risk reduced: removes version labels from outbound contracts without breaking inbox threading, provider callbacks, Slack interactivity, webhook consumers, or notification deduplication.

- [ ] Inventory versioned outbound message contracts, including:
  - [ ] Email notification template ids, subjects, categories, and dedupe keys.
  - [ ] In-app notification class names, notification ids, and deep-link metadata.
  - [ ] Slack message `block_id`, `action_id`, `callback_id`, and renewal-summary form identifiers.
  - [ ] Webhook payload event names, delivery classes, and retry/deduplication keys.
  - [ ] OAuth state payload keys and integration callback metadata.
- [ ] Classify each name as user-visible copy, provider contract, replay/dedupe key, persisted notification row, analytics event, or local-only fixture.
- [ ] Preserve legitimate provider/protocol versions such as Slack `oauth.v2` and webhook `schema_version` values when they describe external APIs rather than product phase labels.
- [ ] Add neutral constants for internal notification and integration identifiers.
- [ ] Keep old provider-facing ids accepted until provider dashboards, message actions, and webhook consumers have migrated.
- [ ] Add dual-read or alias mapping for persisted notification rows and webhook replay records before writer cutover.
- [ ] Add tests proving old and neutral message identifiers route to the same handler and preserve authorization, org scope, replay protection, and redaction.
- [ ] Add removal queue metadata for every old outbound identifier retained for compatibility.
- [ ] Add a check that new outbound message contracts cannot contain product version labels unless classified as provider/protocol versions.

Default verification:

- `npm run check:compatibility-route-inventory`
- `npm run check:route-provider-dependencies`
- `npm run check:telemetry-event-inventory`
- `npm run check:compatibility-removal-queue`
- Route, webhook, notification, and integration-specific tests.

Manual follow-up intentionally excluded:

- Updating provider dashboards or Slack app configuration.
- Removing old interactive message ids before deployed provider payloads have aged out.
- Claiming webhook consumers have migrated without linked evidence.

## Objective 8.3.1. Email Sender Identity, Deliverability, And Mail Header Contract Cleanup

Production risk reduced: removes product version labels from email identity contracts without breaking deliverability, unsubscribe behavior, bounce/reply routing, provider categorization, or mail authentication evidence.

- [ ] Inventory versioned email identity and deliverability contracts, including:
  - [ ] Sender names, sender aliases, reply-to aliases, bounce routing keys, inbound-email route labels, and provider sender identity fixture ids.
  - [ ] `List-ID`, `List-Unsubscribe`, `List-Unsubscribe-Post`, `Message-ID`, `References`, category/tag headers, and provider metadata keys.
  - [ ] Email provider template categories, provider event categories, suppression-list keys, bounce/complaint diagnostics, and resend/retry classification ids.
  - [ ] Email DNS/authentication fixture ids, DKIM selector fixture names, SPF/DMARC/BIMI evidence ids, and email identity spoofing guard allowlists.
  - [ ] Email support-export keys, notification-policy email channel keys, core-email copy audit markers, and mail-specific generated evidence artifacts.
- [ ] Classify each hit as sender identity, provider mail contract, unsubscribe contract, bounce/reply route, deliverability evidence, mail-authentication standard, provider protocol version, local-only fixture, or product phase label.
- [ ] Preserve legitimate mail standards and provider versions such as DKIM versions, SPF/DMARC/BIMI terminology, MIME versions, SMTP extensions, provider API versions, and signature/header format versions.
- [ ] Add neutral aliases before changing sender identity keys, provider categories, unsubscribe route keys, bounce routing keys, or header values that deployed emails, provider dashboards, mail clients, or suppression lists may reference.
- [ ] Keep old email identifiers accepted during a compatibility window when already-sent emails, unsubscribe links, mail client threading, provider events, bounce callbacks, or support diagnostics may still reference them.
- [ ] Define migration behavior for mail contracts, including dual header recognition, redirect-only unsubscribe compatibility, provider-event aliasing, bounce/reply route aliasing, suppression-list aliasing, or manual provider follow-up.
- [ ] Add tests proving old and neutral email identifiers preserve unsubscribe safety, sender-domain allowlists, spoofing guards, provider category routing, bounce/reply handling, copy degradation, PII redaction, and mail-authentication evidence.
- [ ] Add removal queue metadata for old sender identity keys, provider tags/categories, unsubscribe keys, bounce/reply routing keys, mail header values, and email-auth evidence ids retained for compatibility.
- [ ] Add a check that new email identity and deliverability identifiers cannot contain product version labels unless explicitly classified as legitimate mail standard, provider, protocol, or customer-domain versions.

Default verification:

- `npm run check:email-dns-fixtures`
- `npm run check:email-identity-spoof-guards`
- `npm run check:outbound-message-safety`
- `npm run check:outbound-domain-allowlist`
- `npm run audit:core-email-copy:strict`
- `npm run check:notification-payload-scrub-contract`
- `npm run check:compatibility-removal-queue`
- Email provider, unsubscribe, notification, bounce/reply, and deliverability fixture tests.

Manual follow-up intentionally excluded:

- Updating production DNS, DKIM selectors, DMARC/BIMI records, provider sender identities, or provider category settings.
- Rewriting already-sent email headers, provider event history, suppression lists, or mail client threads.
- Removing old unsubscribe or bounce/reply aliases before already-sent emails and provider callbacks have aged out.

## Objective 8.3.2. Third-Party Integration Sync And Connector Contract Cleanup

Production risk reduced: removes product version labels from integration sync contracts without breaking provider account linkage, token refresh, sync cursors, external record mapping, replay protection, or connector-specific field translation.

- [ ] Inventory versioned integration-sync contracts, including:
  - [ ] Connector ids, provider account keys, integration account metadata, sync cursor keys, sync batch ids, and refresh-token diagnostic ids.
  - [ ] Calendar/CRM external record ids, external field mapping keys, remote object type aliases, provider field names, and source-system labels.
  - [ ] Integration route payload keys, sync job status values, replay/idempotency keys, retry diagnostics, and provider error classification ids.
  - [ ] OAuth provider config fixture names, provider capability registries, connector support matrices, and integration surface reports.
  - [ ] Mock provider fixtures, upstream contract tests, provider API path fixtures, and source-owned sample payloads.
- [ ] Classify each hit as provider protocol version, connector identity, provider account mapping, persisted sync cursor, external record mapping, provider field alias, retry/replay key, local fixture, or source-owned support matrix key.
- [ ] Preserve legitimate provider versions such as OAuth 2, provider API versions, `/v1/` upstream paths, webhook schema versions, SDK versions, and externally documented field versions.
- [ ] Add neutral aliases and dual-read logic before changing writers for provider account metadata, sync cursors, external record mappings, connector ids, or provider field aliases.
- [ ] Keep old integration identifiers accepted during a compatibility window when active integrations, token refresh jobs, sync retries, replay records, provider callbacks, or support exports may still reference them.
- [ ] Define migration behavior for persisted integration state, including read-through fallback, copy-forward on next sync, replay-only compatibility, expiry-only compatibility, or manual production follow-up.
- [ ] Add tests proving old and neutral integration identifiers preserve provider auth, token refresh, org scope, sync cursor advancement, external record dedupe, field mapping, idempotency, retry behavior, and redacted diagnostics.
- [ ] Add removal queue metadata for old connector ids, provider account keys, sync cursor keys, external record mapping keys, connector field aliases, and integration fixture ids retained for compatibility.
- [ ] Add a check that new integration-sync identifiers cannot contain product version labels unless explicitly classified as legitimate provider, protocol, SDK, or upstream API versions.

Default verification:

- `npm run check:integration-contract-resilience`
- `npm run report:integration-contract-surface`
- `npm run check:oauth-state-integrity`
- `npm run check:oauth-pkce-enforcement`
- `npm run check:route-provider-dependencies`
- `npm run check:compatibility-removal-queue`
- Integration, OAuth, calendar, CRM, webhook, token-refresh, and mock-provider tests.

Manual follow-up intentionally excluded:

- Updating provider dashboard callback URLs, provider app configuration, or external connector settings.
- Rewriting production integration account rows, sync cursors, token metadata, external record mappings, or provider replay history.
- Removing old connector aliases before active integrations and sync retries have migrated.

## Objective 8.4. AI Prompt, Tool Schema, And Eval Contract Cleanup

Production risk reduced: removes product version labels from model-facing contracts without changing extraction behavior, redaction boundaries, structured-output validation, or tool authorization.

- [ ] Inventory versioned AI-facing contracts, including:
  - [ ] System prompts, user prompts, prompt fragments, and prompt boundary markers.
  - [ ] Structured-output schema names, `response_format` schema ids, and extraction JSON schema identifiers.
  - [ ] Tool/function-call names, tool parameter schemas, and tool authorization manifests.
  - [ ] Prompt-injection guard fixtures, model-context redaction fixtures, and AI eval datasets.
  - [ ] Model-bound cache keys, replay keys, trace labels, and model-output diagnostic ids.
- [ ] Classify each hit as model-facing instruction, untrusted-document delimiter, structured-output contract, provider model id, eval fixture, telemetry/trace label, or user-facing AI copy.
- [ ] Preserve legitimate provider model identifiers, tokenizer versions, embedding model ids, and benchmark versions when they name external APIs or measurement protocols.
- [ ] Add neutral prompt/schema/tool constants before renaming any value used in persisted traces, cached outputs, eval baselines, or downstream parsers.
- [ ] Keep old structured-output schema names and tool aliases accepted during a compatibility window when stored runs or external model traces may reference them.
- [ ] Add tests proving old and neutral AI schema/tool names preserve redaction, prompt-injection boundaries, strict structured-output parsing, tenant AI gates, and tool authorization checks.
- [ ] Add removal queue metadata for old prompt/schema/tool/eval names retained for compatibility.
- [ ] Add a check that new model-facing contracts cannot contain product version labels unless classified as provider/model/protocol versions.

Default verification:

- `npm run check:ai-boundary-contract`
- `npm run check:ai-context-redaction`
- `npm run check:ai-prompt-injection-guards`
- `npm run check:ai-tool-call-authz`
- `npm run check:compatibility-removal-queue`
- Extraction, structured-output, and AI boundary tests.

Manual follow-up intentionally excluded:

- Changing provider model selections or production AI provider configuration.
- Rewriting historical model traces, eval runs, or cached extraction outputs.
- Claiming deployed model behavior equivalence without linked production evidence.

## Objective 8.5. Public Token, Signed Link, And Callback Contract Cleanup

Production risk reduced: removes product version labels from tokenized public flows without weakening link scope, callback validation, replay protection, or token revocation.

- [ ] Inventory versioned public-token and callback contracts, including:
  - [ ] Public token prefixes, stable-key builders, token hash/prefix helpers, and public-token telemetry keys.
  - [ ] Signed external-action link scopes, nonce markers, workflow config payload keys, and external-link state values.
  - [ ] Invite callback state keys, organization invite flow identifiers, and invite redirect destinations.
  - [ ] OAuth state payload keys, PKCE metadata, callback redirect URI constants, and callback diagnostic ids.
  - [ ] External evidence submit headers, token-bearing route parameter names, and idempotency keys derived from token hashes.
- [ ] Classify each hit as cryptographic token envelope, public route contract, persisted token metadata, callback redirect contract, OAuth provider contract, replay/nonce key, telemetry/diagnostic key, or local-only test fixture.
- [ ] Preserve legitimate provider and protocol versions such as `/auth/v1/token`, Slack `oauth.v2`, OAuth 2 terminology, PKCE versions, and cryptographic envelope prefixes.
- [ ] Add neutral token/link/callback constants and dual-read logic before changing writers for persisted token metadata, OAuth state rows, or invite state.
- [ ] Keep old token prefixes, callback state keys, and public route contract names accepted until active links, invites, OAuth states, and cached clients have expired.
- [ ] Add tests proving old and neutral names preserve token hashing, timing-safe comparisons, nonce enforcement, redirect-domain checks, PKCE validation, revocation, expiry, and org scope.
- [ ] Add removal queue metadata for every old token/link/callback identifier retained for compatibility.
- [ ] Add a check that new public token, signed-link, invite, or callback identifiers cannot contain product version labels unless classified as legitimate provider/protocol versions.

Default verification:

- `npm run check:public-token-policy`
- `npm run check:public-token-negative-tests`
- `npm run check:signed-link-nonce-policy`
- `npm run check:signed-link-scope-narrowing`
- `npm run check:auth-callback-guardrails`
- `npm run check:callback-domain-strictness`
- `npm run check:oauth-state-integrity`
- `npm run check:oauth-pkce-enforcement`
- Token, signed-link, invite, and callback route tests.

Manual follow-up intentionally excluded:

- Rotating production tokens or token encryption keys.
- Rewriting persisted public-token, OAuth-state, or invite rows.
- Removing old token/link/callback compatibility before active links and states have expired.

## Objective 8.6. Runtime Stream, Realtime Channel, And Subscription Contract Cleanup

Production risk reduced: removes product version labels from streaming and realtime contracts without breaking scope isolation, redaction, backpressure behavior, reconnect behavior, or channel authorization.

- [ ] Inventory versioned streaming and realtime contracts, including:
  - [ ] `text/event-stream` route ids, SSE event names, stream chunk envelope keys, heartbeat markers, retry hints, stream error codes, and stream close reasons.
  - [ ] `ReadableStream`/`TransformStream` helper names, stream payload builders, redaction wrappers, replay cursor keys, and streaming download route metadata.
  - [ ] WebSocket topic names, broadcast topics, presence keys, room names, subscription filter keys, realtime channel names, and Supabase channel-facing table names.
  - [ ] Client reconnect state keys, last-event-id keys, stream resume tokens, incremental delivery cursors, and stream telemetry labels.
  - [ ] Stream/realtime security checks, realtime surface scans, broadcast-channel E2E gates, and generated route or security evidence artifacts.
- [ ] Classify each hit as SSE event contract, stream payload contract, stream route contract, realtime channel contract, WebSocket/broadcast topic, presence/subscription key, replay/resume cursor, local-only fixture, or legitimate protocol/platform version.
- [ ] Preserve legitimate protocol and platform versions such as HTTP versions, SSE field names, WebSocket protocol versions, Supabase provider API versions, and browser compatibility labels when they are not product phase names.
- [ ] Add neutral stream and channel aliases before changing producers when old names may be held by open browser connections, retrying clients, realtime subscriptions, dashboards, or replay fixtures.
- [ ] Keep old event names, topics, channel names, filter keys, cursors, and heartbeat/error codes recognized during a compatibility window when clients may reconnect or resume with prior state.
- [ ] Define migration behavior for stream/realtime state, including dual event emission, old-to-neutral event translation, resume cursor translation, expiry-only compatibility, cache cleanup on reconnect, or manual production follow-up.
- [ ] Update stream payload redaction checks, scope-isolation checks, realtime surface scans, security pipelines, client handlers, E2E gates, and generated evidence artifacts to prefer neutral names.
- [ ] Add tests proving old and neutral streaming identifiers preserve authorization, org scope, payload redaction, backpressure handling, retry/reconnect semantics, heartbeat handling, replay cursor behavior, and telemetry redaction.
- [ ] Add removal queue metadata for legacy stream event names, route ids, realtime channel names, WebSocket topics, subscription filters, presence keys, cursors, and heartbeat/error codes retained for compatibility.
- [ ] Add a check that new stream, realtime, WebSocket, broadcast, and presence identifiers cannot contain product version labels unless explicitly classified as legitimate protocol, provider, or platform versions.

Default verification:

- `npm run check:stream-scope-isolation`
- `npm run check:stream-payload-sensitivity`
- `npm run check:realtime-auth-boundaries`
- `npm run check:compatibility-removal-queue`
- Stream route, realtime surface, broadcast-channel, reconnect/resume, and payload redaction tests when affected.

Manual follow-up intentionally excluded:

- Closing live production streams, forcing client reconnects, or changing deployed realtime provider settings.
- Removing old event/topic/channel aliases before retry windows, open connections, and browser-held resume state have aged out.
- Claiming production stream or realtime consumers have migrated without linked read-only evidence.

## Objective 9. Cron URL Cutover Preparation

Production risk reduced: prepares neutral cron URLs without changing production schedules.

- [x] Add neutral cron route aliases for every versioned cron URL.
- [x] Keep old cron URLs active.
- [x] Keep `vercel.json` schedules aligned with the retained legacy URLs; no production scheduler cutover is claimed.
- [x] Add route tests for old and neutral cron URLs.
- [x] Add cron inventory metadata with owner, old URL, neutral URL, and removal condition.
- [x] Add evidence summary output that says production scheduler cutover has not happened.

Default verification:

- `npm run check:vercel-cron`
- `npm run check:cron-route-auth`
- `npm run check:compatibility-route-inventory`

## Objective 10. Telemetry Event Alias Cleanup

Production risk reduced: lets code use neutral event names while preserving analytics compatibility.

- [x] Add neutral aliases for every versioned telemetry event name.
- [x] Normalize neutral names to legacy persisted names until dashboard migration is complete.
- [x] Update telemetry inventory with neutral alias coverage.
- [x] Add removal queue entries for old event names.
- [x] Add bridge tests proving old and neutral names resolve to the same persisted event.
- [x] Update audit/event fixtures and tests.
- [x] Add a check that new telemetry names cannot include version labels.

Default verification:

- `npm run check:telemetry-event-inventory`
- `npm run check:compatibility-removal-queue`
- Telemetry-specific `vitest run` commands.

Manual follow-up intentionally excluded:

- Analytics dashboard migration.
- Alert consumer migration.
- Removal of legacy persisted event names.

## Objective 10.1. Observability Metric, SLO, Trace, And Alert Name Cleanup

Production risk reduced: removes version labels from monitoring contracts without breaking dashboards, alerts, SLO evidence, or metric retention continuity.

- [ ] Inventory versioned observability names, including:
  - [ ] Metric and counter names such as `cron_v6_*` and `v10_metric_runs`.
  - [ ] SLO dashboard keys and release evidence IDs.
  - [ ] Trace/span labels, log prefixes, and structured log fields.
  - [ ] Alert identifiers, incident readiness checks, and runbook evidence keys.
  - [ ] Metric capture commands and privacy-scan selectors that embed product version labels.
- [ ] Add neutral metric constants and dashboard keys while preserving old metric emission where dashboards or alerts depend on them.
- [ ] Dual-emit old and neutral metrics only when the extra cardinality and cost are explicitly accepted.
- [ ] Prefer compatibility mapping in reports when dual emission would create misleading operational data.
- [ ] Add removal queue entries with dashboard owner, alert owner, neutral name, and validation command.
- [ ] Update evidence and PR summary output to show whether old names are still emitted, mapped, or ready for removal.
- [ ] Add tests proving neutral names do not change aggregation dimensions, org scoping, or privacy classification.
- [ ] Add a check that new metric, SLO, trace, and alert identifiers cannot contain product version labels unless allowlisted as legitimate protocol/dependency versions.

Default verification:

- `npm run check:telemetry-event-inventory`
- `npm run check:compatibility-removal-queue`
- `npm run report:production-evidence-summary`
- `npm run report:hardening-pr-summary`
- Observability-specific unit tests.

Manual follow-up intentionally excluded:

- Updating production dashboards or alert rules.
- Claiming old metrics are unused without telemetry retention evidence.
- Dropping old metric emission before dashboards and alerts have migrated.

## Objective 10.1.1. Audit, Evidence, And Governance Record Contract Cleanup

Production risk reduced: removes product version labels from audit and evidence contracts without corrupting immutable history, compliance evidence, security event semantics, or governance reporting.

- [ ] Inventory versioned audit/evidence contracts, including:
  - [ ] Audit action enums, audit detail JSON keys, audit actor/source labels, mutation audit event ids, and audit route filter keys.
  - [ ] Security event types, security event payload keys, incident/readiness evidence ids, and security report checksum keys.
  - [ ] Evidence record keys, release evidence ids, production evidence summary keys, governance auditability report ids, and evidence display fixture ids.
  - [ ] Compliance evidence ids, assurance epic evidence rows, waiver evidence keys, policy conformance score keys, and auditability owner metadata.
  - [ ] Generated evidence artifacts, audit coverage reports, evidence-deepening bundles, and historical release evidence fixtures.
- [ ] Classify each hit as mutable audit contract, immutable historical audit record, security event contract, release evidence contract, compliance evidence id, governance report key, generated evidence artifact, local-only fixture, or legitimate standards/version reference.
- [ ] Preserve immutable historical evidence and standards references when version text records what actually happened, identifies a regulatory/control version, or names an externally reviewed release artifact.
- [ ] Add neutral audit/evidence aliases before changing writers when old identifiers may exist in audit rows, release evidence records, compliance artifacts, generated reports, or security event consumers.
- [ ] Keep old audit/evidence identifiers readable during a compatibility window when historical rows, reports, dashboards, support exports, or compliance review material may still reference them.
- [ ] Define migration behavior for mutable audit/evidence state, including read-through aliasing, report-time normalization, generated artifact refresh, immutable historical exception, or manual production follow-up.
- [ ] Add tests proving old and neutral audit/evidence identifiers preserve actor/org scope, security classification, redaction, event ordering, compliance meaning, report aggregation, and evidence lookup.
- [ ] Add removal queue metadata for old audit actions, security event types, evidence keys, release evidence ids, compliance evidence ids, audit detail keys, and governance artifact ids retained for compatibility.
- [ ] Add a check that new audit and evidence identifiers cannot contain product version labels unless explicitly classified as immutable historical evidence, regulatory/control versions, or standards versions.

Default verification:

- `npm run check:audit-event-coverage`
- `npm run check:security-event-contract`
- `npm run check:evidence-deepening-bundle`
- `npm run check:release-evidence`
- `npm run report:governance-auditability`
- `npm run report:production-evidence-summary`
- `npm run check:compatibility-removal-queue`

Manual follow-up intentionally excluded:

- Rewriting production audit rows, security event history, compliance evidence, release evidence, or governance records.
- Reclassifying immutable historical evidence as product-version debt without owner review.
- Claiming production audit dashboards or compliance review packets have migrated without linked evidence.

## Objective 10.2. Diagnostic ID, Header, And Problem-Code Cleanup

Production risk reduced: removes version labels from machine-readable error surfaces without breaking clients or logs.

- [ ] Inventory versioned diagnostic IDs, problem codes, response headers, and log event keys.
- [ ] Add neutral constants for versioned diagnostics such as `v10_*` and `v6_feature_disabled`.
- [ ] Preserve old diagnostic IDs through compatibility mapping where clients or dashboards may depend on them.
- [ ] Add neutral response headers for versioned headers such as `X-V10-*` while keeping legacy headers during the compatibility window.
- [ ] Update API tests to assert both old and neutral compatibility where needed.
- [ ] Add removal queue metadata for legacy diagnostic IDs and headers.
- [ ] Add a check that new diagnostic IDs and headers do not include product version labels.

Default verification:

- `npm run check:auth-error-consistency`
- `npm run check:api-problem-json`
- `npm run check:security-event-contract`
- `npm run check:telemetry-event-inventory`
- Route-specific unit tests.

## Objective 10.2.1. Browser Security Policy And Reporting Contract Cleanup

Production risk reduced: removes product version labels from browser-enforced security policy contracts without weakening CSP, Trusted Types, Permissions-Policy, reporting endpoints, or browser-isolation behavior.

- [ ] Inventory versioned browser security-policy surfaces, including:
  - [ ] CSP directive values, Trusted Types policy names, nonce/hash rollout identifiers, report-only/enforcing rollout keys, and CSP report field names.
  - [ ] Permissions-Policy feature aliases, browser-isolation mode keys, COOP/COEP/CORP rollout keys, and security header builder constants.
  - [ ] `Report-To`, `Reporting-Endpoints`, NEL group names, CSP report endpoint paths, and browser violation telemetry fields.
  - [ ] Security-header smoke tests, trusted-types E2E fixtures, CSP nonce/hash fixtures, reporting endpoint fixtures, and generated security coverage rows.
  - [ ] Deployment env keys that select staged security-policy behavior when they appear in browser policy output or generated evidence.
- [ ] Classify each hit as browser standard term, CSP directive, Trusted Types policy contract, reporting endpoint contract, browser-isolation rollout key, generated security evidence, local-only fixture, or product phase label.
- [ ] Preserve legitimate standards and browser API version references such as CSP levels, Trusted Types terminology, COOP/COEP/CORP names, NEL/reporting API names, Permissions-Policy features, nonce/hash algorithms, and browser compatibility versions.
- [ ] Add neutral policy constants before changing any browser-enforced value, report group, or security evidence key that tests, deployed headers, dashboards, or report ingestion may reference.
- [ ] Keep old policy/reporting identifiers accepted during a compatibility window when browser reports, dashboards, staged rollout env keys, or support diagnostics may still reference them.
- [ ] Add tests proving neutralized names do not broaden script/style/frame/connect permissions, remove Trusted Types enforcement, weaken Permissions-Policy, break CSP report ingestion, or change report redaction.
- [ ] Add removal queue metadata for old policy names, report groups, rollout keys, security evidence ids, and report field aliases retained for compatibility.
- [ ] Add a check that new browser security-policy identifiers cannot contain product version labels unless explicitly classified as legitimate standards, browser API, protocol, or dependency versions.

Default verification:

- `npm run check:security-headers`
- `npm run check:browser-isolation-headers`
- `npm run check:csp-nonce-hash-consistency`
- `npm run check:permissions-policy-security`
- `npm run check:reporting-endpoints`
- `npm run check:compatibility-removal-queue`
- Security-header, CSP builder, trusted-types, reporting endpoint, and browser-isolation tests.

Manual follow-up intentionally excluded:

- Changing production security-header rollout flags without deployment approval.
- Removing old report groups before browser report retention and dashboards have migrated.
- Claiming deployed browser policy equivalence without linked environment evidence.

## Objective 10.3. Operational Key And Durable Literal Cleanup

Production risk reduced: removes version labels from durable machine identifiers without breaking caches, rate limits, idempotency, or deep links.

- [ ] Inventory versioned operational literals, including:
  - [ ] Rate-limit keys such as `cron:v10:*` and `cron:v4:*`.
  - [ ] Cache keys and cache tags.
  - [ ] Lock keys and denominator lock identifiers.
  - [ ] Queue, job, and worker class names.
  - [ ] Idempotency marker names and replay headers.
  - [ ] Persistence keys such as `v10-release:*`.
  - [ ] URL hash anchors such as `#v10-jobs`.
  - [ ] API scopes such as `api.workspace.v6-settings`.
  - [ ] Model-version strings such as `v5-baseline-heuristic`.
  - [ ] Client storage keys, if present.
- [ ] Add neutral constants for each durable literal.
- [ ] Keep old values recognized during a compatibility window when persisted data or external links may reference them.
- [ ] Define migration or backfill strategy for persisted literals stored in database rows.
- [ ] Add tests proving old and neutral literals resolve to the same behavior where compatibility is required.
- [ ] Add removal queue entries for old durable literals.
- [ ] Add a check that new durable literals cannot include product version labels.

Default verification:

- `npm run check:compatibility-removal-queue`
- `npm run check:runtime-health-probe-contracts`
- `npm run check:api-route-rate-limit-coverage`
- `npm run check:idempotency-policy`
- `npm run check:job-lock-guards`
- Targeted route and worker tests.

Manual follow-up intentionally excluded:

- Clearing production caches.
- Rewriting production persisted literal values.
- Updating external deep links.

## Objective 10.3.1. Async Queue, Worker, And Job Payload Contract Cleanup

Production risk reduced: removes product version labels from async execution contracts without breaking queued work, retry behavior, idempotency, worker routing, poison-message containment, or job visibility.

- [ ] Inventory versioned async execution contracts, including:
  - [ ] Queue names, worker class names, job class names, job type keys, worker routing keys, queue topic names, and background task registry keys.
  - [ ] Job payload schema ids, payload discriminator fields, job visibility fields, retry action values, retry outcome codes, and retry diagnostic ids.
  - [ ] Idempotency keys, lease keys, lock keys, claim tokens, dedupe keys, replay keys, and async handoff identifiers.
  - [ ] Dead-letter queue names, poison-message classifications, backoff policy keys, retry window keys, and failure bucket ids.
  - [ ] Worker evidence fixtures, job retry route fixtures, queue surface artifacts, generated job visibility rows, and release evidence keys tied to async workers.
- [ ] Classify each hit as queue routing contract, worker identity, job payload contract, retry contract, idempotency/lease contract, poison-message contract, generated queue artifact, local-only fixture, or legitimate infrastructure version.
- [ ] Preserve legitimate infrastructure versions such as provider queue API versions, protocol versions, dependency versions, worker runtime versions, and schema-version fields that describe a queue payload format rather than product phase naming.
- [ ] Add neutral queue, worker, payload, retry, lease, and visibility aliases before changing writers when queued rows, retry payloads, worker consumers, or generated visibility records may still reference old names.
- [ ] Keep old async identifiers accepted during a compatibility window when queued jobs, failed-job retries, poison-message rows, idempotency rows, or release evidence may still reference them.
- [ ] Define migration behavior for persisted async state, including read-through fallback, copy-forward on retry, worker alias dispatch, dead-letter replay mapping, expiry-only compatibility, or manual production follow-up.
- [ ] Add tests proving old and neutral async identifiers preserve worker routing, idempotency, lease ownership, retry eligibility, dead-letter behavior, poison-message containment, job visibility, audit details, org scope, and telemetry redaction.
- [ ] Add removal queue metadata for old queue names, worker classes, job payload schemas, retry outcomes, dead-letter keys, lease keys, visibility fields, and poison-message classifications retained for compatibility.
- [ ] Add a check that new async queue and worker identifiers cannot contain product version labels unless explicitly classified as legitimate infrastructure, provider, protocol, or schema versions.

Default verification:

- `npm run check:queue-surface`
- `npm run check:queue-message-authenticity`
- `npm run check:poison-message-containment`
- `npm run check:idempotency-policy`
- `npm run check:job-lock-guards`
- `npm run check:compatibility-removal-queue`
- Worker, job retry, async handoff, idempotency, dead-letter, and job visibility tests.

Manual follow-up intentionally excluded:

- Rewriting production queued jobs, failed-job retry rows, idempotency rows, dead-letter rows, or worker visibility records.
- Removing old worker/queue aliases before queued work and retry windows have drained.
- Changing provider queue infrastructure, scheduler settings, or worker deployment topology.

## Objective 10.3.2. Browser Storage And Client Channel Contract Cleanup

Production risk reduced: removes product version labels from browser-persisted and browser-mediated contracts without orphaning client state, breaking session behavior, invalidating offline caches, or severing cross-tab communication.

- [ ] Inventory versioned browser/client contracts, including:
  - [ ] `localStorage`, `sessionStorage`, IndexedDB database/store/index names, and persisted client-cache keys.
  - [ ] Cookie names, cookie prefixes, step-up/session helper keys, and `Clear-Site-Data` assumptions.
  - [ ] Service-worker cache names, offline manifest keys, push-notification tags, and background sync tags.
  - [ ] `BroadcastChannel`, `postMessage`, `MessageChannel`, shared-worker, and web-worker event names.
  - [ ] URL query keys, hash keys, wizard state keys, tab-state keys, and deep-link state markers that persist in browser history.
  - [ ] Client-side feature flag cache keys and hydration/bootstrap payload keys.
- [ ] Classify each hit as browser-persisted key, cookie contract, offline cache contract, client-channel contract, URL-state contract, client-only fixture, or legitimate standards/browser API version.
- [ ] Preserve legitimate browser/platform version references such as HTTP versions, Cookie spec references, Service Worker API versions, IndexedDB versions, WebAuthn versions, and browser compatibility notes.
- [ ] Add neutral read aliases before changing writers when the old key may exist in real browsers, saved links, embedded contexts, or support workflows.
- [ ] Define migration behavior for old browser keys, including copy-forward, read-through, expiry-only, clear-on-sign-out, or no-op compatibility.
- [ ] Keep old cookies and channel names recognized during the compatibility window when auth/session state, cross-tab sync, embedded flows, or offline behavior may depend on them.
- [ ] Update tests to cover old-to-neutral key migration, sign-out cleanup, cross-tab/session sync, URL state preservation, and service-worker cache compatibility.
- [ ] Add removal queue metadata for old browser storage keys, cookies, cache names, channel names, message types, and URL state keys retained for compatibility.
- [ ] Add a check that new browser-persisted and client-channel identifiers cannot contain product version labels unless explicitly classified as legitimate platform versions.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:compatibility-removal-queue`
- `npm run check:auth-cookie-attributes`
- `npm run audit:client-hash-targets`
- Targeted auth, browser-storage, service-worker, cross-tab, and deep-link tests when affected.

Manual follow-up intentionally excluded:

- Clearing users' production browser state outside normal sign-out or migration paths.
- Removing legacy cookies, cache names, channel names, or URL-state readers without usage evidence.
- Updating external embedded clients, support scripts, browser extensions, or saved customer links.

## Objective 10.4. Storage Bucket, Object Path, And Artifact Contract Cleanup

Production risk reduced: removes version labels from storage-facing names without breaking existing stored objects, signed URLs, artifact records, or bucket-level policies.

- [x] Inventory versioned storage and artifact contracts through the content-contract inventory, including:
  - [x] Bucket environment variables such as `V5_DECISION_PACKET_BUCKET`.
  - [x] Storage helper modules and tests such as decision-packet storage helpers.
  - [ ] Object path builders, path prefixes, and signed URL helpers.
  - [ ] Database columns and comments that describe artifact storage paths.
  - [ ] Artifact tables, cleanup functions, route payload fields, `artifact_kind`, and `artifact_key` literals.
  - [ ] UI data attributes and evidence keys that store artifact source or storage identifiers.
- [x] Add neutral bucket environment aliases while continuing to accept old bucket env keys.
- [x] Define precedence when old and neutral bucket env keys are both set.
- [ ] Keep old stored object paths readable during a compatibility window.
- [ ] Add neutral object-path builders only after path-scope and signed-link checks prove the scope is unchanged or narrower.
- [ ] Add read compatibility for old path prefixes before any writer changes to neutral prefixes.
- [ ] Add database migration or backfill plans for artifact path columns when persisted paths need eventual cleanup, but do not run them against production.
- [ ] Update storage path safety checks and signed-link scope checks to recognize neutral names and compatibility aliases.
- [x] Add removal queue metadata for old bucket env keys covered by this pass.
- [x] Add tests proving old and neutral bucket env names resolve to equivalent bucket selection.

Default verification:

- `npm run check:storage-path-safety`
- `npm run check:signed-link-scope-narrowing`
- `npm run check:env-contract-hygiene`
- `npm run check:compatibility-removal-queue`
- `npm run check:sql-object-reference-inventory`
- `npm run check:versioned-content-contracts`
- Storage-specific unit tests.

Manual follow-up intentionally excluded:

- Renaming production storage buckets.
- Rewriting production object keys or persisted artifact storage paths.
- Rotating storage-related production secrets.
- Removing old path-prefix readers before production artifact references have aged out or been migrated.

## Objective 10.5. Export, Download, CSV, PDF, And Report Artifact Cleanup

Production risk reduced: removes version labels from generated artifacts without breaking customer downloads, CSV import parity, PDF audit evidence, report references, or content-disposition consumers.

- [x] Inventory versioned export and download surfaces, including:
  - [x] CSV column names, headers, schema markers, and generated filenames.
  - [x] PDF filenames, metadata fields, titles, and embedded audit labels.
  - [x] Report pack names, report run artifact titles, and attachment names.
  - [x] `Content-Disposition` filenames and MIME-adjacent metadata.
  - [x] Export/import job diagnostic payloads that reference versioned artifact names.
- [x] Classify each name as user-visible download, machine-readable import contract, audit artifact, persisted report metadata, local-only fixture, or telemetry evidence.
- [ ] Add neutral filename/header builders before changing export routes.
- [x] Preserve old CSV headers and schema markers when downstream imports or customer spreadsheets may depend on them.
- [x] Keep legacy filenames or add compatibility aliases where generated links, signed URLs, or stored artifact paths may already exist.
- [ ] Add tests proving neutral filenames and headers preserve escaping, CSV formula safety, content type, disposition, and workspace/org scoping.
- [x] Add removal queue metadata for old artifact names that remain emitted or accepted.
- [x] Add a check that new generated download/report artifact names cannot contain product version labels unless explicitly classified as legitimate schema/protocol versions.

Default verification:

- Export route tests.
- `npm run check:storage-path-safety`
- `npm run check:signed-link-scope-narrowing`
- `npm run check:versioned-export-download-contracts`
- `npm run check:compatibility-removal-queue`
- `npm run check:versioned-naming`

Manual follow-up intentionally excluded:

- Rewriting already-issued signed URLs or downloaded customer files.
- Changing customer-facing CSV schema without a migration note and compatibility window.
- Updating external report consumers or spreadsheet automations.

## Objective 11. SQL Object Rename Staging

Production risk reduced: prepares database rename compatibility without applying production writes.

- [ ] Add neutral views/functions/aliases in new migrations for versioned SQL objects.
- [x] Add a forward-only neutral compatibility view for organization settings so code can read `org_settings_json` while the legacy database column remains available.
- [x] Add forward-only neutral wrappers for the `9` non-data-bearing staged SQL functions while retaining the legacy function names and behavior.
- [x] Add forward-only neutral read-only compatibility views for the `33` staged data-bearing SQL table rows while retaining the legacy table names and behavior.
- [x] Keep SQL policy aliases staged as forward-migration or linked-verification follow-up instead of claiming code-only completion.
- [x] Keep old SQL objects available.
- [ ] Add dual-read or dual-write code paths where data-bearing objects require staged migration.
- [x] Add neutral-first, legacy-second runtime parsing for organization settings rows where the compatibility view can expose the neutral key.
- [ ] Add backfill or sync migrations where needed, but do not run them against production.
- [x] Update SQL object reference inventory with old and neutral object names.
- [x] Add removal queue metadata for every old SQL object.
- [x] Add linked read-only verification SQL to compare old and neutral objects when credentials are available, without executing it or claiming linked verification passed.
- [x] Add an old-to-neutral SQL object map with object type, data-bearing status, owner, and cutover strategy.
- [x] Add generated verification SQL for each staged alias.
- [x] Add a check that app code does not move to neutral SQL objects before alias migrations exist.
- [x] Add a check that alias migrations are idempotent and reversible by forward migration.

Affected SQL families include:

- [x] `v10_*` tables.
  - [x] Current non-data-bearing staged function alias set.
  - [x] Current read-only table-view alias set.
  - [ ] Remaining legacy function removal or production cutover.
  - [ ] `v10_*` indexes.
  - [ ] `v10_*` constraints.
  - [ ] `v10_*` RLS policy names and policy helper references.
  - [ ] `v10_*` triggers, trigger functions, grants, revokes, and publication/realtime objects.
  - [ ] `v6_*` columns.
  - [ ] `v5_*` columns.
  - [ ] `v4_*` columns and compatibility flags.
- [x] Neutral alias staging for the current `claim_*`, `complete_*`, `replace_*`, and cleanup function family.
- [ ] Removal or production cutover for retained legacy function names.

Default verification:

- `npm run check:sql-object-reference-inventory`
- `npm run check:sql-object-rename-staging`
- `npm run check:sql-neutral-table-view-aliases`
- `npm run check:sql-rename-verification-sql`
- `npm run check:supabase:fingerprint-artifact`
- `npm run check:migration-idempotency`
- `npm run check:sql-definer-invoker-inventory`

Manual follow-up intentionally excluded:

- Production migration application.
- Dropping old objects.
- Linked catalog confirmation unless credentials are explicitly provided.

## Objective 11.1. Database Type And Client Cleanup

Production risk reduced: keeps typed database access aligned with staged SQL aliases.

- [ ] Regenerate or update database type definitions after alias migrations are added.
- [ ] Replace internal TypeScript references to versioned SQL object names only after neutral aliases exist.
- [x] Add compatibility types where old and neutral SQL objects coexist.
- [x] Add tests or static type coverage proving neutral table/view row access resolves to the intended object names without claiming production type generation.
- [x] Update SQL object reference inventory after type changes.

Default verification:

- `npm run typecheck`
- `npm run check:sql-object-reference-inventory`
- `npm run check:supabase:fingerprint-artifact`

## Objective 11.2. SQL Security Policy, Grant, Trigger, And Realtime Cleanup

Production risk reduced: removes version labels from Supabase security and automation metadata without weakening RLS, grants, cron cleanup, or realtime behavior.

- [x] Inventory versioned SQL security and automation objects, including:
  - [x] RLS policy names and policy helper function references.
  - [x] Security-definer and security-invoker helper grants.
  - [x] Trigger names and trigger function names.
  - [x] Realtime publication entries and channel-facing table names, if present.
  - [x] Storage policies and bucket policy references.
  - [x] Grant/revoke statements that reference versioned SQL functions.
- [x] Add neutral helper function names only through new forward migrations where the staged object is non-data-bearing.
- [ ] Add neutral policy names only through new forward migrations.
- [x] Keep old RLS policies and grants active until neutral equivalents are applied and verified.
- [x] Add static checks that neutral function helper additions do not widen roles, bypass RLS, or grant broad `execute`.
- [x] Add static checks for neutral policy readiness when policy aliases are staged.
- [x] Prove neutral policy creation is blocked while neutral SQL table targets are views, including extracted legacy predicates, command metadata, queue coverage, verification SQL coverage, and manual follow-up.
- [x] Add `check:sql-policy-predicate-equivalence` and `write:sql-policy-predicate-equivalence` to stage predicate-equivalence evidence without creating, altering, or dropping policies.
- [x] Add generated verification SQL to compare old and neutral policy predicates where feasible.
- [x] Update SQL definer/invoker inventory owner metadata for both old and neutral helpers.
- [x] Add removal queue entries for old policy names, helper functions, grants, triggers, and realtime publication entries.
- [x] Add rollback/readiness notes for every migration that changes SQL security metadata.

Default verification:

- `npm run check:rls-sanity-tables`
- `npm run check:rls-policy-drift`
- `npm run check:sql-security-migrations-bundle`
- `npm run check:sql-security-automation-coverage`
- `npm run check:sql-policy-alias-readiness`
- `npm run check:sql-policy-predicate-equivalence`
- `npm run check:sql-definer-invoker-inventory`
- `npm run check:supabase:fingerprint-artifact`
- `npm run check:migration-idempotency`

Manual follow-up intentionally excluded:

- Applying SQL security migrations to production.
- Dropping old policies, grants, triggers, or helper functions.
- Claiming linked RLS behavior is verified without read-only linked evidence.

## Objective 12. Migration Filename And Content Cleanup

Production risk reduced: reduces future confusion while preserving production migration ledger safety.

- [x] Decide whether historical migration filenames are immutable ledger evidence or can be renamed locally.
- [x] If kept immutable, add them to the removal queue as historical exceptions with owner and reason.
- [ ] If renamed, update migration manifest, migration domain index, fingerprint artifacts, tests, and docs.
- [ ] Remove version labels from migration SQL comments and local-only helper names where compatible.
- [x] Do not rewrite production migration ledger state by code-only action.

Versioned migration slugs currently include:

- [x] `014_v2_*` through `018_v2_*` retained as immutable migration-ledger exceptions.
- [x] `024_v3_*` through `033_v3_*` retained as immutable migration-ledger exceptions.
- [x] `037_v3_*` and `038_v3_*` retained as immutable migration-ledger exceptions.
- [x] `039_v4_*` through `043_v4_*` retained as immutable migration-ledger exceptions.
- [x] `044_v5_*` through `048_v5_*`, plus `054_v5_*`, retained as immutable migration-ledger exceptions.
- [x] `049_v6_*` through `053_v6_*` retained as immutable migration-ledger exceptions.
- [x] `055_v8_*` retained as an immutable migration-ledger exception.
- [x] `056_v9_*` retained as an immutable migration-ledger exception.
- [x] `057_v10_*`, `065_v10_*`, and `066_v10_*` retained as immutable migration-ledger exceptions.

Default verification:

- `npm run check:migrations:strict`
- `npm run check:migration-manifest`
- `npm run check:migration-organization`
- `npm run check:migration-history-version-exceptions`
- `npm run check:supabase:fingerprint-artifact`

Manual follow-up intentionally excluded:

- Production ledger reconciliation.
- Squashing migration history for already-deployed production databases.

## Objective 12.1. Supabase Seed And Local Reset Data Cleanup

Production risk reduced: keeps local reset data aligned with neutral names without implying production data has been rewritten.

- [x] Inventory versioned names in `supabase/seed.sql` and any local reset fixtures.
- [x] Classify each seed reference as SQL column, persisted JSON key, feature flag, fixture-only label, or local-only sample value.
- [x] Keep seed writes aligned with the current migration ledger; do not rename seed columns before neutral SQL aliases or compatibility views exist.
- [ ] Add neutral seed payload keys only after runtime readers support both old and neutral keys.
- [x] Add neutral read coverage for the retained organization settings seed payload through `public.organization_settings.org_settings_json` and neutral-first runtime parsing.
- [x] Update local reset smoke checks so seed data still exercises RLS, feature gates, and API paths after neutral naming changes.
- [x] Add tests that seed safety checks reject stale table/column names and unclassified versioned keys.
- [x] Refresh seed safety reports only through explicit write/report commands.
- [x] Add removal queue entries for any seed-only versioned names retained to mirror production schema compatibility.

Default verification:

- `npm run check:supabase:seed-safety`
- `npm run check:seed-versioned-name-queue-coverage`
- `npm run check:supabase:local-reset-harness`
- `npm run check:sql-object-reference-inventory`
- `npm run check:versioned-naming`

Manual follow-up intentionally excluded:

- Rewriting production rows.
- Claiming local seed cleanup proves production data has neutral keys.
- Applying SQL aliases or backfills to linked Supabase without explicit approval.

## Objective 13. Generated Artifact Refresh

Production risk reduced: keeps guardrails deterministic after large rename waves.

- [x] Refresh route inventories.
- [x] Refresh telemetry inventories.
- [x] Refresh SQL object inventories.
- [x] Refresh Supabase fingerprints.
- [x] Refresh migration manifests and domain indexes.
- [x] Refresh versioned naming baseline.
- [x] Refresh compatibility removal queues.
- [x] Refresh security and route static baselines.
- [x] Ensure all refreshes use explicit `write:*` commands.
- [x] Ensure `check:*` commands remain read-only.
- [x] Record which write command refreshed each artifact in the batch evidence.
- [x] Fail if a generated artifact changes but its owning write command was not run.

Default verification:

- `npm run check:generated-artifact-hygiene`
- `npm run check:baseline-registry`
- `npm run check:versioned-naming`
- `git diff --check`

## Objective 13.1. Batch Evidence And Rollback Reports

Production risk reduced: keeps large cleanup batches reviewable and reversible.

- [x] Add a report that captures before/after version-hit counts by surface and token.
- [x] Add a report that lists every moved path and every rewritten reference.
- [x] Add a rollback note for each batch that explains how to restore aliases or revert local renames.
- [x] Add a check that a baseline refresh does not hide new unclassified version names.
- [x] Include omitted-path counts when reports are truncated.

Default verification:

- `npm run report:versioned-naming-cleanup`
- `npm run check:versioned-naming`
- `npm run check:baseline-registry`

## Objective 14. Documentation Cleanup

Production risk reduced: prevents docs from teaching old versioned commands or paths.

- [x] Rename versioned documentation files such as `docs/current-release.md`.
- [x] Remove versioned command names from docs after neutral aliases exist, except historical/planning evidence kept out of runtime/config semantics.
- [x] Update PR templates, release-state docs, UI design references, and operational checklists to prefer neutral command names where code-owned evidence can prove safety.
- [x] Keep historical references only when they describe immutable past releases or retained compatibility queues.
- [x] Ensure documentation remains non-runtime.

Default verification:

- `npm run check:documentation-runtime-dependencies`
- `npm run check:versioned-naming`

## Objective 15. External Contract Cleanup

Production risk reduced: aligns external contract files with neutral names while preserving compatibility.

- [x] Update `openapi.yaml` with neutral paths and deprecation metadata for old paths.
- [x] Update Semgrep rule filenames and rule IDs if local-only.
- [x] Inventory public metadata surfaces, including Next.js `metadata` exports, Open Graph/Twitter image routes, app icon routes, install metadata, sitemap/robots output, canonical URLs, and JSON-LD payloads.
- [x] Inventory public asset filenames and URLs under `public/`, generated image routes, icon routes, and any install-manifest outputs before renaming or allowlisting.
- [ ] Remove product version labels from SEO/social metadata, structured-data names, crawler-visible descriptions, and social preview labels.
- [ ] Remove product version labels from app-install metadata and public asset URLs only when redirects, aliases, or cache-safe compatibility paths preserve existing crawled or bookmarked URLs.
- [x] Keep historical or standards version labels in public metadata only when they describe immutable facts rather than product phase names.
- [ ] Add tests that marketing/public metadata checks fail on new crawler-visible product version labels.
- [x] Keep old external contract names as deprecated aliases where consumers may depend on them.
- [x] Add compatibility removal queue entries for old external contract names.

Default verification:

- `npm run check:compatibility-route-inventory`
- `npm run check:generated-artifact-hygiene`
- `npm run check:pwa-well-known`
- Metadata, sitemap, robots, and JSON-LD surface tests.
- Semgrep/static check commands that own the changed rules.

## Objective 15.0.1. PWA, Well-Known Association, And Install Contract Cleanup

Production risk reduced: removes product version labels from public install and origin-association contracts without widening app scope, breaking existing installed apps, invalidating app-link association files, or changing offline/service-worker behavior.

- [x] Inventory versioned PWA and origin-association contracts, including:
  - [x] `public/manifest.json`, `public/manifest.webmanifest`, generated web app manifest outputs, `start_url`, `scope`, shortcuts, screenshots, categories, icon ids, icon filenames, and install metadata.
  - [x] `.well-known` files such as `assetlinks.json`, `apple-app-site-association`, app-link association files, security contact metadata, and source-owned allowlist rows.
  - [x] Service-worker registration scopes, update channels, cache manifest names, offline route fallbacks, app shell ids, and install prompt telemetry labels.
  - [x] App icon routes, maskable icon paths, splash metadata, `theme-color`/manifest colors, browser metadata exports, and PWA SEO fixtures.
  - [x] PWA/service-worker E2E gates, install metadata tests, well-known allowlists, and generated public-route or metadata artifacts.
- [x] Classify each hit as public manifest contract, origin-association contract, service-worker scope, install shortcut, public asset URL, generated metadata artifact, source-owned allowlist row, local-only fixture, or legitimate platform/standards version.
- [x] Preserve legitimate platform and standards references such as Web App Manifest versions, Android/iOS association formats, browser compatibility versions, security contact standards, and icon-density descriptors when they are not product phase labels.
- [ ] Add neutral public asset paths and manifest values only when redirects, duplicate assets, cache-safe aliases, or generated metadata compatibility preserve installed-app and crawler behavior.
- [x] Keep old manifest paths, icon URLs, association-file entries, service-worker scopes, and install shortcut ids accepted during a compatibility window when installed apps, app links, crawler caches, or browser caches may still reference them.
- [ ] Define migration behavior for installed-app and offline state, including redirect-only compatibility, duplicate manifest/icon assets, cache version bridging, service-worker cache cleanup on activation, expiry-only compatibility, or manual production follow-up.
- [ ] Update PWA well-known allowlists, metadata builders, icon manifests, service-worker tests, public SEO checks, route metadata checks, and generated public artifacts to prefer neutral names.
- [ ] Add tests proving old and neutral PWA identifiers preserve `start_url`, `scope`, auth bypass expectations, app-link routing, service-worker cache isolation, offline fallback behavior, icon availability, CSP `manifest-src`, and install metadata validity.
- [x] Add removal queue metadata for legacy manifest paths, association ids, icon paths, service-worker scopes, cache manifest keys, install shortcut ids, and public metadata entries retained for compatibility.
- [x] Add public runtime dual-read readiness evidence that classifies public route, deep-link, PWA, and metadata rows as dual-read present, alias-ready, queue-covered, or external/production cutover work.
- [x] Fail public runtime readiness when owner, reason, validation command, manual follow-up, stale path, queue coverage, or old-compatibility evidence is missing.
- [x] Add a check that new PWA, well-known, install, and service-worker identifiers cannot contain product version labels unless explicitly classified as legitimate platform or standards versions.

Default verification:

- `npm run check:pwa-well-known`
- `npm run check:public-seo-surface`
- `npm run check:next-public-surface`
- `npm run check:versioned-public-runtime-dual-read`
- `npm run check:compatibility-removal-queue`
- `npm run check:generated-artifact-hygiene`
- PWA metadata, service-worker, app-link association, CSP manifest, and public route tests when affected.

Manual follow-up intentionally excluded:

- Changing deployed origin-association files, provider-owned app-link settings, mobile app entitlements, or production CDN cache rules.
- Removing old manifest/icon/association paths before installed apps, crawler caches, and browser caches have aged out.
- Claiming production app-link or installed-app traffic has migrated without linked read-only evidence.

## Objective 15.1. Standards And Compliance Reference Preservation

Production risk reduced: prevents cleanup from corrupting legitimate compliance references.

- [x] Preserve ASVS references such as `V1`, `V2`, `V4`, `V13`, and `V14` in compliance mappings.
- [x] Preserve dependency, protocol, and standard version labels in config and generated evidence.
- [x] Add allowlist metadata for standards references under `config/compliance`, security matrices, and external policy artifacts.
- [x] Add tests proving standards references are not reported as product version debt.
- [x] Fail if a product phase label is incorrectly added to the standards allowlist.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:security-control-coverage`
- Compliance/static checks that own the changed config.

## Objective 15.2. Source-Owned Config, QA Registry, And Static-Analysis Rule Cleanup

Production risk reduced: removes version labels from repository governance inputs without weakening scanner coverage, QA tier accounting, or policy evidence.

- [x] Inventory versioned names in source-owned config and registry files, including:
  - [x] QA tier manifests and coverage allowlists.
  - [x] PR requirements and change-impact config.
  - [x] Security control ledgers and enforcement matrices.
  - [x] Semgrep rule files, rule ids, messages, paths, and metadata.
  - [x] Optional workflow dispatch registries and CI evidence config.
- [x] Distinguish source-owned config from generated artifacts so refresh commands do not overwrite hand-reviewed neutral names.
- [x] Rename local-only scanner pack filenames and rule ids only when downstream CI references are updated in the same batch.
- [x] Keep legacy scanner rule ids as compatibility metadata when historical SARIF, dashboards, or suppressions may reference them.
- [x] Update QA allowlists and manifests to use neutral package-script aliases while preserving old command aliases until removal conditions pass.
- [x] Preserve legitimate standards and dependency versions in compliance config.
- [x] Add owner, reason, validation command, and review date for config entries that must retain version labels.
- [x] Add tests or static checks proving renamed scanner rules still execute and QA registries still point to existing commands.
- [x] Add removal queue entries for old scanner ids, config keys, and allowlist entries retained for compatibility.

Default verification:

- `npm run check:qa-tier-manifest`
- `npm run check:security-control-coverage`
- `npm run check:checks-integrity-meta`
- `npm run check:hardening-ci-wiring`
- `npm run check:compatibility-removal-queue`
- Semgrep/static check commands that own the changed rules.

Manual follow-up intentionally excluded:

- Updating external SARIF history, code-scanning suppressions, or dashboard filters.
- Removing scanner rule ids that external tooling still references.
- Treating generated artifact drift as source config cleanup.

## Objective 16. Static Text And Identifier Cleanup

Production risk reduced: removes version labels from comments, display text, identifiers, fixtures, and snapshots.

- [ ] Replace versioned variable names that are internal-only.
- [ ] Replace versioned comments and test descriptions.
- [ ] Replace versioned fixture names.
- [ ] Replace versioned snapshot names where snapshots are local-only.
- [x] Preserve third-party version terms such as protocol names, schema versions, or dependency versions.
- [x] Preserve customer-authored and domain-object version text such as contract/order-form titles, document revisions, policy publication versions, and demo values that represent user data.
- [x] Classify examples such as `Order Form v2`, `Acme MSA` version labels, and "publish to create v1" copy as legitimate domain versioning unless the surrounding code proves they are product phase labels.
- [x] Add tests for false positives around legitimate version references.

Default verification:

- `npm run check:versioned-naming`
- Relevant snapshot/test update commands.

## Objective 16.1. Skip Metadata, Visual Snapshot, And Evidence Key Cleanup

Production risk reduced: removes version labels from test governance and visual evidence without losing quarantine metadata.

- [ ] Rename skip metadata reasons such as `v10_core_smoke_e2e_credentials_gate` to neutral reasons.
- [ ] Rename visual snapshot prefixes such as `compatibility-optional` when snapshots are local-only.
- [ ] Update Playwright snapshot expectations and snapshot update commands.
- [ ] Rename evidence keys, fixture categories, and generated QA registry IDs that include product version labels.
- [ ] Preserve expiry, owner, and reason metadata during rewrites.
- [ ] Add tests that skip metadata remains parseable after renames.

Default verification:

- `npm run check:e2e:skip-baseline`
- `npm run report:e2e:skip-baseline`
- Targeted visual or snapshot tests when practical.
- `npm run check:versioned-naming`

## Objective 16.2. DOM Attribute, Selector, And Accessibility Contract Cleanup

Production risk reduced: removes version labels from browser-visible automation and accessibility contracts without breaking tests, customer extensions, analytics scraping, or assistive behavior.

- [x] Inventory versioned DOM-facing identifiers, including:
  - [x] `data-v10-*` and `data-v9-*` attributes.
  - [x] DOM ids such as `v10-*`.
  - [x] Test ids, CSS selectors, and Playwright locators.
  - [x] ARIA labels or described-by references that include product version labels.
  - [x] CSS class names, style comments, and visual-regression snapshot selectors.
- [x] Classify each identifier as internal test-only, user-visible DOM contract, accessibility linkage, styling hook, analytics hook, or external automation surface.
- [x] Add neutral attributes or ids before removing old ones when selectors may be consumed outside the changed test file.
- [x] Keep old DOM attributes during a compatibility window when E2E tests, visual snapshots, support tooling, or analytics may still query them.
- [ ] Update Playwright locators and UI tests to prefer neutral selectors.
- [x] Add tests proving neutral selector additions do not duplicate invalid ids, break ARIA references, or hide accessibility state.
- [x] Add removal queue metadata for old DOM attributes, ids, and selectors that remain present.
- [x] Add a check that new DOM-facing identifiers cannot contain product version labels unless explicitly allowlisted as legitimate external version references.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:compatibility-removal-queue`
- Targeted UI and Playwright tests for affected selectors.
- Targeted accessibility checks when ARIA/id linkages change.

Manual follow-up intentionally excluded:

- Removing legacy selectors used by deployed support scripts or customer automation without evidence.
- Updating external browser automation or analytics consumers.

## Objective 16.2.1. Design Token And Theme Contract Cleanup

Production risk reduced: removes product version labels from style-system contracts without breaking theming, CSS variable resolution, metadata colors, visual baselines, or customer-visible UI states.

- [x] Inventory versioned style-system identifiers, including:
  - [x] CSS custom properties in global styles and component styles.
  - [x] Semantic color, spacing, radius, shadow, elevation, typography, z-index, and motion tokens.
  - [x] Tailwind, PostCSS, theme config, design-system registry, and component-token keys.
  - [x] `themeColor`, manifest color, viewport color, metadata color, and social-preview style fields.
  - [x] Visual-test-only styling selectors, snapshot style fixture keys, and style audit artifacts.
- [x] Classify each hit as CSS variable contract, theme token, semantic design token, build-time theme config, public metadata style field, visual-test fixture, local comment, or legitimate standards/dependency version.
- [x] Preserve legitimate standards and technical version terms such as CSS Color 4, OKLCH/OKLAB references, WCAG versions, browser API versions, dependency versions, and vendor schema versions.
- [ ] Add neutral token aliases before removing old CSS variables or theme keys when components, visual tests, generated assets, customer CSS, or public metadata may still reference them.
- [x] Keep old tokens during a compatibility window when removal could change computed styles, break snapshots, invalidate theme metadata, or remove a public styling hook.
- [ ] Update components, style utilities, generated theme artifacts, screenshots, and visual baselines to prefer neutral token names.
- [ ] Add tests proving old and neutral tokens resolve to the same computed styles during compatibility, no required CSS variable is missing, metadata color fields remain valid, and visual snapshot changes are intentional.
- [x] Add removal queue metadata for old design tokens, CSS custom properties, and theme keys retained for compatibility.
- [x] Add a check that new style-system identifiers cannot contain product version labels unless explicitly classified as legitimate standards or dependency versions.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:compatibility-removal-queue`
- `npm run check:public-seo-surface`
- `npm run check:next-public-surface`
- Targeted UI, visual, theme, or component tests for affected tokens.

Manual follow-up intentionally excluded:

- Removing legacy CSS variables, public theme keys, or customer styling hooks without runtime usage evidence.
- Updating external design files, customer custom CSS, dashboard theme consumers, or brand asset pipelines.

## Objective 16.3. Localization And Copy Catalog Cleanup

Production risk reduced: removes product version labels from locale-aware copy without breaking translation coverage, localized route safety, pseudo-locale tests, or copy catalog parity.

- [x] Inventory versioned localization and copy-catalog surfaces, including:
  - [x] Translation keys, locale route segments, localized metadata keys, and pseudo-locale fixtures.
  - [x] `spec-strings` modules, copy registries, empty-state copy catalogs, and report/field/evidence copy modules.
  - [x] Locale coverage artifacts, locale route security allowlists, and i18n matrix fixtures.
  - [x] Email copy audits and localized outbound copy snapshots.
  - [x] User-facing copy keys shared between UI, exports, reports, notifications, and public metadata.
- [x] Classify each hit as visible copy, translation key, locale route contract, copy catalog key, pseudo-locale test fixture, outbound copy contract, generated locale artifact, or legitimate language/region version term.
- [x] Preserve legitimate language, region, and standards terms such as `en_US`, `en_GB`, BCP 47 language tags, Unicode/Intl API versions, and locale-specific legal version labels.
- [ ] Add neutral copy keys before changing call sites when keys are shared by multiple UI, report, export, email, or metadata surfaces.
- [x] Keep old translation/copy keys accepted until generated locale artifacts, pseudo-locale snapshots, and downstream copy consumers have migrated.
- [ ] Add tests proving old and neutral copy keys render equivalent text, preserve interpolation variables, keep locale route guards intact, and avoid missing-translation fallback regressions.
- [x] Add removal queue metadata for old locale/copy keys retained for compatibility.
- [x] Add a check that new localization and copy-catalog identifiers cannot contain product version labels unless classified as legitimate language, region, protocol, or standards versions.

Default verification:

- `npm run check:locale-coverage-drift`
- `npm run check:locale-route-security`
- `npm run test:e2e:i18n-matrix`
- `npm run audit:core-email-copy:strict`
- Copy/spec-string and locale route tests.

Manual follow-up intentionally excluded:

- Updating external translation management systems.
- Claiming localized production copy has migrated without deployed evidence.
- Removing old copy keys while generated locale artifacts or outbound templates still reference them.

## Objective 17. Compatibility Removal Queue Enforcement

Production risk reduced: prevents old names from living forever after aliases are added.

- [x] Extend `artifacts/compatibility/removal-queue.json` to include every old versioned name currently covered by deterministic scanners that cannot be removed immediately.
- [x] Extend `artifacts/compatibility/removal-queue.json` with exported-symbol alias entries for current generated alias coverage.
- [x] Extend `artifacts/compatibility/removal-queue.json` with environment-key alias entries for neutral env fallbacks covered by this pass.
- [x] Extend `artifacts/compatibility/removal-queue.json` with content-contract alias entries for queued content-level compatibility names covered by this pass.
- [x] Extend `artifacts/compatibility/removal-queue.json` with export/download contract entries, SQL security automation entries, migration-history filename entries, and seed versioned-name entries covered by this pass.
- [x] Generate current queue coverage for exported-symbol aliases and non-doc content-contract aliases from deterministic inventories.
- [x] Require owner, old name, neutral name, surface, reason, validation command, removal status, and manual follow-up.
- [x] Add statuses such as `alias_added`, `awaiting_production_cutover`, `awaiting_linked_verification`, and `ready_for_removal`.
- [x] Add package-script alias readiness metadata so aliases can be marked `ready_for_removal` only when no references remain outside package scripts, queues, generated artifacts, and historical docs.
- [x] Add package-script readiness blocker metadata so every retained versioned alias explains why it is not removable yet.
- [x] Fail if any old compatibility-sensitive name across all manual surfaces exists without queue entries.
- [x] Fail if old compatibility-sensitive names covered by the current generated inventories lack queue entries.
- [x] Fail if current non-doc manual content-contract rows lack queue or legitimate-version allowlist coverage.
- [x] Fail if queue entries point to removed names.
- [x] Fail if generated queue entries with source paths no longer contain the old compatibility name.
- [x] Require separate manual follow-up fields for production scheduler, provider dashboard, analytics dashboard, and SQL object cleanup.
- [x] Require validation commands for both old and neutral names while aliases coexist.
- [x] Add an `earliestRemovalCondition` field for each legacy name.

Default verification:

- `npm run check:compatibility-removal-queue`
- `npm run check:hardening-ci-wiring`

## Objective 17.1. Unchecked Objective Readiness Closure

Production risk reduced: proves remaining unchecked code-only objectives are either implemented, queued, alias-ready, or blocked by runtime dual-read, forward-migration, or external/production cutover boundaries before any legacy name is removed.

- [x] Add `check:versioned-unchecked-objective-readiness` and `write:versioned-unchecked-objective-readiness`.
- [x] Generate `artifacts/compatibility/versioned-unchecked-objective-readiness.json` from code-owned objective taxonomy and current inventories, queues, allowlists, route/OpenAPI/PWA checks, SQL staging, additive-alias preservation, code-only closure, and local-surface regression evidence.
- [x] Keep the readiness check independent of this checklist document; runtime code, scripts, tests, and checks do not read this file as configuration.
- [x] Classify each still-unchecked code-only objective family as `implemented`, `queue_covered`, `alias_ready`, `requires_runtime_dual_read`, `requires_forward_migration`, or `requires_external_or_production_cutover`.
- [x] Fail readiness when a current scanner row lacks owner, reason, surface/sub-surface metadata, validation command, manual follow-up, queue coverage, allowlist coverage, manual-boundary coverage, or has an unexecuted safe action.
- [x] Prove the current pass has `0` remaining safe actions and `0` readiness issues.
- [x] Register the readiness artifact in generated artifact hygiene and baseline/artifact ownership checks.
- [x] Wire the readiness check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and the comprehensive security pipeline.
- [x] Refresh drifted deterministic readiness and content artifacts only through owning `write:*` commands.
- [x] Add focused tests for deterministic readiness generation, missing metadata failures, pending safe-action failures, dependent-source issue propagation, artifact drift detection, and matching committed artifact pass behavior.

Default verification:

- `node --test scripts/check-versioned-unchecked-objective-readiness.test.mjs`
- `npm run check:versioned-unchecked-objective-readiness`
- `npm run check:versioned-code-only-closure`
- `npm run check:versioned-additive-alias-preservation`
- `npm run check:versioned-remaining-local-contract-closure`
- `npm run check:versioned-compatibility-equivalence`
- `npm run check:compatibility-removal-queue`
- `npm run check:generated-artifact-hygiene`
- `npm run check:hardening-ci-wiring`
- `npm run check:ci-change-impact`

## Objective 17.2. Public Runtime Dual-Read And SQL Function Alias Follow-Up

Production risk reduced: closes the remaining code-addressable public runtime readiness and SQL function staging gaps without removing legacy public or database contracts.

- [x] Add `check:versioned-public-runtime-dual-read` and `write:versioned-public-runtime-dual-read`.
- [x] Generate `artifacts/compatibility/versioned-public-runtime-dual-read.json` from code-owned route, OpenAPI/PWA, public-contract, content-contract, queue, and allowlist artifacts.
- [x] Keep the public runtime readiness check independent of this checklist document; runtime code, scripts, tests, and checks do not read this file as configuration.
- [x] Classify public route, deep-link, PWA, and metadata rows as dual-read present, alias-ready, queue-covered, or external/production cutover work.
- [x] Fail public runtime readiness when a current row lacks owner, reason, validation command, manual follow-up, queue/allowlist/manual-boundary coverage, old compatibility evidence, or has a stale source path.
- [x] Stage neutral SQL wrappers for the current `9` non-data-bearing function aliases in forward-only migration `088_sql_neutral_function_aliases.sql`.
- [x] Preserve legacy SQL function names, signatures, return shapes, role grants, and wrapper delegation; do not drop, rename, or broaden legacy SQL objects.
- [x] Leave data-bearing SQL tables and policy aliases staged as forward-migration or linked-verification follow-up.
- [x] Refresh SQL reference, SQL rename staging, SQL verification SQL, SQL security automation, compatibility queue, unchecked-readiness, code-only closure, migration manifest, migration organization, Supabase fingerprint, and versioned naming artifacts only through owning `write:*` commands.
- [x] Register the public runtime readiness artifact in generated artifact hygiene and baseline/artifact ownership checks.
- [x] Wire the public runtime readiness check into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and the comprehensive security pipeline.
- [x] Add focused tests for deterministic public runtime readiness, uncovered manual row failures, route metadata gaps, SQL wrapper delegation, grant safety, idempotency, and no legacy SQL drops.

Default verification:

- `node --test scripts/check-versioned-public-runtime-dual-read.test.mjs scripts/check-sql-neutral-function-aliases.test.mjs`
- `npm run check:versioned-public-runtime-dual-read`
- `npm run check:versioned-unchecked-objective-readiness`
- `npm run check:versioned-code-only-closure`
- `npm run check:versioned-public-contract-preservation`
- `npm run check:versioned-additive-alias-preservation`
- `npm run check:sql-object-reference-inventory`
- `npm run check:sql-object-rename-staging`
- `npm run check:sql-rename-verification-sql`
- `npm run check:sql-security-automation-coverage`
- `npm run check:compatibility-removal-queue`
- `npm run check:generated-artifact-hygiene`
- `npm run check:baseline-registry`
- `npm run check:hardening-ci-wiring`
- `npm run check:ci-change-impact`

## Objective 17.3. Forward Migration Readiness And Final Checklist Reconciliation

Production risk reduced: proves the remaining SQL table/policy work and final checklist gaps are either code-only complete, queue-covered, forward-migration blocked, external/production-cutover blocked, or final-zero blocked before any legacy contract is removed.

- [x] Add `check:versioned-forward-migration-readiness` and `write:versioned-forward-migration-readiness`.
- [x] Generate `artifacts/compatibility/versioned-forward-migration-readiness.json` from SQL object staging, SQL verification SQL, SQL security automation coverage, SQL policy alias readiness, compatibility removal queue, migration manifest/domain/fingerprint artifacts, and public runtime dual-read readiness.
- [x] Keep the forward-migration readiness check independent of this checklist document; runtime code, scripts, tests, and checks do not read this file as configuration.
- [x] Classify SQL function and table-view alias rows as `alias_added`, and classify remaining SQL policy rows as `requires_forward_migration` with the neutral-target-is-view blocker class.
- [x] Fail forward-migration readiness when staged SQL rows have stale source evidence, missing owner/reason/validation/manual follow-up metadata, missing queue coverage, missing verification SQL, missing migration fingerprint registration, or completion without alias evidence.
- [x] Prove the current staging split has `42` alias-added rows (`9` function wrappers plus `33` table views), `33` policy rows, and `0` readiness issues.
- [x] Add `check:sql-neutral-table-view-aliases` and `write:sql-neutral-table-view-aliases`.
- [x] Generate `artifacts/supabase/sql-neutral-table-view-aliases.json` from SQL object rename staging and migration `089_sql_neutral_table_view_aliases.sql`.
- [x] Add a forward-only migration that creates `33` neutral read-only table views with `security_invoker = true`, delegates each view to the retained legacy table, revokes public access, grants `32` member-readable views to `authenticated` and `service_role`, and keeps `mutation_idempotency` service-role-only.
- [x] Fail neutral table-view alias checks when a view lacks `security_invoker`, delegates to the wrong legacy table, grants broader access than allowed, contains writes/backfills/drops/policy changes, or omits manual follow-up metadata.
- [x] Add `check:sql-policy-alias-readiness` and `write:sql-policy-alias-readiness`.
- [x] Generate `artifacts/supabase/sql-policy-alias-readiness.json` from SQL staging, neutral table-view alias evidence, SQL security automation coverage, SQL verification SQL, compatibility removal queue, and legacy migration SQL.
- [x] Extract legacy policy command, role metadata, `using` predicate, and `with check` predicate evidence for all `33` retained policy rows.
- [x] Fail policy readiness when neutral policy DDL is attempted against neutral view aliases, legacy policy definitions are missing, queue or verification coverage is missing, manual follow-up is missing, table-view alias evidence is stale, or any policy row is marked `alias_added`.
- [x] Add `check:sql-policy-predicate-equivalence` and `write:sql-policy-predicate-equivalence`.
- [x] Generate `artifacts/supabase/sql-policy-predicate-equivalence.json` from SQL policy alias readiness, SQL rename staging, verification SQL, SQL security automation coverage, neutral table-view aliases, compatibility queue, and legacy migration SQL.
- [x] Generate deterministic read-only linked-verification SQL at `supabase/sql/policy-predicate-equivalence.sql`; it records `32` manual auth-context SELECT comparison blocks and `1` manual non-SELECT policy placeholder without executing linked verification.
- [x] Fail predicate-equivalence staging when retained policy rows lack predicate metadata, queue coverage, verification SQL coverage, manual follow-up, neutral table-view evidence, or when generated SQL attempts policy DDL or legacy policy removal.
- [x] Add `check:sql-policy-forward-migration-blueprint` and `write:sql-policy-forward-migration-blueprint`.
- [x] Generate `artifacts/supabase/sql-policy-forward-migration-blueprint.json` from SQL policy predicate-equivalence, policy alias readiness, neutral table-view alias evidence, SQL staging, verification SQL, SQL security automation coverage, and compatibility queue.
- [x] Generate deterministic non-executing blueprint SQL at `supabase/sql/policy-forward-migration-blueprint.sql`; it records per-policy future DDL placeholders as comments plus `select` statements only.
- [x] Fail policy forward-migration blueprint generation when retained policy rows lack predicate-equivalence evidence, queue coverage, table-view alias evidence, validation SQL, owner/reason/manual follow-up metadata, or when generated SQL attempts executable DDL, grants, writes, backfills, or legacy removal.
- [x] Add `check:versioned-final-checklist-reconciliation` and `write:versioned-final-checklist-reconciliation`.
- [x] Generate `artifacts/compatibility/versioned-final-checklist-reconciliation.json` from code-owned objective taxonomy plus current closure/readiness artifacts, queues, allowlists, SQL staging, public runtime readiness, and package-script readiness.
- [x] Keep the final checklist reconciliation check independent of this checklist document; runtime code, scripts, tests, and checks do not read this file as configuration.
- [x] Classify unchecked checklist families as `code_only_complete`, `retained_legacy_blocked`, `requires_forward_migration`, `requires_external_or_production_cutover`, or `final_zero_blocked`.
- [x] Fail final reconciliation when a code-only-complete category still has uncovered scanner rows, missing validation commands, missing metadata, or unexecuted safe actions.
- [x] Register the SQL neutral table-view, SQL policy alias readiness, SQL policy predicate-equivalence, SQL policy forward-migration blueprint, forward-migration, and final-reconciliation artifacts in generated artifact hygiene and baseline/artifact ownership checks.
- [x] Wire the SQL neutral table-view, SQL policy alias readiness, SQL policy predicate-equivalence, SQL policy forward-migration blueprint, forward-migration, and final-reconciliation checks into package scripts, CI, hardening CI parity, change-impact recommendations, production evidence summary, PR summary output, and the comprehensive security pipeline.
- [x] Refresh drifted SQL policy predicate-equivalence, SQL policy forward-migration blueprint, SQL policy readiness, SQL staging, SQL verification, SQL security coverage, compatibility queue, forward-migration, unchecked-readiness, code-only closure, local-content rewrite, remaining-local closure, versioned naming baseline/removal queue, and final-reconciliation artifacts only through owning `write:*` commands.
- [x] Add focused tests for neutral table-view alias generation, SQL policy extraction/readiness, grant safety, `security_invoker` enforcement, no write/backfill/drop/policy-migration behavior, deterministic artifact generation, stale SQL row failures, missing queue coverage, missing validation SQL, incorrect completion failures, uncovered scanner row failures, pending safe-action failures, docs-as-config refusal, and matching committed artifact pass behavior.
- [x] Add focused tests for SQL policy predicate extraction/normalization, generated linked-verification SQL determinism, missing queue/verification/table-view evidence failures, policy DDL rejection, forward-migration readiness integration, final reconciliation integration, artifact hygiene, CI wiring, change-impact, production evidence, PR summary, and comprehensive pipeline wiring.
- [x] Add focused tests for SQL policy forward-migration blueprint generation, deterministic SQL output, missing predicate/queue/verification/table-view evidence failures, executable DDL/grant/write rejection, forward-migration readiness integration, final reconciliation integration, artifact hygiene, CI wiring, change-impact, production evidence, PR summary, and comprehensive pipeline wiring.
- [x] Add safe forward migration staging for the remaining data-bearing table/view rows through read-only neutral compatibility views.
- [x] Stage predicate-equivalence evidence and generated linked-verification SQL for retained SQL policy rows.
- [x] Stage a non-executing forward-migration blueprint for retained SQL policy rows.
- [ ] Add safe forward migrations and perform linked predicate-equivalence verification for retained SQL policy rows.
- [ ] Apply SQL alias migrations in production.
- [ ] Perform linked Supabase verification against production or a production-linked read-only target.
- [ ] Remove legacy SQL object names after compatibility queues say `ready_for_removal`.

Default verification:

- `node --test scripts/check-sql-policy-forward-migration-blueprint.test.mjs scripts/check-versioned-forward-migration-readiness.test.mjs scripts/check-versioned-final-checklist-reconciliation.test.mjs`
- `npm run check:versioned-forward-migration-readiness`
- `npm run check:versioned-final-checklist-reconciliation`
- `npm run check:versioned-code-only-closure`
- `npm run check:versioned-unchecked-objective-readiness`
- `npm run check:sql-object-reference-inventory`
- `npm run check:sql-object-rename-staging`
- `npm run check:sql-neutral-table-view-aliases`
- `npm run check:sql-policy-alias-readiness`
- `npm run check:sql-policy-predicate-equivalence`
- `npm run check:sql-policy-forward-migration-blueprint`
- `npm run check:sql-rename-verification-sql`
- `npm run check:sql-security-automation-coverage`
- `npm run check:compatibility-removal-queue`
- `npm run check:generated-artifact-hygiene`
- `npm run check:baseline-registry`
- `npm run check:hardening-ci-wiring`
- `npm run check:ci-change-impact`

## Objective 18. Final Zero-Version Enforcement

Production risk reduced: prevents regression after cleanup is complete.

- [ ] Switch `check:versioned-naming` to fail on any versioned name not explicitly classified as legitimate non-product version terminology.
- [ ] Remove temporary aliases only after compatibility queues say `ready_for_removal`.
- [ ] Delete stale removal-queue entries after old names are removed.
- [ ] Delete transitional bridge code that no longer has consumers.
- [ ] Refresh all baselines and artifacts.
- [ ] Add final CI gate that blocks new `v[0-9]+` product names in paths, commands, telemetry, SQL objects, and routes.

Default verification:

- `npm run check:versioned-naming`
- `npm run check:compatibility-removal-queue`
- `npm run check:generated-artifact-hygiene`
- `npm run check:hardening-ci-wiring`
- `npm run check:ci-change-impact`
- `npm run report:hardening-pr-summary`
- `git diff --check`

## Suggested Batch Order

1. Inventory and queue all remaining versioned names.
2. Rename local-only tests and fixtures.
3. Rename internal source modules.
4. Rename scripts and package scripts with aliases.
5. Replace test tags.
6. Add route and cron aliases.
7. Add telemetry aliases and bridge tests.
8. Add SQL aliases and rename staging migrations.
9. Refresh generated artifacts.
10. Clean documentation and external contracts.
11. Add batch evidence and rollback report.
12. Run broad verification.
13. Leave production cutovers and legacy removals as explicit manual follow-up.

## Verification Bundle

Run these before marking a batch complete:

- `node --test` for touched scripts.
- Targeted `vitest run` for touched source and tests.
- Targeted `playwright test` for renamed E2E files when practical.
- `npm run typecheck`.
- `npm run lint`.
- `npm run check:versioned-naming`.
- `npm run check:baseline-registry`.
- `npm run check:compatibility-removal-queue`.
- `npm run check:compatibility-route-inventory`.
- `npm run check:telemetry-event-inventory`.
- `npm run check:sql-object-reference-inventory`.
- `npm run check:sql-object-rename-staging`.
- `npm run check:generated-artifact-hygiene`.
- `npm run check:hardening-ci-wiring`.
- `npm run check:ci-change-impact`.
- `npm run check:documentation-runtime-dependencies`.
- `git diff --check`.

Do not run these as part of autonomous code-only cleanup unless explicitly requested:

- `npm run check:supabase:prod`.
- `npm run check:supabase:prod:deep`.
- Any command that applies production migrations.
- Any command that changes provider dashboards, traffic routing, scheduler settings, or secrets.
