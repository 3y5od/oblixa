#!/usr/bin/env node
/**
 * QA cost / wall-clock regression gate vs artifacts/baseline/qa-cost.json
 * QA_COST_STRICT=1 fails when estimated minutes exceed baseline by >25%.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const baselinePath = path.join(root, "artifacts", "baseline", "qa-cost.json");
const strict = process.env.QA_COST_STRICT === "1" || process.env.QA_COST_STRICT === "true";

let baseline = { totalWallClockMinutesEstimate: 0, jobs: {} };
try {
  baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
} catch {
  if (strict) {
    console.error(JSON.stringify({ ok: false, error: "missing_baseline", baselinePath }, null, 2));
    process.exit(1);
  }
}

const baselineTotal = Number(baseline.totalWallClockMinutesEstimate) || 0;
const currentEstimate = Number(process.env.QA_COST_CURRENT_MINUTES) || 0;

let ok = true;
let reason = null;
if (strict && baselineTotal > 0 && currentEstimate > baselineTotal * 1.25) {
  ok = false;
  reason = "cost_regression_over_25pct";
}

const payload = {
  checkId: "qa-cost-estimate",
  ok,
  strict,
  baselineTotal,
  currentEstimate,
  reason,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(ok ? 0 : 1);
