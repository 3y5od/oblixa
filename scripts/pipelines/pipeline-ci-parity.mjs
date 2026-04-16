#!/usr/bin/env node

import { runParallel } from "../lib/scheduler.mjs";

const results = await runParallel([
  "check:github-workflows-security",
  "check:e2e:skip-baseline",
  "check:semgrep-rulepack-integrity",
  "check:wrapper-reintroduction",
]);

const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "ci-parity", results }, null, 2));
process.exit(failed ? failed.code : 0);
