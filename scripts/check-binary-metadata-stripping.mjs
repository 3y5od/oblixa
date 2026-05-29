#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:binary-metadata-stripping"];
const REQUIRED_CI_COMMANDS = ["npm run check:binary-metadata-stripping"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:binary-metadata-stripping"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/decision-intelligence/decision-packet-pdf.tsx": [
    "export const DECISION_PACKET_SAFE_PDF_METADATA = {",
    'title: "Oblixa decision packet"',
    'author: "Oblixa"',
    'creator: "Oblixa"',
    'producer: "Oblixa"',
    "<Document {...DECISION_PACKET_SAFE_PDF_METADATA}>",
  ],
  "src/lib/decision-intelligence/decision-packet-pdf.test.tsx": [
    'it("uses product-safe metadata instead of customer packet fields"',
    "DECISION_PACKET_SAFE_PDF_METADATA",
    "not.toMatch(/Acme|secret|customer/i)",
  ],
  "src/lib/decision-intelligence/decision-packet-storage.ts": [
    "const MAX_DECISION_PACKET_UPLOAD_BYTES = 25 * 1024 * 1024;",
    "uploadDecisionPacketPdfArtifact",
    'contentType: "application/pdf"',
    "normalizeDecisionPacketSignedUrlTtl",
  ],
  "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts": [
    "renderDecisionPacketPdfBuffer",
    '"content-type": "application/pdf"',
    '"cache-control": "private, no-store"',
    "contentDispositionAttachment(filename)",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeBinaryMetadataStripping(root = ROOT) {
  const issues = [];

  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
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
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "binary-metadata-stripping", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeBinaryMetadataStripping();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
