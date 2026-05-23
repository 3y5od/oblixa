import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeApiCorsPolicy } from "./check-api-cors-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-cors-policy-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:api-cors-policy": "node scripts/check-api-cors-policy.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:api-cors-policy\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:api-cors-policy"\n');
  write(
    root,
    "scripts/check-api-cors-policy.test.mjs",
    'it("rejects wildcard CORS on API routes", () => {});\nit("rejects wildcard CORS combined with credentials", () => {});\n'
  );
  return root;
}

test("analyzeApiCorsPolicy accepts API routes without wildcard CORS", () => {
  const root = fixtureRoot();
  write(root, "src/app/api/example/route.ts", 'export async function GET() { return Response.json({ ok: true }); }\n');
  const report = analyzeApiCorsPolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeApiCorsPolicy rejects wildcard CORS on API routes", () => {
  const root = fixtureRoot();
  write(
    root,
    "src/app/api/example/route.ts",
    'export async function GET() { return Response.json({}, { headers: { "Access-Control-Allow-Origin": "*" } }); }\n'
  );
  const report = analyzeApiCorsPolicy(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "wildcard_cors" && issue.rel === "src/app/api/example/route.ts"),
    true
  );
});

test("analyzeApiCorsPolicy rejects wildcard CORS combined with credentials", () => {
  const root = fixtureRoot();
  write(
    root,
    "src/app/api/example/route.ts",
    'export async function GET() { const headers = new Headers(); headers.set("Access-Control-Allow-Origin", "*"); headers.set("Access-Control-Allow-Credentials", "true"); return new Response(null, { headers }); }\n'
  );
  const report = analyzeApiCorsPolicy(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "credentialed_wildcard_cors" && issue.rel === "src/app/api/example/route.ts"),
    true
  );
});
