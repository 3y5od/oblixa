#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "./lib/scheduler.mjs";

export const OPENAPI_SPEC_CONTRACT_STEPS = ["check:openapi-route-coverage", "check:openapi-yaml-integrity"];

export async function runOpenapiSpecContractCheck() {
  const results = await runSequential(OPENAPI_SPEC_CONTRACT_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return { pipeline: "openapi-spec-contract", results, exitCode: failed ? failed.code : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runOpenapiSpecContractCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.exitCode);
}