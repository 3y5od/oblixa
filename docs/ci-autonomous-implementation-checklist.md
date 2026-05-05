# CI Autonomous Implementation Checklist

This checklist covers code, workflow, script, and config changes that can be implemented autonomously inside the repository to improve the likelihood that GitHub Actions stays green.

This checklist intentionally excludes:

- documentation-only work
- repository settings changes that cannot be expressed in code
- secret provisioning, third-party account setup, or org-level policy changes outside the repo

## Scope

Use this document for changes that can be completed by editing files under:

- `.github/workflows/`
- `scripts/`
- `src/`
- `artifacts/`
- `config/`
- repo-root scanner or CI config files

## Status Legend

- `[ ]` not implemented
- `[x]` implemented

## 1. Immediate Blocking CI Fixes

- [ ] Fix the Semgrep blocking finding in [src/lib/security/cron-route-gate.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/security/cron-route-gate.ts:55).
Objective: remove log text that matches authorization or bearer-token logging heuristics without losing operator signal.
Done when: the `quality_security` Semgrep command passes locally with the current ruleset.

- [ ] Preserve the cron-wrapper recognition fix in [scripts/check-job-lock-guards.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/check-job-lock-guards.mjs:8).
Objective: treat shared cron wrappers as satisfying auth and rate-limit coverage so wrapper migrations do not fail static CI.
Done when: `npm run check:job-lock-guards` passes and wrapper-backed cron routes are accepted.

- [ ] Preserve the regression tests in [scripts/check-job-lock-guards.test.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/check-job-lock-guards.test.mjs:14).
Objective: prevent future regressions in wrapper-aware cron guard detection.
Done when: `npm run test:scripts:unit` includes these tests and they pass.

- [ ] Preserve the `.test.mjs` handling and ignore-list updates in [scripts/check-unused-script-files.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/check-unused-script-files.mjs:45).
Objective: stop governance/codehealth checks from flagging legitimate script tests and known scaffolds as unused.
Done when: `npm run check:unused-script-files` passes with zero false positives.

## 2. Secret-Gated Workflow Behavior

- [ ] Convert `quality_build_e2e` in [ci.yml](/Users/dizhou/Documents/Cursor/oblixa/.github/workflows/ci.yml:525) to skip by default when auth secrets are absent.
Objective: optional E2E lanes must not fail the full CI fanout just because repo secrets are missing.
Done when: the gate emits `run=false` and a notice instead of `exit 1` when `E2E_TEST_EMAIL` or `E2E_TEST_PASSWORD` is unset.

- [ ] Convert `runtime_comprehensive_pass` in [ci.yml](/Users/dizhou/Documents/Cursor/oblixa/.github/workflows/ci.yml:832) to skip by default when staging/runtime secrets are absent.
Objective: secret-gated post-quality validation should not create a red status by default.
Done when: missing secrets produce a skipped execution path and neutral workflow outcome.

- [ ] Convert `Cron Canary` in [cron-canary.yml](/Users/dizhou/Documents/Cursor/oblixa/.github/workflows/cron-canary.yml:19) to skip by default when `STAGING_BASE_URL` or `CRON_SECRET` is absent.
Objective: scheduled health workflows should not fail solely because protected secrets are unavailable.
Done when: missing secrets emit a notice and a skip path instead of an error path.

- [ ] Convert `SLO Monitor` in [slo-monitor.yml](/Users/dizhou/Documents/Cursor/oblixa/.github/workflows/slo-monitor.yml:16) to skip by default when its secrets are absent.
Objective: optional operational monitoring must not create recurring red scheduled runs.
Done when: the workflow completes green with an explicit skip notice when secrets are missing.

- [ ] Convert `Load smoke optional` in [load-smoke-optional.yml](/Users/dizhou/Documents/Cursor/oblixa/.github/workflows/load-smoke-optional.yml:14) to skip by default when `STAGING_BASE_URL` is absent.
Objective: align workflow behavior with its optional naming.
Done when: missing staging URL no longer fails the workflow.

