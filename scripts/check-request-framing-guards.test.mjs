import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRequestFramingGuards } from "./check-request-framing-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeRequestFramingGuards validates bounded JSON parsing and representative route adoption", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-request-framing-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:request-framing-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:request-framing-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:request-framing-guards"\n');
  write(root, "src/lib/security/read-json-body-limited.ts", 'const DEFAULT_MAX = 512 * 1024;\nconst len = request.headers.get("content-length");\nif (Number.isFinite(n) && n > maxBytes) {\n}\nconst text = await request.text();\nif (text.length > maxBytes) {\nreturn NextResponse.json({ error: "Payload too large" }, { status: 413 });\n}\nreturn NextResponse.json({ error: "Invalid JSON" }, { status: 400 });\nexport async function parseJsonBodyWithLimit<T>(\nrequest: Request,\nparse: (raw: unknown) => T\n) {}\n');
  write(root, "src/lib/security/read-json-body-limited.test.ts", 'it("rejects oversized body by Content-Length", async () => {})\nit("parses small JSON", async () => {})\nit("maps body through parse", async () => {})\n');
  write(root, "src/app/api/extract/run/route.ts", 'const _lim = await readJsonBodyLimited(request);\nif (!_lim.ok) return _lim.response;\n');
  write(root, "src/app/api/integrations/actions/callback/route.ts", 'const _lb_body = await readJsonBodyLimited(request);\nif (!_lb_body.ok) return _lb_body.response;\n');
  write(root, "src/app/api/webhooks/dispatch/route.ts", 'const deny = gateCronRequest(request);\nconst _lb_body = await readJsonBodyLimited(request);\nif (!_lb_body.ok) return _lb_body.response;\n');
  write(root, "src/app/api/programs/route.ts", 'const parsed = await readJsonBodyLimited(request);\nif (!parsed.ok) return parsed.response;\n');
  write(root, "src/app/api/external-actions/[token]/workflow-step/route.ts", 'import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";\nconst parsedBody = await parseJsonBodyWithLimit(request, (raw) => raw);\n');

  const report = analyzeRequestFramingGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});