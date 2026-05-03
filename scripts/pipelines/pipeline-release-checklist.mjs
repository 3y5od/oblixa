#!/usr/bin/env node

import { runSequential } from "../lib/scheduler.mjs";

/** Staging/cron probes need a reachable app; CI enforces. Local release-tier sweeps may omit a running `next start`. */
const comprehensivePassRequired =
  process.env.GITHUB_ACTIONS === "true" || process.env.COMPREHENSIVE_PASS_REQUIRED === "1";

/** Playwright auth smokes need seeded creds or an explicit remote base URL; skip locally when unset. */
function releaseE2eRequired() {
  if (process.env.RELEASE_CHECKLIST_SKIP_E2E === "1") return false;
  if (process.env.GITHUB_ACTIONS === "true") return true;
  const email = process.env.E2E_TEST_EMAIL?.trim();
  const password = process.env.E2E_TEST_PASSWORD?.trim();
  if (email && password) return true;
  return Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
}

const e2eRequired = releaseE2eRequired();

const steps = [
  "preflight:release",
  "check:v10-release-evidence",
  "check:v10-suite",
  "verify",
  { script: "check:comprehensive-pass", required: comprehensivePassRequired },
];
if (e2eRequired) {
  steps.push("test:e2e:v10", "test:e2e");
}

const results = await runSequential(steps);
const failed = results.find((result) => !result.ok && result.required);
console.log(JSON.stringify({ pipeline: "release-checklist", results }, null, 2));
process.exit(failed ? failed.code : 0);