- [ ] Convert the late onboarding full credential assertions in [ci.yml](/Users/dizhou/Documents/Cursor/oblixa/.github/workflows/ci.yml:782) to an explicit skip path.
Objective: optional onboarding-deep lanes should not fail late after the workflow has already opted in conditionally.
Done when: missing auth secrets produce a notice and skip.

- [ ] Introduce a single reusable helper pattern for secret-gated workflows.
Objective: remove hand-copied shell gate logic across workflow files.
Scope: shared composite action or checked-in shell helper consumed by `ci.yml`, `cron-canary.yml`, `slo-monitor.yml`, and `load-smoke-optional.yml`.
Done when: all secret-gated workflows use one consistent contract for `run=true`, `run=false`, notices, and optional fail-closed mode.

- [ ] Add explicit opt-in variables for fail-closed behavior instead of implicit failure on missing secrets.
Objective: make strictness deliberate and machine-readable.
Scope: variables such as `REQUIRE_CI_E2E_AUTH`, `REQUIRE_RUNTIME_COMPREHENSIVE`, `REQUIRE_CRON_CANARY`, and `REQUIRE_SLO_MONITOR`.
Done when: all affected workflows can be strict when requested and skip otherwise.

## 3. Gitleaks False Positive Remediation

- [ ] Add a repo-level `.gitleaks.toml` with narrow allowlists.
Objective: eliminate known false positives without suppressing real secret detection.
Done when: local `gitleaks detect` no longer fails on the current known benign identifiers and the allowlist is file- and pattern-scoped.

- [ ] Address `todoKey` false positives in [artifacts/assurance/epics.json](/Users/dizhou/Documents/Cursor/oblixa/artifacts/assurance/epics.json:10) and [artifacts/assurance/epic-closure.json](/Users/dizhou/Documents/Cursor/oblixa/artifacts/assurance/epic-closure.json:9).
Objective: reduce the highest-volume source of scanner noise.
Options: targeted allowlist, rename to `todoId`, or both.
Done when: these generated artifacts no longer trip Gitleaks.

- [ ] Address `candidateKey` and `releaseEvidenceKey` false positives in [src/lib/v10-final-gap-audit.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-final-gap-audit.ts:1175), [src/lib/v9-release-contract.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v9-release-contract.ts:142), [src/lib/v10-objective-measurements.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-objective-measurements.ts:126), [src/lib/v10-no-exclusions-matrix.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-no-exclusions-matrix.ts:97), [src/lib/v10-zero-exclusion-report.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-zero-exclusion-report.ts:54), and [src/lib/v10-complete-closure.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-complete-closure.ts:109).
Objective: reduce scanner-hostile naming in V10 release evidence structures.
Done when: these identifiers no longer appear in blocking Gitleaks results.

- [ ] Address generic `key:` type-field false positives in [src/lib/v10-contract-health.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-contract-health.ts:11), [src/lib/v10-domain-depth-contracts.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-domain-depth-contracts.ts:2), [src/lib/v10-operational-contracts.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-operational-contracts.ts:218), [src/lib/v10-read-models.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-read-models.ts:87), and [src/lib/v10-final-gap-audit.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-final-gap-audit.ts:113).
Objective: reduce generic-api-key false positives in type-heavy catalog code.
Done when: type-field names are either allowlisted precisely or renamed to clearer domain-specific identifiers.

- [ ] Address the phase-id false positive in [scripts/lib/autonomous-perf-phase-closure-lib.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/lib/autonomous-perf-phase-closure-lib.mjs:77).
Objective: prevent a non-secret phase identifier from failing the secret scan lane.
Done when: the phase id no longer appears in Gitleaks findings.

- [ ] Add a verification check that `.gitleaks.toml` stays narrow.
Objective: prevent the allowlist from becoming a broad suppression bucket.
Done when: CI fails if the allowlist adds uncontrolled wildcards or unapproved directories.

## 4. Naming Cleanup for Scanner-Hostile Identifiers

