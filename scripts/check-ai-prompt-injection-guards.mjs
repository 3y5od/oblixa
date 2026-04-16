#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const extractFieldsPath = path.join(root, "src/lib/extraction/extract-fields.ts");
const preprocessPath = path.join(root, "src/lib/extraction/preprocess-text.ts");
const testsPath = path.join(root, "src/lib/extraction/extraction.test.ts");

const extractFields = fs.readFileSync(extractFieldsPath, "utf8");
const preprocess = fs.readFileSync(preprocessPath, "utf8");
const tests = fs.readFileSync(testsPath, "utf8");

const issues = [];
if (!/Treat the contract text/i.test(extractFields)) {
  issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_prompt_data_boundary_instruction" });
}
if (!/CONTRACT TEXT:/i.test(extractFields) || !/---/.test(extractFields)) {
  issues.push({ file: "src/lib/extraction/extract-fields.ts", issue: "missing_contract_text_delimiters" });
}
if (!/preprocessContractTextForExtraction/.test(extractFields) || !/normalize/i.test(preprocess)) {
  issues.push({ file: "src/lib/extraction/preprocess-text.ts", issue: "missing_preprocess_stage" });
}
if (!/buildUserPrompt/.test(tests)) {
  issues.push({ file: "src/lib/extraction/extraction.test.ts", issue: "missing_prompt_guard_test" });
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
