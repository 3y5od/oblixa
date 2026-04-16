#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const strict = process.argv.includes("--strict");
const ROOT = process.cwd();
const baselinePath = path.join(ROOT, "scripts", "e2e-skip-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const baselineSchemaValid =
  Number.isFinite(baseline.skipCount) &&
  Number.isFinite(baseline.problemCount) &&
  Number.isFinite(baseline.maxDelta);

const raw = execFileSync("node", [path.join(ROOT, "scripts", "report-test-skip-governance.mjs"), "--report"], {
  encoding: "utf8",
});
const report = JSON.parse(raw);
const skipDelta = report.skipCount - baseline.skipCount;
const problemDelta = report.problemCount - baseline.problemCount;
const maxDelta = Number.isFinite(baseline.maxDelta) ? baseline.maxDelta : 0;

const output = {
  baselinePath,
  baseline,
  baselineSchemaValid,
  current: {
    skipCount: report.skipCount,
    problemCount: report.problemCount,
  },
  deltas: {
    skipDelta,
    problemDelta,
  },
  maxDelta,
  strict,
};

console.log(JSON.stringify(output, null, 2));

if (strict && !baselineSchemaValid) {
  console.error("ERROR: e2e skip baseline schema is invalid.");
  process.exit(1);
}

if (strict && (skipDelta > maxDelta || problemDelta > maxDelta)) {
  console.error("ERROR: e2e skip/problem delta exceeded baseline tolerance.");
  process.exit(1);
}
