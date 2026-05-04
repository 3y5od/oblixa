import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePathTraversalGuards } from "./check-path-traversal-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzePathTraversalGuards validates filename/path sanitization before storage-key use", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-path-traversal-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:path-traversal-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:path-traversal-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:path-traversal-guards"\n');
  write(root, "src/lib/security/upload-filename.ts", 'export function sanitizeUploadedFileName(name: string): string {\nlet base = name.split(/[/\\\\]/).pop() ?? "document";\nif (base === ".." || base === ".") base = "document";\nconst cleaned = base.replace(/[\\x00-\\x1f\\x7f]/g, "").trim();\n}\n');
  write(root, "src/lib/security/upload-filename.test.ts", 'it("uses basename after path separators", () => {})\nit("strips control characters", () => {})\nit("falls back to document when empty after cleaning", () => {})\n');
  write(root, "src/lib/compliance/aml-typology-redteam.test.ts", 'describe("AML / abuse filename typology vs sanitizer", () => {})\nexpect(sanitizeUploadedFileName("../../etc/passwd")).toBe("passwd")\n');
  write(root, "src/actions/contracts.ts", 'const safeName = sanitizeUploadedFileName(file.name);\nconst storagePath = `org/${organizationId}/${contract.id}/${crypto.randomUUID()}-${safeName}`;\nconst storagePath = `org/${contract.organization_id}/${contract.id}/${crypto.randomUUID()}-${safeName}`;\n');

  const report = analyzePathTraversalGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});