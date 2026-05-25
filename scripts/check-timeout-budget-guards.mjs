#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  fileExists,
  issueReport,
  readText,
  walkFiles,
} from "./lib/static-check-utils.mjs";
import { readEffectiveRouteSource } from "./lib/build-route-universe.mjs";

const SAFE_FETCH = "src/lib/security/safe-fetch.ts";
const RETRY_HELPER = "src/lib/extraction/retry.ts";
const ROUTE_MAX_DURATION_LIMIT_SECONDS = 300;

const EXPENSIVE_ROUTE_PATH_RE =
  /^src\/app\/api\/(?:(?:cron|extract|import|integrations|reminders|notifications|tasks\/run-rules|webhooks\/dispatch|contracts\/recompute-signals|reports\/(?:send-summaries|capture-metrics))\/|campaigns\/\[id\]\/export\/route\.ts|export\/review-packet\/route\.ts)/;

const EXPENSIVE_ROUTE_SOURCE_RE =
  /\b(?:runExtractionPipeline|fetchWithRetry|safeFetch|forEachSupabaseRangePage|collectSupabaseRangePages|executeBatch|mapWithConcurrency)\b/;

function collectRouteFiles(root) {
  return walkFiles(root, ["src/app/api"], {
    include(rel, name) {
      return name === "route.ts";
    },
  });
}

function maxDurationValue(source) {
  const match = source.match(/export\s+const\s+maxDuration\s*=\s*(\d[\d_]*)\s*;/);
  return match ? Number(match[1].replace(/_/g, "")) : null;
}

function assertMarkers(issues, root, file, markers) {
  if (!fileExists(root, file)) {
    issues.push({ issue: "missing_timeout_budget_helper", file });
    return;
  }
  const source = readText(root, file);
  for (const [issue, marker] of markers) {
    if (!source.includes(marker)) issues.push({ issue, file });
  }
}

export function analyzeTimeoutBudgetGuards(root = process.cwd()) {
  const issues = [];

  assertMarkers(issues, root, SAFE_FETCH, [
    ["safe_fetch_missing_default_timeout", "SAFE_FETCH_DEFAULT_TIMEOUT_MS"],
    ["safe_fetch_missing_max_timeout", "SAFE_FETCH_MAX_TIMEOUT_MS"],
    ["safe_fetch_missing_timeout_option", "timeoutMs?: number"],
    ["safe_fetch_missing_timeout_normalizer", "normalizeSafeFetchTimeoutMs"],
    ["safe_fetch_missing_abort_controller", "new AbortController()"],
    ["safe_fetch_missing_abort_timer", "setTimeout("],
    ["safe_fetch_missing_timer_cleanup", "clearTimeout("],
  ]);

  assertMarkers(issues, root, RETRY_HELPER, [
    ["retry_missing_timeout_option", "timeoutMs?: number"],
    ["retry_missing_default_timeout", "RETRY_DEFAULT_ATTEMPT_TIMEOUT_MS"],
    ["retry_missing_max_timeout", "RETRY_MAX_ATTEMPT_TIMEOUT_MS"],
    ["retry_missing_timeout_normalizer", "normalizeAttemptTimeoutMs"],
    ["retry_missing_attempt_timeout_wrapper", "withAttemptTimeout"],
    ["retry_missing_abort_controller", "new AbortController()"],
    ["retry_missing_abort_timer", "setTimeout("],
    ["retry_missing_timer_cleanup", "clearTimeout("],
    ["retry_fetch_missing_signal_merge", "combineAbortSignals"],
  ]);

  const routeFiles = collectRouteFiles(root);
  for (const file of routeFiles) {
    const source = readEffectiveRouteSource(path.join(root, file));
    const requiresBudget = EXPENSIVE_ROUTE_PATH_RE.test(file) || EXPENSIVE_ROUTE_SOURCE_RE.test(source);
    if (!requiresBudget) continue;
    const value = maxDurationValue(source);
    if (value === null) {
      issues.push({ issue: "missing_route_max_duration", file });
      continue;
    }
    if (value < 1 || value > ROUTE_MAX_DURATION_LIMIT_SECONDS) {
      issues.push({
        issue: "route_max_duration_out_of_policy",
        file,
        value,
        maxAllowedSeconds: ROUTE_MAX_DURATION_LIMIT_SECONDS,
      });
    }
  }

  return issueReport("timeout-budget-guards", issues, { routeFilesChecked: routeFiles.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTimeoutBudgetGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
