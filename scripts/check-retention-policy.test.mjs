import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeRetentionPolicy } from "./check-retention-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-retention-policy-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:retention-policy": "node scripts/check-retention-policy.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:retention-policy\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:retention-policy"\n');
  write(
    root,
    "src/lib/security/retention-policy.ts",
    [
      "CODE_OWNED_RETENTION_POLICIES",
      "cleanup_code_owned_transient_data",
      "retentionPolicyByDataClass",
      "retentionPolicyTables",
      "import_raw_payloads",
      "extraction_artifacts",
      "report_tracking",
      "expired_public_tokens",
      "calendar_feed_tokens",
      "oauth_callback_state",
      "stale_audit_adjacent_payloads",
    ].join("\n")
  );
  write(root, "src/lib/security/retention-policy.test.ts", "maps every requested transient data class to cleanup metadata\nexposes stable lookup helpers\n");
  write(
    root,
    "supabase/migrations/080_code_owned_transient_retention_cleanup.sql",
    "retention_expires_at\ncleanup_code_owned_transient_data\nsecurity definer\ncontract_import_job_rows\ncontract_extraction_jobs\nreport_run_recipients\nexternal_action_links\ncalendar_feeds\nintegration_oauth_states\nexternal_action_events\nrevoke all on function public.cleanup_code_owned_transient_data\ngrant execute on function public.cleanup_code_owned_transient_data\n"
  );
  write(root, "src/app/api/cron/security/retention-cleanup/route.ts", "withCronRoute\ncleanup_code_owned_transient_data\nCODE_OWNED_RETENTION_POLICIES\nsecurity_retention_cleanup_failed\n");
  write(root, "src/app/api/cron/security/retention-cleanup/route.test.ts", "runs the code-owned transient cleanup RPC through the shared cron wrapper\nfails closed when retention cleanup cannot run\n");
  write(root, "vercel.json", "/api/cron/security/retention-cleanup\n");
  write(root, "scripts/cron-route-expected-keys.mjs", "/api/cron/security/retention-cleanup\ncleanup_counts\n");
  write(root, "src/lib/import-jobs.ts", "minimizeImportRawPayload\nraw_payload_minimized\nttl_expires_at\npayload_hash_sha256\nretry_normalized_fields\n");
  write(root, "src/lib/import-jobs.test.ts", "stores retry-safe minimized import payloads with TTL metadata\nraw_payload_minimized\n");
  return root;
}

test("retention policy check requires metadata, cleanup job, migration, and import minimization", () => {
  const root = fixtureRoot();
  assert.equal(analyzeRetentionPolicy(root).ok, true);
});

test("retention policy check fails when scheduled cleanup route is missing", () => {
  const root = fixtureRoot();
  fs.rmSync(path.join(root, "src/app/api/cron/security/retention-cleanup/route.ts"));
  const report = analyzeRetentionPolicy(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_required_file"));
});
