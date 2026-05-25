import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeBaselineRegistry, discoverBaselineFiles } from "./check-baseline-registry.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "baseline-registry-"));
}

function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function registry(entries) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      baselines: entries,
    },
    null,
    2,
  );
}

function validEntry(overrides) {
  return {
    path: "scripts/owned-baseline.json",
    owner: "platform-hardening",
    purpose: "Fixture baseline ownership.",
    checkCommand: "node scripts/check-owned.mjs",
    refreshCommand: "manual: update after reviewed fixture change",
    sourceScanner: "scripts/check-owned.mjs",
    sourceScannerSha256: overrides.sourceScannerSha256,
    reviewTrigger: "Fixture scanner changes.",
    temporaryPaths: ["none"],
    ...overrides,
  };
}

test("valid registry accepts every discovered baseline artifact", () => {
  const root = makeRoot();
  const scanner = "export function scan() { return []; }\n";
  const costScanner = "export function estimate() { return 0; }\n";

  writeFile(root, "scripts/owned-baseline.json", "{}\n");
  writeFile(root, "scripts/check-owned.mjs", scanner);
  writeFile(root, "artifacts/baseline/qa-cost.json", "{}\n");
  writeFile(root, "scripts/check-cost.mjs", costScanner);
  writeFile(
    root,
    "scripts/baseline-registry.json",
    registry([
      validEntry({ sourceScannerSha256: sha256(scanner) }),
      validEntry({
        path: "artifacts/baseline/qa-cost.json",
        owner: "qa-platform",
        purpose: "Fixture QA cost baseline.",
        checkCommand: "npm run qa:cost:estimate",
        refreshCommand: "manual: update after reviewed QA budget change",
        sourceScanner: "scripts/check-cost.mjs",
        sourceScannerSha256: sha256(costScanner),
        reviewTrigger: "QA runtime budget changes.",
      }),
    ]),
  );

  assert.deepEqual(discoverBaselineFiles(root), [
    "artifacts/baseline/qa-cost.json",
    "scripts/owned-baseline.json",
  ]);

  const report = analyzeBaselineRegistry({ root });
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.discoveredBaselineCount, 2);
  assert.equal(report.registeredBaselineCount, 2);
});

test("missing registry ownership fails for discovered baselines", () => {
  const root = makeRoot();

  writeFile(root, "scripts/unowned-baseline.json", "{}\n");
  writeFile(root, "scripts/baseline-registry.json", registry([]));

  const report = analyzeBaselineRegistry({ root });
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.code),
    ["unregistered_baseline"],
  );
  assert.equal(report.issues[0].path, "scripts/unowned-baseline.json");
});

test("stale entries, scanner drift, and unsafe refresh commands fail", () => {
  const root = makeRoot();
  const scanner = "export function scan() { return ['changed']; }\n";

  writeFile(root, "scripts/owned-baseline.json", "{}\n");
  writeFile(root, "scripts/check-owned.mjs", scanner);
  writeFile(
    root,
    "scripts/baseline-registry.json",
    registry([
      validEntry({
        owner: "",
        refreshCommand: "node scripts/check-owned.mjs test-results",
        sourceScannerSha256: "0".repeat(64),
        temporaryPaths: ["test-results/**"],
      }),
      validEntry({
        path: "scripts/missing-baseline.json",
        sourceScannerSha256: sha256(scanner),
      }),
    ]),
  );

  const report = analyzeBaselineRegistry({ root });
  const codes = report.issues.map((issue) => issue.code).sort();

  assert.equal(report.ok, false);
  assert.deepEqual(codes, [
    "missing_required_field",
    "source_scanner_changed",
    "stale_registry_entry",
    "temporary_path_in_refresh_command",
  ]);
});
