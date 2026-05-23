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
  write(root, "src/actions/contracts.ts", 'scanUploadedFileForMalware\nsniffUploadedFileMime\nconst MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB\nconst ALLOWED_TYPES = new Set([\n"application/pdf",\n"application/vnd.openxmlformats-officedocument.wordprocessingml.document",\n]);\nconst ALLOWED_EXTENSIONS_BY_TYPE = new Map([\n]);\nif (!ALLOWED_EXTENSIONS_BY_TYPE.get(file.type)?.has(extension)) {\n}\nfunction hasAllowedUploadedContractSignature(fileType: string, signature: Uint8Array): boolean {\n}\nasync function getUploadedContractFileSignature(file: File): Promise<Uint8Array> {\n}\nconst nameValidation = validateUploadedFileName(file.name);\nif (!nameValidation.ok) return { ok: false, safeName, reason: "filename" };\nconst signature = await getUploadedContractFileSignature(file);\nreturn { ok: false, safeName, reason: "signature" };\nreturn { ok: false, safeName, reason: "malware" };\n"None of the selected files could be uploaded. Use PDF or DOCX, each 20 MB or smaller.",\nthrow new Error(`${validation.safeName}: exceeds 20 MB limit`);\nthrow new Error(`${validation.safeName}: unsafe file name`);\nthrow new Error(`${validation.safeName}: unsupported file type`);\nreturn { error: "Add at least one PDF or DOCX under 20 MB." };\n');
  write(root, "src/lib/security/upload-filename.ts", 'export const UPLOADED_FILE_NAME_MAX_LENGTH = 255;\nconst BANNED_UPLOADED_FILE_EXTENSIONS = new Set([\n]);\nexport function validateUploadedFileName(name: string):\nnormalize("NFC")\n\\u202a-\\u202e\\u2066-\\u2069\nif (normalized.includes("%")) return { ok: false, safeName, reason: "control_character" };\nnormalized.startsWith(".")\nreason: "banned_extension"\n');
  write(root, "src/lib/security/upload-filename.test.ts", 'it("strips bidi override characters from deceptive unicode filenames", () => {})\nit("rejects upload filenames with path separators and controls", () => {})\nit("rejects percent-encoded separators and extension-only upload filenames", () => {})\nit("rejects disguised executable and archive-like upload filenames", () => {})\nit("rejects reserved, empty, and overlong upload filenames", () => {})\n');
  write(root, "src/lib/security/upload-scan.ts", 'export function sniffUploadedFileMime(signature: Uint8Array):\nexport async function scanUploadedFileForMalware(\nmode === "required"\n"scanner_unavailable"\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE\nOBLIXA_MALWARE_SCANNER_MODE\n');
  write(root, "src/lib/security/upload-scan.test.ts", 'it("sniffs supported upload MIME types from file signatures", () => {})\nit("supports disabled, test, and fail-closed required scanner modes", () => {})\n');
  write(root, "src/lib/extraction/parse-document.ts", 'export const DOCUMENT_PARSER_TIMEOUT_MS = 15_000;\nexport const DOCUMENT_PARSER_MAX_BUFFER_BYTES = 20 * 1024 * 1024;\nasync function withParserTimeout<T>(operation: Promise<T>): Promise<T> {\n}\nthrow new Error("Document parser input too large");\nawait withParserTimeout(pdfParse(buffer))\nawait withParserTimeout(mammoth.extractRawText({ buffer }))\n');
  write(root, "src/lib/extraction/constants.ts", 'export const EXTRACTION_MAX_TEXT_CHARS = 720_000;\nexport const EXTRACTION_MAX_CHUNKS = 16;\n');
  write(root, "src/lib/extraction/chunk-text.ts", 'EXTRACTION_MAX_CHUNKS\nthrow new Error("Extracted contract text exceeds chunk limit");\n');
  write(root, "src/lib/extraction/run-pipeline.ts", 'function parserFailureLogDetails() {}\nconsole.error("Parse failed for uploaded file", parserFailureLogDetails(file, err));\nEXTRACTION_MAX_TEXT_CHARS\nawait fail("Extracted contract text is too large to process safely.");\nreason: "text_too_large",\n');
  write(root, "src/lib/extraction/pdf-mammoth-boundary.contract.test.ts", 'it("rejects malformed docx through the bounded parser wrapper", () => {})\nit("rejects malformed pdf through the bounded parser wrapper", () => {})\nit("rejects parser buffers larger than the upload ceiling", () => {})\n');
  write(root, "src/lib/import-jobs.test.ts", 'it("keeps malformed quoted CSV bounded and non-throwing", () => {})\nit("neutralizes formulas and strips bidi controls in imported cells", () => {})\nit("caps parsed CSV rows and cells before trusted import processing", () => {})\nexpect(MAX_IMPORT_BODY_CHARS).toBe(2_000_000)\nMAX_IMPORT_CSV_CELL_CHARS\n');
  write(root, "src/lib/import-jobs.ts", 'export const MAX_IMPORT_CSV_ROWS = 10_000;\nexport const MAX_IMPORT_CSV_COLUMNS = 100;\nexport const MAX_IMPORT_CSV_CELL_CHARS = 8_192;\nstripCsvBidiControlCharacters\nnormalizeCsvImportCell\nCSV_FORMULA_PREFIX_RE\n');
  write(root, "src/lib/extraction/extraction.test.ts", 'it("rejects text that would exceed the extraction chunk cap", () => {})\nEXTRACTION_MAX_CHUNKS\n');
  write(root, "src/lib/v10-activation-state.ts", 'export const V10_MAX_IMPORT_ROWS = 10_000;\nif (candidate.rowCount >= V10_MAX_IMPORT_ROWS)\n"CSV import must contain fewer than 10,000 rows."\n');
  write(root, "src/app/api/import/contracts/route.ts", 'if (contentType.includes("text/csv")) {\n}\nif (!contentType.includes("application/json")) {\nreturn { error: "Expected CSV or JSON import body." };\n}\nconst _lb_text = await readTextBodyLimited(request, MAX_IMPORT_BODY_CHARS);\nconst _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON);\nreturn importProblem(413, "Import payload too large. Split file and retry.", "import_payload_too_large", "import_contracts_payload_too_large");\nrowCount: parsedRows.length,\n');
  write(root, "src/app/api/import/contracts/route.test.ts", 'it("returns 400 when authenticated but Content-Type is not CSV or JSON", () => {})\nexpect(body).toMatchObject({ error: "Expected CSV or JSON import body." })\nit("requires JSON imports to include csv or rows", () => {})\nheaders: { "content-type": "text/csv; charset=utf-8", "x-idempotency-key": "import-key-1" },\nit("rejects imports at the parsed row ceiling before creating trusted records", () => {})\nexpect(runContractCsvImport).not.toHaveBeenCalled();\n');

  const report = analyzeUploadSecurityGuards(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});
