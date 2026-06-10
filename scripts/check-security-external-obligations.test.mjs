import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeSecurityExternalObligations } from "./check-security-external-obligations.mjs";

function write(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-external-obligations-"));
  write(root, "config/security-external-obligations.json", {
    version: 2,
    obligations: [{ id: "ext-test-control", owner: "security", reviewCycle: "annual" }],
  });
  write(root, "config/maximal-security-closure-register.json", {
    "ext-test-control": { status: "external", path: "config/security-external-obligations.json" },
  });
  return root;
}

test("advisory mode validates registry shape without requiring evidence", () => {
  const report = analyzeSecurityExternalObligations({ root: makeRoot(), strict: false });
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.mode, "advisory");
});

test("strict mode fails closed when external evidence is missing", () => {
  const report = analyzeSecurityExternalObligations({
    root: makeRoot(),
    strict: true,
    nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
  });
  assert.equal(report.ok, false);
  assert(report.issues.some((row) => row.issue === "external_obligations_evidence_missing"));
});

test("strict mode accepts complete external evidence metadata", () => {
  const root = makeRoot();
  write(root, "artifacts/security-external-obligations-evidence.json", {
    schemaVersion: 1,
    generatedFrom: "config/security-external-obligations.json",
    obligations: [
      {
        id: "ext-test-control",
        status: "reviewed",
        reviewer: "@security",
        reviewedAt: "2026-01-01",
        expiresAt: "2026-12-31",
        evidenceRef: "external://vendor-portal/test-control",
      },
    ],
  });
  const report = analyzeSecurityExternalObligations({
    root,
    strict: true,
    nowMs: Date.parse("2026-01-02T00:00:00.000Z"),
  });
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});
