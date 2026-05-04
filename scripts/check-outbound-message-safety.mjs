#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:outbound-message-safety"];
const REQUIRED_CI_COMMANDS = ["npm run check:outbound-message-safety"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:outbound-message-safety"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/email.ts": [
    'function sanitizeSubject(s: string): string {',
    'return s.replace(/[\\r\\n]+/g, " ").trim();',
    'function escapeHtml(str: string): string {',
    '.replace(/&/g, "&amp;")',
    'from: process.env.EMAIL_FROM || "onboarding@resend.dev",',
    'const safeUrl = escapeHtml(opts.actionUrl);',
    'subject: sanitizeSubject("You\'re invited to an Oblixa workspace"),',
  ],
  "src/lib/email/list-unsubscribe-header.ts": [
    'export function assertNoCrlfInHeaderValue(value: string): void {',
    'throw new Error("header_value_contains_crlf");',
    'params.set("List-Unsubscribe", "One-Click");',
  ],
  "src/lib/email/list-unsubscribe-header.test.ts": [
    'it("rejects CRLF injection in header values"',
    'it("buildListUnsubscribePostBody encodes RFC8058 one-click fields"',
  ],
  "src/lib/messaging/chat-snippet-sanitize.ts": [
    'export function sanitizeChatSnippet(text: string): string {',
    '.replace(/@channel/gi, "@ channel")',
    '.replace(/javascript:/gi, "javascript\\u200b:")',
    '.replace(/<https?:\\/\\//gi, "<hxxp://")',
  ],
  "src/lib/messaging/chat-snippet-sanitize.test.ts": [
    'it("defangs mass mention tokens"',
    'it("defangs Slack-style auto-link openers"',
  ],
  "src/lib/messaging/adaptive-card-snippet-sanitize.ts": [
    'export function sanitizeAdaptiveCardSnippet(jsonText: string): string {',
    '.replace(/javascript:/gi, "javascript\\u200b:")',
    '.replace(/data:text\\/html/gi, "data\\u200b:text/html")',
  ],
  "src/lib/messaging/adaptive-card-snippet-sanitize.test.ts": [
    'it("defangs @everyone in card payload text"',
    'it("breaks javascript: in embedded URLs"',
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

export function analyzeOutboundMessageSafety(root = ROOT) {
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

  return { checkId: "outbound-message-safety", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOutboundMessageSafety();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
