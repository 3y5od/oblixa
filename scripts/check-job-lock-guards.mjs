#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const WRAPPER_HELPERS = ["withCronRoute", "withV6CronRoute", "runCronRoute"];
const SHARED_RUNNER_PATH = "src/lib/cron/route-runner.ts";
const SINGLE_FLIGHT_LOCK_PATH = "src/lib/cron/single-flight-lock.ts";

const SHARED_RUNNER_REQUIREMENTS = [
  {
    issue: "shared_cron_runner_missing_single_flight_acquire",
    pattern: /\bacquireCronSingleFlightLock\b/,
  },
  {
    issue: "shared_cron_runner_missing_single_flight_release",
    pattern: /\breleaseCronSingleFlightLock\b/,
  },
  {
    issue: "shared_cron_runner_missing_single_flight_key_option",
    pattern: /\bsingleFlightKey\b/,
  },
  {
    issue: "shared_cron_runner_missing_single_flight_ttl_option",
    pattern: /\bsingleFlightTtlMs\b/,
  },
  {
    issue: "shared_cron_runner_missing_job_already_running_diagnostic",
    pattern: /cron_job_already_running/,
  },
  {
    issue: "shared_cron_runner_missing_lock_release_finally",
    pattern: /finally\s*\{[\s\S]*releaseCronSingleFlightLock/,
  },
];

const SINGLE_FLIGHT_LOCK_REQUIREMENTS = [
  {
    issue: "cron_single_flight_helper_missing_upstash_backend",
    pattern: /\bRedis\.fromEnv\s*\(/,
  },
  {
    issue: "cron_single_flight_helper_missing_redis_set_nx_px",
    pattern: /\.set\s*\([\s\S]*nx:\s*true[\s\S]*px:/,
  },
  {
    issue: "cron_single_flight_helper_missing_owner_checked_release",
    pattern: /redis\.call\('get', KEYS\[1\]\) == ARGV\[1\][\s\S]*redis\.call\('del', KEYS\[1\]\)/,
  },
  {
    issue: "cron_single_flight_helper_missing_memory_fallback",
    pattern: /\bmemoryLocks\b/,
  },
];

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
  const sharedRunnerAbs = path.join(root, SHARED_RUNNER_PATH);
  if (!fs.existsSync(sharedRunnerAbs)) {
    issues.push({ file: SHARED_RUNNER_PATH, issue: "shared_cron_runner_missing" });
  } else {
    const text = fs.readFileSync(sharedRunnerAbs, "utf8");
    for (const requirement of SHARED_RUNNER_REQUIREMENTS) {
      if (!requirement.pattern.test(text)) {
        issues.push({ file: SHARED_RUNNER_PATH, issue: requirement.issue });
      }
    }
  }

  const lockHelperAbs = path.join(root, SINGLE_FLIGHT_LOCK_PATH);
  if (!fs.existsSync(lockHelperAbs)) {
    issues.push({ file: SINGLE_FLIGHT_LOCK_PATH, issue: "cron_single_flight_helper_missing" });
  } else {
    const text = fs.readFileSync(lockHelperAbs, "utf8");
    for (const requirement of SINGLE_FLIGHT_LOCK_REQUIREMENTS) {
      if (!requirement.pattern.test(text)) {
        issues.push({ file: SINGLE_FLIGHT_LOCK_PATH, issue: requirement.issue });
      }
    }
  }

  for (const route of scheduledPaths) {
    const rel = route.replace(/^\//, "");
    const abs = path.join(root, "src/app", rel, "route.ts");
    if (!fs.existsSync(abs)) {
      issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_file_missing" });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const sharedWrapper = usesSharedCronWrapper(text);
    const hasLimiter = sharedWrapper || /rateLimitCheck\(/.test(text);
    const hasAuth =
      sharedWrapper || /authorizeCronRequest|requireCronAuthorized|requireV[56]CronAuth|ensureCronAuthorized/.test(text);
    const hasSingleFlight = sharedWrapper || /\bacquireCronSingleFlightLock\b/.test(text);
    const disablesSharedSingleFlight = /\bsingleFlightKey\s*:\s*false\b/.test(text);
    if (!hasLimiter) {
      issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_rate_limit_guard" });
    }
    if (!hasAuth) {
      issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_cron_auth_guard" });
    }
    if (!hasSingleFlight || disablesSharedSingleFlight) {
      issues.push({ file: `src/app/${rel}/route.ts`, issue: "scheduled_route_missing_single_flight_guard" });
    }
  }

  return { issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeJobLockGuards();
  console.log(JSON.stringify(report, null, 2));
  if (report.issueCount > 0) process.exit(1);
}
