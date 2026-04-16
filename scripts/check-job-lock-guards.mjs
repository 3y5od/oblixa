#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const scheduledPaths = (Array.isArray(vercel.crons) ? vercel.crons : []).map((row) => row.path);

const issues = [];
for (const route of scheduledPaths) {
  const rel = route.replace(/^\//, "");
  const abs = path.join(root, "src/app", rel, "route.ts");
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, "utf8");
  const hasLimiter = /rateLimitCheck\(/.test(text);
  const hasAuth = /authorizeCronRequest|requireV[56]CronAuth|ensureCronAuthorized/.test(text);
  if (!hasLimiter) {
    issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_rate_limit_guard" });
  }
  if (!hasAuth) {
    issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_cron_auth_guard" });
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
