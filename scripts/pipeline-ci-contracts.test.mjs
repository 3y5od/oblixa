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
    "check:api-route-admin-org-scope",
    "check:server-action-auth-contract",
    "check:server-action-org-scope",
    "check:server-action-exports",
    "check:outbound-fetch",
    "check:outbound-domain-allowlist",
  ]) {
    assert.equal(SECURITY_COMPREHENSIVE_STEPS.includes(step), true);
  }
});