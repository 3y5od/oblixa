#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const targetFiles = [
  "src/app/api/events/route.ts",
  "src/app/api/export/calendar/feed/[token]/route.ts",
  "src/app/api/external-actions/[token]/status/route.ts",
  "src/app/api/external-actions/[token]/submit/route.ts",
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts",
  "src/app/api/integrations/oauth/callback/route.ts",
];
const opaqueLookupTokenFiles = new Set([
  "src/app/api/external-actions/[token]/status/route.ts",
]);

export function analyzeTokenSecurityQuality(scanRoot = root) {
  const issues = [];
  for (const rel of targetFiles) {
    const abs = path.join(scanRoot, rel);
    if (!fs.existsSync(abs)) {
      issues.push({ file: rel, issue: "missing_target_file" });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const mentionsToken = /\btoken\b|\bx-api-key\b|engagement_token|state\b/.test(text);
    if (!mentionsToken) continue;
    const hasExpiry =
      /expires_at|token_expires_at|State expired|expired/i.test(text);
    const hasRevocationOrStatus =
      /revoked_at|active|status\s*!==\s*"open"|consumed_at|External action not found|already submitted|effectiveStatus|data\.status\s*===\s*"open"/.test(
        text
      );
    const hasSafeCompare = /secureCompareUtf8|verifyExternalPasscode|verifyExternalSubmitTicket/.test(text);
    const tokenHandledByOpaqueLookup =
      opaqueLookupTokenFiles.has(rel) ||
      /external_action_links/.test(text) ||
      /integration_oauth_states/.test(text);
    if (!hasExpiry) issues.push({ file: rel, issue: "missing_expiry_or_freshness_guard" });
    if (!hasRevocationOrStatus) issues.push({ file: rel, issue: "missing_revocation_or_status_guard" });
    if (
      !hasSafeCompare &&
      /token_hash|passcode_hash|x-api-key/.test(text) &&
      !opaqueLookupTokenFiles.has(rel)
    ) {
      issues.push({ file: rel, issue: "missing_constant_time_or_verified_token_check" });
    }
    if (!hasSafeCompare && /state/.test(text) && !tokenHandledByOpaqueLookup) {
      issues.push({ file: rel, issue: "missing_constant_time_or_verified_token_check" });
    }
  }
  return { issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTokenSecurityQuality();
  console.log(JSON.stringify(report, null, 2));
  if (report.issueCount > 0) process.exit(1);
}
