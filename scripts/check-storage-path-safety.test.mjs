import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeStoragePathSafety } from "./check-storage-path-safety.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeStoragePathSafety validates org-scoped storage keys and signed URL gates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-storage-path-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:storage-path-safety": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:storage-path-safety\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:storage-path-safety"\n');
  write(root, "src/lib/security/validation.ts", 'export function isContractStoragePathSafe(path: string | null | undefined): boolean {\nif (p.includes("%")) return false;\nif (p.includes("..") || p.includes("\\\\") || p.includes("\\0")) return false;\nif (parts.length !== 3) return false;\n}\n');
  write(root, "src/lib/security/validation.test.ts", 'describe("isContractStoragePathSafe", () => {})\nit("accepts valid three-segment path with uuid-uuid-filename", () => {})\nit("rejects traversal, backslash, null byte", () => {})\n');
  write(root, "src/actions/contracts.ts", 'if (!isContractStoragePathSafe(storagePath)) {\nreturn { error: "Invalid file path" };\n}\n.createSignedUrl(storagePath, 60 * 60);\n');
  write(root, "src/lib/v5/decision-packet-storage.ts", 'export function decisionPacketStoragePath(orgId: string, runId: string): string {\n}\nexport function decisionPacketPdfStoragePath(orgId: string, runId: string): string {\n}\nconst bucket = getV5DecisionPacketBucket();\n.createSignedUrl(storagePath, expiresInSeconds);\n');
  write(root, "src/lib/v5/decision-packet-storage.test.ts", 'it("decisionPacketStoragePath is org-scoped", () => {})\nit("decisionPacketPdfStoragePath is org-scoped", () => {})\nit("createDecisionPacketArtifactSignedUrl returns URL when bucket set", () => {})\n');
  write(root, "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts", 'if (!getV5DecisionPacketBucket()) {\n}\nconst signed = await createDecisionPacketArtifactSignedUrl(ctx.admin, storagePath, expiresIn);\nreturn NextResponse.json({ signedUrl: signed.signedUrl, expiresIn, artifact: kind });\n');
  write(root, "src/app/api/decisions/[id]/packet-runs/[runId]/route.test.ts", 'it("returns signed URL JSON when signed=1 and artifact path exists", () => {})\nexpect(body.signedUrl).toBe("https://example.com/signed")\nexpect(body.signedUrl).toBe("https://example.com/signed-pdf")\n');

  const report = analyzeStoragePathSafety(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});