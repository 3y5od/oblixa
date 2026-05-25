import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyzeEnvContractHygiene } from "./check-env-contract-hygiene.mjs";

const REQUIRED_SCRIPTS = [
  "check:env-example-parity",
  "check:env-matrix",
  "check:security-env-contract",
  "check:secrets-env-token-quality",
  "check:static-secret-safety",
];

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-env-contract-hygiene-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writePackage(root, scripts = REQUIRED_SCRIPTS) {
  write(
    root,
    "package.json",
    JSON.stringify({ scripts: Object.fromEntries(scripts.map((script) => [script, "node scripts/example.mjs"])) }, null, 2),
  );
}

test("analyzeEnvContractHygiene classifies env keys without reading .env.local", () => {
  const root = makeRoot();
  writePackage(root);
  write(
    root,
    ".env.example",
    `NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STAGING_BASE_URL=
E2E_TEST_EMAIL=
`,
  );
  write(root, ".env.local", "ONLY_IN_LOCAL=should-not-be-read\n");
  write(root, "src/config.ts", "export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n");

  const report = analyzeEnvContractHygiene(root);

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.counts.publicKeys, 2);
  assert.equal(report.counts.productionSecretKeys, 1);
  assert(!JSON.stringify(report).includes("ONLY_IN_LOCAL"));
});

test("analyzeEnvContractHygiene rejects sensitive unapproved NEXT_PUBLIC keys", () => {
  const root = makeRoot();
  writePackage(root);
  write(root, ".env.example", "NEXT_PUBLIC_INTERNAL_API_KEY=\n");

  const report = analyzeEnvContractHygiene(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "next_public_key_looks_sensitive"));
});

test("analyzeEnvContractHygiene rejects production secret values in .env.example", () => {
  const root = makeRoot();
  writePackage(root);
  write(root, ".env.example", "STRIPE_WEBHOOK_SECRET=whsec_fake_value\n");

  const report = analyzeEnvContractHygiene(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "production_secret_env_example_value_must_be_empty"));
});

test("analyzeEnvContractHygiene rejects undocumented process.env references", () => {
  const root = makeRoot();
  writePackage(root);
  write(root, ".env.example", "NEXT_PUBLIC_SUPABASE_URL=\n");
  write(root, "src/config.ts", "export const token = process.env.CRON_SECRET;\n");

  const report = analyzeEnvContractHygiene(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "process_env_reference_missing_from_env_example"));
});

test("analyzeEnvContractHygiene requires the aggregate package scripts", () => {
  const root = makeRoot();
  writePackage(root, REQUIRED_SCRIPTS.filter((script) => script !== "check:static-secret-safety"));
  write(root, ".env.example", "NEXT_PUBLIC_SUPABASE_URL=\n");

  const report = analyzeEnvContractHygiene(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_package_script" && issue.script === "check:static-secret-safety"));
});

