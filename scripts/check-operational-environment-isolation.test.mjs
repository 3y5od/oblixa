import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOperationalEnvironmentIsolationReport,
  classifyEnvironmentKey,
  classifyEnvironmentValue,
} from "./check-operational-environment-isolation.mjs";

function write(root, rel, value) {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, value);
}

test("classifies environment values and keys without reading local env files", () => {
  assert.equal(classifyEnvironmentValue("http://127.0.0.1:54321"), "local");
  assert.equal(classifyEnvironmentValue("https://oblixa.io"), "production");
  assert.equal(classifyEnvironmentValue("pk_test_fixture"), "test");
  assert.equal(classifyEnvironmentValue("https://branch-preview.vercel.app"), "preview");
  assert.deepEqual(classifyEnvironmentKey("E2E_TEARDOWN_STRICT").classHints, ["test"]);
  assert.equal(classifyEnvironmentKey("SUPABASE_SERVICE_ROLE_KEY").sensitive, true);
});

test("reports unsafe live provider material in local-only env examples", () => {
  const root = mkdtempSync(path.join(tmpdir(), "oblixa-env-isolation-"));
  const pkg = {
    scripts: Object.fromEntries(
      [
        "check:operational-environment-isolation",
        "write:operational-environment-isolation",
        "test:operational-environment-isolation",
        "check:env-matrix",
        "check:e2e-env-matrix",
        "check:env-contract-hygiene",
        "check:env-example-parity",
        "check:security-env-contract",
        "check:release-security-required-env",
        "check:callback-destination-integrity",
        "check:auth-callback-guardrails",
        "check:supabase:seed-safety",
        "check:test-fixture-secrets",
        "check:test-fixture-pii-policy",
        "check:provider-integration-fixtures",
        "check:test-credential-reuse",
        "check:api-tenant-isolation",
        "check:deterministic-org-resolution",
        "check:operational-test-reliability-governance",
        "test:e2e:teardown",
      ].map((script) => [script, "echo ok"])
    ),
  };
  write(root, "package.json", `${JSON.stringify(pkg)}\n`);
  write(root, ".github/workflows/ci.yml", "run: npm run check:operational-environment-isolation\n");
  write(root, "config/e2e-env-matrix.json", JSON.stringify({ keys: [] }));
  write(
    root,
    "config/operational-environment-isolation.json",
    JSON.stringify({
      schemaVersion: 1,
      source: "code-owned-operational-environment-isolation",
      generatedArtifact: "artifacts/operational-environment-isolation.json",
      sourceFiles: [],
      requiredValidationCommands: [],
      environmentClasses: [],
      seedSafety: { seedFiles: [], allowedEmailDomains: [], allowedUuidPrefixes: [] },
      fixtureLifecycleControls: [],
      previewProviderControls: [],
    })
  );
  write(root, ".env.example", "NEXT_PUBLIC_SUPABASE_URL=\n");
  write(root, ".env.local.example", "STRIPE_SECRET_KEY=sk_live_1234567890123456\n");
  write(root, "supabase/seed.sql", "");

  const report = buildOperationalEnvironmentIsolationReport(root, { checkDrift: false });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "operational_environment_local_example_contains_live_secret"));
});
