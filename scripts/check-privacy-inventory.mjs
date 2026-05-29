#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_MARKERS = {
  "src/lib/security/privacy-inventory.ts": [
    "PRIVACY_SAFE_RECORD_INVENTORY",
    "PRIVACY_INVENTORY_SCHEMA_VERSION",
    "buildPrivacySafeUserExportPayload",
    "isLegalHoldProfile",
    "privacyInventoryTables",
    "privacyInventoryByKind",
    "privacyInventoryClassificationIssues",
    "privacyInventoryCoverageSummary",
    "legal_hold_guarded",
    "security_audit_events",
    "storage_bucket",
    "telemetry_event",
    "export_surface",
    "provider",
    "retentionClass",
    "redactionClass",
    "accessClass",
    "deletionClass",
  ],
  "src/lib/security/privacy-inventory.test.ts": [
    "lists tables, buckets, telemetry, exports, providers, and legal-hold behavior",
    "requires retention, redaction, access, and deletion classifications for PII",
    "builds an export bundle without raw delete-only implementation state",
    "keeps legal-hold detection centralized",
  ],
  "src/lib/security/dsar-fixtures.ts": [
    "buildDsarExportFromFixture",
    "dsarExportTenantIsolationIssues",
    "createCanonicalDsarFixtureDataset",
    "code_owned_fixture",
    "sanitizeV10AuditMetadata",
  ],
  "src/lib/security/dsar-fixtures.test.ts": [
    "builds deterministic user exports with required records and no other tenants",
    "builds deterministic org exports with member records while excluding other orgs",
    "detects cross-tenant rows in DSAR bundles",
  ],
  "src/lib/security/data-lifecycle.ts": [
    "DATA_LIFECYCLE_CASCADE_PLANS",
    "organization_deletion",
    "user_deletion",
    "token_revocation",
    "upload_deletion",
    "report_deletion",
    "legal_hold_exception",
    "planLifecycleCascade",
    "lifecycleCascadePlanIssues",
  ],
  "src/lib/security/data-lifecycle.test.ts": [
    "covers org deletion, user deletion, token revocation, uploads, reports, and legal hold",
    "blocks destructive user deletion when legal hold is active",
    "keeps token revocation local and audit-first without legal-hold blocking",
  ],
  "src/app/api/me/export/route.ts": [
    "buildPrivacySafeUserExportPayload",
    "isLegalHoldProfile(profile)",
    "security.dsr_self_export_downloaded",
  ],
  "src/app/api/me/account/route.ts": [
    "PRIVACY_SAFE_RECORD_INVENTORY",
    "isLegalHoldProfile(profile)",
    "security.dsr_account_delete_requested",
    "inventory_count",
  ],
  "supabase/migrations/062_profile_legal_hold.sql": [
    "legal_hold boolean not null default false",
    "idx_profiles_legal_hold_true",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzePrivacyInventory(root = ROOT) {
  const issues = [];
  const pkg = JSON.parse(read(root, "package.json"));
  if (!pkg.scripts?.["check:privacy-inventory"]) {
    issues.push({ issue: "missing_package_script", script: "check:privacy-inventory" });
  }
  const ci = read(root, ".github/workflows/ci.yml");
  if (!ci.includes("npm run check:privacy-inventory")) {
    issues.push({ issue: "missing_ci_reference", cmd: "npm run check:privacy-inventory" });
  }
  const pipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  if (!pipeline.includes('"check:privacy-inventory"')) {
    issues.push({ issue: "missing_security_pipeline_step", step: "check:privacy-inventory" });
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
    checkId: "privacy-inventory",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePrivacyInventory();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
