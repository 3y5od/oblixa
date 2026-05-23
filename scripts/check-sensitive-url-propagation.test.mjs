import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeSensitiveUrlPropagation } from "./check-sensitive-url-propagation.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("sensitive URL propagation check requires helpers, tests, and route markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sensitive-url-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:sensitive-url-propagation": "node scripts/check-sensitive-url-propagation.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:sensitive-url-propagation\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:sensitive-url-propagation"\n');
  write(root, "src/lib/security/sensitive-url.ts", "SENSITIVE_URL_PARAM_NAMES\nisSensitiveUrlParamName\nstripSensitiveUrlParams\nurlContainsSensitiveParams\naccess_token\nsigned_url\nprivate_url\n");
  write(root, "src/lib/security/sensitive-url.test.ts", "strips sensitive query params while preserving safe params and hashes\nreports URLs that contain sensitive query params\n");
  write(root, "src/lib/security/redirect.ts", "stripSensitiveUrlParams(s)\nreturn fallback\n");
  write(root, "src/lib/security/redirect.test.ts", "strips sensitive query parameters from browser-visible redirects\n");
  write(root, "src/app/api/reports/track/click/[token]/route.ts", "getSafeTarget(request)\nnormalizeClickedTargetForStorage(target)\nredacted_query_keys\n");
  write(root, "src/app/auth/callback/route.ts", 'getSafeRedirectPath(searchParams.get("next"))\n');
  write(root, "src/app/api/integrations/oauth/start/route.ts", 'redirect.search === ""\nredirect.hash === ""\n');
  write(root, "src/app/api/integrations/oauth/callback/route.ts", 'redirect.search === ""\nredirect.hash === ""\n');

  assert.equal(analyzeSensitiveUrlPropagation(root).ok, true);
});

test("sensitive URL propagation check fails when redirect sanitization is absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sensitive-url-missing-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:sensitive-url-propagation": "node scripts/check-sensitive-url-propagation.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:sensitive-url-propagation\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:sensitive-url-propagation"\n');
  write(root, "src/lib/security/sensitive-url.ts", "SENSITIVE_URL_PARAM_NAMES\nisSensitiveUrlParamName\nstripSensitiveUrlParams\nurlContainsSensitiveParams\naccess_token\nsigned_url\nprivate_url\n");
  write(root, "src/lib/security/sensitive-url.test.ts", "strips sensitive query params while preserving safe params and hashes\nreports URLs that contain sensitive query params\n");
  write(root, "src/lib/security/redirect.ts", "return s\n");
  write(root, "src/lib/security/redirect.test.ts", "strips sensitive query parameters from browser-visible redirects\n");
  write(root, "src/app/api/reports/track/click/[token]/route.ts", "getSafeTarget(request)\nnormalizeClickedTargetForStorage(target)\nredacted_query_keys\n");
  write(root, "src/app/auth/callback/route.ts", 'getSafeRedirectPath(searchParams.get("next"))\n');
  write(root, "src/app/api/integrations/oauth/start/route.ts", 'redirect.search === ""\nredirect.hash === ""\n');
  write(root, "src/app/api/integrations/oauth/callback/route.ts", 'redirect.search === ""\nredirect.hash === ""\n');

  const report = analyzeSensitiveUrlPropagation(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.rel === "src/lib/security/redirect.ts" && issue.marker === "stripSensitiveUrlParams(s)"));
});
