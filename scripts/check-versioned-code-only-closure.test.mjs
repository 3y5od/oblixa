import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedCodeOnlyClosure,
  buildVersionedCodeOnlyClosure,
} from "./check-versioned-code-only-closure.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-code-only-closure-"));
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
  return {
    safeRenames: { ok: true, issueCount: 0, issues: [], pendingRenameCount: 0, appliedRenameCount: 381 },
    exportedSymbols: { ok: true, issueCount: 0, issues: [], aliasAddedCount: 1135 },
    exportedSymbolAliases: { ok: true, issueCount: 0, issues: [], pendingAliasCount: 0, blockedAliasCount: 0 },
    localContentRewrites: { ok: true, issueCount: 0, issues: [], pendingRewriteCount: 0 },
    packageScriptReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliasCount: 37,
      readyForRemovalCount: 0,
      localReadyForRemovalCount: 37,
      blockedAliasCount: 37,
      blockingReferenceCount: 0,
    },
    aliasUsageNeutrality: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliasCount: 79,
      retainedLegacyAliasCount: 79,
    },
    envFlagAliases: { ok: true, issueCount: 0, issues: [], aliasCount: 22 },
    compatibilityEquivalence: { ok: true, issueCount: 0, issues: [] },
    compatibilityRemovalQueue: { ok: true, issueCount: 0, issues: [] },
    openObjectiveClosure: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        objectives: [
          {
            id: "compatibility_alias_equivalence",
            owner: "platform-hardening",
            reason: "Compatibility aliases are covered.",
            validationCommand: "npm run check:versioned-compatibility-equivalence",
            manualFollowUp: "Remove aliases only after queue readiness.",
            coverageStatus: "coverage_proven",
            queueNames: ["exportedSymbolAliases"],
            queueCounts: { exportedSymbolAliases: 1 },
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
          {
            id: "package_script_alias_retirement_readiness",
            owner: "platform-hardening",
            reason: "Package aliases remain callable.",
            validationCommand: "npm run check:versioned-package-script-readiness",
            manualFollowUp: "Wait for external runbook and branch-protection evidence.",
            coverageStatus: "retained_legacy_blocked",
            queueNames: ["packageScriptAliases"],
            queueCounts: { packageScriptAliases: 37 },
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
          {
            id: "public_route_and_metadata_preservation",
            owner: "frontend-platform",
            reason: "Public routes need runtime aliases.",
            validationCommand: "npm run check:versioned-public-contract-preservation",
            manualFollowUp: "Keep public legacy names until aliases and cutover evidence exist.",
            coverageStatus: "requires_runtime_alias",
            queueNames: ["apiRoutes"],
            queueCounts: { apiRoutes: 1 },
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
          {
            id: "sql_security_and_seed_staging",
            owner: "database-platform",
            reason: "SQL aliases need forward migrations.",
            validationCommand: "npm run check:sql-object-rename-staging",
            manualFollowUp: "Do not remove SQL names without linked verification.",
            coverageStatus: "requires_production_or_external_cutover",
            queueNames: ["sqlObjects"],
            queueCounts: { sqlObjects: 1 },
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
          {
            id: "final_zero_version_enforcement",
            owner: "platform-hardening",
            reason: "Final enforcement requires retained legacy removal.",
            validationCommand: "npm run check:versioned-naming",
            manualFollowUp: "Keep unchecked until queues are ready for removal.",
            coverageStatus: "requires_production_or_external_cutover",
            queueNames: ["packageScriptAliases"],
            queueCounts: { packageScriptAliases: 37 },
            uncoveredManualCount: 0,
            remainingSafeActionCount: 0,
            missingMetadataCount: 0,
            missingValidationCommandCount: 0,
          },
        ],
      },
    },
    ...overrides,
  };
}

test("code-only closure maps covered, retained, alias, migration, and external statuses", () => {
  const artifact = buildVersionedCodeOnlyClosure(makeRoot(), { sources: baseSources() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.pendingSafeActionCount, 0);
  assert.equal(artifact.totals.statusCounts.coverage_proven, 1);
  assert.equal(artifact.totals.statusCounts.retained_legacy_blocked, 1);
  assert.equal(artifact.totals.statusCounts.requires_runtime_alias, 1);
  assert.equal(artifact.totals.statusCounts.requires_forward_migration, 1);
  assert.equal(artifact.totals.statusCounts.requires_external_or_production_cutover, 1);
  assert.equal(artifact.safeActionGates.every((row) => row.safeActionStatus === "exhausted"), true);
  assert.equal(
    artifact.safeActionGates.find((row) => row.id === "exported_symbol_aliases")?.completedActionCount,
    1135,
  );
});

test("code-only closure fails when a safe action gate has pending work", () => {
  const artifact = buildVersionedCodeOnlyClosure(makeRoot(), {
    sources: baseSources({
      safeRenames: { ok: true, issueCount: 0, issues: [], pendingRenameCount: 1, appliedRenameCount: 380 },
    }),
  });

  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "versioned_code_only_closure_pending_safe_action_gate");
  assert.equal(artifact.issues[0].gate, "path_level_safe_renames");
});

test("code-only closure surfaces dependent source issues", () => {
  const artifact = buildVersionedCodeOnlyClosure(makeRoot(), {
    sources: baseSources({
      compatibilityRemovalQueue: {
        ok: false,
        issueCount: 1,
        issues: [{ issue: "compatibility_removal_queue_stale_source_path", path: "src/lib/stale.ts" }],
      },
    }),
  });

  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "versioned_code_only_closure_source_issues");
  assert.equal(artifact.issues[0].source, "compatibility_removal_queue");
});

test("code-only closure detects missing objective metadata", () => {
  const sources = baseSources();
  sources.openObjectiveClosure.current.objectives[0] = {
    ...sources.openObjectiveClosure.current.objectives[0],
    validationCommand: "",
  };

  const artifact = buildVersionedCodeOnlyClosure(makeRoot(), { sources });

  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "versioned_code_only_closure_missing_objective_metadata");
  assert.equal(artifact.issues[0].key, "validationCommand");
});

test("code-only closure detects deterministic artifact drift", () => {
  const root = makeRoot();
  const sources = baseSources();
  writeJson(root, "artifacts/compatibility/versioned-code-only-closure.json", { stale: true });

  const report = analyzeVersionedCodeOnlyClosure({ root, sources });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_code_only_closure_drift"));
});

test("code-only closure passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  const sources = baseSources();
  const artifact = buildVersionedCodeOnlyClosure(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-code-only-closure.json", artifact);

  const report = analyzeVersionedCodeOnlyClosure({ root, sources });

  assert.equal(report.ok, true);
});
