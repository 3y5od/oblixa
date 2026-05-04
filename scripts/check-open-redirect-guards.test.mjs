import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeOpenRedirectGuards } from "./check-open-redirect-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeOpenRedirectGuards validates redirect sanitization and same-origin redirect targets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-open-redirect-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:open-redirect-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:open-redirect-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:open-redirect-guards"\n');
  write(root, "src/lib/security/redirect.ts", 'export function getSafeRedirectPath(){ const fallback = "/dashboard"; if (!s.startsWith("/") || s.startsWith("//") || s.includes("://")) return fallback; if (/[\\x00-\\x1f\\x7f\\\\]/.test(s) || s.includes("@") || s.includes("<")) return fallback; }\n');
  write(root, "src/lib/security/redirect.test.ts", "rejects protocol-relative paths (open redirect)\nrejects absolute URLs and encoded slashes\nrejects javascript: and CRLF injection attempts\n");
  write(root, "src/app/auth/callback/route.ts", 'const next = getSafeRedirectPath(searchParams.get("next"))\nreturn NextResponse.redirect(`${origin}${finalDestination}`)\n');
  write(root, "src/app/api/reports/track/click/[token]/route.ts", 'function getSafeTarget(request: Request){}\nif (targetRaw.startsWith("//")) return safeFallback(request)\nif (!["http:", "https:"].includes(target.protocol)){}\nconst appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()\nif (target.origin !== allowedOrigin) return safeFallback(request)\n');

  const report = analyzeOpenRedirectGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});