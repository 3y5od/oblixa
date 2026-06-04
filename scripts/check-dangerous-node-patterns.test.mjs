import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDangerousNodePatterns } from "./check-dangerous-node-patterns.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dangerous-node-patterns-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test("exempts scanner sources that intentionally mention banned tokens", () => {
  const root = makeRoot({
    "scripts/security-static-audit.mjs": "eval(input);\nnew Function(input);\n",
  });

  const report = analyzeDangerousNodePatterns(root, { strict: true });

  assert.equal(report.ok, true);
  assert.equal(report.totalHits, 0);
});

test("ignores test fixture files that intentionally contain banned examples", () => {
  const root = makeRoot({
    "scripts/example.test.mjs": "const fixture = `eval(input); new Function(input);`;\n",
  });

  const report = analyzeDangerousNodePatterns(root, { strict: true });

  assert.equal(report.ok, true);
  assert.equal(report.totalHits, 0);
});

test("reports executable dangerous patterns in source files", () => {
  const root = makeRoot({
    "src/lib/bad.ts": "export function run(input) { eval(input); }\n",
  });

  const report = analyzeDangerousNodePatterns(root, { strict: true });

  assert.equal(report.ok, false);
  assert.deepEqual(report.hits, [{ file: "src/lib/bad.ts", pattern: "eval" }]);
});
