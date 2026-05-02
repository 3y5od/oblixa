#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const strict = process.argv.includes("--strict");
const ciContext = {
  githubRunId: process.env.GITHUB_RUN_ID ?? "",
  githubSha: process.env.GITHUB_SHA ?? "",
  githubRef: process.env.GITHUB_REF ?? "",
};
const reports = [
  {
    script: "report-hardening-debt.mjs",
    required: true,
    requiredKeys: ["generatedAt", "skipCount", "skipProblemCount", "ownerMetadataIssues"],
    timeoutMs: 60000,
  },
  {
    script: "report-release-readiness.mjs",
    required: false,
    requiredKeys: ["generatedAt", "schemaVersion", "traceId", "ok", "checks", "nextActions"],
    timeoutMs: 1_800_000,
  },
  {
    script: "report-dependency-risk.mjs",
    required: true,
    requiredKeys: ["generatedAt", "ok", "summary"],
    timeoutMs: 60000,
  },
  {
    script: "report-policy-conformance-score.mjs",
    required: true,
    requiredKeys: ["generatedAt", "score", "status"],
    timeoutMs: 60000,
  },
  {
    script: "report-control-efficacy.mjs",
    required: true,
    requiredKeys: ["generatedAt", "efficacyScore", "controls", "weakestControls"],
    timeoutMs: 60000,
  },
];

const rows = [];
for (const report of reports) {
  const { script, requiredKeys, timeoutMs } = report;
  let ok = false;
  let keys = [];
  let error = "";
  let errorType = "";
  let missingRequiredKeys = [];
  try {
    const raw = execFileSync("node", [path.join(ROOT, "scripts", script)], {
      encoding: "utf8",
      timeout: timeoutMs,
    });
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      errorType = "parse";
      error =
        parseError instanceof Error ? parseError.message : "non_json_output";
    }
    if (errorType === "parse") {
      ok = false;
    } else {
    ok = typeof parsed === "object" && parsed !== null;
    keys = Object.keys(parsed || {});
    missingRequiredKeys = requiredKeys.filter((k) => !keys.includes(k));
    if (missingRequiredKeys.length > 0) {
      ok = false;
      errorType = "schema";
      error = `missing_required_keys:${missingRequiredKeys.join(",")}`;
    }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    if (error.includes("ETIMEDOUT")) errorType = "timeout";
    else errorType = "spawn";
  }
  rows.push({
    script,
    required: report.required !== false,
    timeoutMs,
    ok,
    keyCount: keys.length,
    keys,
    requiredKeys,
    missingRequiredKeys,
    errorType,
    error: error.slice(0, 300),
  });
}

const failed = rows.filter((r) => !r.ok);
const requiredFailed = rows.filter((r) => r.required && !r.ok);
console.log(
  JSON.stringify(
    {
      strict,
      ciContext,
      reportCount: rows.length,
      failedCount: failed.length,
      requiredFailedCount: requiredFailed.length,
      rows,
    },
    null,
    2
  )
);
if (requiredFailed.length > 0) process.exit(1);
// Require commit provenance only on real GitHub Actions runners. Local workflows
// often set CI=1 for Playwright/check batch parity; that must not imply GITHUB_SHA.
if (strict && process.env.GITHUB_ACTIONS === "true" && !ciContext.githubSha) process.exit(1);
