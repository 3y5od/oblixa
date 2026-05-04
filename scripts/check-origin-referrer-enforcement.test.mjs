import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeOriginReferrerEnforcement } from "./check-origin-referrer-enforcement.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeOriginReferrerEnforcement validates live Sec-Fetch-Site mutation guards", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-origin-referrer-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:origin-referrer-enforcement": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:origin-referrer-enforcement\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:origin-referrer-enforcement"\n');
  write(root, "src/lib/security/sec-fetch-policy.ts", 'export function secFetchSiteAllowsSensitiveMutation(request: Request): boolean {\nif (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;\nconst site = request.headers.get("sec-fetch-site")?.toLowerCase().trim();\nif (site === "same-origin" || site === "same-site") return true;\nif (site === "none") return true;\n}\n');
  write(root, "src/lib/security/sec-fetch-policy.test.ts", 'it("allows GET regardless of Sec-Fetch-Site", () => {})\nit("blocks cross-site POST", () => {})\nit("allows POST when header absent (non-browser clients)", () => {})\n');
  write(root, "src/app/api/programs/route.ts", 'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";\nif (!secFetchSiteAllowsSensitiveMutation(request)) {\nreturn NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });\n}\n');
  write(root, "src/app/api/extract/route.ts", 'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";\nif (!secFetchSiteAllowsSensitiveMutation(request)) {\nreturn NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });\n}\n');

  const report = analyzeOriginReferrerEnforcement(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});