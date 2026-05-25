import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedUncheckedObjectiveReadiness,
  buildVersionedUncheckedObjectiveReadiness,
} from "./check-versioned-unchecked-objective-readiness.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-unchecked-objective-readiness-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function baseSources(overrides = {}) {
  const legacyPrefix = "v";
  const legacySymbolPrefix = "V";
  return {
    versionedCodeOnlyClosure: {
      ok: true,
      issueCount: 0,
      issues: [],
      pendingSafeActionCount: 0,
      retainedLegacyAliasCount: 79,
      statusCounts: {
        coverage_proven: 4,
        retained_legacy_blocked: 1,
        requires_runtime_alias: 1,
        requires_forward_migration: 1,
        requires_external_or_production_cutover: 3,
      },
      current: { totals: { pendingSafeActionCount: 0, safeActionGateCount: 6 } },
    },
    versionedRemainingLocalContractClosure: {
      ok: true,
      issueCount: 0,
      issues: [],
      statusCounts: { coverage_proven: 8, retained_legacy_blocked: 1, requires_runtime_alias: 1 },
      current: {
        objectives: [
          {
            id: "remaining_surface_queue_completeness",
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
        ],
      },
    },
    versionedAdditiveAliasPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      domAliasPairCount: 11,
      coveredDomAliasPairCount: 11,
    },
    versionedPackageScriptReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliasCount: 37,
      localReadyForRemovalCount: 37,
      readyForRemovalCount: 0,
      blockedAliasCount: 37,
      blockingReferenceCount: 0,
    },
    versionedCompatibilityEquivalence: {
      ok: true,
      issueCount: 0,
      issues: [],
      telemetry: {
        eventCount: 338,
        neutralAliasCount: 74,
        queueCount: 74,
      },
    },
    versionedAliasUsageNeutrality: {
      ok: true,
      issueCount: 0,
      issues: [],
      retainedLegacyAliasCount: 79,
    },
    versionedEnvFlagAliases: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliasCount: 24,
    },
    versionedPublicContractPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      groupCount: 4,
      preservedGroupCount: 4,
      contractCount: 12,
      uncoveredManualCount: 0,
      remainingSafeActionCount: 0,
      missingMetadataCount: 0,
      missingValidationCommandCount: 0,
    },
    versionedPublicRuntimeDualRead: {
      ok: true,
      issueCount: 0,
      issues: [],
      dualReadPresentCount: 2,
      queueCoveredCount: 4,
      remainingSafeActionCount: 0,
      statusCounts: {
        dual_read_present: 2,
        queue_covered: 4,
      },
    },
    versionedSourceConfigPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      groupCount: 5,
      uncoveredManualCount: 0,
      remainingSafeActionCount: 0,
      missingMetadataCount: 0,
      missingValidationCommandCount: 0,
    },
    versionedLocalSurfaceRegression: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        groups: [
          {
            id: "copy_and_localization_keys",
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
        ],
      },
    },
    compatibilityRemovalQueue: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        queues: {
          packageScriptAliases: [{ legacyName: "check:legacy-suite" }],
          exportedSymbolAliases: [{ legacyName: `${legacySymbolPrefix}10RecoverableState` }],
          telemetryEventNames: [{ legacyName: `${legacyPrefix}9.event` }],
          environmentKeys: [{ legacyName: `ENABLE_${legacySymbolPrefix}6_AUTOPILOT` }],
          apiRoutes: [{ legacyName: `/api/workspace/${legacyPrefix}6-settings` }],
          cronRoutes: [{ legacyName: `/api/cron/${legacyPrefix}6/scorecard-recompute` }],
          sqlObjects: [{ legacyName: `public.organizations.${legacyPrefix}6_org_settings_json` }],
          contentContractAliases: [{ legacyName: `data-${legacyPrefix}10-state` }],
          sqlSecurityAutomation: [{ legacyName: `${legacyPrefix}6 policy` }],
          migrationHistoryFilenames: [{ legacyName: "085_contract_fields_compatibility_view.sql" }],
          seedVersionedNames: [{ legacyName: `${legacyPrefix}6_org_settings_json` }],
        },
      },
    },
    sqlObjectRenameStaging: {
      ok: true,
      issueCount: 0,
      issues: [],
      stagedRenameCount: 75,
    },
    sqlSecurityAutomationCoverage: {
      ok: true,
      issueCount: 0,
      issues: [],
      coverageCount: 12,
    },
    seedVersionedNameQueueCoverage: {
      ok: true,
      issueCount: 0,
      issues: [],
      queueCoveredCount: 4,
    },
    ...overrides,
  };
}

test("unchecked objective readiness classifies implemented, queued, alias-ready, migration, and external families", () => {
  const artifact = buildVersionedUncheckedObjectiveReadiness(makeRoot(), { sources: baseSources() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.objectiveCount, 9);
  assert.equal(artifact.totals.statusCounts.implemented, 4);
  assert.equal(artifact.totals.statusCounts.queue_covered, 1);
  assert.equal(artifact.totals.statusCounts.alias_ready, 1);
  assert.equal(artifact.totals.statusCounts.requires_runtime_dual_read ?? 0, 0);
  assert.equal(artifact.totals.statusCounts.requires_forward_migration, 1);
  assert.equal(artifact.totals.statusCounts.requires_external_or_production_cutover, 2);
  assert.equal(
    artifact.objectives.find((row) => row.id === "package_script_alias_readiness")?.readinessStatus,
    "alias_ready",
  );
});

test("unchecked objective readiness fails when a safe action remains pending", () => {
  const artifact = buildVersionedUncheckedObjectiveReadiness(makeRoot(), {
    sources: baseSources({
      versionedCodeOnlyClosure: {
        ok: true,
        issueCount: 0,
        issues: [],
        pendingSafeActionCount: 1,
        current: { totals: { pendingSafeActionCount: 1 } },
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_unchecked_objective_readiness_pending_safe_actions"));
});

test("unchecked objective readiness surfaces dependent source issues", () => {
  const artifact = buildVersionedUncheckedObjectiveReadiness(makeRoot(), {
    sources: baseSources({
      compatibilityRemovalQueue: {
        ok: false,
        issueCount: 1,
        issues: [{ issue: "compatibility_removal_queue_stale_source_path", path: "src/lib/stale.ts" }],
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.equal(artifact.issues[0].issue, "versioned_unchecked_objective_readiness_source_issues");
  assert.equal(artifact.issues[0].source, "compatibility_removal_queue");
});

test("unchecked objective readiness detects deterministic artifact drift", () => {
  const root = makeRoot();
  const sources = baseSources();
  writeJson(root, "artifacts/compatibility/versioned-unchecked-objective-readiness.json", { stale: true });

  const report = analyzeVersionedUncheckedObjectiveReadiness({ root, sources });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_unchecked_objective_readiness_drift"));
});

test("unchecked objective readiness passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  const sources = baseSources();
  const artifact = buildVersionedUncheckedObjectiveReadiness(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-unchecked-objective-readiness.json", artifact);

  const report = analyzeVersionedUncheckedObjectiveReadiness({ root, sources });

  assert.equal(report.ok, true);
});
