#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();

function runJson(scriptName, args = []) {
  const raw = execFileSync("node", [path.join(ROOT, "scripts", scriptName), ...args], {
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

const skip = runJson("report-test-skip-governance.mjs", ["--report"]);
const api = runJson("check-api-route-tests.mjs", ["--report"]);
const rateLimit = runJson("check-api-route-rate-limit-coverage.mjs", ["--report"]);
const owner = runJson("check-owner-metadata.mjs", ["--report"]);
const integration = runJson("report-integration-contract-surface.mjs");
const concurrency = runJson("report-concurrency-hotspots.mjs");
const exemptions = JSON.parse(
  readFileSync(path.join(ROOT, "src/lib/product-surface/v8-test-exemptions.json"), "utf8")
);

const report = {
  generatedAt: new Date().toISOString(),
  skipCount: skip.skipCount,
  skipProblemCount: skip.problemCount,
  allowlistedApiRoutes: api.allowlistedCount,
  uncoveredApiRoutes: api.uncoveredCount,
  allowlistMetadataIssues: api.allowlistMetadataIssueCount,
  rateLimitViolations: rateLimit.violationCount,
  v8ExemptionRows: Array.isArray(exemptions) ? exemptions.length : 0,
  ownerMetadataIssues: owner.issueCount,
  ownerMetadataWarnings: owner.warningCount ?? 0,
  integrationCoverageViolations: integration.violationCount ?? 0,
  concurrencyHotspots: concurrency.hotspotCount ?? 0,
  concurrencyAllowlistMetadataIssues: concurrency.allowlistMetadataIssueCount ?? 0,
  concurrencyStaleAllowlistRoutes: concurrency.staleAllowlistCount ?? 0,
};

console.log(JSON.stringify(report, null, 2));
