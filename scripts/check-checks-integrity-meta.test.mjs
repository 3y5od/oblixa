import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeChecksIntegrityMeta } from "./check-checks-integrity-meta.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("analyzeChecksIntegrityMeta accepts required files, scripts, and CI commands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-checks-integrity-ok-"));
  write(root, "scripts/check-demo.mjs", "console.log('ok');\n");
  writeJson(root, "package.json", { scripts: { "check:demo": "node scripts/check-demo.mjs" } });
  write(root, ".github/workflows/ci.yml", "npm run check:demo\n");

  const report = analyzeChecksIntegrityMeta(root, {
    requiredFiles: ["scripts/check-demo.mjs"],
    requiredScripts: ["check:demo"],
    ciCommands: ["npm run check:demo"],
  });

  assert.equal(report.issueCount, 0);
  assert.deepEqual(report.issues, []);
});

test("analyzeChecksIntegrityMeta rejects missing files, scripts, and CI commands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-checks-integrity-bad-"));
  writeJson(root, "package.json", { scripts: {} });
  write(root, ".github/workflows/ci.yml", "npm run check:other\n");

  const report = analyzeChecksIntegrityMeta(root, {
    requiredFiles: ["scripts/check-demo.mjs"],
    requiredScripts: ["check:demo"],
    ciCommands: ["npm run check:demo"],
  });

  assert.equal(report.issueCount, 3);
  assert(report.issues.some((issue) => issue.type === "missing_required_file" && issue.rel === "scripts/check-demo.mjs"));
  assert(report.issues.some((issue) => issue.type === "missing_required_script" && issue.script === "check:demo"));
  assert(report.issues.some((issue) => issue.type === "ci_missing_command" && issue.cmd === "npm run check:demo"));
});
