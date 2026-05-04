#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const CI_VERIFY_EXTRA_STEPS = [
  "check:outbound-events-context",
  "audit:client-hash-targets",
  "audit:core-email-copy:strict",
  "audit:nav-primary-vs-metadata",
  "audit:core-metadata",
  "audit:refinement-surface-area",
  "audit:marketing-identity:strict",
  "audit:ui-operational:strict",
];

export async function runCiVerifyExtras() {
  const results = await runSequential(CI_VERIFY_EXTRA_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return {
    pipeline: "ci-verify-extras",
    results,
    exitCode: failed ? failed.code : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runCiVerifyExtras();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}