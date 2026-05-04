#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const COVERAGE_COMPLETENESS_BUNDLE_STEPS = ["report:coverage-completeness", "check:coverage-completeness:inner"];

export async function runCoverageCompletenessBundle() {
  const results = await runSequential(COVERAGE_COMPLETENESS_BUNDLE_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "coverage-completeness", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runCoverageCompletenessBundle();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}