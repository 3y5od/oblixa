import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildSecurityControlCoverageMatrixPayload,
  writeSecurityControlCoverageMatrix,
} from "./build-security-control-coverage-matrix.mjs";

test("security control coverage matrix payload is deterministic and timestamp-free", () => {
  const payload = buildSecurityControlCoverageMatrixPayload();
  const ids = payload.rows.map((row) => row.sec_id);
  const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));

  assert.equal(payload.version, 1);
  assert.equal(Object.hasOwn(payload, "generated"), false);
  assert.equal(Object.hasOwn(payload, "generatedAt"), false);
  assert.deepEqual(ids, sortedIds);
  assert.equal(new Set(ids).size, ids.length);
});

test("security control coverage matrix writer appends a trailing newline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-control-coverage-"));
  const outputPath = path.join(root, "artifacts/security-control-coverage-matrix.rows.json");
  writeSecurityControlCoverageMatrix(outputPath);

  assert.equal(fs.readFileSync(outputPath, "utf8").endsWith("\n"), true);
});
