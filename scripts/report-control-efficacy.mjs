#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();

function runJson(scriptName, args = []) {
  const raw = execFileSync("node", [path.join(ROOT, "scripts", scriptName), ...args], {
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

const debt = runJson("report-hardening-debt.mjs");
const integrity = runJson("check-checks-integrity-meta.mjs");

const controls = [
  {
    name: "skip_governance",
    debtCount: Number(debt.skipProblemCount ?? 0),
    weight: 20,
  },
  {
    name: "api_allowlist_metadata",
    debtCount: Number(debt.allowlistMetadataIssues ?? 0) + Number(debt.ownerMetadataIssues ?? 0),
    weight: 20,
  },
  {
    name: "integration_contract_coverage",
    debtCount: Number(debt.integrationCoverageViolations ?? 0),
    weight: 15,
  },
  {
    name: "rate_limit_coverage",
    debtCount: Number(debt.rateLimitViolations ?? 0),
    weight: 15,
  },
  {
    name: "concurrency_hotspots",
    debtCount: Number(debt.concurrencyHotspots ?? 0),
    weight: 10,
  },
  {
    name: "checks_integrity",
    debtCount: Number(integrity.issueCount ?? 0),
    weight: 20,
  },
];

const rows = controls.map((control) => {
  const bounded = Math.min(100, control.debtCount * control.weight);
  const efficacy = Math.max(0, 100 - bounded);
  const stage = efficacy >= 90 ? "enforce" : efficacy >= 70 ? "guard" : "introduce";
  return {
    control: control.name,
    debtCount: control.debtCount,
    efficacy,
    status: efficacy >= 90 ? "strong" : efficacy >= 70 ? "watch" : "weak",
    stage,
    targetStage: efficacy >= 90 ? "enforce" : "guard",
    recommendedAction:
      control.debtCount > 0
        ? "Reduce debt count and maintain ratchet controls before strict promotion."
        : "Keep strict enforcement and monitor drift.",
  };
});

const weakestControls = [...rows]
  .sort((a, b) => a.efficacy - b.efficacy)
  .slice(0, 5);
const score =
  rows.reduce((sum, row) => sum + row.efficacy, 0) / (rows.length === 0 ? 1 : rows.length);

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      efficacyScore: Number(score.toFixed(2)),
      status: score >= 90 ? "strong" : score >= 70 ? "watch" : "at_risk",
      weakestControls,
      strictnessPromotionLadder: ["introduce", "guard", "enforce"],
      controls: rows,
    },
    null,
    2
  )
);
