#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:notification-payload-scrub-contract"];
const REQUIRED_CI_COMMANDS = ["npm run check:notification-payload-scrub-contract"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:notification-payload-scrub-contract"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/notification-delivery.ts": [
    'function sanitizeRetryPayload(payload: RetryPayload | undefined | null): RetryPayload | null {',
    'sourceSnippet: payload.sourceSnippet ? limitString(payload.sourceSnippet, 2000) : null,',
    'if (encoded.length <= MAX_METADATA_BYTES) return out;',
    'return { metadata_truncated: true };',
    'retry_payload: retryPayload,',
  ],
  "src/lib/notification-delivery.test.ts": [
    'it("fails poison messages without retry payload when max attempts reached"',
    'it("sanitizes stored metadata and retry payload sizes"',
    'expect(metadata.metadata_truncated).toBe(true);',
    'expect(String(retryPayload.sourceSnippet).length).toBeLessThanOrEqual(2000);',
  ],
  "src/lib/observability/sentry-scrub.ts": [
    'function scrubCalibrationPayloads<T>(event: T): T {',
    'nextExtra[key] = "[redacted]";',
    'if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {',
    'out = scrubSentryDeepExtras(out);',
    'out = scrubSentryBreadcrumbs(out);',
  ],
  "src/lib/observability/sentry-scrub.test.ts": [
    'it("redacts API keys, cookies, and inbound automation tokens (case-insensitive keys)"',
    'it("redacts email-like substrings in nested extras and user payloads"',
    'expect(user?.email).toBe("[redacted]");',
  ],
  "src/lib/v10-hardening-contracts.ts": [
    'export function sanitizeV10DiagnosticMetadata(',
    'const unsafe = /raw|text|email|token|secret|private.?url|customer.?name|file/i;',
    'safe[key] = "redacted";',
    'return { safe, droppedKeys };',
  ],
  "src/lib/v10-hardening-contracts.v10.test.ts": [
    'sanitizeV10DiagnosticMetadata({',
    'provider_error: "redacted"',
    'droppedKeys: ["raw_contract_text", "responder_email"]',
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

export function analyzeNotificationPayloadScrubContract(root = ROOT) {
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

  return { checkId: "notification-payload-scrub-contract", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeNotificationPayloadScrubContract();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
