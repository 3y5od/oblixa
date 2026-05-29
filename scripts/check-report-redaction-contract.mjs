#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const files = [
  "src/lib/notification-delivery.ts",
  "src/app/api/reports/track/open/[token]/route.ts",
  "src/app/api/reports/track/click/[token]/route.ts",
];

export function analyzeReportRedactionContract(baseRoot = root) {
  const issues = [];
  for (const rel of files) {
    const abs = path.join(baseRoot, rel);
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
      if (!/engagement_token_hash/.test(text)) {
        issues.push({ file: rel, issue: "missing_hash_token_scoped_update" });
      }
    }
  }
  return {
    checkId: "report-redaction-contract",
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedFileCount: files.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeReportRedactionContract();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
