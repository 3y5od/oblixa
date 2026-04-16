#!/usr/bin/env node
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const roots = ["src/app/api/integrations", "src/app/api/stripe", "src/app/api/external-actions"].map((p) =>
  join(ROOT, p)
);
const strict = process.argv.includes("--strict");
const negativePathSignalRe =
  /toBe\((400|401|403|404|409|422|429|500)\)|toThrow|rejects|invalid|missing|error|timeout|rate\s*limit/i;
const replayIdempotencySignalRe =
  /idempot|replay|duplicate|dedupe|already\s+processed|409|conflict|idempotency-key/i;
const compatibilitySignalRe = /schema|version|compat|payload|shape|field|backward|additive/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const rows = [];
for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const file of walk(root)) {
    const testFile = file.replace(/route\.ts$/, "route.test.ts");
    const testSource = existsSync(testFile) ? readFileSync(testFile, "utf8") : "";
    rows.push({
      route: file.replace(`${ROOT}/`, ""),
      hasColocatedTest: existsSync(testFile),
      hasNegativePathSignal: negativePathSignalRe.test(testSource),
      hasReplayOrIdempotencySignal: replayIdempotencySignalRe.test(testSource),
      hasCompatibilitySignal: compatibilitySignalRe.test(testSource),
    });
  }
}

const enforceReplayCompat = process.argv.includes("--enforce-replay-compat");
const coverageViolations = rows.filter((r) => {
  if (!r.hasColocatedTest || !r.hasNegativePathSignal) return true;
  if (!enforceReplayCompat) return false;
  return !r.hasReplayOrIdempotencySignal && !r.hasCompatibilitySignal;
});
const report = {
  strict,
  enforceReplayCompat,
  routeCount: rows.length,
  withoutColocatedTest: rows.filter((r) => !r.hasColocatedTest).length,
  withoutNegativePathSignal: rows.filter((r) => !r.hasNegativePathSignal).length,
  withoutReplayOrIdempotencySignal: rows.filter((r) => !r.hasReplayOrIdempotencySignal).length,
  withoutCompatibilitySignal: rows.filter((r) => !r.hasCompatibilitySignal).length,
  violationCount: coverageViolations.length,
  violations: coverageViolations,
  rows,
};
console.log(JSON.stringify(report, null, 2));

if (strict && coverageViolations.length > 0) {
  process.exit(1);
}
