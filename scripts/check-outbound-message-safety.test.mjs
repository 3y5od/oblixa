import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeOutboundMessageSafety } from "./check-outbound-message-safety.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeOutboundMessageSafety validates mail/chat sanitization and header hygiene", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-outbound-message-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:outbound-message-safety": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:outbound-message-safety\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:outbound-message-safety"\n');
  write(root, "src/lib/email.ts", 'function sanitizeSubject(s: string): string {\nreturn s.replace(/[\\r\\n]+/g, " ").trim();\n}\nfunction escapeHtml(str: string): string {\nreturn str.replace(/&/g, "&amp;");\n}\nfrom: process.env.EMAIL_FROM || "onboarding@resend.dev",\nconst safeUrl = escapeHtml(opts.actionUrl);\nsubject: sanitizeSubject("You\'re invited to an Oblixa workspace"),\n');
  write(root, "src/lib/email/list-unsubscribe-header.ts", 'export function assertNoCrlfInHeaderValue(value: string): void {\nthrow new Error("header_value_contains_crlf");\n}\nparams.set("List-Unsubscribe", "One-Click");\n');
  write(root, "src/lib/email/list-unsubscribe-header.test.ts", 'it("rejects CRLF injection in header values", () => {})\nit("buildListUnsubscribePostBody encodes RFC8058 one-click fields", () => {})\n');
  write(root, "src/lib/messaging/chat-snippet-sanitize.ts", 'export function sanitizeChatSnippet(text: string): string {\nreturn text.replace(/@channel/gi, "@ channel").replace(/javascript:/gi, "javascript\\u200b:").replace(/<https?:\\/\\//gi, "<hxxp://");\n}\n');
  write(root, "src/lib/messaging/chat-snippet-sanitize.test.ts", 'it("defangs mass mention tokens", () => {})\nit("defangs Slack-style auto-link openers", () => {})\n');
  write(root, "src/lib/messaging/adaptive-card-snippet-sanitize.ts", 'export function sanitizeAdaptiveCardSnippet(jsonText: string): string {\nreturn jsonText.replace(/javascript:/gi, "javascript\\u200b:").replace(/data:text\\/html/gi, "data\\u200b:text/html");\n}\n');
  write(root, "src/lib/messaging/adaptive-card-snippet-sanitize.test.ts", 'it("defangs @everyone in card payload text", () => {})\nit("breaks javascript: in embedded URLs", () => {})\n');

  const report = analyzeOutboundMessageSafety(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});