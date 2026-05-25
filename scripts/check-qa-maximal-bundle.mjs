#!/usr/bin/env node
/**
 * Static maximal bundle: governance checks + API/server-action contracts + artifact presence
 * + security.txt policy + lightweight repo policy greps (plan aggregation).
 */
import fs from "node:fs";
import path from "node:path";
import { runCommand, runNpmScript } from "./lib/process.mjs";

const root = process.cwd();

const npmScripts = [
  "check:qa-closure-manifest",
  "check:checks-integrity-meta",
  "check:test-skip-governance",
  "check:e2e:skip-baseline",
  "check:hardening-debt-ratchet",
  "check:control-traceability",
  "check:e2e-quarantine",
  "check:graphql-surface",
  "check:web3-surface-absent",
  "check:sar-surface-absent",
  "check:artifact-json-matrix",
  "check:artifact-integrity",
  "check:pen-test-findings-closure",
  "check:qa-workflow-fleet",
  "check:api-route-tests",
  "check:server-action-exports",
  "check:api-route-rate-limit-coverage",
  "check:api-route-admin-org-scope",
  "check:api-problem-json",
  "check:api-sunset-deprecation",
  "check:auth-cookie-attributes",
  "check:merge-queue-canary-parity",
  "check:dependabot-config",
  "check:branch-protection-drift",
  "check:lockfile-integrity-drift",
  "check:observability-contracts",
  "check:migrations",
  "report:bus-factor-codeowners",
  "check:qa-maximal-twelfth-expansion-closure",
  "check:supply-chain-security-matrix",
  "check:sbom-formats-vex-sarif",
  "check:container-signing-slsa-stub",
  "check:mutation-fuzz-load-stub",
  "check:flake-stabilization-note",
  "check:dependency-cycles-ratchet",
  "check:adr-required-paths-lint",
  "check:archaeology-legacy-touch-ratchet",
  "check:constant-time-spectre-doc-grep",
  "check:cla-dco-signed-commits-policy",
  "check:copyleft-transitive-license-graph",
  "check:vendor-geo-blocklist",
  "check:oauth-par-jar-dpop-stub",
  "check:control-traceability:strict",
  "check:e2e-quarantine:strict",
  "check:migrations:strict",
  "check:security-enforcement-matrix:strict",
  "check:security-fetch-sinks:strict",
  "check:subprocessors-drift:strict",
  "check:api-workspace-eligibility:strict",
  "check:migration-smoke:current:strict",
  "check:surface:hrefs:strict",
  "check:required-security-checkset",
  "check:security-report-checksums",
  "report:security-docs",
  "check:performance-static:strict",
  "check:license-sbom",
  "security:audit:maximal",
  "check:qa-comprehensive-taxonomy",
  "check:qa-taxonomy-strictness-sla",
];

function assertArtifacts() {
  const manifestPath = path.join(root, "config", "qa-maximal-artifacts-required.json");
  const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const missing = [];
  for (const rel of data.requiredArtifacts || []) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p) || fs.statSync(p).size < 2) missing.push(rel);
  }
  if (missing.length) {
    console.error(JSON.stringify({ ok: false, missing }, null, 2));
    process.exit(1);
  }
}

function assertSecurityTxt() {
  const p = path.join(root, "public", ".well-known", "security.txt");
  if (!fs.existsSync(p)) {
    console.error(JSON.stringify({ ok: false, reason: "missing_public_well_known_security_txt" }, null, 2));
    process.exit(1);
  }
  const body = fs.readFileSync(p, "utf8");
  if (!/Contact:/i.test(body)) {
    console.error(JSON.stringify({ ok: false, reason: "security_txt_missing_contact" }, null, 2));
    process.exit(1);
  }
}

function assertConstantTimeSpectreDoc() {
  const contract = path.join(root, "src/lib/integration/qa-ultimate-contracts.test.ts");
  const body = fs.readFileSync(contract, "utf8");
  if (!/constant[- ]time/i.test(body) || !/spectre/i.test(body)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "expected_constant_time_spectre_doc_trace",
          file: "src/lib/integration/qa-ultimate-contracts.test.ts",
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

async function main() {
  assertArtifacts();
  assertSecurityTxt();
  assertConstantTimeSpectreDoc();

  for (const entry of npmScripts) {
    const result = await runNpmScript(entry);
    if (!result.ok) {
      console.error(JSON.stringify({ ok: false, failed: entry, code: result.code }, null, 2));
      process.exit(result.code ?? 1);
    }
  }

  const drift = await runCommand("npx", ["vitest", "run", "src/lib/qa/artifact-json-matrix-drift.test.ts"], {
    cwd: root,
    stdio: "inherit",
  });
  if (!drift.ok) process.exit(drift.code ?? 1);

  const twelfth = await runCommand("npx", ["vitest", "run", "src/lib/qa/maximal-twelfth-expansion-behavior.test.ts"], {
    cwd: root,
    stdio: "inherit",
  });
  if (!twelfth.ok) process.exit(twelfth.code ?? 1);

  console.log(JSON.stringify({ ok: true, pipeline: "check-qa-maximal-bundle", scripts: npmScripts.length }, null, 2));
}

await main();
