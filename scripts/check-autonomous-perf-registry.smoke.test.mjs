import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTONOMOUS_PERF_EXT_KEYS } from "./lib/autonomous-perf-ext-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

test("autonomous perf handoff + groups match canonical EXT key list", () => {
  const handoff = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/autonomous-perf-external-handoff.keys.json"), "utf8"),
  );
  const grouped = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/autonomous-perf-ext-key-groups.json"), "utf8"),
  );
  const expected = [...AUTONOMOUS_PERF_EXT_KEYS].sort();
  assert.deepEqual(Object.keys(handoff.keys).sort(), expected);
  assert.deepEqual(Object.keys(grouped.groups).sort(), expected);
});

test("autonomous perf coverage matrix schema", () => {
  const cov = JSON.parse(
    fs.readFileSync(path.join(root, "artifacts/autonomous-perf-coverage-matrix.json"), "utf8"),
  );
  assert.equal(cov.schemaVersion, 1);
  assert.ok(cov.apiExportBufferPolicyBytes);
  assert.equal(typeof cov.apiExportBufferPolicyBytes.softDefaultMaxInMemory, "number");
  assert.ok(Array.isArray(cov.subtrees));
  for (const row of cov.subtrees) {
    assert.ok(typeof row.pathGlob === "string" && row.pathGlob.length > 0, "pathGlob");
    assert.ok(Array.isArray(row.phases), "phases");
    assert.ok("technology_absent" in row);
    assert.ok("lastReviewedCommit" in row);
  }
});

test("duplicate-deps react/next script exits 0 in workspace", () => {
  const script = path.join(root, "scripts", "autonomous-perf-duplicate-deps.mjs");
  const r = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("autonomous perf phase closure check script exits 0", () => {
  const script = path.join(root, "scripts", "check-autonomous-perf-phase-closure.mjs");
  const r = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
