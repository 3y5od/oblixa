#!/usr/bin/env node
/**
 * Gate Epics 64 / nightly — compare coverage-completeness.json to coverage-threshold.json.
 * COVERAGE_THRESHOLD_STRICT=1 enforces minimums even when threshold mode is report-only.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const thresholdPath = path.join(root, "artifacts", "assurance", "coverage-threshold.json");
const completenessPath = path.join(root, "artifacts", "assurance", "coverage-completeness.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const strict =
  process.env.COVERAGE_THRESHOLD_STRICT === "1" || process.env.COVERAGE_THRESHOLD_STRICT === "true";
const threshold = loadJson(thresholdPath);
const mode = threshold.mode ?? "report-only";

if (!fs.existsSync(completenessPath)) {
  console.error("Missing artifacts/assurance/coverage-completeness.json — run npm run report:coverage-completeness");
  process.exit(strict ? 1 : 0);
}

const coverage = loadJson(completenessPath);
const mins = threshold.minimums ?? {};
const failures = [];

for (const [key, min] of Object.entries(mins)) {
  const val = key === "coverageScore" ? coverage.coverageScore : coverage.subscores?.[key];
  if (typeof val !== "number") continue;
  if (val < min) failures.push(`${key}: ${val} < minimum ${min}`);
}

if (failures.length && (strict || mode === "enforce")) {
  console.error("check-coverage-completeness failed:\n", failures.join("\n"));
  process.exit(1);
}

if (failures.length) {
  console.warn("WARN coverage below threshold (report-only):\n", failures.join("\n"));
} else {
  console.log("OK: coverage completeness meets configured minimums (or none enforced).");
}
