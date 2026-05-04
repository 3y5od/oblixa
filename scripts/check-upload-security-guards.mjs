#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:upload-security-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:upload-security-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:upload-security-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/actions/contracts.ts": [
    "const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB",
    'const ALLOWED_TYPES = new Set([',
    '"application/pdf",',
    '"application/vnd.openxmlformats-officedocument.wordprocessingml.document",',
    '"None of the selected files could be uploaded. Use PDF or DOCX, each 20 MB or smaller.",',
    'throw new Error(`${file.name}: exceeds 20 MB limit`);',
    'throw new Error(`${file.name}: unsupported file type`);',
    'return { error: "Add at least one PDF or DOCX under 20 MB." };',
  ],
  "src/app/api/import/contracts/route.ts": [
    'if (contentType.includes("text/csv")) {',
    'if (!contentType.includes("application/json")) {',
    'return { error: "Expected CSV or JSON import body." };',
    'const _lb_body = await readJsonBodyLimited(request);',
    '{ error: "Import payload too large. Split file and retry." },',
  ],
  "src/app/api/import/contracts/route.test.ts": [
    'it("returns 400 when authenticated but Content-Type is not CSV or JSON"',
    'expect(body).toEqual({ error: "Expected CSV or JSON import body." })',
    'it("requires JSON imports to include csv or rows"',
    'headers: { "content-type": "text/csv; charset=utf-8", "x-idempotency-key": "import-key-1" },',
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
