#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const WRAPPER_HELPERS = ["withCronRoute", "withV6CronRoute", "runCronRoute"];

function hasHelperImport(text, helper) {
  return new RegExp(`\\b${helper}\\b`).test(text) && /from\s+["'][^"']+["']/.test(text);
}

function hasHelperCall(text, helper) {
  return new RegExp(`\\b${helper}\\s*\\(`).test(text);
}

function usesSharedCronWrapper(text) {
  return WRAPPER_HELPERS.some((helper) => hasHelperImport(text, helper) && hasHelperCall(text, helper));
}

export function analyzeJobLockGuards(root = process.cwd()) {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const scheduledPaths = (Array.isArray(vercel.crons) ? vercel.crons : []).map((row) => row.path);

  const issues = [];
  for (const route of scheduledPaths) {
    const rel = route.replace(/^\//, "");
    const abs = path.join(root, "src/app", rel, "route.ts");
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    const sharedWrapper = usesSharedCronWrapper(text);
    const hasLimiter = sharedWrapper || /rateLimitCheck\(/.test(text);
    const hasAuth =
      sharedWrapper || /authorizeCronRequest|requireCronAuthorized|requireV[56]CronAuth|ensureCronAuthorized/.test(text);
    if (!hasLimiter) {
      issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_rate_limit_guard" });
    }
    if (!hasAuth) {
      issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_cron_auth_guard" });
    }
  }

  return { issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeJobLockGuards();
  console.log(JSON.stringify(report, null, 2));
  if (report.issueCount > 0) process.exit(1);
}
