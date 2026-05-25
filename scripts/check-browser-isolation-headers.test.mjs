import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeBrowserIsolationHeaders } from "./check-browser-isolation-headers.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeBrowserIsolationHeaders validates COOP/CORP header wiring", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-browser-isolation-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:browser-isolation-headers": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:browser-isolation-headers\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:browser-isolation-headers"\n');
  write(root, "next.config.ts", 'import { buildSecurityHeaders, normalizeCoepMode, normalizeTrustedTypesMode } from "@/lib/security/csp-builders";\nconst securityHeaders = buildSecurityHeaders({});\nexport default { async headers() { return [{ source: "/:path*", headers: securityHeaders }]; } };\n');
  write(root, "src/lib/security/csp-builders.ts", 'key: "X-Frame-Options", value: "DENY"\nkey: "Cross-Origin-Opener-Policy", value: "same-origin"\nkey: "Cross-Origin-Resource-Policy", value: "same-origin"\nkey: "Cross-Origin-Embedder-Policy", value: coepMode\nnormalizeTrustedTypesMode\nnormalizeCoepMode\ntrustedTypesMode === "enforce"\nscript-src-attr \'none\'\nupgrade-insecure-requests\n');
  write(root, "src/lib/security/csp-builders.test.ts", "prod CSP omits unsafe-eval in main policy\nframe-ancestors 'none'\nreport-only CSP carries script attribute and mixed-content protections\nTrusted Types can be enforced on the main CSP with an explicit mode\nCOEP compatibility gate supports off, credentialless, and require-corp\n");
  write(root, "src/app/api/security/csp-report/route.ts", "CSP_REPORT_BODY_LIMIT\nnormalizeCspReportBody(parsed)\nrateLimitCheck(`csp-report:${ip}`\nprivate, no-store\n[security-event:csp-report]\n");
  write(root, "src/app/api/security/csp-report/route.test.ts", "accepts bounded CSP reports, logs redacted security event, and returns no-store 204\nrejects unsupported content types\nrejects malformed report shapes\n");
  write(root, "e2e/security-headers-smoke.spec.ts", "cross-origin-opener-policy\ncross-origin-resource-policy\nscript-src-attr 'none'\nupgrade-insecure-requests\n");

  const report = analyzeBrowserIsolationHeaders(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
