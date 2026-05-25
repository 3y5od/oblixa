#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_MARKERS = {
  "src/lib/rate-limit.ts": [
    "export const RATE_LIMIT_KEY_MAX_LENGTH",
    "export function normalizeRateLimitKey",
    'createHash("sha256")',
    "const normalizedKey = normalizeRateLimitKey(key)",
    "upstash.limit(normalizedKey)",
    "return rateLimitTake(normalizedKey, config)",
  ],
  "src/lib/product-surface/api-workspace-guard.ts": [
    "rateLimitCheck(`workspace-api:${input.orgId}:${input.apiPath}`",
    "RATE_LIMITS.workspaceApi",
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    "rateLimitCheck(`external-submit:token-hash:${tokenKey}`",
  ],
  "src/app/api/external-actions/[token]/status/route.ts": [
    "rateLimitCheck(`external-status:token-hash:${tokenKey}`",
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts": [
    "rateLimitCheck(\n    `external-participant-workflow:token-hash:${tokenKey}`",
  ],
  "src/app/api/stripe/webhook/route.ts": [
    "rateLimitCheck(",
    'stripe-webhook:account:${event.account ?? "platform"}:${event.type}',
  ],
  "src/lib/assurance/cron-route-runner.ts": [
    'rateLimitKey: options.rateLimitKey ?? `cron:v6:${options.route.split("/").pop() ?? "job"}`',
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else if (name === "route.ts") acc.push(abs);
  }
  return acc;
}

function analyzeCronRateLimitKeys(root, issues) {
  const cronRoot = path.join(root, "src", "app", "api", "cron");
  for (const abs of walk(cronRoot).sort()) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const source = fs.readFileSync(abs, "utf8");
    const isCronRunner = /\bwithCronRoute\s*\(|\brunCronRoute\s*\(|route:\s*["']\/api\/cron\//.test(source);
    if (!isCronRunner) continue;
    if (/\bwithV6CronRoute\s*\(/.test(source)) continue;
    if (!/\brateLimitKey\s*:/.test(source)) {
      issues.push({ issue: "cron_route_missing_rate_limit_key", rel });
      continue;
    }
    if (!/\brateLimitKey[\s\S]*cron:/.test(source)) {
      issues.push({ issue: "cron_route_rate_limit_key_not_route_specific", rel });
    }
  }
}

export function analyzeRateLimitKeyCardinality(root = ROOT) {
  const issues = [];

  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!fileExists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) {
        issues.push({ issue: "missing_rate_limit_key_marker", rel, marker });
      }
    }
  }

  analyzeCronRateLimitKeys(root, issues);

  return {
    checkId: "rate-limit-key-cardinality",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRateLimitKeyCardinality();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
