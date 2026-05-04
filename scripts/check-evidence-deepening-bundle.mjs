#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const EVIDENCE_DEEPENING_BUNDLE_STEPS = ["check:subprocessors-drift", "check:branch-protection-drift"];

export async function runEvidenceDeepeningBundle() {
  const results = await runSequential(EVIDENCE_DEEPENING_BUNDLE_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "evidence-deepening-bundle", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runEvidenceDeepeningBundle();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}