import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeGeneratedArtifactHygiene } from "./check-generated-artifact-hygiene.mjs";

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
