#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const strict = process.argv.includes("--strict");
const baseline = JSON.parse(
  readFileSync(path.join(ROOT, "scripts", "playwright-stability-baseline.json"), "utf8")
);
const current = JSON.parse(
  execFileSync("node", [path.join(ROOT, "scripts", "report-playwright-stability.mjs")], {
    encoding: "utf8",
  })
);

const found = Boolean(current.found);
const violations = [];
// Only enforce JSON report presence on real GitHub Actions (after Playwright uploads).
// Local `CI=1` QA batch shards may run this check without a prior Playwright invocation.
if (!found && process.env.GITHUB_ACTIONS === "true") {
  violations.push({
    metric: "report_presence",
    current: 0,
    min: 1,
    reason: current.message ?? "Playwright report was not generated.",
  });
}

if (found) {
  if (current.malformed === true) {
    violations.push({
      metric: "report_malformed",
      current: 1,
      max: 0,
      reason: current.message ?? "Playwright report payload malformed.",
    });
  }
  if ((current.tests ?? 0) <= 0) {
    violations.push({
      metric: "tests_detected",
      current: current.tests ?? 0,
      min: 1,
      reason: "No tests found in Playwright JSON report.",
    });
  }
  if ((current.flaky ?? 0) > (baseline.maxFlaky ?? 0)) {
    violations.push({
      metric: "flaky",
      current: current.flaky ?? 0,
      max: baseline.maxFlaky ?? 0,
    });
  }
  if ((current.skipped ?? 0) > (baseline.maxSkipped ?? 0)) {
    violations.push({
      metric: "skipped",
      current: current.skipped ?? 0,
      max: baseline.maxSkipped ?? 0,
    });
  }
}

console.log(
  JSON.stringify(
    {
      baseline,
      current,
      strict,
      found,
      violationCount: violations.length,
      violations,
    },
    null,
    2
  )
);

if (strict && violations.length > 0) {
  process.exit(1);
}
