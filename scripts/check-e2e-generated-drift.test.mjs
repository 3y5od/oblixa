import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  E2E_GENERATED_ARTIFACTS,
  analyzeE2eGeneratedDrift,
} from "./check-e2e-generated-drift.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-e2e-drift-"));
}

function writeGeneratedArtifacts(root) {
  for (const artifact of E2E_GENERATED_ARTIFACTS) {
    const abs = path.join(root, artifact.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, artifact.source(), "utf8");
  }
}

test("e2e generated drift check accepts exact generator output", () => {
  const root = makeRoot();
  writeGeneratedArtifacts(root);

  const report = analyzeE2eGeneratedDrift(root);
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("e2e generated drift check rejects stale generated content", () => {
  const root = makeRoot();
  writeGeneratedArtifacts(root);
  fs.appendFileSync(path.join(root, "e2e/generated/public-routes.ts"), "\n// stale\n");

  const report = analyzeE2eGeneratedDrift(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "e2e_generated_artifact_drift" && issue.path === "e2e/generated/public-routes.ts"),
    true
  );
});

test("e2e generated drift check rejects missing generated files", () => {
  const root = makeRoot();
  writeGeneratedArtifacts(root);
  fs.unlinkSync(path.join(root, "e2e/generated/route-states.ts"));

  const report = analyzeE2eGeneratedDrift(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "missing_e2e_generated_artifact" && issue.path === "e2e/generated/route-states.ts"),
    true
  );
});
