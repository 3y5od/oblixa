import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeMethodOverrideAbuse } from "./check-method-override-abuse.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root, overrides = {}) {
  const files = {
    "package.json": JSON.stringify({ scripts: { "check:method-override-abuse": "node scripts/check-method-override-abuse.mjs" } }),
    ".github/workflows/ci.yml": "npm run check:method-override-abuse\n",
    "scripts/pipelines/pipeline-security-comprehensive.mjs": '"check:method-override-abuse"\n',
    "src/lib/security/sec-fetch-policy.ts": `
      export const METHOD_OVERRIDE_HEADERS = ["x-http-method-override", "x-method-override", "x-http-method", "x-method"] as const;
      export const METHOD_OVERRIDE_QUERY_PARAMS = ["_method", "method", "httpMethod", "x-http-method-override", "x-method-override"] as const;
      export function hasMethodOverrideAttempt(request: Request): boolean {
        request.headers.has(header)
        url.searchParams.has(param)
      }
    `,
    "src/lib/security/sec-fetch-policy.test.ts": `
      describe("hasMethodOverrideAttempt", () => {})
      it("rejects method override headers", () => {})
      it("rejects method override query parameters", () => {})
      it("allows normal API requests without override signals", () => {})
    `,
    "src/proxy.ts": `
      if (pathname.startsWith("/api/") && hasMethodOverrideAttempt(request)) {
        code: "method_override_rejected"
        diagnostic_id: "proxy_method_override_rejected"
      }
    `,
    "src/proxy.invariants.test.ts": `
      hasMethodOverrideAttempt(request)
      code: "method_override_rejected"
    `,
    "src/app/api/example/route.ts": "export async function GET() { return Response.json({ ok: true }); }\n",
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
}

test("analyzeMethodOverrideAbuse accepts checked method override rejection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-method-override-"));
  writeFixture(root);
  const report = analyzeMethodOverrideAbuse(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeMethodOverrideAbuse rejects missing proxy enforcement", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-method-override-missing-"));
  writeFixture(root, {
    "src/proxy.ts": "export async function proxy() {}\n",
  });
  const report = analyzeMethodOverrideAbuse(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_marker" && issue.rel === "src/proxy.ts"), true);
});

test("analyzeMethodOverrideAbuse rejects API routes reading override signals directly", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-method-override-route-"));
  writeFixture(root, {
    "src/app/api/example/route.ts": `
      export async function POST(request) {
        const url = new URL(request.url);
        const method = url.searchParams.get("_method");
        return Response.json({ method });
      }
    `,
  });
  const report = analyzeMethodOverrideAbuse(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "route_reads_method_override_signal"), true);
});
