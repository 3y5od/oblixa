#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const MAXIMAL_ASSURANCE_SCAFFOLDING_STEPS = [
  "check:maximal-assurance-plan-snapshot",
  "check:assurance-epics-registry",
  "check:assurance-program-semver",
  "check:assurance-waivers",
  "check:rls-sanity-tables",
  "check:catalog-script-index",
  "check:assurance-catalog-drift",
  "check:threat-row-coverage",
  "check:dashboard-start-transition-async",
  "verify:assurance-bundle-signature",
  "check:coverage-completeness",
  "check:assurance-epic-closure",
];

export async function runMaximalAssuranceScaffoldingCheck() {
  const results = await runSequential(MAXIMAL_ASSURANCE_SCAFFOLDING_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return {
    pipeline: "maximal-assurance-scaffolding",
    results,
    exitCode: failed ? failed.code : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runMaximalAssuranceScaffoldingCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}