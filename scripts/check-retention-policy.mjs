#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_DATA_CLASSES = [
  "import_raw_payloads",
  "extraction_artifacts",
  "report_tracking",
  "expired_public_tokens",
  "calendar_feed_tokens",
  "oauth_callback_state",
  "stale_audit_adjacent_payloads",
];

const REQUIRED_MARKERS = {
  "src/lib/security/retention-policy.ts": [
    "CODE_OWNED_RETENTION_POLICIES",
    "cleanup_code_owned_transient_data",
    "retentionPolicyByDataClass",
    "retentionPolicyTables",
    ...REQUIRED_DATA_CLASSES,
  ],
  "src/lib/security/retention-policy.test.ts": [
    "maps every requested transient data class to cleanup metadata",
    "exposes stable lookup helpers",
  ],
  "supabase/migrations/080_code_owned_transient_retention_cleanup.sql": [
    "retention_expires_at",
    "cleanup_code_owned_transient_data",
    "security definer",
    "contract_import_job_rows",
    "contract_extraction_jobs",
    "report_run_recipients",
    "external_action_links",
    "calendar_feeds",
    "integration_oauth_states",
    "external_action_events",
    "revoke all on function public.cleanup_code_owned_transient_data",
    "grant execute on function public.cleanup_code_owned_transient_data",
  ],
  "src/app/api/cron/security/retention-cleanup/route.ts": [
    "withCronRoute",
    "cleanup_code_owned_transient_data",
    "CODE_OWNED_RETENTION_POLICIES",
    "security_retention_cleanup_failed",
  ],
  "src/app/api/cron/security/retention-cleanup/route.test.ts": [
    "runs the code-owned transient cleanup RPC through the shared cron wrapper",
    "fails closed when retention cleanup cannot run",
  ],
  "vercel.json": ["/api/cron/security/retention-cleanup"],
  "scripts/cron-route-expected-keys.mjs": ["/api/cron/security/retention-cleanup", "cleanup_counts"],
  "src/lib/import-jobs.ts": [
    "minimizeImportRawPayload",
    "raw_payload_minimized",
    "ttl_expires_at",
    "payload_hash_sha256",
    "retry_normalized_fields",
  ],
  "src/lib/import-jobs.test.ts": [
    "stores retry-safe minimized import payloads with TTL metadata",
    "raw_payload_minimized",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzeRetentionPolicy(root = ROOT) {
  const issues = [];
  const pkg = JSON.parse(read(root, "package.json"));
  if (!pkg.scripts?.["check:retention-policy"]) {
    issues.push({ issue: "missing_package_script", script: "check:retention-policy" });
  }
  const ci = read(root, ".github/workflows/ci.yml");
  if (!ci.includes("npm run check:retention-policy")) {
    issues.push({ issue: "missing_ci_reference", cmd: "npm run check:retention-policy" });
  }
  const pipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  if (!pipeline.includes('"check:retention-policy"')) {
    issues.push({ issue: "missing_security_pipeline_step", step: "check:retention-policy" });
  }

  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return {
    checkId: "retention-policy",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRetentionPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
