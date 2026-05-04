#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const ROUTE_FUNCTIONALITY_STEPS = ["check:route-universe", "check:red-metrics-json"];

export async function runRouteFunctionalityCheck() {
  const results = await runSequential(ROUTE_FUNCTIONALITY_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return {
    pipeline: "route-functionality",
    results,
    exitCode: failed ? failed.code : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runRouteFunctionalityCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}