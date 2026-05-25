import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeForwardedHeaderSafety } from "./check-forwarded-header-safety.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-forwarded-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:forwarded-header-safety": "x" } }));
  write(root, ".env.example", "OBLIXA_TRUST_FORWARDED_IP\nVercel is trusted automatically\n");
  write(
    root,
    "src/lib/security/trusted-forwarded.ts",
    [
      "OBLIXA_TRUST_FORWARDED_IP",
      "export function isForwardedClientIpTrusted",
      "export function requireTrustedClientIpConfigForProduction",
      "Missing ${TRUST_FORWARDED_IP_ENV}=1",
      "export function getTrustedClientIpFromHeaders",
      "export function getTrustedClientIpFromRequest",
      'normalizeForwardedClientIp(headers.get("x-forwarded-for"))',
      'normalizeForwardedClientIp(headers.get("x-real-ip"))',
    ].join("\n")
  );
  write(
    root,
    "src/lib/rate-limit.ts",
    [
      "getTrustedClientIpFromHeaders",
      "getTrustedClientIpFromRequest",
      "return getTrustedClientIpFromRequest(request)",
      "return getTrustedClientIpFromHeaders(h)",
    ].join("\n")
  );
  write(
    root,
    "src/lib/security/trusted-forwarded.test.ts",
    [
      "ignores client IP forwarding headers unless a trusted proxy is configured",
      "uses the first forwarded client IP when running behind a trusted proxy",
      "fails closed in non-Vercel production when trusted client IP config is absent",
      "falls back safely when trusted forwarded IP headers are malformed",
    ].join("\n")
  );
  return root;
}

test("analyzeForwardedHeaderSafety accepts centralized trusted client IP parsing", () => {
  const report = analyzeForwardedHeaderSafety(fixtureRoot());
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeForwardedHeaderSafety rejects raw forwarded header parsing in rate limits", () => {
  const root = fixtureRoot();
  fs.appendFileSync(
    path.join(root, "src/lib/rate-limit.ts"),
    '\nreturn request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";\n'
  );

  const report = analyzeForwardedHeaderSafety(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "raw_forwarded_header_used_in_rate_limit"),
    true
  );
});
