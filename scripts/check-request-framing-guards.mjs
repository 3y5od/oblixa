#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:request-framing-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:request-framing-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:request-framing-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/read-json-body-limited.ts": [
    "const DEFAULT_MAX = 512 * 1024;",
    'const len = request.headers.get("content-length");',
    "if (!/^\\d+$/.test(len.trim()))",
    "Number.isSafeInteger(n) || n > maxBytes",
    "request.body.getReader()",
    "value.byteLength",
    "reader.cancel()",
    "decoder.decode(value, { stream: true })",
    "return jsonPayloadTooLarge();",
    'return jsonBadRequest(undefined, { reason: "invalid_content_length" });',
    'reason: "invalid_json"',
    'reason: "unsafe_json_key"',
    'reason: "json_shape_too_large"',
    "jsonUnsupportedMediaType",
    "jsonContentTypeRejection",
    "hasUnsafeJsonKey",
    "isJsonShapeWithinLimits",
    "allowJsonWhitespaceControls",
    "export async function rejectUnexpectedBody(",
    "export async function parseJsonBodyWithLimit<T>(",
  ],
  "src/lib/security/read-json-body-limited.test.ts": [
    'it("rejects oversized body by Content-Length", async () => {',
    'it("parses small JSON", async () => {',
    'it("rejects missing, wrong, duplicate, and text/plain JSON content types", async () => {',
    'it("allows parameterized JSON content types", async () => {',
    'it("rejects prototype-pollution keys after parsing"',
    'it("rejects JSON shapes that exceed structural limits"',
    'it("maps body through parse", async () => {',
  ],
  "src/app/api/extract/run/route.ts": [
    'const _lim = await readJsonBodyLimitedWithRaw(request, BODY_LIMIT_LARGE_JSON);',
    'if (!_lim.ok) return _lim.response;',
  ],
  "src/app/api/integrations/actions/callback/route.ts": [
    'const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND);',
    'if (!_lb_body.ok) return _lb_body.response;',
  ],
  "src/app/api/webhooks/dispatch/route.ts": [
    'const deny = gateCronRequest(request);',
    'const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND);',
    'if (!_lb_body.ok) return _lb_body.response;',
  ],
  "src/app/api/programs/route.ts": [
    'const parsed = await readJsonBodyLimited(request);',
    'if (!parsed.ok) return parsed.response;',
  ],
  "src/app/api/external-actions/[token]/workflow-step/route.ts": [
    'import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";',
    'const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>',
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

export function analyzeRequestFramingGuards(root = ROOT) {
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

  return { checkId: "request-framing-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRequestFramingGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
