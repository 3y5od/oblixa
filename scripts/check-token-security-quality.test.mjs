import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeTokenSecurityQuality } from "./check-token-security-quality.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeTargetSet(root, statusRouteContent) {
  const neutral = "token expires_at active secureCompareUtf8";
  for (const rel of [
    "src/app/api/events/route.ts",
    "src/app/api/export/calendar/feed/[token]/route.ts",
    "src/app/api/external-actions/[token]/submit/route.ts",
    "src/app/api/external-actions/[token]/participant/workflow-step/route.ts",
    "src/app/api/integrations/oauth/callback/route.ts",
  ]) {
    write(root, rel, neutral);
  }
  write(root, "src/app/api/external-actions/[token]/status/route.ts", statusRouteContent);
}

test("analyzeTokenSecurityQuality accepts effectiveStatus as explicit token status guard", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-token-quality-"));
  writeTargetSet(root, 'token external_action_links token_hash expires_at expired const effectiveStatus = expired && data.status === "open" ? "expired" : data.status;');
  const report = analyzeTokenSecurityQuality(root);
  assert.equal(report.issueCount, 0, JSON.stringify(report.issues, null, 2));
});

test("analyzeTokenSecurityQuality rejects token route without freshness guard", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-token-quality-bad-"));
  writeTargetSet(root, "token external_action_links token_hash effectiveStatus");
  const report = analyzeTokenSecurityQuality(root);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_expiry_or_freshness_guard"), true);
});
