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
  write(root, "next.config.ts", 'import { buildApiNoStoreHeaders, buildSecurityHeaders } from "@/lib/security/csp-builders";\nconst securityHeaders = buildSecurityHeaders({});\nexport default { headers: securityHeaders };\n');
  write(
    root,
    "src/lib/security/csp-builders.ts",
    'const DISABLED_PERMISSION_POLICY_FEATURES = ["accelerometer", "ambient-light-sensor", "autoplay", "battery", "browsing-topics", "camera", "conversion-measurement", "display-capture", "encrypted-media", "gamepad", "geolocation", "gyroscope", "hid", "interest-cohort", "magnetometer", "microphone", "midi", "payment", "picture-in-picture", "screen-wake-lock", "serial", "speaker-selection", "sync-xhr", "usb", "web-share", "xr-spatial-tracking", "bluetooth"];\nkey: "Permissions-Policy"\n'
  );
  write(root, "src/lib/security/csp-builders.test.ts", "Permissions-Policy disables payment and capture surfaces unless product opts in later\npayment=()\ndisplay-capture=()\nbrowsing-topics=()\nxr-spatial-tracking=()\n");
  write(root, "e2e/security-headers-smoke.spec.ts", "Permissions-Policy present on root (soft)\ncamera=()\nbrowsing-topics=()\n");

  const report = analyzePermissionsPolicySecurity(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
