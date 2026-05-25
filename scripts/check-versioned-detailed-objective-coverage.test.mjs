import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedDetailedObjectiveCoverage,
  buildVersionedDetailedObjectiveCoverage,
} from "./check-versioned-detailed-objective-coverage.mjs";
import { analyzeVersionedPublicContractPreservation } from "./check-versioned-public-contract-preservation.mjs";
import { analyzeVersionedSourceConfigPreservation } from "./check-versioned-source-config-preservation.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-detailed-objective-coverage-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function contract(overrides = {}) {
  return {
    path: "public/manifest.json",
    surfaceClass: "public_contract",
    subSurfaceClass: "public_metadata_or_asset",
    contractName: "v10-install",
    token: "v10",
    count: 1,
    sampleLines: [1],
    evidenceHashes: ["abc123"],
    owner: "frontend-platform",
    reason: "Public install metadata needs compatibility metadata before legacy values are removed.",
    manualOnly: true,
    suggestedNeutralName: "install",
    removalStrategy: "compatibility_alias_then_manual_cutover",
    validationCommand: "npm run check:versioned-public-contract-preservation",
    manualFollowUp: "Keep the public compatibility value until installed-app and crawler caches have aged out.",
    ...overrides,
  };
}

function baseArtifacts(root, contracts, options = {}) {
  const legacySuiteScript = `check:${"v"}10-suite`;
  writeJson(root, "artifacts/compatibility/versioned-content-contract-inventory.json", {
    schemaVersion: 2,
    generatedBy: "test",
    contractCount: contracts.length,
    hitCount: contracts.reduce((sum, row) => sum + (row.count ?? 0), 0),
    manualOnlyContractCount: contracts.filter((row) => row.manualOnly).length,
    bySurface: {},
    bySubSurface: {},
    contracts,
  });
  writeJson(root, "artifacts/compatibility/removal-queue.json", {
    schemaVersion: 1,
    generatedBy: "test",
    manualBoundaries: ["Production-facing names require manual cutover evidence."],
    queues: {
      packageScriptAliases: [
        {
          surface: "package_script",
          legacyName: legacySuiteScript,
          neutralAlias: "check:release-suite-current",
          status: "alias_added",
          readinessStatus: "blocked_by_external_references",
          readinessBlocker: `External workflow still references ${legacySuiteScript}.`,
          externalReferenceCount: 1,
          externalReferences: [".github/workflows/ci.yml"],
          validationCommand: "npm run check:compatibility-removal-queue",
        },
      ],
      contentContractAliases: options.queueRows ?? [
        {
          legacyName: "v10-install",
          neutralAlias: "install",
          sourcePath: "public/manifest.json",
          surface: "public_metadata_or_asset",
          subSurface: "public_metadata_or_asset",
          status: "awaiting_production_cutover",
          validationCommand: "npm run check:versioned-public-contract-preservation",
        },
      ],
    },
  });
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: [
      {
        id: "schema-version-fields",
        owner: "platform-hardening",
        reason: "schemaVersion is generated artifact metadata.",
        reviewedOn: "2026-05-23",
        pattern: "\\bschemaVersion\\b",
        examples: ["schemaVersion"],
        surface: "schema_metadata",
        validationCommand: "npm run check:version-reference-allowlist",
      },
    ],
  });
  writeJson(root, "artifacts/compatibility/versioned-local-content-rewrite-manifest.json", {
    schemaVersion: 1,
    pendingRewriteCount: options.rewrites?.length ?? 0,
    rewrites: options.rewrites ?? [],
    refusals: [],
  });
}

test("buildVersionedDetailedObjectiveCoverage summarizes detailed objectives and package blockers", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()]);

  const coverage = buildVersionedDetailedObjectiveCoverage(root);

  assert.equal(coverage.issueCount, 0);
  assert.equal(coverage.totals.retainedLegacyObjectiveCount, 1);
  assert.ok(coverage.objectives.some((row) => row.id === "public_metadata_pwa_well_known" && row.coverageStatus === "coverage_proven"));
  assert.equal(coverage.packageScriptReadiness.aliasCount, 1);
  assert.equal(coverage.packageScriptReadiness.readyForRemovalCount, 0);
});

test("analyzeVersionedDetailedObjectiveCoverage fails when manual detailed rows are uncovered", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()], { queueRows: [] });
  writeJson(root, "artifacts/compatibility/versioned-detailed-objective-coverage.json", buildVersionedDetailedObjectiveCoverage(root));

  const report = analyzeVersionedDetailedObjectiveCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_content_surface_manual_contract_uncovered"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_detailed_objective_uncovered_manual_rows"));
});

test("analyzeVersionedDetailedObjectiveCoverage detects deterministic artifact drift", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()]);
  writeJson(root, "artifacts/compatibility/versioned-detailed-objective-coverage.json", { stale: true });

  const report = analyzeVersionedDetailedObjectiveCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_detailed_objective_coverage_drift"));
});

test("public and source-config preservation checks accept covered current rows", () => {
  const root = makeRoot();
  baseArtifacts(root, [
    contract(),
    contract({
      path: "scripts/security-static-audit-allowlist.txt",
      surfaceClass: "source_content",
      subSurfaceClass: "source_owned_config_or_scanner_id",
      contractName: "v10-rule",
      suggestedNeutralName: "release-rule",
      validationCommand: "npm run check:versioned-source-config-preservation",
    }),
  ], {
    queueRows: [
      {
        legacyName: "v10-install",
        neutralAlias: "install",
        sourcePath: "public/manifest.json",
        surface: "public_metadata_or_asset",
        subSurface: "public_metadata_or_asset",
        status: "awaiting_production_cutover",
        validationCommand: "npm run check:versioned-public-contract-preservation",
      },
      {
        legacyName: "v10-rule",
        neutralAlias: "release-rule",
        sourcePath: "scripts/security-static-audit-allowlist.txt",
        surface: "source_owned_config_or_scanner_id",
        subSurface: "source_owned_config_or_scanner_id",
        status: "awaiting_production_cutover",
        validationCommand: "npm run check:versioned-source-config-preservation",
      },
    ],
  });

  assert.equal(analyzeVersionedPublicContractPreservation({ root }).ok, true);
  assert.equal(analyzeVersionedSourceConfigPreservation({ root }).ok, true);
});

test("public preservation check fails pending safe public rewrites", () => {
  const root = makeRoot();
  baseArtifacts(
    root,
    [
      contract({
        manualOnly: false,
        removalStrategy: "local_manifest_rewrite",
      }),
    ],
    {
      rewrites: [
        {
          subSurfaceClass: "public_metadata_or_asset",
          oldValue: "v10-install",
          neutralValue: "install",
        },
      ],
    },
  );

  const report = analyzeVersionedPublicContractPreservation({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_public_contract_pending_safe_actions"));
});
