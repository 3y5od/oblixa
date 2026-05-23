import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAiContextRedaction } from "./check-ai-context-redaction.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeBase(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:ai-context-redaction": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:ai-context-redaction\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:ai-context-redaction"\n');
  write(
    root,
    "src/lib/extraction/model-context-redaction.ts",
    "redactModelBoundContractText\nprepareModelBoundContractText\nMODEL_CONTEXT_REDACTION_REPLACEMENT\nAUTH_HEADER_LINE_RE\nSIGNED_MODEL_CONTEXT_URL_PARAM_RE\nPROVIDER_TOKEN_RE\nSENSITIVE_MODEL_CONTEXT_ASSIGNMENT_RE\nUNRELATED_ORG_IDENTIFIER_RE\nX-Goog-Signature\nGoogleAccessId\nAWSAccessKeyId\nsk-proj-\ngh[pousr]_\n"
  );
  write(
    root,
    "src/lib/extraction/model-context-redaction.test.ts",
    "redacts provider tokens, cookies, private URLs, and unrelated org ids\nconstructs prompts without sensitive fields present\nnormalizes and redacts before chunking model-bound text\nOPENAI_API_KEY=sk-proj-\ngithub_token=gho_\nX-Goog-Signature\n"
  );
  write(
    root,
    "src/lib/extraction/extract-fields.ts",
    "redactModelBoundContractText(contractText)\nprepareModelBoundContractText(text)\nslice(0, 200)\nformatUnknownForServerLog\n"
  );
  write(
    root,
    "src/lib/extraction/extraction.test.ts",
    "redacts sensitive model-bound context while preserving useful contract text\nkeeps model-returned source snippets bounded\n"
  );
  write(
    root,
    "src/lib/extraction/openai-pdf-text.ts",
    "redactModelBoundContractText\nReplace provider tokens, cookies, private URLs, signed URL secret parameters, and unrelated tenant identifiers\nformatUnknownForServerLog\n"
  );
  write(
    root,
    "src/lib/extraction/run-pipeline.ts",
    "prepareModelBoundContractText(combinedText)\napplyGroundingToFields(modelBoundGroundingText, extraction.fields)\nformatUnknownForServerLog(err)\n"
  );
  write(
    root,
    "src/lib/observability/log-redaction.ts",
    "redactSensitiveLogString\nformatUnknownForServerLog\nX-Goog-Signature\nsk-proj-\ngh[pousr]_\n"
  );
  write(
    root,
    "src/lib/observability/log-redaction.test.ts",
    "OPENAI_API_KEY=sk-proj-\ngithub_token=gho_\nX-Goog-Signature\n"
  );
  write(root, "src/lib/observability/sentry-scrub.ts", "redact\nscrub\nrawMessage\nraw_message\n");
  write(
    root,
    "scripts/check-ai-context-redaction.test.mjs",
    "rejects missing model-context redaction helper\nrejects raw model output logging regressions\n"
  );
}

test("analyzeAiContextRedaction accepts complete context redaction coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ai-context-ok-"));
  writeBase(root);
  const report = analyzeAiContextRedaction(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeAiContextRedaction rejects missing model-context redaction helper", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ai-context-missing-"));
  writeBase(root);
  fs.rmSync(path.join(root, "src/lib/extraction/model-context-redaction.ts"));
  const report = analyzeAiContextRedaction(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_required_file" && issue.rel === "src/lib/extraction/model-context-redaction.ts"));
});

test("analyzeAiContextRedaction rejects raw model output logging regressions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ai-context-raw-log-"));
  writeBase(root);
  write(
    root,
    "src/lib/extraction/extract-fields.ts",
    "redactModelBoundContractText(contractText)\nprepareModelBoundContractText(text)\nslice(0, 200)\nformatUnknownForServerLog\nslice(0, 2000)\ne instanceof Error ? e.message : e\n"
  );
  write(
    root,
    "src/lib/extraction/run-pipeline.ts",
    "prepareModelBoundContractText(combinedText)\napplyGroundingToFields(modelBoundGroundingText, extraction.fields)\nformatUnknownForServerLog(err)\nrawMessage\nconsole.error(\"OpenAI extraction error:\", err)\n"
  );
  const report = analyzeAiContextRedaction(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "raw_model_output_logged"));
  assert(report.issues.some((issue) => issue.issue === "raw_ai_error_forwarded_to_telemetry"));
  assert(report.issues.some((issue) => issue.issue === "raw_ai_error_logged"));
});
