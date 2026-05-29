import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRegexDosRisk } from "./check-regex-dos-risk.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-regex-dos-"));
  try {
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("analyzeRegexDosRisk accepts anchored linear regexes", () => {
  const report = withFixture(
    {
      "src/lib/example.ts": [
        "const SAFE_PATH_RE = /^\\/[A-Za-z0-9/_-]+$/;",
        'const SAFE_TOKEN_RE = new RegExp("^[A-Za-z0-9_-]{1,80}$", "u");',
      ].join("\n"),
    },
    analyzeRegexDosRisk
  );

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.regexCount, 2);
});

test("analyzeRegexDosRisk rejects nested quantified groups", () => {
  const report = withFixture(
    {
      "src/lib/example.ts": [
        "const BAD_LITERAL_RE = /(a+)+$/;",
        'const BAD_CONSTRUCTOR_RE = new RegExp("^(.*)+$", "u");',
      ].join("\n"),
    },
    analyzeRegexDosRisk
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "nested_quantifier_group"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "repeated_wildcard_group"), true);
});
