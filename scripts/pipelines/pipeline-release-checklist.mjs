#!/usr/bin/env node

import { runSequential } from "../lib/scheduler.mjs";

/** Staging/cron probes need a reachable app; CI enforces. Local release-tier sweeps may omit a running `next start`. */
const comprehensivePassRequired =
  process.env.GITHUB_ACTIONS === "true" || process.env.COMPREHENSIVE_PASS_REQUIRED === "1";

const results = await runSequential([
  "preflight:release",
  "check:v10-release-evidence",
  "check:v10-suite",
  "verify",
  { script: "check:comprehensive-pass", required: comprehensivePassRequired },
  "test:e2e:v10",
  "test:e2e",
]);
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "release-checklist", results }, null, 2));
process.exit(failed ? failed.code : 0);
