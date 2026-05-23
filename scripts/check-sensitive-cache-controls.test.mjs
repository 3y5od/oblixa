import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSensitiveCacheControls } from "./check-sensitive-cache-controls.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSensitiveCacheControls validates no-store cache helpers and config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-cache-controls-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:sensitive-cache-controls": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:sensitive-cache-controls\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:sensitive-cache-controls"\n');
  write(root, "next.config.ts", 'import { buildApiNoStoreHeaders, buildSecurityHeaders } from "@/lib/security/csp-builders"\nconst apiNoStoreHeaders = buildApiNoStoreHeaders();\nsource: "/api/:path*"\nheaders: apiNoStoreHeaders\n');
  write(root, "src/lib/security/csp-builders.ts", 'export function buildApiNoStoreHeaders()\nvalue: "private, no-store, max-age=0, must-revalidate"\nkey: "Expires", value: "0"\nkey: "Surrogate-Control", value: "no-store"\nkey: "Vary", value: "Cookie, Authorization"\n');
  write(root, "src/lib/security/api-guards.ts", 'import { jsonForbidden, jsonUnauthorized, PRIVATE_NO_STORE_HEADERS } from "@/lib/http/problem";\nexport const API_PRIVATE_NO_STORE_HEADERS = PRIVATE_NO_STORE_HEADERS;\nheaders: API_PRIVATE_NO_STORE_HEADERS\n');
  write(root, "src/lib/security/cron-route-gate.ts", 'export const CRON_DENY_RESPONSE_HEADERS = {\n"Cache-Control": "private, no-store",\nPragma: "no-cache",\n};\n');
  write(root, "src/lib/http/problem.ts", 'export const PRIVATE_NO_STORE_HEADERS = {\n"Cache-Control": "private, no-store",\nPragma: "no-cache",\nVary: "Cookie, Authorization",\n};\n');
  write(root, "src/lib/security/api-guards.test.ts", "API_PRIVATE_NO_STORE_HEADERS includes Cache-Control\nAPI_PRIVATE_NO_STORE_HEADERS.Vary\n");
  write(root, "src/lib/http/problem.test.ts", 'adds private no-store headers to problem responses\nheaders.get("Vary")\n');
  write(root, "src/lib/assurance/next-config-api-headers.contract.test.ts", "declares private no-store for /api/:path*\n");

  const report = analyzeSensitiveCacheControls(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
