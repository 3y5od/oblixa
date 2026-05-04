import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeInternalApiBoundaries } from "./check-internal-api-boundaries.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeInternalApiBoundaries validates internal worker and diagnostics auth boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-internal-boundaries-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:internal-api-boundaries": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:internal-api-boundaries\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:internal-api-boundaries"\n');
  write(root, "src/lib/security/api-guards.ts", 'export function requireCronAuthorized(request: Request): NextResponse | null {\nreturn gateCronRequest(request, { headers: API_PRIVATE_NO_STORE_HEADERS });\n}\nexport function requireBearerSecret(\nrequest: Request,\nenvVarName: BearerSecretEnvVarName\n): NextResponse | null {\ntype BearerSecretEnvVarName =\n| "EXTRACTION_WORKER_SECRET"\n| "OBLIXA_INTERNAL_DIAG_SECRET";\nreturn null;\n}\n');
  write(root, "src/lib/security/api-guards.test.ts", 'describe("requireCronAuthorized", () => {\nit("503 when CRON_SECRET unset (misconfiguration, not caller fault)", () => {})\nit("null when x-cron-secret matches", () => {})\n})\ndescribe("requireBearerSecret", () => {\nit("supports custom missing-secret responses", () => {})\nit("supports custom unauthorized responses", () => {})\n})\n');
  write(root, "src/app/api/extract/run/route.ts", 'const auth = requireBearerSecret(request, "EXTRACTION_WORKER_SECRET", {\nmissingSecretResponse: () =>\nNextResponse.json({ error: "Worker not configured" }, { status: 503 }),\n});\nconst _lim = await readJsonBodyLimited(request);\nif (!_lim.ok) return _lim.response;\n');
  write(root, "src/app/api/extract/run/route.test.ts", 'it("returns 401 when bearer token is missing", async () => {})\nit("returns 400 for invalid ids", async () => {})\nit("runs pipeline and returns ok for valid request", async () => {})\n');
  write(root, "src/app/api/internal/debugging-sweep/route.ts", 'const auth = requireBearerSecret(request, "OBLIXA_INTERNAL_DIAG_SECRET", {\nmissingSecretResponse: () => null,\nunauthorizedResponse: () => {\nerrors.push({ code: "UNAUTHORIZED", detail: "invalid or missing bearer" });\nreturn null;\n},\n});\nconst allow = parseInternalDiagAllowlist(process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST);\n');
  write(root, "src/app/api/internal/debugging-sweep/route.test.ts", 'it("returns 404 when endpoint disabled", async () => {})\nit("returns 403 for bad bearer", async () => {})\nit("returns JSON with kind and sorted keys on success", async () => {})\n');

  const report = analyzeInternalApiBoundaries(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});