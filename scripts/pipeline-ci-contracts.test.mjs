import test from "node:test";
import assert from "node:assert/strict";
import { CI_STATIC_MUST_PASS_STEPS, CI_STATIC_PARALLEL_STEPS } from "./pipelines/pipeline-ci-static.mjs";
import { CI_PARITY_STEPS } from "./pipelines/pipeline-ci-parity.mjs";
import { SECURITY_COMPREHENSIVE_STEPS } from "./pipelines/pipeline-security-comprehensive.mjs";
import { VERIFY_DOMAIN_PASS_STEPS, VERIFY_FIRST_PASS_STEPS, VERIFY_PARITY_STEPS } from "./pipelines/pipeline-verify.mjs";

test("pipeline-ci-static exports expected must-pass and parallel guards", () => {
  assert.deepEqual(CI_STATIC_MUST_PASS_STEPS.slice(0, 3), [
    "check:migrations",
    "check:api-route-tests",
    "check:api-route-auth-contract",
  ]);
  assert.equal(CI_STATIC_PARALLEL_STEPS.includes("test:scripts:unit"), true);
  assert.equal(CI_STATIC_PARALLEL_STEPS.includes("lint"), true);
  assert.equal(CI_STATIC_PARALLEL_STEPS.includes("typecheck"), true);
});

test("pipeline-ci-parity keeps the four parity guards", () => {
  assert.deepEqual(CI_PARITY_STEPS, [
    "check:github-workflows-security",
    "check:e2e:skip-baseline",
    "check:semgrep-rulepack-integrity",
    "check:wrapper-reintroduction",
  ]);
});

test("pipeline-verify still depends on ci-verify extras and ci parity", () => {
  assert.equal(VERIFY_FIRST_PASS_STEPS.includes("check:checks-integrity-meta"), true);
  assert.equal(VERIFY_DOMAIN_PASS_STEPS.includes("check:ci-verify-extras"), true);
  assert.deepEqual(VERIFY_PARITY_STEPS, ["pipeline:ci-parity"]);
});

test("pipeline-security-comprehensive retains key route, outbound, and server-action checks", () => {
  for (const step of [
    "check:api-route-auth-contract",
    "check:versioned-content-surface-coverage",
    "check:versioned-remaining-surface-coverage",
    "check:versioned-detailed-objective-coverage",
    "check:versioned-public-contract-preservation",
    "check:versioned-public-runtime-dual-read",
    "check:versioned-forward-migration-readiness",
    "check:versioned-source-config-preservation",
    "check:versioned-export-download-contracts",
    "check:versioned-package-script-readiness",
    "check:neutral-naming-rules",
    "check:versioned-manual-surface-closure",
    "check:versioned-open-objective-closure",
    "check:versioned-compatibility-equivalence",
    "check:versioned-local-surface-regression",
    "check:versioned-alias-usage-neutrality",
    "check:versioned-env-flag-aliases",
    "check:versioned-code-only-closure",
    "check:versioned-additive-alias-preservation",
    "check:versioned-unchecked-objective-readiness",
    "check:versioned-final-checklist-reconciliation",
    "check:route-universe",
    "check:catalog-script-index",
    "check:assurance-catalog-drift",
    "check:e2e-generated-drift",
    "check:api-route-admin-org-scope",
    "check:server-action-auth-contract",
    "check:server-action-org-scope",
    "check:server-action-exports",
    "check:outbound-fetch",
    "check:outbound-domain-allowlist",
    "check:csp-nonce-hash-consistency",
    "check:xss-client-exposure",
    "check:dangerously-set-inner-html",
    "check:postmessage-origins",
    "check:client-storage-sensitivity",
    "check:security-report-checksums",
    "check:next-public-surface",
    "check:auth-callback-guardrails",
    "check:sensitive-action-step-up",
    "check:json-body-limited-adoption",
    "check:timeout-budget-guards",
    "check:pagination-guardrails",
    "check:concurrency-cap-guards",
    "check:sql-neutral-table-view-aliases",
    "check:sql-policy-alias-readiness",
    "check:sql-policy-predicate-equivalence",
    "check:sql-policy-forward-migration-blueprint",
    "check:sql-rename-verification-sql",
    "check:sql-security-automation-coverage",
    "check:migration-history-version-exceptions",
    "check:seed-versioned-name-queue-coverage",
  ]) {
    assert.equal(SECURITY_COMPREHENSIVE_STEPS.includes(step), true);
  }
  assert.deepEqual(SECURITY_COMPREHENSIVE_STEPS.slice(-3), ["lint", "typecheck", "test"]);
});
