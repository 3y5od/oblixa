#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const strict = process.argv.includes("--strict");
const ROOT = process.cwd();
const TRACKED_METRICS = [
  "skipCount",
  "skipProblemCount",
  "allowlistedApiRoutes",
  "v8ExemptionRows",
  "allowlistFileCount",
  "allowlistEntryCount",
  "allowlistMetadataIssues",
  "allowlistReviewMetadataIssues",
  "allowlistBroadPatternIssues",
  "allowlistHighRiskBypassIssues",
  "allowlistExpiredEntries",
  "allowlistStaleEntries",
  "ownerMetadataIssues",
  "integrationCoverageViolations",
  "concurrencyHotspots",
  "concurrencyAllowlistMetadataIssues",
  "concurrencyStaleAllowlistRoutes",
];

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function analyzeHardeningDebtRatchet({ baseline, current, strict: strictMode = false }) {
  const maxDelta = Number.isFinite(baseline.maxDelta) ? baseline.maxDelta : 0;
  const checks = TRACKED_METRICS.flatMap((key) => {
    const baselineValue = numberOrNull(baseline[key]);
    const currentValue = numberOrNull(current[key]);
    if (baselineValue === null || currentValue === null) return [];
    return [
      {
        key,
        baseline: baselineValue,
        current: currentValue,
        delta: currentValue - baselineValue,
      },
    ];
  });
  const violations = checks.filter((check) => check.delta > maxDelta);
  const ratchetCandidates =
    baseline.enforceRatchetDown === false ? [] : checks.filter((check) => check.delta < 0);
  const regressions = Object.fromEntries(
    TRACKED_METRICS.map((key) => [key, checks.find((check) => check.key === key)?.delta ?? 0])
  );

  return {
    baseline,
    current,
    checks,
    maxDelta,
    strict: strictMode,
    violationCount: violations.length,
    violations,
    ratchetCandidateCount: ratchetCandidates.length,
    ratchetCandidates,
    regressions,
    ok: violations.length === 0 && (!strictMode || ratchetCandidates.length === 0),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseline = JSON.parse(
    readFileSync(path.join(ROOT, "scripts", "hardening-debt-baseline.json"), "utf8")
  );
  const current = JSON.parse(
    execFileSync("node", [path.join(ROOT, "scripts", "report-hardening-debt.mjs")], {
      encoding: "utf8",
    })
  );
  const report = analyzeHardeningDebtRatchet({ baseline, current, strict });

  console.log(JSON.stringify(report, null, 2));

  if (strict && !report.ok) {
    process.exit(1);
  }
}
