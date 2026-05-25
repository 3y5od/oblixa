import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedContentSurfaceCoverage,
  buildVersionedContentSurfaceCoverage,
} from "./check-versioned-content-surface-coverage.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-content-surface-coverage-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function baseArtifacts(root, contracts, queueRows = [], allowlistEntries = []) {
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
    queues: {
      packageScriptAliases: [
        {
          legacyName: legacySuiteScript,
          neutralAlias: "check:release-suite-current",
          status: "alias_added",
          externalReferenceCount: 2,
        },
      ],
      contentContractAliases: queueRows,
    },
  });
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: allowlistEntries,
  });
  writeJson(root, "artifacts/compatibility/versioned-local-content-rewrite-manifest.json", {
    schemaVersion: 1,
    pendingRewriteCount: 1,
    rewrites: [
      {
        subSurfaceClass: "local_copy_or_historical_document",
      },
    ],
    refusals: [],
  });
}

function contract(overrides = {}) {
  return {
    path: "src/lib/example.ts",
    surfaceClass: "environment_key",
    subSurfaceClass: "environment_key",
    contractName: "V10_EXAMPLE",
    token: "v10",
    count: 1,
    owner: "platform-runtime",
    reason: "compatibility",
    manualOnly: true,
    removalStrategy: "add_alias_or_queue_then_manual_cutover",
    validationCommand: "npm run check:versioned-content-contracts",
    manualFollowUp: "manual cutover",
    suggestedNeutralName: "EXAMPLE",
    ...overrides,
  };
}

test("buildVersionedContentSurfaceCoverage summarizes queue, allowlist, and safe-action coverage", () => {
  const root = makeRoot();
  baseArtifacts(
    root,
    [
      contract(),
      contract({
        path: "SECURITY.md",
        surfaceClass: "provider_or_crypto_format",
        subSurfaceClass: "cryptographic_envelope_version",
        contractName: "enc:v1:",
        token: "v1",
        suggestedNeutralName: null,
      }),
      contract({
        path: "docs/example.md",
        surfaceClass: "documentation_contract",
        subSurfaceClass: "local_copy_or_historical_document",
        contractName: "v10",
        token: "v10",
        manualOnly: false,
        removalStrategy: "local_manifest_rewrite",
        suggestedNeutralName: null,
      }),
    ],
    [
      {
        surface: "environment_key",
        subSurface: "environment_key",
        sourcePath: "src/lib/example.ts",
        legacyName: "V10_EXAMPLE",
        neutralAlias: "EXAMPLE",
      },
    ],
    [
      {
        id: "crypto-prefix",
        pattern: "enc:v[0-9]+:",
      },
    ],
  );

  const coverage = buildVersionedContentSurfaceCoverage(root);

  assert.equal(coverage.issueCount, 0);
  assert.equal(coverage.totals.contractCount, 3);
  assert.equal(coverage.totals.queueCoveredManualCount, 1);
  assert.equal(coverage.totals.allowlistCoveredManualCount, 1);
  assert.equal(coverage.totals.remainingSafeActionCount, 1);
  assert.equal(coverage.packageScriptReadiness.aliasCount, 1);
  assert.equal(coverage.packageScriptReadiness.blockedCount, 1);
  assert.ok(coverage.bySubSurface.some((row) => row.subSurfaceClass === "environment_key" && row.queueCoveredManualCount === 1));
});

test("analyzeVersionedContentSurfaceCoverage rejects missing metadata", () => {
  const root = makeRoot();
  const bad = contract();
  delete bad.owner;
  baseArtifacts(root, [bad], [
    {
      surface: "environment_key",
      subSurface: "environment_key",
      sourcePath: "src/lib/example.ts",
      legacyName: "V10_EXAMPLE",
      neutralAlias: "EXAMPLE",
    },
  ]);
  writeJson(root, "artifacts/compatibility/versioned-content-surface-coverage.json", buildVersionedContentSurfaceCoverage(root));

  const report = analyzeVersionedContentSurfaceCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_content_surface_contract_missing_metadata"));
});

test("analyzeVersionedContentSurfaceCoverage rejects manual rows without queue or allowlist coverage", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()]);
  writeJson(root, "artifacts/compatibility/versioned-content-surface-coverage.json", buildVersionedContentSurfaceCoverage(root));

  const report = analyzeVersionedContentSurfaceCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_content_surface_manual_contract_uncovered"));
});

test("analyzeVersionedContentSurfaceCoverage accepts the current deterministic artifact", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()], [
    {
      surface: "environment_key",
      subSurface: "environment_key",
      sourcePath: "src/lib/example.ts",
      legacyName: "V10_EXAMPLE",
      neutralAlias: "EXAMPLE",
    },
  ]);
  writeJson(root, "artifacts/compatibility/versioned-content-surface-coverage.json", buildVersionedContentSurfaceCoverage(root));

  const report = analyzeVersionedContentSurfaceCoverage({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeVersionedContentSurfaceCoverage detects artifact drift", () => {
  const root = makeRoot();
  baseArtifacts(root, [contract()], [
    {
      surface: "environment_key",
      subSurface: "environment_key",
      sourcePath: "src/lib/example.ts",
      legacyName: "V10_EXAMPLE",
      neutralAlias: "EXAMPLE",
    },
  ]);
  writeJson(root, "artifacts/compatibility/versioned-content-surface-coverage.json", { stale: true });

  const report = analyzeVersionedContentSurfaceCoverage({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_content_surface_coverage_drift"));
});
