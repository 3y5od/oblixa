#!/usr/bin/env node
/**
 * Maximal code QA orchestrator (plan: twelfth expansion).
 *
 * Dedupes vs qa:sweep:max:p4: starts from P4 as a single gate, then adds governance/contract bundle
 * and Playwright legs not duplicated inside P4.
 *
 * Env:
 * - QA_MAXIMAL_SUBSET=1 — qa:sweep:max:p1 + smoke + waiver registry.
 * - QA_MAXIMAL_SKIP_PLAYWRIGHT=1 — omit Playwright legs (CI static shard).
 * - QA_MAXIMAL_PLAYWRIGHT_ONLY=1 — only Playwright legs (CI matrix); maps PLAYWRIGHT_SHARD_* → SHARD_*.
 * - QA_MAXIMAL_INCLUDE_ULTIMATE=1 — qa:sweep:ultimate:nightly (optional; overlaps P4 + more).
 * - QA_MAXIMAL_INCLUDE_POSTMERGE=1 — qa:sweep:ultimate:postmerge.
 * - QA_MAXIMAL_DISCOVER_CHECK_UNION=1 — tail check:qa-discovered-union (needs batch total env in that script).
 * - PLAYWRIGHT_VISUAL_CONTINUE=1 — append test:e2e:visual:full:continue (non-blocking).
 * - QA_MAXIMAL_MULTI_BROWSER=1 — prepend test:e2e:multi-browser (optional).
 * - QA_MAXIMAL_EXTENDED_LEGS=1 — extra Playwright bundles (v10 matrix + a11y).
 * - GITHUB_EVENT_NAME=schedule — default-on ultimate + multi-browser + extended legs (CI cron).
 */
import { runNpmScript } from "../lib/process.mjs";

const isSchedule = process.env.GITHUB_EVENT_NAME === "schedule";
if (isSchedule) {
  if (!process.env.QA_MAXIMAL_INCLUDE_ULTIMATE) process.env.QA_MAXIMAL_INCLUDE_ULTIMATE = "1";
  if (!process.env.QA_MAXIMAL_MULTI_BROWSER) process.env.QA_MAXIMAL_MULTI_BROWSER = "1";
}
const extendedLegs =
  process.env.QA_MAXIMAL_EXTENDED_LEGS === "1" ||
  process.env.QA_MAXIMAL_EXTENDED_LEGS === "true" ||
  isSchedule;

/** @typedef {{ script: string, required?: boolean }} Step */

async function runStep(script, required = true) {
  const startedAt = Date.now();
  const result = await runNpmScript(script);
  return {
    script,
    required,
    ok: result.ok,
    code: result.code,
    durationMs: Date.now() - startedAt,
  };
}

function mapShardEnv() {
  if (process.env.PLAYWRIGHT_SHARD_INDEX && !process.env.SHARD_INDEX) {
    process.env.SHARD_INDEX = process.env.PLAYWRIGHT_SHARD_INDEX;
  }
  if (process.env.PLAYWRIGHT_SHARD_TOTAL && !process.env.SHARD_TOTAL) {
    process.env.SHARD_TOTAL = process.env.PLAYWRIGHT_SHARD_TOTAL;
  }
}

/** @returns {Step[]} */
function playwrightLegs() {
  const legs = [
    { script: "test:e2e:resilience:all", required: true },
    { script: "test:e2e:adversarial", required: true },
    { script: "test:e2e:current-product", required: true },
    { script: "test:e2e:compatibility", required: true },
    { script: "test:e2e:i18n-matrix", required: true },
    { script: "test:e2e:maximal-playwright-bundle", required: true },
    { script: "test:e2e:shard", required: true },
  ];
  if (process.env.PLAYWRIGHT_VISUAL_CONTINUE === "1" || process.env.PLAYWRIGHT_VISUAL_CONTINUE === "true") {
    legs.push({ script: "test:e2e:visual:full:continue", required: false });
  }
  if (process.env.QA_MAXIMAL_MULTI_BROWSER === "1" || process.env.QA_MAXIMAL_MULTI_BROWSER === "true") {
    legs.unshift({ script: "test:e2e:multi-browser", required: false });
  }
  if (extendedLegs) {
    legs.push(
      { script: "test:e2e:current-product:matrix", required: false },
      { script: "test:e2e:a11y", required: false }
    );
  }
  return legs;
}

/** @param {Step[]} steps */
async function runSequential(steps) {
  const results = [];
  for (const step of steps) {
    const required = step.required !== false;
    const out = await runStep(step.script, required);
    results.push(out);
    if (!out.ok && required) return results;
  }
  return results;
}

const subset = process.env.QA_MAXIMAL_SUBSET === "1" || process.env.QA_MAXIMAL_SUBSET === "true";
const playwrightOnly = process.env.QA_MAXIMAL_PLAYWRIGHT_ONLY === "1" || process.env.QA_MAXIMAL_PLAYWRIGHT_ONLY === "true";
const skipPw = process.env.QA_MAXIMAL_SKIP_PLAYWRIGHT === "1" || process.env.QA_MAXIMAL_SKIP_PLAYWRIGHT === "true";

mapShardEnv();

/** @type {Step[]} */
let steps = [];

if (subset) {
  steps = [
    { script: "qa:sweep:max:p1", required: true },
    { script: "test:e2e:smoke", required: true },
    { script: "check:qa-waiver-registry", required: true },
  ];
} else if (playwrightOnly) {
  steps = [...playwrightLegs()];
} else {
  steps = [{ script: "qa:sweep:max:p4", required: true }];

  if (process.env.QA_MAXIMAL_INCLUDE_ULTIMATE === "1" || process.env.QA_MAXIMAL_INCLUDE_ULTIMATE === "true") {
    steps.push({ script: "qa:sweep:ultimate:nightly", required: false });
  }
  if (process.env.QA_MAXIMAL_INCLUDE_POSTMERGE === "1" || process.env.QA_MAXIMAL_INCLUDE_POSTMERGE === "true") {
    steps.push({ script: "qa:sweep:ultimate:postmerge", required: false });
  }

  steps.push({ script: "check:qa-maximal-bundle", required: true });
  steps.push({ script: "check:qa-waiver-registry", required: true });

  if (process.env.QA_MAXIMAL_DISCOVER_CHECK_UNION === "1" || process.env.QA_MAXIMAL_DISCOVER_CHECK_UNION === "true") {
    steps.push({ script: "check:qa-discovered-union", required: true });
  }

  if (!skipPw) {
    steps.push(...playwrightLegs());
  }
}

const results = await runSequential(steps);
const failed = results.find((r) => !r.ok && r.required);
console.log(
  JSON.stringify(
    {
      pipeline: "qa-code-maximal",
      subset,
      playwrightOnly,
      skipPlaywright: skipPw,
      stepCount: steps.length,
      results,
    },
    null,
    2
  )
);
process.exit(failed ? failed.code ?? 1 : 0);
