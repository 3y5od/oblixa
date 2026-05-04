#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:path-traversal-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:path-traversal-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:path-traversal-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/upload-filename.ts": [
    "export function sanitizeUploadedFileName(name: string): string {",
    'let base = name.split(/[/\\\\]/).pop() ?? "document";',
    'if (base === ".." || base === ".") base = "document";',
    'const cleaned = base.replace(/[\\x00-\\x1f\\x7f]/g, "").trim();',
  ],
  "src/lib/security/upload-filename.test.ts": [
    'it("uses basename after path separators"',
    'it("strips control characters"',
    'it("falls back to document when empty after cleaning"',
  ],
  "src/lib/compliance/aml-typology-redteam.test.ts": [
    'describe("AML / abuse filename typology vs sanitizer"',
    'expect(sanitizeUploadedFileName("../../etc/passwd")).toBe("passwd")',
  ],
  "src/actions/contracts.ts": [
    'const safeName = sanitizeUploadedFileName(file.name);',
    'const storagePath = `org/${organizationId}/${contract.id}/${crypto.randomUUID()}-${safeName}`;',
    'const storagePath = `org/${contract.organization_id}/${contract.id}/${crypto.randomUUID()}-${safeName}`;',
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

export function analyzePathTraversalGuards(root = ROOT) {
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

  return { checkId: "path-traversal-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePathTraversalGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
