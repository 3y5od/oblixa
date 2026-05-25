#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:logging-telemetry-redaction"];
const REQUIRED_CI_COMMANDS = [
  "npm run check:logging-telemetry-redaction",
  "npm run check:notification-payload-scrub-contract",
  "npm run check:report-redaction-contract",
  "npm run check:ai-context-redaction",
];
const REQUIRED_SECURITY_PIPELINE_STEPS = [
  '"check:logging-telemetry-redaction"',
  '"check:notification-payload-scrub-contract"',
  '"check:report-redaction-contract"',
  '"check:ai-context-redaction"',
];
const HARDENING_DIAGNOSTIC_EXPORT_MARKER = "export function sanitize" + "V" + "10DiagnosticMetadata(";
const REQUIRED_FILE_MARKERS = {
  "src/lib/observability/log-redaction.ts": [
    "export function redactSensitiveLogString",
    "export function redactSensitiveHeaders",
    "export function isSensitiveLogKey",
    "SENSITIVE_HEADER_KEYS",
    "SECRET_LIKE_VALUE",
    "SIGNED_URL_SECRET_PARAM",
    "SENSITIVE_STRING_ASSIGNMENT",
    "SENSITIVE_LOG_KEY",
    "isPostgrestErrorLikeRecord",
    "formatUnknownForServerLog",
  ],
  "src/lib/observability/log-redaction.test.ts": [
    'it("redacts tokens, signed URL secrets, API keys, and raw payload keys"',
    'it("formats route and job errors without secret material"',
    'it("redacts header-shaped objects with centralized sensitive header names"',
    'it("redacts provider response and customer metadata keys"',
    'it("redacts PostgREST-shaped errors without logging query details or user content"',
    "request_id",
  ],
  "src/lib/observability/sentry-scrub.ts": [
    "redactSensitiveHeaders",
    "scrubSentryDeepExtras",
    "scrubSentryDeniedTagKeys",
    "scrubSentryMessage",
    "scrubSentryExceptions",
    "scrubSentryBreadcrumbs",
    "deepRedactEmailLikeInUnknown",
  ],
  "src/lib/observability/sentry-scrub.test.ts": [
    'it("redacts API keys, cookies, and inbound automation tokens (case-insensitive keys)"',
    'it("redacts signed URLs, bearer secrets, OAuth codes, and raw text in deep payloads"',
    'it("redacts signed URL values from non-sensitive request headers"',
    'expect(text).toContain("req_1");',
  ],
  "src/lib/http/problem.ts": [
    "redactSensitiveLogString",
    "deepRedactEmailLikeInUnknown",
    "sanitizeProblemDetails",
    "redactProblemErrorMessage",
  ],
  "src/lib/http/problem.test.ts": [
    'it("redacts technical provider and stack details from problem error messages"',
    'it("redacts secret-bearing problem details and raw exception strings"',
    "signed_url",
    "authorization",
  ],
  "src/lib/product-telemetry.ts": [
    "clampProductTelemetryDetails",
    "redactSensitiveLogString",
    "V10_TELEMETRY_FORBIDDEN_DETAIL_KEY_RE",
    "PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES",
  ],
  "src/lib/product-telemetry-current.test.ts": [
    'it("redacts email-like private strings before writing telemetry details"',
    "Bearer abcdefghijk123456789",
    "oauth_code",
    "dropped_field_count",
  ],
  "src/lib/hardening-contracts.ts": [
    HARDENING_DIAGNOSTIC_EXPORT_MARKER,
    "const unsafe = /raw|text|email|token|secret|private.?url|customer.?name|file/i;",
    'safe[key] = "redacted"',
    "return { safe, droppedKeys };",
  ],
  "src/lib/hardening-contracts.test.ts": [
    "sanitizeV10DiagnosticMetadata({",
    "provider_error: \"redacted\"",
    'droppedKeys: ["raw_contract_text", "responder_email"]',
  ],
  "src/lib/observability/sentry.ts": [
    "truncateSweepTag",
    "SENTRY_SWEEP_MAX_TAGS",
    "setSweepCorrelationContext",
    "addProductSurfaceDiagnosticBreadcrumb",
  ],
  "src/lib/observability/api-route-instrumentation.ts": [
    "request_id",
    "correlation_id",
    "error_class",
    "captureServerException",
  ],
  "scripts/check-notification-payload-scrub-contract.mjs": ["analyzeNotificationPayloadScrubContract"],
  "scripts/check-report-redaction-contract.mjs": ["sanitizeRetryPayload", "sanitizeMetadata"],
  "scripts/check-ai-context-redaction.mjs": ["redact"],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
    const childRel = path.join(rel, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) walk(root, childRel, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(childRel);
  }
  return out;
}

function collectRouteConsoleIssues(root) {
  const issues = [];
  const routeFiles = walk(root, "src/app").filter((rel) => rel.endsWith("/route.ts"));
  for (const rel of routeFiles) {
    const text = read(root, rel);
    if (!/console\.(error|warn|info|debug|log)\(/.test(text)) continue;
    if (!/formatUnknownForServerLog|formatCspReportForSecurityLog|\.message|JSON\.stringify\(\{/.test(text)) {
      issues.push({ issue: "route_console_without_redaction_marker", rel });
    }
  }
  return issues;
}

export function analyzeLoggingTelemetryRedaction(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
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
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }
  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) issues.push({ issue: "missing_marker", rel, marker });
  }
  issues.push(...collectRouteConsoleIssues(root));
  return { checkId: "logging-telemetry-redaction", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeLoggingTelemetryRedaction();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
