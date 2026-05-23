import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeDecompressionBombGuards } from "./check-decompression-bomb-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:decompression-bomb-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:decompression-bomb-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:decompression-bomb-guards"\n');
  write(
    root,
    "src/lib/extraction/parse-document.ts",
    'export const DOCUMENT_PARSER_MAX_DOCX_ENTRIES = 2_000;\nexport const DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;\nexport const DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO = 100;\nfunction isDocxZipEntryNameSafe(name: string): boolean {\n}\nexport function inspectDocxZipExpansion(buffer: Buffer): DocxZipExpansionStats | null {\nthrow new Error("Document parser DOCX entry name unsafe");\n}\nexport function assertDocxZipExpansionWithinParserLimits(buffer: Buffer): void {\nstats.entryCount > DOCUMENT_PARSER_MAX_DOCX_ENTRIES\nstats.uncompressedBytes > DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES\nstats.maxCompressionRatio > DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO\nthrow new Error("Document parser DOCX central directory missing");\nthrow new Error("Document parser DOCX archive expands too large");\nthrow new Error("Document parser DOCX archive compression ratio too high");\nthrow new Error("Document parser DOCX required entries missing");\n}\nassertDocxZipExpansionWithinParserLimits(buffer);\n'
  );
  write(
    root,
    "src/lib/extraction/pdf-mammoth-boundary.contract.test.ts",
    'makeDocxCentralDirectory\nit("rejects docx zip expansion before mammoth parsing", () => {})\nit("rejects docx archive entries with unsafe internal names", () => {})\nit("rejects docx archives with suspicious compression ratios", () => {})\nit("rejects docx archives missing required document entries", () => {})\nit("rejects docx archives with too many central directory entries", () => {})\nDOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES + 1\nDOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO + 1\nDOCUMENT_PARSER_MAX_DOCX_ENTRIES + 1\n'
  );
}

test("analyzeDecompressionBombGuards accepts DOCX expansion caps and tests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-decompression-"));
  writeValidFixture(root);

  const report = analyzeDecompressionBombGuards(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeDecompressionBombGuards rejects missing ZIP expansion guard", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-decompression-bad-"));
  writeValidFixture(root);
  write(root, "src/lib/extraction/parse-document.ts", "export const DOCUMENT_PARSER_MAX_DOCX_ENTRIES = 2_000;\n");

  const report = analyzeDecompressionBombGuards(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_marker" && issue.marker.includes("assertDocxZipExpansion")));
});
