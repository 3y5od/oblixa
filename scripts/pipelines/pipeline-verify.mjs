#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { runParallel, runSequential } from "../lib/scheduler.mjs";

export const VERIFY_FIRST_PASS_STEPS = [
  "check:migrations:strict",
  "check:v10-migration-smoke:strict",
  "check:v10-release-evidence",
  "check:v10-privacy-scan",
  "check:v10-complete-closure",
  "check:v10-suite",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
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
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
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
