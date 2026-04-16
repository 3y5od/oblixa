#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const extractionPath = path.join(root, "src/lib/extraction/extract-fields.ts");
const source = fs.readFileSync(extractionPath, "utf8");

const issues = [];
if (/tools\s*:|tool_choice|function_call|function_calling|responses\.create/i.test(source)) {
  issues.push({
    file: "src/lib/extraction/extract-fields.ts",
    issue: "ai_tool_call_surface_present_requires_explicit_authorization_design",
  });
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
