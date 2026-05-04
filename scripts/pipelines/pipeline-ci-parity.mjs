#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { runParallel } from "../lib/scheduler.mjs";

export const CI_PARITY_STEPS = [
  "check:github-workflows-security",
  "check:e2e:skip-baseline",
  "check:semgrep-rulepack-integrity",
  "check:wrapper-reintroduction",
];

export async function runPipelineCiParity() {
  const results = await runParallel(CI_PARITY_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "ci-parity", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runPipelineCiParity();
  console.log(JSON.stringify({ pipeline: report.pipeline, results: report.results }, null, 2));
  process.exit(report.exitCode);
}
