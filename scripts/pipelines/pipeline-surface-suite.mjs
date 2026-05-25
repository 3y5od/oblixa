#!/usr/bin/env node

import { runSequential } from "../lib/scheduler.mjs";

const steps = [
  "check:surface:hrefs:strict",
  "check:surface:vocabulary",
  "check:surface:page-inventory",
  "check:surface:api-inventory",
  "check:surface:action-inventory",
  "check:surface:api-eligibility",
  "check:surface:action-eligibility",
  "check:surface:denial-mapping",
  "check:surface:diagnostics-contract",
  "check:surface:supplemental-contracts",
  "check:route-inventory",
  "check:plan-ia",
  "check:refinement-api-coverage",
  "check:surface:acceptance-matrix",
  "check:surface:acceptance-criteria",
  "report:surface-inventory",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-auth-route-index",
  "check:api-route-rate-limit-coverage",
  "check:server-lib-admin",
  "check:cron-route-auth",
  "check:previous-release-suite",
  "check:release-suite-current",
];

const results = await runSequential(steps);
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "surface-suite", results }, null, 2));
process.exit(failed ? failed.code : 0);
