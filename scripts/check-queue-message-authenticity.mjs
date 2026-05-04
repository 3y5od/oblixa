#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:queue-message-authenticity"];
const REQUIRED_CI_COMMANDS = ["npm run check:queue-message-authenticity"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:queue-message-authenticity"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/webhooks/dispatch/route.ts": [
    '{ name: "HMAC", hash: "SHA-256" },',
    'const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));',
    '{ onConflict: "outbound_event_id,subscription_id", ignoreDuplicates: true }',
    'signingSecret = decryptIntegrationToken(sub.secret) ?? sub.secret;',
    'const reencrypted = encryptIntegrationToken(signingSecret);',
    '"x-oblixa-signature": signature,',
  ],
  "src/app/api/webhooks/dispatch/route.test.ts": [
    'it("signs webhook deliveries with HMAC and dedupes delivery rows", async () => {',
    'expect(headers["x-oblixa-signature"]).toBe(expectedSignature);',
    'expect(deliverySeedUpsert).toHaveBeenCalledWith(',
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

export function analyzeQueueMessageAuthenticity(root = ROOT) {
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

  return { checkId: "queue-message-authenticity", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeQueueMessageAuthenticity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
