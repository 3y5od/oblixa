import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildRatchetSnapshot } from "./report-ratchet-snapshot.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ratchet-snapshot-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("buildRatchetSnapshot reports baselines without timestamp churn", () => {
  const root = makeRoot();
  writeJson(root, "scripts/example-baseline.json", { baselineDate: "2026-05-23", count: 3 });

  const report = buildRatchetSnapshot({
    root,
    baselines: [{ id: "example", rel: "scripts/example-baseline.json" }],
    ratchetCandidates: [],
  });

  assert.equal(report.ok, true);
  assert.equal(report.baselineCount, 1);
  assert.equal(report.baselines[0].baselineDate, "2026-05-23");
  assert.equal("generatedAt" in report, false);
});

test("buildRatchetSnapshot lists ratchet candidates when counts go down", () => {
  const report = buildRatchetSnapshot({
    root: makeRoot(),
    baselines: [],
    ratchetCandidates: [
      { ratchet: "versioned-naming", path: "src/lib/current.ts", baseline: 2, current: 1, delta: -1 },
    ],
  });

  assert.equal(report.ratchetCandidateCount, 1);
  assert.equal(report.ratchetCandidates[0].delta, -1);
});
