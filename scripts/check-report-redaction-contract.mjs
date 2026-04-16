#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "src/lib/notification-delivery.ts",
  "src/app/api/reports/track/open/[token]/route.ts",
  "src/app/api/reports/track/click/[token]/route.ts",
];

const issues = [];
for (const rel of files) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, "utf8");
  if (rel.includes("notification-delivery")) {
    if (!text.includes("sanitizeRetryPayload")) {
      issues.push({ file: rel, issue: "missing_retry_payload_sanitizer" });
    }
    if (!text.includes("sanitizeMetadata")) {
      issues.push({ file: rel, issue: "missing_metadata_sanitizer" });
    }
  } else {
    if (!/Cache-Control|no-store/.test(text)) {
      issues.push({ file: rel, issue: "missing_cache_control" });
    }
    if (!/engagement_token/.test(text)) {
      issues.push({ file: rel, issue: "missing_token_scoped_update" });
    }
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
