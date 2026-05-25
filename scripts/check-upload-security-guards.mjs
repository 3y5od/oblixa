#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:upload-security-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:upload-security-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:upload-security-guards"'];
const MAX_IMPORT_ROWS_EXPORT_MARKER = "export const " + "V" + "10_MAX_IMPORT_ROWS = 10_000;";
const REQUIRED_FILE_MARKERS = {
  "src/actions/contracts.ts": [
    "scanUploadedFileForMalware",
    "sniffUploadedFileMime",
    "const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB",
    'const ALLOWED_TYPES = new Set([',
    "const ALLOWED_EXTENSIONS_BY_TYPE = new Map([",
    '"application/pdf",',
    '"application/vnd.openxmlformats-officedocument.wordprocessingml.document",',
    'if (!ALLOWED_EXTENSIONS_BY_TYPE.get(file.type)?.has(extension)) {',
    "function hasAllowedUploadedContractSignature(fileType: string, signature: Uint8Array): boolean {",
    "async function getUploadedContractFileSignature(file: File): Promise<Uint8Array> {",
    "const nameValidation = validateUploadedFileName(file.name);",
    'if (!nameValidation.ok) return { ok: false, safeName, reason: "filename" };',
    "const signature = await getUploadedContractFileSignature(file);",
    'return { ok: false, safeName, reason: "signature" };',
    'return { ok: false, safeName, reason: "malware" };',
    '"None of the selected files could be uploaded. Use PDF or DOCX, each 20 MB or smaller.",',
    'throw new Error(`${validation.safeName}: exceeds 20 MB limit`);',
    'throw new Error(`${validation.safeName}: unsafe file name`);',
    'throw new Error(`${validation.safeName}: unsupported file type`);',
    'return { error: "Add at least one PDF or DOCX under 20 MB." };',
  ],
  "src/lib/security/upload-filename.ts": [
    "export const UPLOADED_FILE_NAME_MAX_LENGTH = 255;",
    "const BANNED_UPLOADED_FILE_EXTENSIONS = new Set([",
    "export function validateUploadedFileName(name: string):",
    'normalize("NFC")',
    "\\u202a-\\u202e\\u2066-\\u2069",
    'if (normalized.includes("%")) return { ok: false, safeName, reason: "control_character" };',
    'normalized.startsWith(".")',
    "reason: \"banned_extension\"",
  ],
  "src/lib/security/upload-filename.test.ts": [
    'it("strips bidi override characters from deceptive unicode filenames"',
    'it("rejects upload filenames with path separators and controls"',
    'it("rejects percent-encoded separators and extension-only upload filenames"',
    'it("rejects disguised executable and archive-like upload filenames"',
    'it("rejects reserved, empty, and overlong upload filenames"',
  ],
  "src/lib/security/upload-scan.ts": [
    "export function sniffUploadedFileMime(signature: Uint8Array):",
    "export async function scanUploadedFileForMalware(",
    'mode === "required"',
    '"scanner_unavailable"',
    "EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
    "OBLIXA_MALWARE_SCANNER_MODE",
  ],
  "src/lib/security/upload-scan.test.ts": [
    'it("sniffs supported upload MIME types from file signatures"',
    'it("supports disabled, test, and fail-closed required scanner modes"',
  ],
  "src/lib/extraction/parse-document.ts": [
    "export const DOCUMENT_PARSER_TIMEOUT_MS = 15_000;",
    "export const DOCUMENT_PARSER_MAX_BUFFER_BYTES = 20 * 1024 * 1024;",
    "async function withParserTimeout<T>(operation: Promise<T>): Promise<T> {",
    'throw new Error("Document parser input too large");',
    "await withParserTimeout(pdfParse(buffer))",
    "await withParserTimeout(mammoth.extractRawText({ buffer }))",
  ],
  "src/lib/extraction/constants.ts": [
    "export const EXTRACTION_MAX_TEXT_CHARS = 720_000;",
    "export const EXTRACTION_MAX_CHUNKS = 16;",
  ],
  "src/lib/extraction/chunk-text.ts": [
    "EXTRACTION_MAX_CHUNKS",
    'throw new Error("Extracted contract text exceeds chunk limit");',
  ],
  "src/lib/extraction/run-pipeline.ts": [
    "function parserFailureLogDetails(",
    'console.error("Parse failed for uploaded file", parserFailureLogDetails(file, err));',
    "EXTRACTION_MAX_TEXT_CHARS",
    'await fail("Extracted contract text is too large to process safely.");',
    'reason: "text_too_large",',
  ],
  "src/lib/extraction/pdf-mammoth-boundary.contract.test.ts": [
    'it("rejects malformed docx through the bounded parser wrapper"',
    'it("rejects malformed pdf through the bounded parser wrapper"',
    'it("rejects parser buffers larger than the upload ceiling"',
  ],
  "src/lib/import-jobs.test.ts": [
    'it("keeps malformed quoted CSV bounded and non-throwing"',
    'it("neutralizes formulas and strips bidi controls in imported cells"',
    'it("caps parsed CSV rows and cells before trusted import processing"',
    "expect(MAX_IMPORT_BODY_CHARS).toBe(2_000_000)",
    "MAX_IMPORT_CSV_CELL_CHARS",
  ],
  "src/lib/import-jobs.ts": [
    "export const MAX_IMPORT_CSV_ROWS = 10_000;",
    "export const MAX_IMPORT_CSV_COLUMNS = 100;",
    "export const MAX_IMPORT_CSV_CELL_CHARS = 8_192;",
    "stripCsvBidiControlCharacters",
    "normalizeCsvImportCell",
    "CSV_FORMULA_PREFIX_RE",
  ],
  "src/lib/extraction/extraction.test.ts": [
    'it("rejects text that would exceed the extraction chunk cap"',
    "EXTRACTION_MAX_CHUNKS",
  ],
  "src/lib/activation-state.ts": [
    MAX_IMPORT_ROWS_EXPORT_MARKER,
    "if (candidate.rowCount >= V10_MAX_IMPORT_ROWS)",
    '"CSV import must contain fewer than 10,000 rows."',
  ],
  "src/app/api/import/contracts/route.ts": [
    'if (contentType.includes("text/csv")) {',
    'if (!contentType.includes("application/json")) {',
    'return { error: "Expected CSV or JSON import body." };',
    'const _lb_text = await readTextBodyLimited(request, MAX_IMPORT_BODY_CHARS);',
    'const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON);',
    'return importProblem(413, "Import payload too large. Split file and retry.", "import_payload_too_large", "import_contracts_payload_too_large");',
    "rowCount: parsedRows.length,",
  ],
  "src/app/api/import/contracts/route.test.ts": [
    'it("returns 400 when authenticated but Content-Type is not CSV or JSON"',
    'expect(body).toMatchObject({ error: "Expected CSV or JSON import body." })',
    'it("requires JSON imports to include csv or rows"',
    'headers: { "content-type": "text/csv; charset=utf-8", "x-idempotency-key": "import-key-1" },',
    'it("rejects imports at the parsed row ceiling before creating trusted records"',
    'expect(runContractCsvImport).not.toHaveBeenCalled();',
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

export function analyzeUploadSecurityGuards(root = ROOT) {
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

  return { checkId: "upload-security-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeUploadSecurityGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
