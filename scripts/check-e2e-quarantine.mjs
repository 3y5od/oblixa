#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), "e2e-quarantine.json");
if (!fs.existsSync(p)) {
  console.log(JSON.stringify({ ok: true, mode: "no_manifest" }, null, 2));
  process.exit(0);
}
const data = JSON.parse(fs.readFileSync(p, "utf8"));
const strict = process.argv.includes("--strict");
const files = data.files || [];
const expired = files.filter((row) => row.expires && new Date(row.expires) < new Date());
if (strict && expired.length) {
  console.error(JSON.stringify({ ok: false, expired }, null, 2));
  process.exit(1);
}
const issuePattern = /^(NO_TICKET|GH-\d+|https:\/\/)/i;
const badIssue = [];
if (strict && files.length) {
  for (const row of files) {
    if (!row.path || typeof row.path !== "string") badIssue.push({ row, reason: "missing_path" });
    if (!row.issue || !issuePattern.test(String(row.issue))) badIssue.push({ row, reason: "issue_format" });
  }
}
if (strict && badIssue.length) {
  console.error(JSON.stringify({ ok: false, badIssue }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, quarantined: files.length }, null, 2));
process.exit(0);
