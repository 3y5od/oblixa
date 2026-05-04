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
  write(root, "next.config.ts", 'source: "/api/:path*"\n{ key: "Cache-Control", value: "private, no-store" }\n{ key: "Pragma", value: "no-cache" }\n{ key: "Vary", value: "Cookie" }\n');
  write(root, "src/lib/security/api-guards.ts", 'export const API_PRIVATE_NO_STORE_HEADERS = {\n"Cache-Control": "private, no-store",\nPragma: "no-cache",\n};\n');
  write(root, "src/lib/security/cron-route-gate.ts", 'export const CRON_DENY_RESPONSE_HEADERS = {\n"Cache-Control": "private, no-store",\nPragma: "no-cache",\n};\n');
  write(root, "src/lib/http/problem.ts", 'export const PRIVATE_NO_STORE_HEADERS = {\n"Cache-Control": "private, no-store",\nPragma: "no-cache",\n};\n');
  write(root, "src/lib/security/api-guards.test.ts", "API_PRIVATE_NO_STORE_HEADERS includes Cache-Control\n");
  write(root, "src/lib/http/problem.test.ts", "adds private no-store headers to problem responses\n");
  write(root, "src/lib/assurance/next-config-api-headers.contract.test.ts", "declares private no-store for /api/:path*\n");

  const report = analyzeSensitiveCacheControls(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});