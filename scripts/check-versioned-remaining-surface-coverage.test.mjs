import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedRemainingSurfaceCoverage,
  buildVersionedRemainingSurfaceCoverage,
} from "./check-versioned-remaining-surface-coverage.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-remaining-surface-coverage-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function contract(overrides = {}) {
  return {
    path: "src/lib/env.ts",
    surfaceClass: "environment_key",
    subSurfaceClass: "environment_key",
    contractName: "V10_RUNTIME_MODE",
    token: "v10",
    count: 1,
    owner: "platform-runtime",
    reason: "The legacy runtime-mode key is retained until deployed environments use the neutral key.",
    manualOnly: true,
    suggestedNeutralName: "RUNTIME_MODE",
    removalStrategy: "dual_read_then_manual_cutover",
    validationCommand: "npm run check:versioned-content-contracts",
    manualFollowUp: "Confirm deployed environments use RUNTIME_MODE before removing V10_RUNTIME_MODE.",
    ...overrides,
  };
}

function baseArtifacts(root, contracts, options = {}) {
  const legacySuiteScript = `check:${"v"}10-suite`;
  const queueRows = options.queueRows ?? [
    {
      legacyName: "V10_RUNTIME_MODE",
      neutralAlias: "RUNTIME_MODE",
      sourcePath: "src/lib/env.ts",
      surface: "environment_key",
      subSurface: "environment_key",
      status: "awaiting_production_cutover",
      validationCommand: "npm run check:versioned-content-contracts",
    },
  ];
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
    manualBoundaries: [
      "Provider dashboards, scheduled jobs, external analytics, and production SQL objects require manual cutover evidence.",
    ],
    queues: {
      packageScriptAliases: [
        {
          legacyName: legacySuiteScript,
          neutralAlias: "check:release-suite-current",
          status: "alias_added",
          readinessStatus: "blocked_by_external_references",
          readinessBlocker: `External workflows and docs still reference ${legacySuiteScript}.`,
          externalReferenceCount: 2,
          externalReferences: ["README.md", ".github/workflows/ci.yml"],
          validationCommand: "npm run check:compatibility-removal-queue",
        },
      ],
      contentContractAliases: queueRows,
    },
  });
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: options.allowlistEntries ?? [
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

test("buildVersionedRemainingSurfaceCoverage summarizes completion categories and package alias blockers", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()]);

  const coverage = buildVersionedRemainingSurfaceCoverage(root);

  assert.equal(coverage.issueCount, 0);
  assert.equal(coverage.totals.retainedLegacyCategoryCount, 1);
  assert.equal(coverage.packageScriptReadiness.aliasCount, 1);
  assert.equal(coverage.packageScriptReadiness.readyForRemovalCount, 0);
  assert.deepEqual(coverage.packageScriptReadiness.blockedAliases[0].externalReferences, [
    "README.md",
    ".github/workflows/ci.yml",
  ]);
  assert.ok(
    coverage.categories.some(
      (category) =>
        category.id === "deployment_runtime_config" &&
        category.coverageStatus === "coverage_proven" &&
        category.queueEntryCount === 1,
    ),
  );
});

test("analyzeVersionedRemainingSurfaceCoverage fails when a manual scanner row is not queued or allowlisted", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()], { queueRows: [] });
  writeJson(root, "artifacts/compatibility/versioned-remaining-surface-coverage.json", buildVersionedRemainingSurfaceCoverage(root));

  const report = analyzeVersionedRemainingSurfaceCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_content_surface_manual_contract_uncovered"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_remaining_surface_uncovered_manual_rows"));
});

test("analyzeVersionedRemainingSurfaceCoverage fails completed categories with pending safe actions", () => {
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
          subSurfaceClass: "environment_key",
          oldValue: "V10_RUNTIME_MODE",
          neutralValue: "RUNTIME_MODE",
        },
      ],
    },
  );
  writeJson(root, "artifacts/compatibility/versioned-remaining-surface-coverage.json", buildVersionedRemainingSurfaceCoverage(root));

  const report = analyzeVersionedRemainingSurfaceCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_remaining_surface_has_pending_safe_actions"));
});

test("analyzeVersionedRemainingSurfaceCoverage accepts the current deterministic artifact", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()]);
  writeJson(root, "artifacts/compatibility/versioned-remaining-surface-coverage.json", buildVersionedRemainingSurfaceCoverage(root));

  const report = analyzeVersionedRemainingSurfaceCoverage({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeVersionedRemainingSurfaceCoverage detects artifact drift", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()]);
  writeJson(root, "artifacts/compatibility/versioned-remaining-surface-coverage.json", { stale: true });

  const report = analyzeVersionedRemainingSurfaceCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_remaining_surface_coverage_drift"));
});
