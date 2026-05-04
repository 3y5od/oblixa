#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:poison-message-containment"];
const REQUIRED_CI_COMMANDS = ["npm run check:poison-message-containment"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:poison-message-containment"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/notification-delivery.ts": [
    'return { delivered: false, error: "delivery_locked_or_not_due", skipped: true };',
    'const validKinds: string[] = ["reminder_due", "saved_view_summary", "review_board_packet", "slack_workflow"];',
    'sendResult = { error: new Error("invalid_retry_payload_kind") };',
    ': { error: new Error("missing_retry_payload") };',
    'const terminal = isTerminalDeliveryError(sendResult.error.message);',
    'const isFinal = terminal || nextAttempt >= maxAttempts;',
    'status: isFinal ? "failed" : "retrying",',
    'return Math.max(1, Math.min(5, Math.trunc(raw)));',
  ],
  "src/lib/notification-delivery.test.ts": [
    'it("fails poison messages without retry payload when max attempts reached", async () => {',
    'expect(rows[0]?.last_error).toContain("missing_retry_payload");',
    'it("uses lock semantics so overlapping workers do not duplicate sends", async () => {',
    'it("clamps max attempts to 5 for repeated failures", async () => {',
    'it("short-circuits terminal errors without extra retries", async () => {',
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

export function analyzePoisonMessageContainment(root = ROOT) {
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

  return { checkId: "poison-message-containment", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePoisonMessageContainment();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
