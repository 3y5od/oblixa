#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const files = [
  "semgrep/oblixa-security.yml",
  "semgrep/oblixa-performance.yml",
  "semgrep/oblixa-v7-surface.yml",
  "semgrep/oblixa-v8-surface.yml",
];
const missing = files.filter((rel) => !fs.existsSync(path.join(root, rel)));
const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const absentInCi = files.filter((rel) => !ci.includes(rel));

const payload = {
  checkId: "semgrep-rulepack-integrity",
  strict,
  ok: !strict || (missing.length === 0 && absentInCi.length === 0),
  missingRulepacks: missing,
  missingCiReferences: absentInCi,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
