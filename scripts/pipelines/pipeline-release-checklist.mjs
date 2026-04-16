#!/usr/bin/env node

import { runSequential } from "../lib/scheduler.mjs";

const results = await runSequential([
  "preflight:release",
  "verify",
  "check:comprehensive-pass",
  "test:e2e",
]);
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "release-checklist", results }, null, 2));
process.exit(failed ? failed.code : 0);
