#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const strict = process.argv.includes("--strict");
const ROOT = process.cwd();
const baseline = JSON.parse(readFileSync(path.join(ROOT, "scripts", "hardening-debt-baseline.json"), "utf8"));
const current = JSON.parse(
  execFileSync("node", [path.join(ROOT, "scripts", "report-hardening-debt.mjs")], {
    encoding: "utf8",
  })
);

const maxDelta = Number.isFinite(baseline.maxDelta) ? baseline.maxDelta : 0;
const checks = [
  { key: "skipCount", delta: current.skipCount - baseline.skipCount },
  { key: "skipProblemCount", delta: current.skipProblemCount - baseline.skipProblemCount },
  { key: "allowlistedApiRoutes", delta: current.allowlistedApiRoutes - baseline.allowlistedApiRoutes },
  { key: "v8ExemptionRows", delta: current.v8ExemptionRows - baseline.v8ExemptionRows },
  ...(typeof baseline.ownerMetadataIssues === "number"
    ? [{ key: "ownerMetadataIssues", delta: current.ownerMetadataIssues - baseline.ownerMetadataIssues }]
    : []),
  ...(typeof baseline.integrationCoverageViolations === "number"
    ? [
        {
          key: "integrationCoverageViolations",
          delta: current.integrationCoverageViolations - baseline.integrationCoverageViolations,
        },
      ]
    : []),
  ...(typeof baseline.concurrencyHotspots === "number"
    ? [{ key: "concurrencyHotspots", delta: current.concurrencyHotspots - baseline.concurrencyHotspots }]
    : []),
  ...(typeof baseline.concurrencyAllowlistMetadataIssues === "number"
    ? [
        {
          key: "concurrencyAllowlistMetadataIssues",
          delta:
            current.concurrencyAllowlistMetadataIssues - baseline.concurrencyAllowlistMetadataIssues,
        },
      ]
    : []),
  ...(typeof baseline.concurrencyStaleAllowlistRoutes === "number"
    ? [
        {
          key: "concurrencyStaleAllowlistRoutes",
          delta: current.concurrencyStaleAllowlistRoutes - baseline.concurrencyStaleAllowlistRoutes,
        },
      ]
    : []),
];
const violations = checks.filter((c) => c.delta > maxDelta);
const regressions = {
  skipCount: checks.find((c) => c.key === "skipCount")?.delta ?? 0,
  skipProblemCount: checks.find((c) => c.key === "skipProblemCount")?.delta ?? 0,
  allowlistedApiRoutes: checks.find((c) => c.key === "allowlistedApiRoutes")?.delta ?? 0,
  v8ExemptionRows: checks.find((c) => c.key === "v8ExemptionRows")?.delta ?? 0,
  ownerMetadataIssues: checks.find((c) => c.key === "ownerMetadataIssues")?.delta ?? 0,
  integrationCoverageViolations: checks.find((c) => c.key === "integrationCoverageViolations")?.delta ?? 0,
  concurrencyHotspots: checks.find((c) => c.key === "concurrencyHotspots")?.delta ?? 0,
  concurrencyAllowlistMetadataIssues:
    checks.find((c) => c.key === "concurrencyAllowlistMetadataIssues")?.delta ?? 0,
  concurrencyStaleAllowlistRoutes:
    checks.find((c) => c.key === "concurrencyStaleAllowlistRoutes")?.delta ?? 0,
};

console.log(
  JSON.stringify(
    {
      baseline,
      current,
      checks,
      maxDelta,
      strict,
      violationCount: violations.length,
      violations,
      regressions,
    },
    null,
    2
  )
);

if (strict && violations.length > 0) {
  process.exit(1);
}
