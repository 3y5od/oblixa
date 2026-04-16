#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetFiles = [
  "src/app/api/extract/route.ts",
  "src/app/api/extract/run/route.ts",
  "src/app/api/webhooks/dispatch/route.ts",
  "src/app/api/reports/send-summaries/route.ts",
];

const issues = [];
for (const rel of targetFiles) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, "utf8");
  if (!/export const maxDuration\s*=/.test(text)) {
    issues.push({ file: rel, issue: "missing_max_duration" });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
