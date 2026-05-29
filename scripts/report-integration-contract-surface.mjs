#!/usr/bin/env node
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
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

export function analyzeIntegrationContractSurface(
  root = ROOT,
  options = {}
) {
  const roots = ["src/app/api/integrations", "src/app/api/stripe", "src/app/api/external-actions"].map((p) =>
    join(root, p)
  );
  const strict = Boolean(options.strict);
  const enforceReplayCompat = Boolean(options.enforceReplayCompat);
  const rows = [];
  for (const routeRoot of roots) {
    if (!existsSync(routeRoot)) continue;
    for (const file of walk(routeRoot)) {
      const testFile = file.replace(/route\.ts$/, "route.test.ts");
      const testSource = existsSync(testFile) ? readFileSync(testFile, "utf8") : "";
      rows.push({
        route: file.replace(`${root}/`, ""),
        hasColocatedTest: existsSync(testFile),
        hasNegativePathSignal: negativePathSignalRe.test(testSource),
        hasReplayOrIdempotencySignal: replayIdempotencySignalRe.test(testSource),
        hasCompatibilitySignal: compatibilitySignalRe.test(testSource),
      });
    }
  }

  const coverageViolations = rows.filter((r) => {
    if (!r.hasColocatedTest || !r.hasNegativePathSignal) return true;
    if (!enforceReplayCompat) return false;
    return !r.hasReplayOrIdempotencySignal && !r.hasCompatibilitySignal;
  });
  return {
    strict,
    enforceReplayCompat,
    routeCount: rows.length,
    withoutColocatedTest: rows.filter((r) => !r.hasColocatedTest).length,
    withoutNegativePathSignal: rows.filter((r) => !r.hasNegativePathSignal).length,
    withoutReplayOrIdempotencySignal: rows.filter((r) => !r.hasReplayOrIdempotencySignal).length,
    withoutCompatibilitySignal: rows.filter((r) => !r.hasCompatibilitySignal).length,
    violationCount: coverageViolations.length,
    issueCount: coverageViolations.length,
    ok: coverageViolations.length === 0,
    violations: coverageViolations,
    rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeIntegrationContractSurface(ROOT, {
    strict: process.argv.includes("--strict"),
    enforceReplayCompat: process.argv.includes("--enforce-replay-compat"),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.strict && report.violationCount > 0) {
    process.exit(1);
  }
}
