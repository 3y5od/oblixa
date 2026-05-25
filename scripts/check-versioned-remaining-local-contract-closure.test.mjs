import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedRemainingLocalContractClosure,
  buildVersionedRemainingLocalContractClosure,
} from "./check-versioned-remaining-local-contract-closure.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-remaining-local-contract-closure-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function localGroup(id, overrides = {}) {
  return {
    id,
    coverageStatus: "regression_guarded",
    contractCount: 2,
    manualOnlyContractCount: 1,
    uncoveredManualCount: 0,
    remainingSafeActionCount: 0,
    missingMetadataCount: 0,
    missingValidationCommandCount: 0,
    ...overrides,
  };
}

function publicGroup(id, overrides = {}) {
  return {
    id,
    coverageStatus: "preserved",
    contractCount: 1,
    manualOnlyContractCount: 1,
    uncoveredManualCount: 0,
    remainingSafeActionCount: 0,
    missingMetadataCount: 0,
    missingValidationCommandCount: 0,
    ...overrides,
  };
}

function baseSources(overrides = {}) {
  return {
    contentSurfaceCoverage: { issueCount: 0, issues: [] },
    remainingSurfaceCoverage: {
      issueCount: 0,
      issues: [],
      totals: {
        contractCount: 10,
        manualOnlyContractCount: 8,
        uncoveredManualCount: 0,
        remainingSafeActionCount: 0,
        missingMetadataCount: 0,
        missingValidationCommandCount: 0,
      },
      categories: [{ id: "static_text_fixtures_snapshots" }],
    },
    localSurfaceRegression: {
      ok: true,
      issueCount: 0,
      issues: [],
      current: {
        groups: [
          localGroup("copy_and_localization_keys"),
          localGroup("test_tags_skip_and_snapshot_prefixes"),
          localGroup("fixtures_evidence_and_qa_registries"),
          localGroup("dom_and_test_selectors"),
          localGroup("style_tokens_and_visual_keys"),
          localGroup("source_config_and_static_analysis_ids"),
        ],
      },
    },
    publicContractPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      groups: [
        publicGroup("public_metadata_assets"),
        publicGroup("pwa_well_known_install"),
      ],
    },
    sourceConfigPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      groups: [publicGroup("source_owned_config_scanner_ids")],
    },
    seedQueueCoverage: {
      ok: true,
      issueCount: 0,
      issues: [],
      queueCoveredCount: 4,
      manualOnlyCount: 4,
      uncoveredManualCount: 0,
    },
    packageScriptReadiness: {
      ok: true,
      issueCount: 0,
      issues: [],
      aliasCount: 37,
      readyForRemovalCount: 0,
      localReadyForRemovalCount: 37,
      blockingReferenceCount: 0,
    },
    codeOnlyClosure: {
      ok: true,
      issueCount: 0,
      issues: [],
      objectiveCount: 10,
      pendingSafeActionCount: 0,
      retainedLegacyAliasCount: 79,
    },
    additiveAliasPreservation: {
      ok: true,
      issueCount: 0,
      issues: [],
      domAliasPairCount: 11,
      coveredDomAliasPairCount: 11,
      semgrepNeutralRulepackActive: true,
      current: {
        semgrep: {
          neutralRulepackActive: true,
          legacyRulepacksInactiveInCi: true,
          versionedActiveRuleIdCount: 0,
        },
      },
    },
    ...overrides,
  };
}

test("remaining local contract closure classifies covered, retained, and runtime-alias objectives", () => {
  const artifact = buildVersionedRemainingLocalContractClosure(makeRoot(), { sources: baseSources() });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.objectiveCount, 10);
  assert.equal(artifact.totals.statusCounts.coverage_proven, 8);
  assert.equal(artifact.totals.statusCounts.retained_legacy_blocked, 1);
  assert.equal(artifact.totals.statusCounts.requires_runtime_alias, 1);
  assert.equal(
    artifact.objectives.find((row) => row.id === "package_script_retained_aliases")?.closureStatus,
    "retained_legacy_blocked",
  );
  assert.equal(
    artifact.objectives.find((row) => row.id === "public_metadata_pwa_readiness")?.closureStatus,
    "requires_runtime_alias",
  );
});

test("remaining local contract closure fails when a local surface has pending safe actions", () => {
  const sources = baseSources();
  sources.localSurfaceRegression.current.groups[0] = localGroup("copy_and_localization_keys", {
    remainingSafeActionCount: 2,
  });

  const artifact = buildVersionedRemainingLocalContractClosure(makeRoot(), { sources });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.issue === "versioned_remaining_local_contract_closure_pending_safe_actions"));
});

test("remaining local contract closure surfaces dependent report issues", () => {
  const artifact = buildVersionedRemainingLocalContractClosure(makeRoot(), {
    sources: baseSources({
      packageScriptReadiness: {
        ok: false,
        issueCount: 1,
        issues: [{ issue: "versioned_package_script_alias_bridge_missing", legacyName: "check:legacy-surface" }],
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.equal(artifact.issues[0].issue, "versioned_remaining_local_contract_closure_source_issues");
  assert.equal(artifact.issues[0].source, "versioned_package_script_readiness");
});

test("remaining local contract closure fails when DOM aliases are incomplete", () => {
  const artifact = buildVersionedRemainingLocalContractClosure(makeRoot(), {
    sources: baseSources({
      additiveAliasPreservation: {
        ok: true,
        issueCount: 0,
        issues: [],
        domAliasPairCount: 11,
        coveredDomAliasPairCount: 10,
        semgrepNeutralRulepackActive: true,
      },
    }),
  });

  assert.equal(artifact.issueCount > 0, true);
  assert.ok(artifact.issues.some((row) => row.objective === "dom_selector_accessibility_aliases"));
});

test("remaining local contract closure detects deterministic artifact drift", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/compatibility/versioned-remaining-local-contract-closure.json", { stale: true });

  const report = analyzeVersionedRemainingLocalContractClosure({ root, sources: baseSources() });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "versioned_remaining_local_contract_closure_drift"));
});

test("remaining local contract closure passes when committed artifact matches current evidence", () => {
  const root = makeRoot();
  const sources = baseSources();
  const artifact = buildVersionedRemainingLocalContractClosure(root, { sources });
  writeJson(root, "artifacts/compatibility/versioned-remaining-local-contract-closure.json", artifact);

  const report = analyzeVersionedRemainingLocalContractClosure({ root, sources });

  assert.equal(report.ok, true);
});
