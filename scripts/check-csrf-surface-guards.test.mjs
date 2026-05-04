import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCsrfSurfaceGuards } from "./check-csrf-surface-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeCsrfSurfaceGuards validates bounded-body mutation surfaces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-csrf-surface-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:csrf-surface-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:csrf-surface-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:csrf-surface-guards"\n');
  write(root, "src/lib/security/read-json-body-limited.ts", 'const DEFAULT_MAX = 512 * 1024;\nconst len = request.headers.get("content-length");\n{ error: "Payload too large" },\nreturn { ok: true, body: text ? JSON.parse(text) : null };\nexport async function parseJsonBodyWithLimit<T>(\n');
  write(root, "src/lib/security/read-json-body-limited.test.ts", 'it("rejects oversized body by Content-Length", () => {})\nit("parses small JSON", () => {})\nit("maps body through parse", () => {})\n');
  write(root, "scripts/lib/build-route-universe.mjs", 'function bodyPolicy(methods, source, cls) {\nconst mutating = methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method));\nif (/readJsonBodyLimited|parseJsonBodyWithLimit|readRequestBodyLimited|formData\\(/.test(source)) return "bounded_or_form_body";\nreturn "body_limit_required";\n}\n');
  write(root, "src/app/api/programs/route.ts", 'const parsed = await readJsonBodyLimited(request);\nif (!parsed.ok) return parsed.response;\n');
  write(root, "src/app/api/extract/route.ts", 'const ctReject = jsonContentTypeRejection(request);\nconst _limBody = await readJsonBodyLimited(request);\nif (!_limBody.ok) return _limBody.response;\n');
  write(root, "src/app/api/integrations/oauth/start/route.ts", 'const _lb_body = await readJsonBodyLimited(request);\nif (!_lb_body.ok) return _lb_body.response;\n');
  write(root, "artifacts/route-universe.json", JSON.stringify({
    routes: [
      { route: "/api/programs", methods: ["GET", "POST"], cachePolicy: "private_no_store", bodyPolicy: "bounded_or_form_body" },
      { route: "/api/extract", methods: ["POST"], cachePolicy: "private_no_store", bodyPolicy: "bounded_or_form_body" },
      { route: "/api/integrations/oauth/start", methods: ["POST"], cachePolicy: "private_no_store", bodyPolicy: "bounded_or_form_body" },
    ],
  }));

  const report = analyzeCsrfSurfaceGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});