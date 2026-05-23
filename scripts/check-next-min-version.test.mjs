import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeNextMinVersion, compareSemver, parseSemver } from "./check-next-min-version.mjs";

function withTempLockfile(lockfile, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-next-min-"));
  fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lockfile, null, 2));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("parseSemver accepts regular and build metadata versions", () => {
  assert.deepEqual(parseSemver("16.2.6"), { major: 16, minor: 2, patch: 6 });
  assert.deepEqual(parseSemver("16.2.6+build.1"), { major: 16, minor: 2, patch: 6 });
  assert.equal(parseSemver("^16.2.6"), null);
});

test("compareSemver orders major, minor, and patch", () => {
  assert.equal(compareSemver("16.2.6", "16.2.6"), 0);
  assert.equal(compareSemver("16.2.7", "16.2.6"), 1);
  assert.equal(compareSemver("16.1.9", "16.2.6"), -1);
});

test("next minimum version check passes when installed lockfile package meets the floor", () => {
  const report = withTempLockfile(
    {
      packages: {
        "": { dependencies: { next: "^16.2.6" } },
        "node_modules/next": { version: "16.2.6" },
      },
    },
    (root) => analyzeNextMinVersion(root, "16.2.6")
  );

  assert.equal(report.ok, true);
  assert.equal(report.installedVersion, "16.2.6");
});

test("next minimum version check fails when installed lockfile package is below the floor", () => {
  const report = withTempLockfile(
    {
      packages: {
        "": { dependencies: { next: "^16.2.3" } },
        "node_modules/next": { version: "16.2.3" },
      },
    },
    (root) => analyzeNextMinVersion(root, "16.2.6")
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "next_below_security_floor");
});
