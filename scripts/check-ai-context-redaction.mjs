#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "src/lib/extraction/extract-fields.ts",
  "src/lib/extraction/run-pipeline.ts",
  "src/lib/observability/sentry-scrub.ts",
];

const issues = [];
for (const rel of files) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, "utf8");
  if (rel.endsWith("extract-fields.ts")) {
    if (/slice\(0,\s*2000\)/.test(text)) {
      issues.push({ file: rel, issue: "raw_model_output_logged" });
    }
  }
  if (rel.endsWith("run-pipeline.ts")) {
    if (/rawMessage/.test(text)) {
      issues.push({ file: rel, issue: "raw_ai_error_forwarded_to_telemetry" });
    }
  }
  if (rel.endsWith("sentry-scrub.ts")) {
    if (!/redact|scrub/i.test(text)) {
      issues.push({ file: rel, issue: "missing_sentry_scrub_logic" });
    }
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
