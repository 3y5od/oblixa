import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzePackageManager } from "./check-package-manager.mjs";

function makeFixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-package-manager-"));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

test("accepts pinned npm and matching Node major metadata", () => {
  const root = makeFixture({
    "package.json": `${JSON.stringify(
      {
        packageManager: "npm@11.13.0",
        engines: { node: ">=20.0.0" },
      },
      null,
      2
    )}\n`,
    ".nvmrc": "20\n",
  });

  assert.equal(analyzePackageManager(root).ok, true);
});

test("rejects missing package manager metadata", () => {
  const root = makeFixture({
    "package.json": `${JSON.stringify({ engines: { node: ">=20.0.0" } }, null, 2)}\n`,
    ".nvmrc": "20\n",
  });

  const report = analyzePackageManager(root);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue),
    ["missing_or_invalid_package_manager"]
  );
});

test("rejects Node major drift between package.json and .nvmrc", () => {
  const root = makeFixture({
    "package.json": `${JSON.stringify(
      {
        packageManager: "npm@11.13.0",
        engines: { node: ">=22.0.0" },
      },
      null,
      2
    )}\n`,
    ".nvmrc": "20\n",
  });

  const report = analyzePackageManager(root);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue),
    ["node_engine_nvmrc_mismatch"]
  );
});
