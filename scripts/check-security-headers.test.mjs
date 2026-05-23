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
    'import { buildApiNoStoreHeaders, buildSecurityHeaders } from "@/lib/security/csp-builders";\nconst securityHeaders = buildSecurityHeaders({});\nconst apiNoStoreHeaders = buildApiNoStoreHeaders();\nasync function headers(){ return [{ source: "/api/:path*", headers: apiNoStoreHeaders }, { source: "/:path*", headers: securityHeaders }]; }\n'
  );
  write(
    root,
    "src/lib/security/csp-builders.ts",
    [
      'key: "X-Content-Type-Options"',
      'key: "X-DNS-Prefetch-Control"',
      'key: "X-Permitted-Cross-Domain-Policies"',
      'key: "X-Frame-Options"',
      'key: "Cross-Origin-Opener-Policy"',
      'key: "Cross-Origin-Resource-Policy"',
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
    "buildSecurityHeaders adds HSTS only on Vercel by default\nPermissions-Policy disables payment and capture surfaces unless product opts in later\nrequire-trusted-types-for 'script'\nbuildSecurityHeaders rejects unsafe header values sourced from nonce input\nbuildApiNoStoreHeaders emits CDN-resistant private API cache headers\nscript-src-attr 'none'\nupgrade-insecure-requests\n"
  );

  const report = analyzeSecurityHeaders(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
