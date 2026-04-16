#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const issues = [];

const requiredFiles = [
  "scripts/check-api-route-tests.mjs",
  "scripts/check-api-route-auth-contract.mjs",
  "scripts/check-api-route-admin-org-scope.mjs",
  "scripts/check-server-action-exports.mjs",
  "scripts/check-server-action-auth-contract.mjs",
  "scripts/check-server-action-org-scope.mjs",
  "scripts/check-server-action-complexity.mjs",
  "scripts/check-security-env-contract.mjs",
  "scripts/check-required-security-checkset.mjs",
  "scripts/check-lockfile-integrity-drift.mjs",
  "scripts/check-sbom-integrity.mjs",
  "scripts/check-release-artifact-provenance.mjs",
  "scripts/check-ai-context-redaction.mjs",
  "scripts/check-ai-prompt-injection-guards.mjs",
  "scripts/check-ai-tool-call-authz.mjs",
  "scripts/check-token-security-quality.mjs",
  "scripts/check-report-redaction-contract.mjs",
  "scripts/check-feature-flag-security-bypass.mjs",
  "scripts/check-rate-limit-distribution-safety.mjs",
  "scripts/check-idempotency-policy.mjs",
  "scripts/check-job-lock-guards.mjs",
  "scripts/check-timeout-budget-guards.mjs",
  "scripts/check-owner-metadata.mjs",
  "scripts/check-hardening-debt-ratchet.mjs",
  "scripts/check-incident-readiness.mjs",
  "scripts/check-concurrency-hotspots-ratchet.mjs",
  "scripts/report-integration-contract-surface.mjs",
  "scripts/report-control-efficacy.mjs",
  "scripts/report-release-readiness.mjs",
  ".github/workflows/ci.yml",
  "scripts/pipelines/pipeline-ci-parity.mjs",
];

for (const rel of requiredFiles) {
  if (!existsSync(path.join(ROOT, rel))) {
    issues.push({ type: "missing_required_file", rel });
  }
}

const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const requiredScripts = [
  "verify",
  "verify:security",
  "check:api-route-tests",
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-exports",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-complexity",
  "check:security-env-contract",
  "check:required-security-checkset",
  "check:lockfile-integrity-drift",
  "check:sbom-integrity",
  "check:release-artifact-provenance",
  "check:ai-context-redaction",
  "check:ai-prompt-injection-guards",
  "check:ai-tool-call-authz",
  "check:token-security-quality",
  "check:report-redaction-contract",
  "check:feature-flag-security-bypass",
  "check:rate-limit-distribution-safety",
  "check:idempotency-policy",
  "check:job-lock-guards",
  "check:timeout-budget-guards",
  "check:owner-metadata",
  "check:hardening-debt-ratchet",
  "check:integration-contract-resilience",
  "check:concurrency-hotspots-ratchet",
  "check:test-skip-governance",
  "check:type-lint-ratchet",
];
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) {
    issues.push({ type: "missing_required_script", script });
  }
}

const ci = readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
for (const cmd of [
  "npm run check:api-route-tests",
  "npm run check:api-route-auth-contract",
  "npm run check:api-route-admin-org-scope",
  "npm run check:server-action-exports",
  "npm run check:server-action-auth-contract",
  "npm run check:server-action-org-scope",
  "npm run check:server-action-complexity",
  "npm run check:security-env-contract",
  "npm run check:required-security-checkset",
  "npm run check:lockfile-integrity-drift",
  "npm run check:sbom-integrity",
  "npm run check:release-artifact-provenance",
  "npm run check:ai-context-redaction",
  "npm run check:ai-prompt-injection-guards",
  "npm run check:ai-tool-call-authz",
  "npm run check:token-security-quality",
  "npm run check:report-redaction-contract",
  "npm run check:feature-flag-security-bypass",
  "npm run check:rate-limit-distribution-safety",
  "npm run check:idempotency-policy",
  "npm run check:job-lock-guards",
  "npm run check:timeout-budget-guards",
  "npm run check:owner-metadata",
  "npm run check:integration-contract-resilience",
  "npm run check:concurrency-hotspots-ratchet",
  "npm run check:test-skip-governance",
  "npm run check:type-lint-ratchet",
]) {
  if (!ci.includes(cmd)) {
    issues.push({ type: "ci_missing_command", cmd });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
