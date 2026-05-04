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
    'if (!isContractStoragePathSafe(storagePath)) {',
    'return { error: "Invalid file path" };',
    '.createSignedUrl(storagePath, 60 * 60);',
  ],
  "src/lib/v5/decision-packet-storage.ts": [
    "export function decisionPacketStoragePath(orgId: string, runId: string): string {",
    "export function decisionPacketPdfStoragePath(orgId: string, runId: string): string {",
    'const bucket = getV5DecisionPacketBucket();',
    '.createSignedUrl(storagePath, expiresInSeconds);',
  ],
  "src/lib/v5/decision-packet-storage.test.ts": [
    'it("decisionPacketStoragePath is org-scoped"',
    'it("decisionPacketPdfStoragePath is org-scoped"',
    'it("createDecisionPacketArtifactSignedUrl returns URL when bucket set"',
  ],
  "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts": [
    'if (!getV5DecisionPacketBucket()) {',
    'const signed = await createDecisionPacketArtifactSignedUrl(ctx.admin, storagePath, expiresIn);',
    'return NextResponse.json({ signedUrl: signed.signedUrl, expiresIn, artifact: kind });',
  ],
  "src/app/api/decisions/[id]/packet-runs/[runId]/route.test.ts": [
    'it("returns signed URL JSON when signed=1 and artifact path exists"',
    'expect(body.signedUrl).toBe("https://example.com/signed")',
    'expect(body.signedUrl).toBe("https://example.com/signed-pdf")',
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
