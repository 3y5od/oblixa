import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeUploadSecurityGuards } from "./check-upload-security-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeUploadSecurityGuards validates upload type/size and import content-type controls", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-upload-guards-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:upload-security-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:upload-security-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:upload-security-guards"\n');
  write(root, "src/actions/contracts.ts", 'const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB\nconst ALLOWED_TYPES = new Set([\n"application/pdf",\n"application/vnd.openxmlformats-officedocument.wordprocessingml.document",\n]);\n"None of the selected files could be uploaded. Use PDF or DOCX, each 20 MB or smaller.",\nthrow new Error(`${file.name}: exceeds 20 MB limit`);\nthrow new Error(`${file.name}: unsupported file type`);\nreturn { error: "Add at least one PDF or DOCX under 20 MB." };\n');
  write(root, "src/app/api/import/contracts/route.ts", 'if (contentType.includes("text/csv")) {\n}\nif (!contentType.includes("application/json")) {\nreturn { error: "Expected CSV or JSON import body." };\n}\nconst _lb_body = await readJsonBodyLimited(request);\n{ error: "Import payload too large. Split file and retry." },\n');
  write(root, "src/app/api/import/contracts/route.test.ts", 'it("returns 400 when authenticated but Content-Type is not CSV or JSON", () => {})\nexpect(body).toEqual({ error: "Expected CSV or JSON import body." })\nit("requires JSON imports to include csv or rows", () => {})\nheaders: { "content-type": "text/csv; charset=utf-8", "x-idempotency-key": "import-key-1" },\n');

  const report = analyzeUploadSecurityGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});