#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const reportPath =
  process.env.PLAYWRIGHT_JSON_REPORT ?? path.join(ROOT, "test-results", "playwright-report.json");

if (!existsSync(reportPath)) {
  console.log(
    JSON.stringify(
      {
        reportPath,
        found: false,
        message: "Playwright JSON report not found; skipping stability telemetry.",
      },
      null,
      2
    )
  );
  process.exit(0);
}

let raw;
try {
  raw = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(
    JSON.stringify(
      {
        reportPath,
        found: false,
        malformed: true,
        message: `Playwright JSON report is invalid: ${message}`,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!raw || typeof raw !== "object" || !Array.isArray(raw.suites)) {
  console.log(
    JSON.stringify(
      {
        reportPath,
        found: false,
        malformed: true,
        message: "Playwright JSON report is missing required suites payload.",
      },
      null,
      2
    )
  );
  process.exit(0);
}

const stats = {
  reportPath,
  found: true,
  malformed: false,
  suites: 0,
  specs: 0,
  tests: 0,
  expected: 0,
  flaky: 0,
  unexpected: 0,
  skipped: 0,
  passOnRetry: 0,
};

function walkSuites(suites) {
  for (const suite of suites ?? []) {
    stats.suites += 1;
    for (const spec of suite.specs ?? []) {
      stats.specs += 1;
      for (const test of spec.tests ?? []) {
        stats.tests += 1;
        const outcome = test.outcome ?? "unknown";
        if (outcome === "expected") stats.expected += 1;
        else if (outcome === "flaky") {
          stats.flaky += 1;
          stats.passOnRetry += 1;
        } else if (outcome === "unexpected") stats.unexpected += 1;
        else if (outcome === "skipped") stats.skipped += 1;
      }
    }
    walkSuites(suite.suites);
  }
}

walkSuites(raw.suites);
console.log(JSON.stringify(stats, null, 2));
