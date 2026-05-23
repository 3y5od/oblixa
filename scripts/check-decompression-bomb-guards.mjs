#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:decompression-bomb-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:decompression-bomb-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:decompression-bomb-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/extraction/parse-document.ts": [
    "export const DOCUMENT_PARSER_MAX_DOCX_ENTRIES = 2_000;",
    "export const DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;",
    "export const DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO = 100;",
    "function isDocxZipEntryNameSafe(name: string): boolean {",
    "export function inspectDocxZipExpansion(buffer: Buffer): DocxZipExpansionStats | null {",
    "export function assertDocxZipExpansionWithinParserLimits(buffer: Buffer): void {",
    "stats.entryCount > DOCUMENT_PARSER_MAX_DOCX_ENTRIES",
    "stats.uncompressedBytes > DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES",
    "stats.maxCompressionRatio > DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO",
    'throw new Error("Document parser DOCX central directory missing");',
    'throw new Error("Document parser DOCX archive expands too large");',
    'throw new Error("Document parser DOCX archive compression ratio too high");',
    'throw new Error("Document parser DOCX entry name unsafe");',
    'throw new Error("Document parser DOCX required entries missing");',
    "assertDocxZipExpansionWithinParserLimits(buffer);",
  ],
  "src/lib/extraction/pdf-mammoth-boundary.contract.test.ts": [
    "makeDocxCentralDirectory",
    'it("rejects docx zip expansion before mammoth parsing"',
    'it("rejects docx archive entries with unsafe internal names"',
    'it("rejects docx archives with suspicious compression ratios"',
    'it("rejects docx archives missing required document entries"',
    'it("rejects docx archives with too many central directory entries"',
    "DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES + 1",
    "DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO + 1",
    "DOCUMENT_PARSER_MAX_DOCX_ENTRIES + 1",
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

export function analyzeDecompressionBombGuards(root = ROOT) {
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

  return { checkId: "decompression-bomb-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDecompressionBombGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
