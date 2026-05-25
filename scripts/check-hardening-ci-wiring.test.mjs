import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeHardeningCiWiring,
  LOCAL_REQUIRED_CHECKS,
  OPTIONAL_CREDENTIAL_CHECKS,
} from "./check-hardening-ci-wiring.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hardening-ci-wiring-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root, { scripts = LOCAL_REQUIRED_CHECKS, ciChecks = LOCAL_REQUIRED_CHECKS } = {}) {
  const packageScripts = {};
  for (const script of [...scripts, ...OPTIONAL_CREDENTIAL_CHECKS]) {
    packageScripts[script] = "node scripts/example.mjs";
  }
  write(root, "package.json", JSON.stringify({ scripts: packageScripts }, null, 2));
  write(
    root,
    ".github/workflows/ci.yml",
    ciChecks.map((script) => `      - run: npm run ${script}`).join("\n"),
  );
}

test("analyzeHardeningCiWiring accepts wired local checks and reports credential checks as optional", () => {
  const root = makeRoot();
  writeFixture(root);

  const report = analyzeHardeningCiWiring(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.localRequiredChecks.length, LOCAL_REQUIRED_CHECKS.length);
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-detailed-objective-coverage"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-public-contract-preservation"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-public-runtime-dual-read"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-forward-migration-readiness"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-source-config-preservation"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-package-script-readiness"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:neutral-naming-rules"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-manual-surface-closure"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-open-objective-closure"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-compatibility-equivalence"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-local-surface-regression"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-alias-usage-neutrality"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-env-flag-aliases"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-code-only-closure"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-additive-alias-preservation"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-remaining-local-contract-closure"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-unchecked-objective-readiness"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:versioned-final-checklist-reconciliation"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:sql-neutral-table-view-aliases"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:sql-policy-alias-readiness"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:sql-policy-predicate-equivalence"));
  assert.ok(report.localRequiredChecks.some((row) => row.script === "check:sql-policy-forward-migration-blueprint"));
  assert.equal(report.optionalCredentialChecks.every((row) => row.credentialRequirement === "production"), true);
});

test("analyzeHardeningCiWiring fails on missing package scripts", () => {
  const root = makeRoot();
  writeFixture(root, { scripts: LOCAL_REQUIRED_CHECKS.filter((script) => script !== "check:supabase:snapshot") });

  const report = analyzeHardeningCiWiring(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "missing_package_script" && row.script === "check:supabase:snapshot"));
});

test("analyzeHardeningCiWiring fails on missing CI commands", () => {
  const root = makeRoot();
  writeFixture(root, { ciChecks: LOCAL_REQUIRED_CHECKS.filter((script) => script !== "check:compatibility-route-inventory") });

  const report = analyzeHardeningCiWiring(root);

  assert.equal(report.ok, false);
  assert.ok(
    report.issues.some(
      (row) => row.issue === "missing_ci_hardening_command" && row.script === "check:compatibility-route-inventory",
    ),
  );
});

test("analyzeHardeningCiWiring fails when credential checks are mandatory in CI", () => {
  const root = makeRoot();
  writeFixture(root, { ciChecks: [...LOCAL_REQUIRED_CHECKS, "check:supabase:prod"] });

  const report = analyzeHardeningCiWiring(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "credential_required_check_is_mandatory_ci"));
});

test("analyzeHardeningCiWiring fails when required local checks are reordered", () => {
  const root = makeRoot();
  writeFixture(root, { ciChecks: [...LOCAL_REQUIRED_CHECKS].reverse() });

  const report = analyzeHardeningCiWiring(root);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "hardening_ci_command_order_mismatch"));
});
