import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedPublicRuntimeDualRead,
  buildVersionedPublicRuntimeDualRead,
} from "./check-versioned-public-runtime-dual-read.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-public-runtime-dual-read-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function baseSources(overrides = {}) {
  const legacyPrefix = "v";
  return {
    publicContractPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      groups: [
        {
          id: "routes_deeplinks_redirects",
          subSurfaceClasses: ["api_route_contract", "cron_route_contract"],
          categoryIds: ["route_deeplink_redirect_contracts"],
          contractCount: 2,
          manualOnlyContractCount: 2,
          uncoveredManualCount: 0,
          missingMetadataCount: 0,
          remainingSafeActionCount: 0,
          missingValidationCommandCount: 0,
          queueEntryCount: 2,
          allowlistEntryCount: 0,
        },
        {
          id: "public_metadata_assets",
          subSurfaceClasses: ["public_metadata_or_asset"],
          categoryIds: ["public_metadata_pwa_install_contracts"],
          contractCount: 0,
          manualOnlyContractCount: 0,
          uncoveredManualCount: 0,
          missingMetadataCount: 0,
          remainingSafeActionCount: 0,
          missingValidationCommandCount: 0,
          queueEntryCount: 1,
          allowlistEntryCount: 0,
        },
      ],
    },
    routeAliases: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliases: [
        {
          surface: "api_route",
          legacyPath: `/api/workspace/${legacyPrefix}6-settings`,
          neutralPath: "/api/workspace/settings",
          legacyRouteFile: `src/app/api/workspace/${legacyPrefix}6-settings/route.ts`,
          neutralRouteFile: "src/app/api/workspace/settings/route.ts",
          owner: "platform-api",
          reason: "test alias",
        },
        {
          surface: "cron_route",
          legacyPath: `/api/cron/${legacyPrefix}6/job`,
          neutralPath: "/api/cron/job",
          legacyRouteFile: `src/app/api/cron/${legacyPrefix}6/job/route.ts`,
          neutralRouteFile: "src/app/api/cron/job/route.ts",
          owner: "platform-api",
          reason: "test alias",
        },
      ],
    },
    compatibilityRemovalQueue: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        queues: {
          apiRoutes: [{ legacyName: `/api/workspace/${legacyPrefix}6-settings` }],
          cronRoutes: [{ legacyName: `/api/cron/${legacyPrefix}6/job` }],
          contentContractAliases: [{ legacyName: "public-metadata-key" }],
        },
      },
    },
    ...overrides,
  };
}

test("public runtime dual-read readiness classifies route aliases and queued public groups", () => {
  const artifact = buildVersionedPublicRuntimeDualRead(makeRoot(), { sources: baseSources() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.statusCounts.dual_read_present, 2);
  assert.equal(artifact.totals.statusCounts.queue_covered, 2);
  assert.equal(artifact.totals.remainingSafeActionCount, 0);
});

test("public runtime dual-read readiness fails on uncovered manual rows", () => {
  const artifact = buildVersionedPublicRuntimeDualRead(makeRoot(), {
    sources: baseSources({
      publicContractPreservation: {
        ...baseSources().publicContractPreservation,
        groups: [
          {
            ...baseSources().publicContractPreservation.groups[0],
            uncoveredManualCount: 1,
          },
        ],
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_public_runtime_dual_read_uncovered_manual_rows"));
});

test("public runtime dual-read readiness fails on route alias metadata gaps", () => {
  const sources = baseSources();
  sources.routeAliases.aliases[0].neutralPath = "";
  const artifact = buildVersionedPublicRuntimeDualRead(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_public_runtime_dual_read_missing_row_metadata"));
});

test("public runtime dual-read readiness detects deterministic artifact drift", () => {
  const root = makeRoot();
  const sources = baseSources();
  writeJson(root, "artifacts/compatibility/versioned-public-runtime-dual-read.json", { stale: true });

  const report = analyzeVersionedPublicRuntimeDualRead({ root, sources });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_public_runtime_dual_read_drift"));
});

test("public runtime dual-read readiness passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  const sources = baseSources();
  const artifact = buildVersionedPublicRuntimeDualRead(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-public-runtime-dual-read.json", artifact);

  const report = analyzeVersionedPublicRuntimeDualRead({ root, sources });

  assert.equal(report.ok, true);
});
