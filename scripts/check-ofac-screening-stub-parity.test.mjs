import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeOfacScreeningStubParity } from "./check-ofac-screening-stub-parity.mjs";

function makeRoot(sample, expected = createHash("sha256").update(sample).digest("hex")) {
  const root = mkdtempSync(path.join(tmpdir(), "oblixa-ofac-check-"));
  mkdirSync(path.join(root, "artifacts"), { recursive: true });
  writeFileSync(path.join(root, "artifacts/ofac-sdn-sample-placeholder.txt"), sample);
  writeFileSync(path.join(root, "artifacts/ofac-sdn-sample.sha256"), `${expected}  ofac-sdn-sample-placeholder.txt\n`);
  return root;
}

test("accepts matching sample hash", () => {
  const report = analyzeOfacScreeningStubParity(makeRoot("sample\n"));
  assert.equal(report.ok, true);
});

test("rejects mismatched sample hash", () => {
  const report = analyzeOfacScreeningStubParity(makeRoot("sample\n", "0".repeat(64)));
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "ofac_sample_hash_mismatch");
});
