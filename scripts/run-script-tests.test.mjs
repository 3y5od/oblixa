import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildNodeTestArgs, findScriptTestFiles } from "./run-script-tests.mjs";

test("findScriptTestFiles returns sorted top-level scripts/*.test.mjs files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-script-tests-"));
  const scriptsDir = path.join(root, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.join(scriptsDir, "nested"), { recursive: true });
  fs.writeFileSync(path.join(scriptsDir, "b.test.mjs"), "");
  fs.writeFileSync(path.join(scriptsDir, "a.test.mjs"), "");
  fs.writeFileSync(path.join(scriptsDir, "skip.mjs"), "");
  fs.writeFileSync(path.join(scriptsDir, "nested", "c.test.mjs"), "");

  assert.deepEqual(findScriptTestFiles(root), [path.join(scriptsDir, "a.test.mjs"), path.join(scriptsDir, "b.test.mjs")]);
});

test("buildNodeTestArgs prefixes --test", () => {
  assert.deepEqual(buildNodeTestArgs(["scripts/a.test.mjs", "scripts/b.test.mjs"]), ["--test", "scripts/a.test.mjs", "scripts/b.test.mjs"]);
});