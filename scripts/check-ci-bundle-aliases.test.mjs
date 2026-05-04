import test from "node:test";
import assert from "node:assert/strict";
import { COVERAGE_COMPLETENESS_BUNDLE_STEPS } from "./check-coverage-completeness-bundle.mjs";
import { EVIDENCE_DEEPENING_BUNDLE_STEPS } from "./check-evidence-deepening-bundle.mjs";
import { OPENAPI_SPEC_CONTRACT_STEPS } from "./check-openapi-spec-contract.mjs";
import { SQL_SECURITY_MIGRATIONS_BUNDLE_STEPS } from "./check-sql-security-migrations-bundle.mjs";

test("openapi spec contract bundle keeps route coverage before yaml integrity", () => {
  assert.deepEqual(OPENAPI_SPEC_CONTRACT_STEPS, ["check:openapi-route-coverage", "check:openapi-yaml-integrity"]);
});

test("coverage completeness bundle preserves report then inner check order", () => {
  assert.deepEqual(COVERAGE_COMPLETENESS_BUNDLE_STEPS, ["report:coverage-completeness", "check:coverage-completeness:inner"]);
});

test("sql security migrations bundle preserves strict sql audit ordering", () => {
  assert.deepEqual(SQL_SECURITY_MIGRATIONS_BUNDLE_STEPS, [
    "check:migration-security-patterns:strict-inner",
    "check:sql-definer-invoker-inventory",
  ]);
});

test("evidence deepening bundle keeps subprocessors before branch protection drift", () => {
  assert.deepEqual(EVIDENCE_DEEPENING_BUNDLE_STEPS, ["check:subprocessors-drift", "check:branch-protection-drift"]);
});