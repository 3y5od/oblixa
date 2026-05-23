import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCodeownersSecurityPaths } from "./check-codeowners-security-paths.mjs";

function write(root, rel, content = "") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeSecurityCriticalFiles(root) {
  for (const rel of [
    "src/app/api/demo/route.ts",
    "src/lib/security/api-guards.ts",
    "src/lib/security/safe-fetch.ts",
    "src/lib/security/token-crypto.ts",
    "src/lib/security/secret-compare.ts",
    "src/lib/auth/post-auth-redirect.ts",
    "src/actions/auth.ts",
    "src/app/(auth)/layout.tsx",
    "src/proxy.ts",
    "src/lib/env/server.ts",
    "src/app/api/export/calendar/feed/route.ts",
    "supabase/migrations/001_demo.sql",
    ".github/workflows/ci.yml",
    ".env.example",
    "package.json",
    "package-lock.json",
    "scripts/outbound-fetch-allowlist.txt",
    "scripts/outbound-domain-allowlist.txt",
    "artifacts/license-allowlist.json",
    "config/qa-tier-coverage-allowlist.json",
  ]) {
    write(root, rel, "{}\n");
  }
}

test("analyzeCodeownersSecurityPaths requires concrete security-critical path coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-codeowners-missing-"));
  writeSecurityCriticalFiles(root);
  write(root, ".github/CODEOWNERS", "src/app/api/ @YOUR_ORG/backend\n");

  const report = analyzeCodeownersSecurityPaths(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_codeowner_coverage" && issue.path === ".env.example"));
  assert(
    report.issues.some(
      (issue) => issue.issue === "allowlist_missing_codeowner_coverage" && issue.path === "artifacts/license-allowlist.json"
    )
  );
});

test("analyzeCodeownersSecurityPaths requires security-aware owners", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-codeowners-owner-"));
  write(root, "src/lib/security/api-guards.ts", "");
  write(root, ".github/CODEOWNERS", "src/lib/security/ @YOUR_ORG/docs\n");

  const report = analyzeCodeownersSecurityPaths(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_security_aware_owner"));
});

test("analyzeCodeownersSecurityPaths accepts comprehensive security ownership", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-codeowners-ok-"));
  writeSecurityCriticalFiles(root);
  write(
    root,
    ".github/CODEOWNERS",
    [
      "src/app/api/ @YOUR_ORG/backend",
      "src/lib/security/ @YOUR_ORG/security",
      "src/lib/auth/ @YOUR_ORG/backend",
      "src/actions/ @YOUR_ORG/backend",
      "src/app/(auth)/ @YOUR_ORG/backend",
      "src/proxy.ts @YOUR_ORG/backend",
      "src/lib/env/ @YOUR_ORG/backend",
      "supabase/migrations/ @YOUR_ORG/backend",
      ".github/workflows/ @YOUR_ORG/backend",
      ".github/CODEOWNERS @YOUR_ORG/backend",
      ".env.example @YOUR_ORG/backend",
      "package.json @YOUR_ORG/backend",
      "package-lock.json @YOUR_ORG/backend",
      "scripts/ @YOUR_ORG/backend",
      "artifacts/ @YOUR_ORG/backend",
      "config/ @YOUR_ORG/backend",
    ].join("\n")
  );

  const report = analyzeCodeownersSecurityPaths(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.allowlistFileCount, 4);
});