- [ ] Rename `todoKey` to a less secret-like identifier where churn is acceptable.
Objective: reduce future scanner false positives at the source.
Scope: generators, checks, and generated JSON artifacts that consume or emit this field.
Done when: downstream scripts still pass and generated artifacts remain consistent.

- [ ] Rename `candidateKey` to `candidateId` or equivalent where churn is acceptable.
Objective: make deprecation-cleanup inventory identifiers clearer and less scanner-hostile.
Done when: all dependent code and tests compile and pass.

- [ ] Rename `releaseEvidenceKey` to `releaseEvidenceId` or `releaseEvidenceRef` where churn is acceptable.
Objective: clarify that the value is a catalog identifier, not a credential.
Done when: dependent V10 report/build/test scripts remain green.

- [ ] Rename broad `key` DTO fields to domain-specific names where feasible.
Objective: improve readability and reduce scanner ambiguity.
Examples: `metricKey`, `rowKey`, `compatibilityKey`, `deductionId`, `contractKey`.
Done when: type signatures remain explicit and no downstream report generation breaks.

## 5. Script Race and Flake Hardening

- [ ] Harden [scripts/check-no-executable-notebooks.mjs](/Users/dizhou/Documents/Cursor/oblixa/scripts/check-no-executable-notebooks.mjs:9) against transient `ENOENT`.
Objective: avoid failures when files disappear during a build or cleanup.
Done when: the script tolerates disappearing files and still reports deterministically.

- [ ] Exclude transient build output such as `.next` from the notebook walker.
Objective: stop source-scanning checks from traversing generated runtime output.
Done when: the walker only scans durable source directories.

- [ ] Wrap file stat and directory walk operations defensively in script checks that scan the repo tree.
Objective: remove flake potential from concurrent filesystem changes.
Scope: begin with `check-no-executable-notebooks.mjs`, then audit similar recursive walkers under `scripts/`.
Done when: recursive scripts do not crash on transient filesystem churn.

- [ ] Add a unit test for the notebook-walker race case.
Objective: lock in the fix for disappearing files or generated directories.
Done when: `test:scripts:unit` includes a direct regression test for this behavior.

## 6. Build Warning Cleanup

- [ ] Replace invalid OG renderer style usage in [src/app/opengraph-image.tsx](/Users/dizhou/Documents/Cursor/oblixa/src/app/opengraph-image.tsx:99).
Objective: remove build-time warnings from the Open Graph image generation path.
Done when: `npm run build` no longer warns about `width: "fit-content"`.

- [ ] Reduce the NFT tracing warning triggered by runtime filesystem checks in [src/lib/v10-route-api-catalog.ts](/Users/dizhou/Documents/Cursor/oblixa/src/lib/v10-route-api-catalog.ts:2704).
Objective: avoid tracing the whole project unintentionally during production builds.
Done when: `npm run build` no longer warns that the whole project was traced due to runtime fs/path usage.

- [ ] Move runtime-irrelevant filesystem validation out of app-imported libraries and into script-only code paths.
Objective: keep build/runtime bundles free of repo-root filesystem introspection.
Scope: `existsSync(join(process.cwd(), ...))` style checks in V10 catalog and traceability helpers.
Done when: static validation remains available from scripts, but not from application runtime imports.

## 7. Workflow Topology and CI Integrity

- [ ] Add a check preventing new secret-gated workflows from introducing fail-by-default gates.
Objective: enforce skip-by-default policy in code.
Done when: CI fails if new workflow files gate on secrets by calling `exit 1` without an explicit strict variable.

- [ ] Add a check preventing optional workflows from being named or described as optional while failing by default.
Objective: align workflow semantics with naming.
Done when: optional workflows either skip neutrally or are renamed to required.

- [ ] Add a check ensuring aggregate required jobs only depend on stable, repo-controlled lanes.
Objective: keep `quality` as the branch-protection target without inheriting secret-dependent flakiness.
Done when: required aggregation excludes optional secret-gated jobs by construction.

