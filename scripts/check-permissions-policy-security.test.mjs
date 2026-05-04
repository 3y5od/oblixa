import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePermissionsPolicySecurity } from "./check-permissions-policy-security.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzePermissionsPolicySecurity validates disabled browser capability policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-permissions-policy-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:permissions-policy-security": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:permissions-policy-security\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:permissions-policy-security"\n');
  write(root, "next.config.ts", 'import { buildSecurityHeaders } from "@/lib/security/csp-builders";\nconst securityHeaders = buildSecurityHeaders({});\nexport default { headers: securityHeaders };\n');
  write(
    root,
    "src/lib/security/csp-builders.ts",
    'key: "Permissions-Policy"\ncamera=()\nmicrophone=()\ngeolocation=()\npayment=()\ndisplay-capture=()\nweb-share=()\ninterest-cohort=()\nusb=()\nbluetooth=()\nserial=()\nhid=()\n'
  );
  write(root, "src/lib/security/csp-builders.test.ts", "Permissions-Policy disables payment and capture surfaces unless product opts in later\npayment=()\ndisplay-capture=()\n");
  write(root, "e2e/security-headers-smoke.spec.ts", "Permissions-Policy present on root (soft)\ncamera=()\n");

  const report = analyzePermissionsPolicySecurity(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});