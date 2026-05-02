#!/usr/bin/env node

import { runSequential } from "../lib/scheduler.mjs";

const steps = [
  "check:v8-hrefs:strict",
  "check:v8-vocabulary",
  "check:v8-page-inventory",
  "check:v8-api-inventory",
  "check:v8-action-inventory",
  "check:v8-api-eligibility",
  "check:v8-action-eligibility",
  "check:v8-denial-mapping",
  "check:v8-diagnostics-contract",
  "check:v8-supplemental-contracts",
  "check:route-inventory",
  "check:plan-ia",
  "check:refinement-api-coverage",
  "check:v8-acceptance-matrix",
  "check:v8-acceptance-criteria",
  "v8:inventory-report",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-auth-route-index",
  "check:api-route-rate-limit-coverage",
  "check:server-lib-admin",
  "check:cron-route-auth",
  "check:v9-suite",
  "check:v10-suite",
];

const results = await runSequential(steps);
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "surface-suite", results }, null, 2));
process.exit(failed ? failed.code : 0);
