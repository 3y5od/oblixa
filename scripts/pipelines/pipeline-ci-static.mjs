#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { runParallel, runSequential } from "../lib/scheduler.mjs";

export const CI_STATIC_MUST_PASS_STEPS = [
  "check:migrations",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-exports",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:vercel-cron",
  "check:cron-route-auth",
];

export const CI_STATIC_PARALLEL_STEPS = [
  "test:scripts:unit",
  "check:security-static:strict:grep",
  "check:performance-static:strict",
  "check:bundle-budget",
  "check:server-action-complexity",
  "check:test-skip-governance",
  "check:type-lint-ratchet",
  "lint",
  "typecheck",
];

export async function runPipelineCiStatic() {
  const mustPass = await runSequential(CI_STATIC_MUST_PASS_STEPS);
  const earlyFailure = mustPass.find((result) => !result.ok && result.required);
  if (earlyFailure) {
    return { pipeline: "ci-static", results: mustPass, exitCode: earlyFailure.code };
  }

  const parallel = await runParallel(CI_STATIC_PARALLEL_STEPS);
  const results = [...mustPass, ...parallel];
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "ci-static", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runPipelineCiStatic();
  console.log(JSON.stringify({ pipeline: report.pipeline, results: report.results }, null, 2));
  process.exit(report.exitCode);
}
