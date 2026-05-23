import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeLoggingTelemetryRedaction } from "./check-logging-telemetry-redaction.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:logging-telemetry-redaction": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:logging-telemetry-redaction\nnpm run check:notification-payload-scrub-contract\nnpm run check:report-redaction-contract\nnpm run check:ai-context-redaction\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:logging-telemetry-redaction"\n"check:notification-payload-scrub-contract"\n"check:report-redaction-contract"\n"check:ai-context-redaction"\n');
  write(root, "src/lib/observability/log-redaction.ts", "export function redactSensitiveLogString\nexport function redactSensitiveHeaders\nexport function isSensitiveLogKey\nSENSITIVE_HEADER_KEYS\nSECRET_LIKE_VALUE\nSIGNED_URL_SECRET_PARAM\nSENSITIVE_STRING_ASSIGNMENT\nSENSITIVE_LOG_KEY\nisPostgrestErrorLikeRecord\nformatUnknownForServerLog\n");
  write(root, "src/lib/observability/log-redaction.test.ts", 'it("redacts tokens, signed URL secrets, API keys, and raw payload keys", () => {})\nit("formats route and job errors without secret material", () => {})\nit("redacts header-shaped objects with centralized sensitive header names", () => {})\nit("redacts provider response and customer metadata keys", () => {})\nit("redacts PostgREST-shaped errors without logging query details or user content", () => {})\nrequest_id\n');
  write(root, "src/lib/observability/sentry-scrub.ts", "redactSensitiveHeaders\nscrubSentryDeepExtras\nscrubSentryDeniedTagKeys\nscrubSentryMessage\nscrubSentryExceptions\nscrubSentryBreadcrumbs\ndeepRedactEmailLikeInUnknown\n");
  write(root, "src/lib/observability/sentry-scrub.test.ts", 'it("redacts API keys, cookies, and inbound automation tokens (case-insensitive keys)", () => {})\nit("redacts signed URLs, bearer secrets, OAuth codes, and raw text in deep payloads", () => {})\nit("redacts signed URL values from non-sensitive request headers", () => {})\nexpect(text).toContain("req_1");\n');
  write(root, "src/lib/http/problem.ts", "redactSensitiveLogString\ndeepRedactEmailLikeInUnknown\nsanitizeProblemDetails\nredactProblemErrorMessage\n");
  write(root, "src/lib/http/problem.test.ts", 'it("redacts technical provider and stack details from problem error messages", () => {})\nit("redacts secret-bearing problem details and raw exception strings", () => {})\nsigned_url\nauthorization\n');
  write(root, "src/lib/product-telemetry.ts", "clampProductTelemetryDetails\nredactSensitiveLogString\nV10_TELEMETRY_FORBIDDEN_DETAIL_KEY_RE\nPRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES\n");
  write(root, "src/lib/product-telemetry.v10.test.ts", 'it("redacts email-like private strings before writing telemetry details", () => {})\nBearer abcdefghijk123456789\noauth_code\ndropped_field_count\n');
  write(root, "src/lib/v10-hardening-contracts.ts", 'export function sanitizeV10DiagnosticMetadata(\nconst unsafe = /raw|text|email|token|secret|private.?url|customer.?name|file/i;\nsafe[key] = "redacted"\nreturn { safe, droppedKeys };\n');
  write(root, "src/lib/v10-hardening-contracts.v10.test.ts", 'sanitizeV10DiagnosticMetadata({\nprovider_error: "redacted"\ndroppedKeys: ["raw_contract_text", "responder_email"]\n');
  write(root, "src/lib/observability/sentry.ts", "truncateSweepTag\nSENTRY_SWEEP_MAX_TAGS\nsetSweepCorrelationContext\naddProductSurfaceDiagnosticBreadcrumb\n");
  write(root, "src/lib/observability/api-route-instrumentation.ts", "request_id\ncorrelation_id\nerror_class\ncaptureServerException\n");
  write(root, "scripts/check-notification-payload-scrub-contract.mjs", "analyzeNotificationPayloadScrubContract\n");
  write(root, "scripts/check-report-redaction-contract.mjs", "sanitizeRetryPayload\nsanitizeMetadata\n");
  write(root, "scripts/check-ai-context-redaction.mjs", "redaction\n");
  write(root, "src/app/api/example/route.ts", 'console.error("[route] failed", error.message);\n');
}

test("analyzeLoggingTelemetryRedaction accepts complete Section 18 fixture", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-log-redaction-"));
  writeValidFixture(root);
  const report = analyzeLoggingTelemetryRedaction(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeLoggingTelemetryRedaction rejects unsafe route console logging", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-log-redaction-bad-"));
  writeValidFixture(root);
  write(root, "src/app/api/example/route.ts", "console.error(error);\n");
  const report = analyzeLoggingTelemetryRedaction(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "route_console_without_redaction_marker"));
});

test("analyzeLoggingTelemetryRedaction accepts CSP report redaction formatter", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-log-redaction-csp-"));
  writeValidFixture(root);
  write(
    root,
    "src/app/api/security/csp-report/route.ts",
    "console.warn(`[security-event:csp-report] ${formatCspReportForSecurityLog(report)}`);\n"
  );
  const report = analyzeLoggingTelemetryRedaction(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});
