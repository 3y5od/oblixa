import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSecurityHeaders } from "./check-security-headers.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSecurityHeaders validates header builder and next config wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-security-headers-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:security-headers": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:security-headers\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:security-headers"\n');
  write(
    root,
    "next.config.ts",
    'import { buildSecurityHeaders } from "@/lib/security/csp-builders";\nconst securityHeaders = buildSecurityHeaders({});\nasync function headers(){ return [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] }, { source: "/:path*", headers: securityHeaders }]; }\n'
  );
  write(
    root,
    "src/lib/security/csp-builders.ts",
    [
      'key: "X-Content-Type-Options"',
      'key: "X-Frame-Options"',
      'key: "Referrer-Policy"',
      'key: "Permissions-Policy"',
      'key: "Content-Security-Policy"',
      'key: "Content-Security-Policy-Report-Only"',
      'key: "Strict-Transport-Security"',
    ].join("\n")
  );
  write(
    root,
    "src/lib/security/csp-builders.test.ts",
    "buildSecurityHeaders adds HSTS only on Vercel by default\nPermissions-Policy disables payment and capture surfaces unless product opts in later\nrequire-trusted-types-for 'script'\n"
  );

  const report = analyzeSecurityHeaders(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});