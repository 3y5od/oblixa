import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeNotificationPayloadScrubContract } from "./check-notification-payload-scrub-contract.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeNotificationPayloadScrubContract validates retry-payload and diagnostics redaction", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-notification-scrub-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:notification-payload-scrub-contract": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:notification-payload-scrub-contract\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:notification-payload-scrub-contract"\n');
  write(root, "src/lib/notification-delivery.ts", 'scrubOutboundMetadata,\nredactOutboundMessageText,\nfunction sanitizeRetryPayload(\nsourceSnippet: payload.sourceSnippet ? scrubLimitedText(payload.sourceSnippet, 2000) : null,\nwebhookUrl: redactWebhookUrl ? "[redacted]" : scrubLimitedText(payload.webhookUrl, 1024),\n}\nif (encoded.length <= MAX_METADATA_BYTES) return out;\nreturn { metadata_truncated: true };\nlast_error: `${terminal ? "[terminal] " : ""}${sanitizedError}`.slice(0, 500),\nconst metadata = sanitizeMetadata(input.metadata ?? {});\nretry_payload: retryPayload,\n');
  write(root, "src/lib/notification-delivery.test.ts", 'it("fails poison messages without retry payload when max attempts reached", async () => {})\nit("sanitizes stored metadata and retry payload sizes", async () => {})\nit("redacts sensitive metadata, retry payload text, and stored Slack webhook URLs", async () => {})\nexpect(metadata.metadata_truncated).toBe(true);\nexpect(String(retryPayload.sourceSnippet).length).toBeLessThanOrEqual(2000);\nexpect(retryPayload.webhookUrl).toBe("[redacted]");\n');
  write(root, "src/lib/observability/sentry-scrub.ts", 'function scrubCalibrationPayloads<T>(event: T): T {\nnextExtra[key] = "[redacted]";\n}\nredactSensitiveHeaders(headers)\nout = scrubSentryDeepExtras(out);\nout = scrubSentryBreadcrumbs(out);\n');
  write(root, "src/lib/observability/sentry-scrub.test.ts", 'it("redacts API keys, cookies, and inbound automation tokens (case-insensitive keys)", () => {})\nit("redacts email-like substrings in nested extras and user payloads", () => {})\nexpect(user?.email).toBe("[redacted]");\n');
  write(root, "src/lib/hardening-contracts.ts", 'export function sanitizeV10DiagnosticMetadata(\nmetadata: Record<string, string | number | boolean | null>\n) {\nconst unsafe = /raw|text|email|token|secret|private.?url|customer.?name|file/i;\nsafe[key] = "redacted";\nreturn { safe, droppedKeys };\n}\n');
  write(root, "src/lib/hardening-contracts.test.ts", 'sanitizeV10DiagnosticMetadata({\nprovider_error: "redacted",\ndroppedKeys: ["raw_contract_text", "responder_email"],\n});\n');

  const report = analyzeNotificationPayloadScrubContract(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
