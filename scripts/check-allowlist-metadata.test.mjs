import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAllowlistMetadata } from "./check-allowlist-metadata.mjs";

function write(root, rel, content = "") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-allowlist-metadata-"));
  try {
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const FUTURE_NOW = new Date("2026-05-10T00:00:00.000Z");

test("analyzeAllowlistMetadata accepts text and JSON entries with inherited metadata", () => {
  const report = withFixture(
    {
      "scripts/local-allowlist.txt": [
        "# meta: owner=@security reviewedOn=2026-05-10 expiry=2027-12-31 reason=fixture_reviewed_exception compensatingTest=scripts/local-proof.test.mjs",
        "src/example.ts",
      ].join("\n"),
      "scripts/local-proof.test.mjs": "test('proof', () => {});\n",
      "artifacts/license-allowlist.json": JSON.stringify(
        {
          metadata: {
            owner: "supply-chain",
            reviewedOn: "2026-05-10",
            reason: "reviewed license families",
            expiresOn: "2027-12-31",
            compensatingTest: "scripts/local-proof.test.mjs",
          },
          families: ["MIT"],
        },
        null,
        2
      ),
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.entryCount, 2);
  assert.equal(report.metadataIssueCount, 0);
});

test("analyzeAllowlistMetadata rejects entries without metadata", () => {
  const report = withFixture(
    {
      "scripts/security-static-audit-allowlist.txt": "src/example.ts\n",
      "src/example.ts": "export const value = 1;\n",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_allowlist_metadata"));
});

test("analyzeAllowlistMetadata rejects expired entries and missing compensating tests", () => {
  const report = withFixture(
    {
      "scripts/outbound-fetch-allowlist.txt": [
        "# meta: owner=@security reviewedOn=2026-05-10 expiry=2020-01-01 reason=legacy_fetch_exception compensatingTest=scripts/missing.test.mjs",
        "actions/demo.ts",
      ].join("\n"),
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "expired_allowlist_entry"));
  assert(report.issues.some((issue) => issue.issue === "missing_allowlist_compensating_test_file"));
});

test("analyzeAllowlistMetadata reports stale API route test allowlist entries", () => {
  const report = withFixture(
    {
      "scripts/api-route-test-allowlist.txt": [
        "# meta: owner=@api reviewedOn=2026-05-10 expiry=2027-12-31 reason=bundled_route_coverage bundleProofTest=app/api/demo/route-bundle.test.ts",
        "demo/route.ts",
      ].join("\n"),
      "src/app/api/demo/route.ts": "export async function GET() {}\n",
      "src/app/api/demo/route.test.ts": "it('covers route', () => {});\n",
      "src/app/api/demo/route-bundle.test.ts": "it('covers bundled route', () => {});\n",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(
    report.issues.some((issue) => issue.issue === "stale_allowlist_entry_has_colocated_route_test")
  );
});

test("analyzeAllowlistMetadata reports stale QA tier allowlist scripts", () => {
  const report = withFixture(
    {
      "package.json": JSON.stringify({ scripts: { "check:kept": "node kept.mjs" } }),
      "scripts/check-tier-coverage.mjs": "",
      "config/qa-tier-coverage-allowlist.json": JSON.stringify(
        {
          metadata: {
            owner: "qa-platform",
            reviewedOn: "2026-05-10",
            reason: "batch coverage fixture",
            expiresOn: "2027-12-31",
            compensatingTest: "scripts/check-tier-coverage.mjs",
          },
          scripts: ["check:missing"],
        },
        null,
        2
      ),
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "stale_allowlist_entry_missing_package_script"));
});

test("analyzeAllowlistMetadata rejects entries without review date", () => {
  const report = withFixture(
    {
      "scripts/local-allowlist.txt": [
        "# meta: owner=@security expiry=2027-12-31 reason=fixture_reviewed_exception compensatingTest=scripts/local-proof.test.mjs",
        "src/example.ts",
      ].join("\n"),
      "scripts/local-proof.test.mjs": "test('proof', () => {});\n",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "invalid_allowlist_review_date"));
});

test("analyzeAllowlistMetadata accepts explicit revisit trigger instead of expiry", () => {
  const report = withFixture(
    {
      "scripts/local-allowlist.txt": [
        "# meta: owner=@security reviewedOn=2026-05-10 revisitTrigger=remove_when_provider_fixture_is_replaced reason=fixture_reviewed_exception compensatingTest=scripts/local-proof.test.mjs",
        "src/example.ts",
      ].join("\n"),
      "scripts/local-proof.test.mjs": "test('proof', () => {});\n",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeAllowlistMetadata requires explicit control rationale for broad patterns", () => {
  const report = withFixture(
    {
      "artifacts/assurance/gitleaks-allowlist-inventory.json": JSON.stringify(
        {
          allowlists: [
            {
              metadata: {
                owner: "security",
                reviewedOn: "2026-05-10",
                reason: "reviewed false positive paths",
                expiresOn: "2027-12-31",
                compensatingTest: "scripts/check-gitleaks-allowlist.mjs",
              },
              paths: [".*\\.test\\.ts$"],
            },
          ],
        },
        null,
        2
      ),
      "scripts/check-gitleaks-allowlist.mjs": "",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(
    report.issues.some(
      (issue) => issue.issue === "broad_allowlist_pattern_without_explicit_approval"
    )
  );
  assert(
    report.issues.some((issue) => issue.issue === "broad_allowlist_pattern_without_control_rationale")
  );
});

test("analyzeAllowlistMetadata accepts broad patterns with explicit approval and rationale", () => {
  const report = withFixture(
    {
      "artifacts/assurance/gitleaks-allowlist-inventory.json": JSON.stringify(
        {
          allowlists: [
            {
              metadata: {
                owner: "security",
                reviewedOn: "2026-05-10",
                reason: "reviewed false positive paths",
                expiresOn: "2027-12-31",
                compensatingTest: "scripts/check-gitleaks-allowlist.mjs",
                allowBroadPattern: true,
                controlRationale: "Anchored false-positive test paths are mirrored from the Gitleaks config.",
              },
              paths: [".*\\.test\\.ts$"],
            },
          ],
        },
        null,
        2
      ),
      "scripts/check-gitleaks-allowlist.mjs": "",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeAllowlistMetadata rejects broad P0 allowlist entries", () => {
  const report = withFixture(
    {
      "scripts/api-route-public-allowlist.txt": [
        "# meta: owner=@security reviewedOn=2026-05-10 expiry=2027-12-31 reason=explicit_public_route_review compensatingTest=scripts/check-api-route-auth-contract.mjs allowBroadPattern=true controlRationale=public_route_auth_contract_reviewed",
        "admin/*/route.ts",
      ].join("\n"),
      "scripts/check-api-route-auth-contract.mjs": "",
    },
    (root) => analyzeAllowlistMetadata(root, { now: FUTURE_NOW })
  );

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "p0_allowlist_entry_must_be_path_specific"));
});
