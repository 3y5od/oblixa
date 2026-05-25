import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedFinalChecklistReconciliation,
  buildVersionedFinalChecklistReconciliation,
} from "./check-versioned-final-checklist-reconciliation.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-final-checklist-reconciliation-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

function baseSources(overrides = {}) {
  return {
    versionedCodeOnlyClosure: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        totals: {
          pendingSafeActionCount: 0,
          retainedLegacyAliasCount: 79,
          packageScriptAliasCount: 37,
          statusCounts: {
            coverage_proven: 6,
            retained_legacy_blocked: 1,
            requires_forward_migration: 1,
            requires_external_or_production_cutover: 2,
          },
        },
      },
    },
    versionedUncheckedObjectiveReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        totals: {
          remainingSafeActionCount: 0,
          uncoveredManualCount: 0,
          missingMetadataCount: 0,
          missingValidationCommandCount: 0,
          requiresExternalOrProductionCutoverCount: 2,
          statusCounts: {
            implemented: 4,
            queue_covered: 1,
            alias_ready: 1,
            requires_forward_migration: 1,
            requires_external_or_production_cutover: 2,
          },
        },
      },
    },
    versionedForwardMigrationReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      rowCount: 75,
      aliasAddedCount: 9,
      requiresForwardMigrationCount: 66,
      blockerClassCounts: {
        data_bearing_table_view_or_backfill: 33,
        none: 9,
        policy_alias_requires_predicate_equivalence: 33,
      },
    },
    sqlPolicyPredicateEquivalence: {
      ok: true,
      issueCount: 0,
      issues: [],
      policyRowCount: 33,
      statusCounts: {
        requires_forward_migration: 33,
      },
      blockerClassCounts: {
        neutral_target_is_view_requires_policy_migration: 33,
      },
      linkedVerificationKindCounts: {
        manual_auth_context_select_comparison: 32,
        manual_non_select_policy_placeholder: 1,
      },
      current: {
        totals: {
          policyRowCount: 33,
          queueCoveredCount: 33,
          verificationSqlCoveredCount: 33,
          neutralTableViewAliasCoveredCount: 33,
          predicateEvidenceCount: 33,
          manualLinkedVerificationRequiredCount: 33,
          missingValidationCommandCount: 0,
          missingMetadataCount: 0,
          statusCounts: {
            requires_forward_migration: 33,
          },
          blockerClassCounts: {
            neutral_target_is_view_requires_policy_migration: 33,
          },
          linkedVerificationKindCounts: {
            manual_auth_context_select_comparison: 32,
            manual_non_select_policy_placeholder: 1,
          },
        },
      },
    },
    sqlPolicyForwardMigrationBlueprint: {
      ok: true,
      issueCount: 0,
      issues: [],
      policyRowCount: 33,
      statusCounts: {
        requires_forward_migration: 33,
      },
      blockerClassCounts: {
        neutral_target_is_view_requires_policy_migration: 33,
      },
      requiredPredicateEquivalenceLinkedContextCounts: {
        representative_authenticated_org_member_contexts: 32,
        manual_catalog_and_role_context_for_non_select_policy: 1,
      },
      current: {
        totals: {
          policyRowCount: 33,
          queueCoveredCount: 33,
          predicateEquivalenceCoveredCount: 33,
          policyAliasReadinessCoveredCount: 33,
          verificationSqlCoveredCount: 33,
          sqlSecurityAutomationCoveredCount: 33,
          neutralTableViewAliasCoveredCount: 33,
          stagingCoveredCount: 33,
          migratableInThisPassCount: 0,
          missingValidationCommandCount: 0,
          missingMetadataCount: 0,
          commentOnlyFutureDdlPlaceholderCount: 33,
          statusCounts: {
            requires_forward_migration: 33,
          },
          blockerClassCounts: {
            neutral_target_is_view_requires_policy_migration: 33,
          },
          requiredPredicateEquivalenceLinkedContextCounts: {
            representative_authenticated_org_member_contexts: 32,
            manual_catalog_and_role_context_for_non_select_policy: 1,
          },
        },
      },
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
      current: {
        totals: {
          remainingSafeActionCount: 0,
          missingValidationCommandCount: 0,
          missingMetadataCount: 0,
          uncoveredManualCount: 0,
          missingQueueCoverageCount: 0,
        },
      },
    },
    versionedPackageScriptReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliasCount: 37,
      localReadyForRemovalCount: 37,
      readyForRemovalCount: 0,
      blockingReferenceCount: 0,
    },
    compatibilityRemovalQueue: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        queues: {
          packageScriptAliases: Array.from({ length: 37 }, (_, index) => ({ legacyName: `legacy:${index}` })),
          sqlObjects: Array.from({ length: 75 }, (_, index) => ({ legacyName: `sql:${index}` })),
          telemetryEventNames: [{ legacyName: "telemetry:legacy" }],
          apiRoutes: [{ legacyName: "/api/legacy" }],
          cronRoutes: [{ legacyName: "/api/cron/legacy" }],
        },
      },
    },
    safeRenames: {
      ok: true,
      issueCount: 0,
      issues: [],
      pendingRenameCount: 0,
      appliedRenameCount: 381,
    },
    exportedSymbolAliases: {
      ok: true,
      issueCount: 0,
      issues: [],
      pendingAliasCount: 0,
      blockedAliasCount: 0,
    },
    localContentRewrites: {
      ok: true,
      issueCount: 0,
      issues: [],
      pendingRewriteCount: 0,
    },
    ...overrides,
  };
}

