import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzeGeneratedArtifactHygiene,
  DETERMINISTIC_GENERATED_ARTIFACT_PATHS,
  GENERATED_ARTIFACT_HYGIENE_PATHS,
  GENERATED_ARTIFACT_WRITE_COMMANDS,
} from "./check-generated-artifact-hygiene.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-artifact-hygiene-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2) + "\n");
}

test("generated artifact hygiene allows policy labels and scoped package names", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/sample.json", {
    rows: [
      { auth_type: "cron_secret", package: "@sentry/cli" },
      { bodyPolicy: "structured_action_payload" },
    ],
  });

  const report = analyzeGeneratedArtifactHygiene(root, { artifactPaths: ["artifacts/sample.json"] });
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("generated artifact hygiene rejects secret-shaped keys", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/sample.json", { apiKey: "placeholder" });

  const report = analyzeGeneratedArtifactHygiene(root, { artifactPaths: ["artifacts/sample.json"] });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "generated_artifact_secret_key");
});

test("generated artifact hygiene rejects raw provider payload fields", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/sample.json", { providerPayload: { id: "evt_1" } });

  const report = analyzeGeneratedArtifactHygiene(root, { artifactPaths: ["artifacts/sample.json"] });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "generated_artifact_provider_payload_key");
});

test("generated artifact hygiene rejects direct PII values", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/sample.json", { owner: "security@example.com" });

  const report = analyzeGeneratedArtifactHygiene(root, { artifactPaths: ["artifacts/sample.json"] });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "generated_artifact_email_address");
});

test("generated artifact hygiene rejects timestamps in deterministic artifacts", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/supabase/local-catalog-fingerprint.json", {
    schemaVersion: 1,
    generatedAt: "2026-05-23T12:00:00.000Z",
  });

  const report = analyzeGeneratedArtifactHygiene(root, {
    artifactPaths: ["artifacts/supabase/local-catalog-fingerprint.json"],
    deterministicArtifactPaths: ["artifacts/supabase/local-catalog-fingerprint.json"],
    writeCommands: {
      "artifacts/supabase/local-catalog-fingerprint.json": "npm run write:supabase:fingerprint-artifact",
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "deterministic_artifact_timestamp_key");
});

test("generated artifact hygiene reports safe regeneration metadata", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/supabase/local-catalog-fingerprint.json", {
    schemaVersion: 1,
    generatedBy: "scripts/check-supabase-fingerprint-artifact.mjs --write",
  });

  const report = analyzeGeneratedArtifactHygiene(root, {
    artifactPaths: ["artifacts/supabase/local-catalog-fingerprint.json"],
    deterministicArtifactPaths: ["artifacts/supabase/local-catalog-fingerprint.json"],
    writeCommands: {
      "artifacts/supabase/local-catalog-fingerprint.json": "npm run write:supabase:fingerprint-artifact",
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.deterministicArtifactCount, 1);
  assert.equal(report.safeToRegenerateCount, 1);
  assert.equal(report.artifactMetadata[0].safeToRegenerate, true);
});

test("generated artifact hygiene registers versioned content coverage artifacts", () => {
  for (const [rel, command] of [
    ["artifacts/compatibility/versioned-content-surface-coverage.json", "npm run write:versioned-content-surface-coverage"],
    ["artifacts/compatibility/versioned-remaining-surface-coverage.json", "npm run write:versioned-remaining-surface-coverage"],
    ["artifacts/compatibility/versioned-detailed-objective-coverage.json", "npm run write:versioned-detailed-objective-coverage"],
    ["artifacts/compatibility/versioned-public-runtime-dual-read.json", "npm run write:versioned-public-runtime-dual-read"],
    ["artifacts/compatibility/versioned-forward-migration-readiness.json", "npm run write:versioned-forward-migration-readiness"],
    ["artifacts/compatibility/versioned-package-script-readiness.json", "npm run write:versioned-package-script-readiness"],
    ["artifacts/compatibility/neutral-naming-rules.json", "npm run write:neutral-naming-rules"],
    ["artifacts/compatibility/versioned-manual-surface-closure.json", "npm run write:versioned-manual-surface-closure"],
    ["artifacts/compatibility/versioned-open-objective-closure.json", "npm run write:versioned-open-objective-closure"],
    ["artifacts/compatibility/versioned-local-surface-regression.json", "npm run write:versioned-local-surface-regression"],
    ["artifacts/compatibility/versioned-alias-usage-neutrality.json", "npm run write:versioned-alias-usage-neutrality"],
    ["artifacts/compatibility/versioned-env-flag-aliases.json", "npm run write:versioned-env-flag-aliases"],
    ["artifacts/compatibility/versioned-code-only-closure.json", "npm run write:versioned-code-only-closure"],
    ["artifacts/compatibility/versioned-additive-alias-preservation.json", "npm run write:versioned-additive-alias-preservation"],
    ["artifacts/compatibility/versioned-remaining-local-contract-closure.json", "npm run write:versioned-remaining-local-contract-closure"],
    ["artifacts/compatibility/versioned-unchecked-objective-readiness.json", "npm run write:versioned-unchecked-objective-readiness"],
    ["artifacts/compatibility/versioned-final-checklist-reconciliation.json", "npm run write:versioned-final-checklist-reconciliation"],
    ["artifacts/compatibility/versioned-export-download-contracts.json", "npm run write:versioned-export-download-contracts"],
    ["artifacts/supabase/sql-neutral-table-view-aliases.json", "npm run write:sql-neutral-table-view-aliases"],
    ["artifacts/supabase/sql-policy-alias-readiness.json", "npm run write:sql-policy-alias-readiness"],
    ["artifacts/supabase/sql-policy-predicate-equivalence.json", "npm run write:sql-policy-predicate-equivalence"],
    ["supabase/sql/policy-predicate-equivalence.sql", "npm run write:sql-policy-predicate-equivalence"],
    ["artifacts/supabase/sql-policy-forward-migration-blueprint.json", "npm run write:sql-policy-forward-migration-blueprint"],
    ["supabase/sql/policy-forward-migration-blueprint.sql", "npm run write:sql-policy-forward-migration-blueprint"],
    ["artifacts/supabase/sql-rename-verification-sql.json", "npm run write:sql-rename-verification-sql"],
    ["artifacts/supabase/sql-security-automation-coverage.json", "npm run write:sql-security-automation-coverage"],
    ["artifacts/supabase/migration-history-version-exceptions.json", "npm run write:migration-history-version-exceptions"],
    ["artifacts/supabase/seed-versioned-name-queue-coverage.json", "npm run write:seed-versioned-name-queue-coverage"],
  ]) {
    assert.ok(GENERATED_ARTIFACT_HYGIENE_PATHS.includes(rel));
    assert.ok(DETERMINISTIC_GENERATED_ARTIFACT_PATHS.includes(rel));
    assert.equal(GENERATED_ARTIFACT_WRITE_COMMANDS[rel], command);
  }
});
