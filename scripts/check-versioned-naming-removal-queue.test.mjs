import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedNamingRemovalQueue,
  buildVersionedNamingRemovalQueue,
} from "./check-versioned-naming-removal-queue.mjs";
import { buildVersionedNamingBaseline, scanVersionedNaming } from "./check-versioned-naming.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-removal-queue-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("buildVersionedNamingRemovalQueue records owner, neutral name, condition, and validation command", () => {
  const root = makeRoot();
  write(root, "src/app/api/v10/example/route.ts", "export function GET() {}\n");
  write(root, "src/lib/v5/example.test.ts", "test('example', () => {});\n");
  writeJson(root, "scripts/versioned-naming-baseline.json", buildVersionedNamingBaseline(scanVersionedNaming(root)));

  const queue = buildVersionedNamingRemovalQueue(root);
  const routeEntry = queue.entries.find((entry) => entry.oldName === "src/app/api/v10/example/route.ts");
  const testEntry = queue.entries.find((entry) => entry.oldName === "src/lib/v5/example.test.ts");

  assert.equal(routeEntry.owner, "platform-api");
  assert.equal(routeEntry.surfaceClass, "api_routes");
  assert.equal(routeEntry.compatibilityClass, "compatibility_sensitive");
  assert.equal(routeEntry.neutralName, "src/app/api/example/route.ts");
  assert.equal(routeEntry.validationCommand, "npm run check:compatibility-route-inventory");
  assert.equal(testEntry.compatibilityClass, "source_owned");
  assert.equal(testEntry.validationCommand, "npm run check:versioned-naming-safe-renames");
});

test("analyzeVersionedNamingRemovalQueue rejects stale entries for removed files", () => {
  const root = makeRoot();
  writeJson(root, "scripts/versioned-naming-baseline.json", {
    schemaVersion: 2,
    fileCount: 1,
    totalHits: 1,
    files: [
      {
        path: "src/lib/v5/removed.test.ts",
        total: 1,
        tokens: { v5: 1 },
        sources: { path: 1 },
      },
    ],
  });
  writeJson(root, "scripts/versioned-naming-removal-queue.json", buildVersionedNamingRemovalQueue(root));

  const report = analyzeVersionedNamingRemovalQueue({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_naming_removal_queue_removed_file"));
});

test("analyzeVersionedNamingRemovalQueue rejects drift and missing metadata", () => {
  const root = makeRoot();
  write(root, "src/lib/v5/example.test.ts", "test('example', () => {});\n");
  writeJson(root, "scripts/versioned-naming-baseline.json", buildVersionedNamingBaseline(scanVersionedNaming(root)));
  writeJson(root, "scripts/versioned-naming-removal-queue.json", {
    schemaVersion: 1,
    entries: [{ oldName: "src/lib/v5/example.test.ts" }],
  });

  const report = analyzeVersionedNamingRemovalQueue({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_naming_removal_queue_missing_metadata"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_naming_removal_queue_drift"));
});
