import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeHttpMethodPolicy } from "./check-http-method-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeHttpMethodPolicy validates generated route method inventory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-http-method-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:http-method-policy": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:http-method-policy\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:http-method-policy"\n');
  write(root, "scripts/lib/build-route-universe.mjs", 'const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];\nfunction methodsFromSource(source) {\nconst methods = HTTP_METHODS.filter((method) => new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(source));\n}\nconst methods = kind === "api_route" ? methodsFromSource(source) : ["GET"];\n');
  write(root, "src/app/api/programs/route.ts", 'export async function GET() {\n}\nexport async function POST(request: Request) {\n}\n');
  write(root, "src/app/api/extract/route.ts", 'export async function POST(request: Request) {\n}\n');
  write(root, "src/app/auth/callback/route.ts", 'export async function GET(request: Request) {\n}\n');
  write(root, "artifacts/route-universe.json", JSON.stringify({
    routes: [
      { route: "/api/programs", kind: "api_route", sourcePath: "src/app/api/programs/route.ts", methods: ["GET", "POST"], bodyPolicy: "bounded_or_form_body" },
      { route: "/api/extract", kind: "api_route", sourcePath: "src/app/api/extract/route.ts", methods: ["POST"], bodyPolicy: "bounded_or_form_body" },
      { route: "/auth/callback", kind: "api_route", sourcePath: "src/app/auth/callback/route.ts", methods: ["GET"], bodyPolicy: "no_body_expected" },
    ],
  }));

  const report = analyzeHttpMethodPolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});