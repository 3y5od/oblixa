import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCspNonceHashConsistency } from "./check-csp-nonce-hash-consistency.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:csp-nonce-hash-consistency": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:csp-nonce-hash-consistency\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:csp-nonce-hash-consistency"\n');
  write(
    root,
    "next.config.ts",
    [
      "OBLIXA_CSP_REPORT_ONLY_SCRIPT_NONCE",
      "OBLIXA_TRUSTED_TYPES_REPORT_ONLY",
      "OBLIXA_CSP_STRICT_ENFORCING_STYLE",
      "OBLIXA_CSP_STRICT_ENFORCING_SCRIPT",
      "OBLIXA_CSP_ENFORCING_SCRIPT_HASHES",
      "cspStrictEnforcingScriptSrc:",
      "cspEnforcingScriptHashes:",
    ].join("\n")
  );
  write(
    root,
    "src/lib/security/csp-builders.ts",
    [
      "export function normalizeCspScriptHashSources() {}",
      "export function normalizeCspScriptNonce() {}",
      "const CSP_SCRIPT_HASH_SOURCE_RE = /sha256/;",
      "const CSP_NONCE_SOURCE_RE = /nonce/;",
      "function buildEnforcingScriptSrc() {",
      "  if (isProd && options?.strictEnforcingScriptSrc !== false) {",
      "    normalizeCspScriptHashSources(options.enforcingScriptHashes);",
      "  }",
      "  return `script-src 'self' 'unsafe-inline'`;",
      "}",
      "export function buildStrictCspReportOnly() {",
      "  return [\"default-src 'self'\", \"script-src 'self'\", \"script-src-attr 'none'\", \"style-src 'self'\", \"upgrade-insecure-requests\"].join('; ');",
      "}",
      "let memoCspKey = '';",
      "const headers = ['Content-Security-Policy', 'Content-Security-Policy-Report-Only'];",
      "const tt = \"require-trusted-types-for 'script'\";",
      "const strictEnforcingScriptSrc = true;",
      "const enforcingScriptHashes = [];",
    ].join("\n")
  );
  write(
    root,
    "src/lib/security/csp-builders.test.ts",
    [
      "prod script-src drops unsafe-inline on enforcing CSP by default",
      "strict prod script-src accepts configured hashes for inline rollout",
      "prod enforcing CSP supports explicit unsafe-inline rollback flags",
      "invalid configured CSP script hash sources fail closed",
      "invalid report-only CSP nonce sources fail closed",
      "report-only CSP can use script nonce when provided (staged)",
      "report-only CSP carries script attribute and mixed-content protections",
      "optional Trusted Types directive appended to report-only CSP when enabled",
    ].join("\n")
  );
  write(
    root,
    "e2e/security-headers-smoke.spec.ts",
    [
      "root CSP carries enforcing and report-only browser isolation directives",
      "content-security-policy-report-only",
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "script-src-attr 'none'",
      "upgrade-insecure-requests",
      "script-src 'self'",
      "not.toContain(\"'unsafe-inline'\")",
    ].join("\n")
  );
}

test("analyzeCspNonceHashConsistency accepts strict report-only and staged enforcing CSP rollout", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-csp-consistency-"));
  writeValidFixture(root);

  const report = analyzeCspNonceHashConsistency(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeCspNonceHashConsistency rejects report-only unsafe-inline regressions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-csp-consistency-"));
  writeValidFixture(root);
  write(
    root,
    "src/lib/security/csp-builders.ts",
    [
      "export function normalizeCspScriptHashSources() {}",
      "export function normalizeCspScriptNonce() {}",
      "const CSP_SCRIPT_HASH_SOURCE_RE = /sha256/;",
      "const CSP_NONCE_SOURCE_RE = /nonce/;",
      "function buildEnforcingScriptSrc() {",
      "  if (isProd && options?.strictEnforcingScriptSrc === true) {",
      "    normalizeCspScriptHashSources(options.enforcingScriptHashes);",
      "  }",
      "  return `script-src 'self' 'unsafe-inline'`;",
      "}",
      "export function buildStrictCspReportOnly() {",
      "  return \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'\";",
      "}",
      "let memoCspKey = '';",
      "Content-Security-Policy Content-Security-Policy-Report-Only require-trusted-types-for 'script'",
      "script-src-attr 'none'",
      "upgrade-insecure-requests",
      "strictEnforcingScriptSrc enforcingScriptHashes",
    ].join("\n")
  );

  const report = analyzeCspNonceHashConsistency(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "report_only_csp_allows_unsafe_inline"), true);
});
