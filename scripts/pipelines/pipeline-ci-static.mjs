#!/usr/bin/env node

import { runParallel, runSequential } from "../lib/scheduler.mjs";

const mustPass = await runSequential([
  "check:migrations",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-exports",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:vercel-cron",
  "check:cron-route-auth",
]);
const earlyFailure = mustPass.find((result) => !result.ok && result.required);
if (earlyFailure) {
  console.log(JSON.stringify({ pipeline: "ci-static", results: mustPass }, null, 2));
  process.exit(earlyFailure.code);
}

const parallel = await runParallel([
  "check:security-static:strict:grep",
  "check:performance-static:strict",
  "check:bundle-budget",
  "check:server-action-complexity",
  "check:test-skip-governance",
  "check:type-lint-ratchet",
  "lint",
  "typecheck",
]);

const results = [...mustPass, ...parallel];
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "ci-static", results }, null, 2));
process.exit(failed ? failed.code : 0);
