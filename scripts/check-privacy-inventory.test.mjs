import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzePrivacyInventory } from "./check-privacy-inventory.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-privacy-inventory-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:privacy-inventory": "node scripts/check-privacy-inventory.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:privacy-inventory\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:privacy-inventory"\n');
  write(root, "src/lib/security/privacy-inventory.ts", "PRIVACY_SAFE_RECORD_INVENTORY\nPRIVACY_INVENTORY_SCHEMA_VERSION\nbuildPrivacySafeUserExportPayload\nisLegalHoldProfile\nprivacyInventoryTables\nprivacyInventoryByKind\nprivacyInventoryClassificationIssues\nprivacyInventoryCoverageSummary\nlegal_hold_guarded\nsecurity_audit_events\nstorage_bucket\ntelemetry_event\nexport_surface\nprovider\nretentionClass\nredactionClass\naccessClass\ndeletionClass\n");
  write(root, "src/lib/security/privacy-inventory.test.ts", "lists tables, buckets, telemetry, exports, providers, and legal-hold behavior\nrequires retention, redaction, access, and deletion classifications for PII\nbuilds an export bundle without raw delete-only implementation state\nkeeps legal-hold detection centralized\n");
  write(root, "src/lib/security/dsar-fixtures.ts", "buildDsarExportFromFixture\ndsarExportTenantIsolationIssues\ncreateCanonicalDsarFixtureDataset\ncode_owned_fixture\nsanitizeV10AuditMetadata\n");
  write(root, "src/lib/security/dsar-fixtures.test.ts", "builds deterministic user exports with required records and no other tenants\nbuilds deterministic org exports with member records while excluding other orgs\ndetects cross-tenant rows in DSAR bundles\n");
  write(root, "src/lib/security/data-lifecycle.ts", "DATA_LIFECYCLE_CASCADE_PLANS\norganization_deletion\nuser_deletion\ntoken_revocation\nupload_deletion\nreport_deletion\nlegal_hold_exception\nplanLifecycleCascade\nlifecycleCascadePlanIssues\n");
  write(root, "src/lib/security/data-lifecycle.test.ts", "covers org deletion, user deletion, token revocation, uploads, reports, and legal hold\nblocks destructive user deletion when legal hold is active\nkeeps token revocation local and audit-first without legal-hold blocking\n");
  write(root, "src/app/api/me/export/route.ts", "buildPrivacySafeUserExportPayload\nisLegalHoldProfile(profile)\nsecurity.dsr_self_export_downloaded\n");
  write(root, "src/app/api/me/account/route.ts", "PRIVACY_SAFE_RECORD_INVENTORY\nisLegalHoldProfile(profile)\nsecurity.dsr_account_delete_requested\ninventory_count\n");
  write(root, "supabase/migrations/062_profile_legal_hold.sql", "legal_hold boolean not null default false\nidx_profiles_legal_hold_true\n");
  return root;
}

test("privacy inventory check accepts helper-backed export/delete hooks", () => {
  const root = fixtureRoot();
  assert.equal(analyzePrivacyInventory(root).ok, true);
});

test("privacy inventory check rejects export route without legal-hold helper", () => {
  const root = fixtureRoot();
  write(root, "src/app/api/me/export/route.ts", "buildPrivacySafeUserExportPayload\nsecurity.dsr_self_export_downloaded\n");
  const report = analyzePrivacyInventory(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_marker" && issue.rel === "src/app/api/me/export/route.ts"));
});
