#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:storage-path-safety"];
const REQUIRED_CI_COMMANDS = ["npm run check:storage-path-safety"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:storage-path-safety"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/validation.ts": [
    "export function isContractStoragePathSafe(path: string | null | undefined): boolean {",
    'if (p.includes("%")) return false;',
    'p.includes("..")',
    'p.includes("\\\\")',
    'p.includes("\\0")',
    'if (parts.length !== 3) return false;',
  ],
  "src/lib/security/validation.test.ts": [
    'describe("isContractStoragePathSafe"',
    'it("accepts valid three-segment path with uuid-uuid-filename"',
    'it("rejects traversal, backslash, null byte"',
  ],
  "src/actions/contracts.ts": [
    "const CONTRACT_FILE_SIGNED_URL_TTL_SECONDS = 5 * 60;",
    'if (!isContractStoragePathSafe(storagePath)) {',
    'return { error: "Invalid file path" };',
    '.select("id, contract_id, contracts!inner(organization_id)")',
    '.createSignedUrl(storagePath, CONTRACT_FILE_SIGNED_URL_TTL_SECONDS);',
    'action: "contract_file.download_url_created"',
    'expires_in_seconds: CONTRACT_FILE_SIGNED_URL_TTL_SECONDS',
  ],
  "src/lib/v5/decision-packet-storage.ts": [
    "export const DECISION_PACKET_SIGNED_URL_TTL_SECONDS = 5 * 60;",
    "export function decisionPacketStoragePath(orgId: string, runId: string): string {",
    "export function decisionPacketPdfStoragePath(orgId: string, runId: string): string {",
    "export function isDecisionPacketArtifactStoragePathScoped(",
    "export function normalizeDecisionPacketSignedUrlTtl(expiresInSeconds: number): number {",
    'const bucket = getV5DecisionPacketBucket();',
    ".createSignedUrl(storagePath, safeExpiresIn);",
  ],
  "src/lib/v5/decision-packet-storage.test.ts": [
    'it("decisionPacketStoragePath is org-scoped"',
    'it("decisionPacketPdfStoragePath is org-scoped"',
    'it("validates decision packet artifact paths against org, run, and artifact kind"',
    'it("caps signed URL TTLs to the short-lived packet maximum"',
    'it("caps overlong signed URL TTLs before storage signing"',
    'it("createDecisionPacketArtifactSignedUrl returns URL when bucket set"',
  ],
  "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts": [
    'if (!getV5DecisionPacketBucket()) {',
    'isDecisionPacketArtifactStoragePathScoped(storagePath, {',
    'const expiresIn = DECISION_PACKET_SIGNED_URL_TTL_SECONDS;',
    'const signed = await createDecisionPacketArtifactSignedUrl(ctx.admin, storagePath, expiresIn);',
    'action: "decision_packet_artifact.download_url_created"',
    '"Cache-Control": "private, no-store"',
  ],
  "src/app/api/decisions/[id]/packet-runs/[runId]/route.test.ts": [
    'it("returns signed URL JSON when signed=1 and artifact path exists"',
    'it("rejects cross-org artifact storage paths before signing"',
    'expect(body.signedUrl).toBe("https://example.com/signed")',
    'expect(body.signedUrl).toBe("https://example.com/signed-pdf")',
    'expect(body.expiresIn).toBe(300)',
    'expect(createSignedUrl).not.toHaveBeenCalled()',
  ],
  "supabase/migrations/079_storage_bucket_private_policy_checks.sql": [
    "insert into storage.buckets",
    "('contracts', 'contracts', false)",
    "('decision-packets', 'decision-packets', false)",
    "on conflict (id) do update set public = false",
    "Org members can read contract file objects",
    "cf.storage_path = storage.objects.name",
    "Org members can read decision packet objects",
    "storage.objects.name like (dpr.organization_id::text || '/%')",
  ],
};

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeStoragePathSafety(root = ROOT) {
  const issues = [];

  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "storage-path-safety", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeStoragePathSafety();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
