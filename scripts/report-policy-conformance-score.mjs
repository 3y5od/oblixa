#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const debt = JSON.parse(
  execFileSync("node", [path.join(ROOT, "scripts", "report-hardening-debt.mjs")], { encoding: "utf8" })
);

const penalties = {
  skipProblems: Math.min(40, debt.skipProblemCount ?? 0),
  allowlistMetadata: Math.min(20, (debt.allowlistMetadataIssues ?? 0) * 5),
  uncoveredApiRoutes: Math.min(30, (debt.uncoveredApiRoutes ?? 0) * 10),
  rateLimitViolations: Math.min(30, (debt.rateLimitViolations ?? 0) * 10),
  exemptionRows: Math.min(10, debt.v8ExemptionRows ?? 0),
  ownerMetadataIssues: Math.min(20, (debt.ownerMetadataIssues ?? 0) * 5),
  integrationCoverageViolations: Math.min(20, (debt.integrationCoverageViolations ?? 0) * 10),
  concurrencyHotspots: Math.min(20, Math.floor((debt.concurrencyHotspots ?? 0) / 10)),
};

const totalPenalty = Object.values(penalties).reduce((a, b) => a + b, 0);
const score = Math.max(0, 100 - totalPenalty);
const status = score >= 90 ? "strong" : score >= 75 ? "watch" : "at_risk";
const remediationCandidates = [
  {
    control: "skip_governance",
    priority: debt.skipProblemCount > 0 ? "high" : "low",
    action: "Add or renew skip metadata and reduce total skips in highest-signal suites.",
  },
  {
    control: "concurrency_hotspots",
    priority: debt.concurrencyHotspots > 0 ? "high" : "low",
    action: "Add idempotency/dedup safeguards or governed allowlist metadata for mutation routes.",
  },
  {
    control: "api_allowlist_governance",
    priority: debt.allowlistMetadataIssues > 0 ? "high" : "low",
    action: "Fix allowlist metadata and convert high-risk allowlisted routes to colocated tests.",
  },
  {
    control: "integration_resilience",
    priority: debt.integrationCoverageViolations > 0 ? "high" : "low",
    action: "Add deterministic negative-path integration tests and rerun strict integration resilience checks.",
  },
].sort((a, b) => (a.priority === "high" && b.priority !== "high" ? -1 : a.priority === b.priority ? 0 : 1));

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      score,
      status,
      penalties,
      remediationCandidates,
      inputs: debt,
    },
    null,
    2
  )
);
