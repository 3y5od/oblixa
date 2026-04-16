#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
function run(script) {
  return JSON.parse(execFileSync("node", [path.join(ROOT, "scripts", script)], { encoding: "utf8" }));
}

const release = run("report-release-readiness.mjs");
const owners = run("report-governance-owners.mjs");
const debt = run("report-hardening-debt.mjs");
const efficacy = run("report-control-efficacy.mjs");
const integration = run("report-integration-contract-surface.mjs");
const artifact = run("report-artifact-integrity.mjs");
const traceId = `audit-${Date.now()}`;

const completeness = {
  hasReleaseChecks: Array.isArray(release.checks),
  hasOwners: Array.isArray(owners.owners),
  hasDebtSnapshot: typeof debt.skipCount === "number",
  hasControlEfficacy: typeof efficacy.efficacyScore === "number",
  hasIntegrationContractSnapshot: typeof integration.routeCount === "number",
  hasArtifactIntegrity: typeof artifact.failedCount === "number",
  releaseHasGeneratedAt: typeof release.generatedAt === "string",
  debtHasGeneratedAt: typeof debt.generatedAt === "string",
  efficacyHasGeneratedAt: typeof efficacy.generatedAt === "string",
};

const missing = Object.entries(completeness)
  .filter(([, ok]) => !ok)
  .map(([k]) => k);

console.log(
  JSON.stringify(
    {
      traceId,
      generatedAt: new Date().toISOString(),
      completeness,
      missingCount: missing.length,
      missing,
      ownerCount: owners.ownerCount ?? 0,
      traceability: {
        traceId,
        releaseGeneratedAt: release.generatedAt ?? null,
        debtGeneratedAt: debt.generatedAt ?? null,
        efficacyGeneratedAt: efficacy.generatedAt ?? null,
      },
      evidenceRefs: [
        "scripts/report-release-readiness.mjs",
        "scripts/report-governance-owners.mjs",
        "scripts/report-hardening-debt.mjs",
        "scripts/report-control-efficacy.mjs",
        "scripts/report-integration-contract-surface.mjs",
        "scripts/report-artifact-integrity.mjs",
      ],
    },
    null,
    2
  )
);

if (missing.length > 0) process.exit(1);
