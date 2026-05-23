#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function read(projectRoot, rel) {
  return fs.readFileSync(path.join(projectRoot, rel), "utf8");
}

export function analyzeAiPromptInjectionGuards(projectRoot = root) {
  const extractFields = read(projectRoot, "src/lib/extraction/extract-fields.ts");
  const preprocess = read(projectRoot, "src/lib/extraction/preprocess-text.ts");
  const tests = read(projectRoot, "src/lib/extraction/extraction.test.ts");

  const issues = [];
  if (!/Treat the contract text/i.test(extractFields)) {
    issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_prompt_data_boundary_instruction" });
  }
  if (!/CONTRACT TEXT:/i.test(extractFields) || !/BEGIN_UNTRUSTED_CONTRACT_TEXT/.test(extractFields) || !/END_UNTRUSTED_CONTRACT_TEXT/.test(extractFields)) {
    issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_contract_text_delimiters" });
  }
  if (!/escapePromptBoundaryTokens/.test(extractFields) || !/contract boundary marker removed/.test(extractFields)) {
    issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_boundary_token_escaping" });
  }
  if (!/{ role: "system", content: SYSTEM_PROMPT }/.test(extractFields) || !/{ role: "user", content: userContent }/.test(extractFields)) {
    issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_system_user_message_separation" });
  }
  if (!/strict:\s*true/.test(extractFields) || !/validateExtractionJsonPayload/.test(extractFields)) {
    issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_strict_structured_output_validation" });
  }
  if (!/EXTRACTION_MODEL_OUTPUT_MAX_CHARS/.test(extractFields) || !/EXTRACTION_MODEL_OUTPUT_MAX_FIELD_ROWS/.test(extractFields)) {
    issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_model_output_size_bounds" });
  }
  if (!/preprocessContractTextForExtraction/.test(extractFields) || !/normalize/i.test(preprocess)) {
    issues.push({ file: "src/lib/extraction/preprocess-text.ts", issue: "missing_preprocess_stage" });
  }
  if (!/buildUserPrompt/.test(tests)) {
    issues.push({ file: "src/lib/extraction/extraction.test.ts", issue: "missing_prompt_guard_test" });
  }
  if (!/Ignore previous instructions/.test(tests) || !/spoof extraction delimiters/.test(tests)) {
    issues.push({ file: "src/lib/extraction/extraction.test.ts", issue: "missing_prompt_injection_regression_test" });
  }
  if (!/malformed model output/.test(tests) || !/injected field names/.test(tests)) {
    issues.push({ file: "src/lib/extraction/extraction.test.ts", issue: "missing_malformed_model_output_tests" });
  }
  if (!/oversized or overlong structured model output/.test(tests)) {
    issues.push({ file: "src/lib/extraction/extraction.test.ts", issue: "missing_oversized_model_output_tests" });
  }

  return { issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAiPromptInjectionGuards();
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length > 0) process.exit(1);
}
