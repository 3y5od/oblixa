#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { runParallel, runSequential } from "../lib/scheduler.mjs";

export const VERIFY_FIRST_PASS_STEPS = [
  "check:migrations:strict",
  "check:migration-smoke:current:strict",
  "check:release-evidence",
  "check:release-privacy-scan",
  "check:complete-closure",
  "check:release-suite-current",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-guard-normalization",
  "check:api-problem-json",
  "check:auth-error-consistency",
  "check:security-route-matrix",
  "check:api-route-admin-org-scope",
  "check:api-tenant-isolation",
  "check:rls-sanity-tables",
  "check:rls-policy-drift",
  "check:sql-security-migrations-bundle",
  "test:rls-smoke",
  "check:owner-metadata",
  "check:checks-integrity-meta",
  "check:config-drift",
  "check:branch-protection-drift",
];

export const VERIFY_DOMAIN_PASS_STEPS = [
  "check:performance-static:strict",
  "check:frontend-component-complexity",
  "check:server-action-complexity",
  "check:bundle-budget",
  "check:hardening-debt-ratchet",
  "check:integration-contract-resilience",
  "check:concurrency-hotspots-ratchet",
  "check:api-workspace-eligibility:strict",
  "check:incident-readiness:strict",
  "check:artifact-integrity",
  "check:ci-verify-extras",
  "check:qa-loading-routes",
  "check:qa-route-coverage-tsv",
  "check:qa-bug-log",
  "check:test-skip-governance",
  "check:refinement-acceptance-commands",
  "check:server-actions-inventory",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:deterministic-org-resolution",
  "check:server-action-negative-tests",
  "check:server-action-exports",
  "check:server-lib-admin",
  "check:role-capability-inventory",
  "check:type-lint-ratchet",
  "lint",
  "typecheck",
];

export const VERIFY_FINAL_PASS_STEPS = ["test:coverage", "check:surface:suite", "build"];
export const VERIFY_PARITY_STEPS = ["pipeline:ci-parity"];

export async function runPipelineVerify() {
  const firstPass = await runSequential(VERIFY_FIRST_PASS_STEPS);
  const blockingFailure = firstPass.find((result) => !result.ok && result.required);
  if (blockingFailure) {
    return { pipeline: "verify", results: firstPass, exitCode: blockingFailure.code };
  }

  const domainPass = await runParallel(VERIFY_DOMAIN_PASS_STEPS);
  const finalPass = await runSequential(VERIFY_FINAL_PASS_STEPS);
  const parity = await runSequential(VERIFY_PARITY_STEPS);

  const results = [...firstPass, ...domainPass, ...finalPass, ...parity];
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "verify", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runPipelineVerify();
  console.log(JSON.stringify({ pipeline: report.pipeline, results: report.results }, null, 2));
  process.exit(report.exitCode);
}
