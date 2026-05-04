import test from "node:test";
import assert from "node:assert/strict";
import { CI_VERIFY_EXTRA_STEPS } from "./check-ci-verify-extras.mjs";

test("CI verify extras bundle keeps expected ordered audits", () => {
  assert.deepEqual(CI_VERIFY_EXTRA_STEPS, [
    "check:outbound-events-context",
    "audit:client-hash-targets",
    "audit:core-email-copy:strict",
    "audit:nav-primary-vs-metadata",
    "audit:core-metadata",
    "audit:refinement-surface-area",
    "audit:marketing-identity:strict",
    "audit:ui-operational:strict",
  ]);
});

test("CI verify extras bundle has no duplicate steps", () => {
  assert.equal(new Set(CI_VERIFY_EXTRA_STEPS).size, CI_VERIFY_EXTRA_STEPS.length);
});