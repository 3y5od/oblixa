import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeTrustedHostHandling } from "./check-trusted-host-handling.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeTrustedHostHandling validates forwarded-host origin derivation and tests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-trusted-host-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:trusted-host-handling": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:trusted-host-handling\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:trusted-host-handling"\n');
  write(root, "src/lib/security/trusted-forwarded.ts", 'export function getTrustedPublicOriginFromRequest(request: Request){}\nrequest.headers.get("x-forwarded-proto")\nrequest.headers.get("x-forwarded-host")\nreturn `${proto}://${host}`\n');
  write(root, "src/lib/security/trusted-forwarded.test.ts", "prefers x-forwarded-proto and x-forwarded-host when present\nfalls back to request URL when forwards absent\n");
  write(root, "src/lib/app-url.ts", 'const host = h.get("x-forwarded-host") ?? h.get("host")\nh.get("x-forwarded-proto")\nreturn `${proto}://${host}`.replace(/\\/+$/, "")\n');
  write(root, "src/lib/app-url.test.ts", "prefers x-forwarded-host and x-forwarded-proto when present\nbuilds an origin from forwarded headers as provided (edge must validate host trust)\n");

  const report = analyzeTrustedHostHandling(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});