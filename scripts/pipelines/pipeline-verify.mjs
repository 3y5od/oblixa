#!/usr/bin/env node

import { runParallel, runSequential } from "../lib/scheduler.mjs";

const firstPass = await runSequential([
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
]);
const blockingFailure = firstPass.find((result) => !result.ok && result.required);
if (blockingFailure) {
  console.log(JSON.stringify({ pipeline: "verify", results: firstPass }, null, 2));
  process.exit(blockingFailure.code);
}

const domainPass = await runParallel([
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
]);

const finalPass = await runSequential(["test:coverage", "check:surface:suite", "build"]);

const parity = await runSequential(["pipeline:ci-parity"]);

const results = [...firstPass, ...domainPass, ...finalPass, ...parity];
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "verify", results }, null, 2));
process.exit(failed ? failed.code : 0);