test("final checklist reconciliation classifies complete, retained, migration, external, and final-zero families", () => {
  const artifact = buildVersionedFinalChecklistReconciliation(makeRoot(), { sources: baseSources() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.objectiveCount, 9);
  assert.equal(artifact.totals.statusCounts.code_only_complete, 5);
  assert.equal(artifact.totals.statusCounts.retained_legacy_blocked, 1);
  assert.equal(artifact.totals.statusCounts.requires_forward_migration, 1);
  assert.equal(artifact.totals.statusCounts.requires_external_or_production_cutover, 1);
  assert.equal(artifact.totals.statusCounts.final_zero_blocked, 1);
  assert.equal(
    artifact.objectives.find((row) => row.id === "final_zero_version_enforcement")?.finalStatus,
    "final_zero_blocked",
  );
});

test("final checklist reconciliation fails when a safe action is still pending", () => {
  const artifact = buildVersionedFinalChecklistReconciliation(makeRoot(), {
    sources: baseSources({
      safeRenames: {
        ok: true,
        issueCount: 0,
        issues: [],
        pendingRenameCount: 1,
        appliedRenameCount: 380,
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_final_checklist_reconciliation_coverage_gap"));
});

test("final checklist reconciliation carries dependent source issues", () => {
  const artifact = buildVersionedFinalChecklistReconciliation(makeRoot(), {
    sources: baseSources({
      compatibilityRemovalQueue: {
        ok: false,
        issueCount: 1,
        issues: [{ issue: "compatibility_removal_queue_missing_validation_command", legacyName: "legacy-command" }],
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.equal(artifact.issues[0].issue, "versioned_final_checklist_reconciliation_source_issues");
  assert.equal(artifact.issues[0].source, "compatibility_removal_queue");
});

test("final checklist reconciliation detects deterministic artifact drift", () => {
  const root = makeRoot();
  const sources = baseSources();
  writeJson(root, "artifacts/compatibility/versioned-final-checklist-reconciliation.json", { stale: true });

  const report = analyzeVersionedFinalChecklistReconciliation({ root, sources });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_final_checklist_reconciliation_drift"));
});

test("final checklist reconciliation passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  const sources = baseSources();
  const artifact = buildVersionedFinalChecklistReconciliation(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-final-checklist-reconciliation.json", artifact);

  const report = analyzeVersionedFinalChecklistReconciliation({ root, sources });

  assert.equal(report.ok, true);
});
