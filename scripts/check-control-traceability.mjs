#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const mapPath = path.join(ROOT, "artifacts", "gdpr-soc2-control-map.json");
const data = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const strict = process.argv.includes("--strict");
const issues = [];
for (const row of data.controls || []) {
  const hasTests = Array.isArray(row.testPaths) && row.testPaths.length > 0;
  const exempt = typeof row.exemptCode === "string" && row.exemptCode.length > 0;
  if (!hasTests && !exempt) issues.push({ controlId: row.controlId, issue: "no_tests_or_exempt" });
  if (hasTests) {
    for (const tp of row.testPaths) {
      if (!fs.existsSync(path.join(ROOT, tp))) issues.push({ controlId: row.controlId, missingPath: tp });
    }
  }
}
const ok = !strict || issues.length === 0;
console.log(JSON.stringify({ ok, strict, issueCount: issues.length, issues: issues.slice(0, 40) }, null, 2));
process.exit(ok ? 0 : 1);
