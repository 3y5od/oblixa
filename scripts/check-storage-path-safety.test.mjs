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
  write(root, "src/actions/contracts.ts", 'const CONTRACT_FILE_SIGNED_URL_TTL_SECONDS = 5 * 60;\nif (!isContractStoragePathSafe(storagePath)) {\nreturn { error: "Invalid file path" };\n}\n.select("id, contract_id, contracts!inner(organization_id)")\n.createSignedUrl(storagePath, CONTRACT_FILE_SIGNED_URL_TTL_SECONDS);\naction: "contract_file.download_url_created"\nexpires_in_seconds: CONTRACT_FILE_SIGNED_URL_TTL_SECONDS\n');
  write(root, "src/lib/v5/decision-packet-storage.ts", 'export const DECISION_PACKET_SIGNED_URL_TTL_SECONDS = 5 * 60;\nexport function decisionPacketStoragePath(orgId: string, runId: string): string {\n}\nexport function decisionPacketPdfStoragePath(orgId: string, runId: string): string {\n}\nexport function isDecisionPacketArtifactStoragePathScoped(\nexport function normalizeDecisionPacketSignedUrlTtl(expiresInSeconds: number): number {\nconst bucket = getV5DecisionPacketBucket();\n.createSignedUrl(storagePath, safeExpiresIn);\n');
  write(root, "src/lib/v5/decision-packet-storage.test.ts", 'it("decisionPacketStoragePath is org-scoped", () => {})\nit("decisionPacketPdfStoragePath is org-scoped", () => {})\nit("validates decision packet artifact paths against org, run, and artifact kind", () => {})\nit("caps signed URL TTLs to the short-lived packet maximum", () => {})\nit("caps overlong signed URL TTLs before storage signing", () => {})\nit("createDecisionPacketArtifactSignedUrl returns URL when bucket set", () => {})\n');
  write(root, "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts", 'if (!getV5DecisionPacketBucket()) {\n}\nisDecisionPacketArtifactStoragePathScoped(storagePath, {\nconst expiresIn = DECISION_PACKET_SIGNED_URL_TTL_SECONDS;\nconst signed = await createDecisionPacketArtifactSignedUrl(ctx.admin, storagePath, expiresIn);\naction: "decision_packet_artifact.download_url_created"\n"Cache-Control": "private, no-store"\n');
  write(root, "src/app/api/decisions/[id]/packet-runs/[runId]/route.test.ts", 'it("returns signed URL JSON when signed=1 and artifact path exists", () => {})\nit("rejects cross-org artifact storage paths before signing", () => {})\nexpect(body.signedUrl).toBe("https://example.com/signed")\nexpect(body.signedUrl).toBe("https://example.com/signed-pdf")\nexpect(body.expiresIn).toBe(300)\nexpect(createSignedUrl).not.toHaveBeenCalled()\n');
  write(root, "supabase/migrations/079_storage_bucket_private_policy_checks.sql", "insert into storage.buckets\n('contracts', 'contracts', false)\n('decision-packets', 'decision-packets', false)\non conflict (id) do update set public = false\nOrg members can read contract file objects\ncf.storage_path = storage.objects.name\nOrg members can read decision packet objects\nstorage.objects.name like (dpr.organization_id::text || '/%')\n");

  const report = analyzeStoragePathSafety(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