- [ ] Add a local parity script for the GitHub Actions security lane.
Objective: make `quality_security` reproducible outside Actions.
Scope: wrapper command that runs Semgrep, Gitleaks, and dependency scanning in the same order as CI.
Done when: one local command reproduces the lane with actionable output.

- [ ] Add a local parity script for the GitHub Actions build/E2E lane with skip-aware gating.
Objective: make `quality_build_e2e` behavior inspectable without pushing.
Done when: one local command reproduces the gate and the runnable subset of the lane.

## 8. Security Lane Hardening

- [ ] Add a regression test preventing sensitive-auth log strings from reappearing.
Objective: block future reintroduction of `authorization`, `bearer`, or signature-related log wording where static rules disallow it.
Done when: a targeted script or unit test fails if those strings appear in protected logging sites.

- [ ] Keep `check:github-workflows-security` and strengthen it only if needed.
Objective: preserve pinning and workflow hygiene checks without widening scope unnecessarily.
Done when: current workflow security checks remain green and continue catching unpinned or unsafe patterns.

- [ ] Keep `check:github-scheduled-workflows-secrets` and adapt workflow code rather than weakening the check.
Objective: preserve policy coverage while changing runtime behavior to skip cleanly.
Done when: workflows and the registry check both pass together.

- [ ] Consider adding a CI-owned Gitleaks baseline test artifact only if narrow allowlisting is insufficient.
Objective: keep secret scanning strict while acknowledging known non-secret catalog strings.
Done when: secret scanning is green without broad suppression.

## 9. Generated Artifact and Registry Consistency

- [ ] Regenerate assurance artifacts after any field renames that affect emitted JSON.
Objective: keep generated registries and committed artifacts in sync.
Scope: epics registry, epic closure, scripts-to-epic map, coverage completeness, and dashboard artifacts.
Done when: the corresponding assurance checks pass with no drift.

- [ ] Add a focused check ensuring generated JSON field renames do not break consuming scripts.
Objective: safely support renames like `todoKey` -> `todoId`.
Done when: consumer scripts fail fast with a clear error if the shape drifts.

- [ ] Keep maximal-assurance scaffolding checks green after any renames.
Objective: prevent scanner-noise remediation from breaking assurance/reporting infrastructure.
Done when: `npm run check:maximal-assurance-scaffolding` passes after all related changes.

## 10. Nice-to-Have Autonomous Improvements

- [ ] Add a checked-in machine-readable inventory of secret-gated workflows and their strictness mode.
Objective: make optional-vs-required workflow policy easy to audit from scripts.
Done when: one artifact records workflow id, required secrets, default behavior, and strict variable.

- [ ] Add a checked-in machine-readable inventory of scanner allowlist entries.
Objective: make scanner exceptions auditable without opening tool-specific config only.
Done when: the inventory can be diffed and validated in CI.

- [ ] Add a dedicated `check:ci-autonomous` bundle script.
Objective: group the autonomous CI-hardening checks into one executable target.
Done when: one script covers workflow gating policy, scanner config integrity, and script-race hardening.

## 11. Verified Current Green Paths

These are not new tasks. They are already passing locally on the inspected checkout and should be preserved while implementing the checklist above.

- [x] `npm run pipeline:ci:static`
- [x] `npm run check:maximal-assurance-scaffolding`
- [x] `npm run test:scripts:checks` when run sequentially outside concurrent build mutation
- [x] `npm run check:security-static:strict:grep`
- [x] `npm audit --audit-level=high`
- [x] `npm run build` aside from current non-blocking warnings

## 12. Completion Condition

This checklist is complete when all of the following are true:

- every current code-implementable blocking finding in `quality_security` is resolved
- secret-gated optional workflows skip neutrally by default
- scanner false positives are eliminated through narrow allowlists or identifier cleanup
- repo-walking script checks are resilient to transient filesystem churn
- current build warnings caused by invalid styles or runtime filesystem tracing are removed
- all changed generators, artifacts, and CI integrity checks remain green locally
