import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PACKAGE_SCRIPT_ALIASES } from "./check-compatibility-removal-queue.mjs";
import {
  analyzeNeutralNamingRules,
  buildNeutralNamingRules,
} from "./check-neutral-naming-rules.mjs";
import {
  analyzeVersionedManualSurfaceClosure,
  buildVersionedManualSurfaceClosure,
} from "./check-versioned-manual-surface-closure.mjs";
import {
  analyzeVersionedCompatibilityEquivalence,
  validateOrgSettingsRuntimeAlias,
} from "./check-versioned-compatibility-equivalence.mjs";
import {
  analyzeVersionedLocalSurfaceRegression,
  buildVersionedLocalSurfaceRegression,
} from "./check-versioned-local-surface-regression.mjs";
import {
  analyzeVersionedOpenObjectiveClosure,
  buildVersionedOpenObjectiveClosure,
} from "./check-versioned-open-objective-closure.mjs";
import {
  analyzeVersionedPackageScriptReadiness,
  buildVersionedPackageScriptReadiness,
} from "./check-versioned-package-script-readiness.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-closure-readiness-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function packageScripts() {
  const scripts = {};
  for (const alias of PACKAGE_SCRIPT_ALIASES) {
    scripts[alias.legacy] = `npm run ${alias.neutral}`;
    scripts[alias.neutral] = "node scripts/example.mjs";
  }
  return scripts;
}

const legacyOrgSettingsColumn = ["v", "6_org_settings_json"].join("");

test("versioned package script readiness records blockers and drift", () => {
  const root = makeRoot();
  const legacyScript = `check:${"v"}10-suite`;
  writeJson(root, "package.json", { scripts: packageScripts() });
  write(root, "scripts/example.mjs", "console.log('ok');\n");
  write(root, "scripts/local-reference.mjs", `const command = "${legacyScript}";\n`);
  write(root, "docs/runbook.md", `Run npm run ${legacyScript} before release.\n`);

  const artifact = buildVersionedPackageScriptReadiness(root);
  const row = artifact.aliases.find((alias) => alias.legacyName === legacyScript);

  assert.equal(artifact.aliasCount, PACKAGE_SCRIPT_ALIASES.length);
  assert.equal(row.status, "alias_added");
  assert.equal(row.readinessStatus, "blocked_by_repo_local_references");
  assert.equal(row.repoLocalReferenceCount, 1);
  assert.equal(row.docsOnlyReferenceCount, 1);
  assert.equal(row.blockerCategoryCounts.repo_local, 1);
  assert.equal(row.blockerCategoryCounts.docs_only, 1);
  assert.equal(row.blockingReferences.some((ref) => ref.path === "docs/runbook.md"), true);
  assert.equal(row.blockingReferences.some((ref) => ref.path === "scripts/local-reference.mjs"), true);

  let report = analyzeVersionedPackageScriptReadiness({ root });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_package_script_readiness_missing_artifact"));

  writeJson(root, "artifacts/compatibility/versioned-package-script-readiness.json", artifact);
  report = analyzeVersionedPackageScriptReadiness({ root });
  assert.equal(report.ok, true);
});

test("versioned package script readiness separates docs-only blockers from repo-local readiness", () => {
  const root = makeRoot();
  const legacyScript = `check:${"v"}10-suite`;
  writeJson(root, "package.json", { scripts: packageScripts() });
  write(root, "docs/runbook.md", `Run npm run ${legacyScript} before release.\n`);

  const artifact = buildVersionedPackageScriptReadiness(root);
  const row = artifact.aliases.find((alias) => alias.legacyName === legacyScript);

  assert.equal(row.repoLocalReferenceCount, 0);
  assert.equal(row.docsOnlyReferenceCount, 1);
  assert.equal(row.localReadyForRemoval, true);
  assert.equal(row.readinessStatus, "blocked_by_docs_or_generated_references");
  assert.equal(artifact.repoLocalReferenceCount, 0);
  assert.equal(artifact.docsOnlyReferenceCount, 1);
});

test("versioned package script aliases retain old commands as neutral bridges", () => {
  const scripts = packageScripts();

  for (const alias of PACKAGE_SCRIPT_ALIASES) {
    assert.equal(scripts[alias.legacy], `npm run ${alias.neutral}`);
    assert.equal(typeof scripts[alias.neutral], "string");
  }
});

test("repository package script aliases bridge legacy commands to neutral commands", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

  for (const alias of PACKAGE_SCRIPT_ALIASES) {
    assert.equal(pkg.scripts[alias.legacy], `npm run ${alias.neutral}`);
    assert.equal(typeof pkg.scripts[alias.neutral], "string");
    assert.notEqual(pkg.scripts[alias.neutral], `npm run ${alias.legacy}`);
  }
});

test("repository package script readiness has no repo-local or docs-only blockers", () => {
  const artifact = buildVersionedPackageScriptReadiness(process.cwd());

  assert.equal(artifact.aliasCount, PACKAGE_SCRIPT_ALIASES.length);
  assert.equal(artifact.readyForRemovalCount, 0);
  assert.equal(artifact.localReadyForRemovalCount, PACKAGE_SCRIPT_ALIASES.length);
  assert.equal(artifact.blockingReferenceCount, 0);
  assert.equal(artifact.repoLocalReferenceCount, 0);
  assert.equal(artifact.docsOnlyReferenceCount, 0);
  assert.equal(artifact.generatedArtifactReferenceCount, 0);
  assert.equal(artifact.externalOrManualReferenceCount, 0);
  assert.ok(artifact.aliases.every((row) => row.readinessStatus === "blocked_by_manual_follow_up"));
});

test("repository package metadata has no versioned module-resolution aliases", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  const versionedProductAliasPattern = /(?:^|[:/_-])v[0-9]+(?:$|[:/_-])/iu;
  const metadata = {
    bin: pkg.bin ?? {},
    browser: pkg.browser ?? {},
    exports: pkg.exports ?? {},
    files: pkg.files ?? [],
    imports: pkg.imports ?? {},
    types: pkg.types ?? "",
    typesVersions: pkg.typesVersions ?? {},
  };

  const serialized = JSON.stringify(metadata);
  assert.equal(versionedProductAliasPattern.test(serialized), false);
});

test("org settings runtime alias evidence requires neutral types, reader, and panel imports", () => {
  const root = makeRoot();
  write(root, "src/lib/assurance/org-settings.ts", `
export type OrganizationSettingsCompatibilityViewRow = { org_settings_json?: unknown };
export type OrgSettingsStorageRow = OrganizationSettingsCompatibilityViewRow & { ${legacyOrgSettingsColumn}?: unknown };
function getOrgSettingsRawFromRow(row: OrgSettingsStorageRow | null | undefined): unknown {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, "org_settings_json")) {
    return row.org_settings_json;
  }
  return row.${legacyOrgSettingsColumn};
}
export function readOrgSettingsJsonFromRow(row: OrgSettingsStorageRow | null | undefined) {
  return getOrgSettingsRawFromRow(row);
}
`);
  write(root, "src/components/assurance/org-settings-panel.tsx", `
export function OrgSettingsPanel() {
  return null;
}
export const OrgV6SettingsPanel = OrgSettingsPanel;
`);
  write(root, "src/app/(dashboard)/assurance/autopilot/page.tsx", `
import { OrgSettingsPanel } from "@/components/assurance/org-settings-panel";
import { readOrgSettingsJsonFromRow } from "@/lib/assurance/org-settings";
export function Page({ orgRow }) {
  const orgSettings = readOrgSettingsJsonFromRow(orgRow);
  return <OrgSettingsPanel initialAutopilotAllowExecution={orgSettings?.autopilot_allow_execution ?? null} />;
}
`);

  const report = validateOrgSettingsRuntimeAlias(root);

  assert.equal(report.issueCount, 0);
  assert.equal(report.compatibilityViewTypePresent, true);
  assert.equal(report.storageRowTypePresent, true);
  assert.equal(report.neutralFirstReader, true);
  assert.equal(report.pageUsesNeutralComponent, true);
  assert.equal(report.pageDirectLegacyRead, false);
});

test("org settings runtime alias evidence rejects direct page reads from the legacy column", () => {
  const root = makeRoot();
  write(root, "src/lib/assurance/org-settings.ts", `
export type OrganizationSettingsCompatibilityViewRow = { org_settings_json?: unknown };
export type OrgSettingsStorageRow = OrganizationSettingsCompatibilityViewRow & { ${legacyOrgSettingsColumn}?: unknown };
function getOrgSettingsRawFromRow(row: OrgSettingsStorageRow | null | undefined): unknown {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, "org_settings_json")) {
    return row.org_settings_json;
  }
  return row.${legacyOrgSettingsColumn};
}
`);
  write(root, "src/components/assurance/org-settings-panel.tsx", `
export function OrgSettingsPanel() {
  return null;
}
export const OrgV6SettingsPanel = OrgSettingsPanel;
`);
  write(root, "src/app/(dashboard)/assurance/autopilot/page.tsx", `
import { OrgV6SettingsPanel } from "@/components/assurance/org-settings-panel";
export function Page({ orgRow }) {
  const orgSettings = orgRow?.${legacyOrgSettingsColumn} ?? {};
  return <OrgV6SettingsPanel initialAutopilotAllowExecution={orgSettings.autopilot_allow_execution ?? null} />;
}
`);

  const report = validateOrgSettingsRuntimeAlias(root);

  assert.equal(report.ok, undefined);
  assert.equal(report.issueCount > 0, true);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_compatibility_equivalence_org_settings_page_uses_legacy_component"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_compatibility_equivalence_org_settings_page_direct_legacy_read"));
});

test("neutral naming rules reject banned replacement names", () => {
  const artifact = buildNeutralNamingRules(makeRoot(), {
    safeRenameManifest: {
      plannedRenames: [
        {
          from: `src/lib/${"v"}10-example.ts`,
          to: "src/lib/next-example.ts",
          status: "planned",
          validationCommand: "npm run check:versioned-naming-safe-renames",
        },
      ],
    },
    compatibilityQueue: { queues: {} },
    versionedRemovalQueue: { entries: [] },
  });

  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "neutral_naming_aging_replacement_term");
});

test("neutral naming rules artifact drift is detected", () => {
  const root = makeRoot();
  writeJson(root, "artifacts/compatibility/versioned-naming-safe-rename-manifest.json", { plannedRenames: [] });
  writeJson(root, "artifacts/compatibility/removal-queue.json", { queues: {} });
  writeJson(root, "scripts/versioned-naming-removal-queue.json", { entries: [] });

  const report = analyzeNeutralNamingRules({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "neutral_naming_rules_missing_artifact"));
});

test("manual surface closure accepts covered families", () => {
  const remainingCoverage = {
    categories: [
      {
        id: "public_token_signed_link_external_action_contracts",
        uncoveredManualCount: 0,
        remainingSafeActionCount: 0,
        missingMetadataCount: 0,
        missingValidationCommandCount: 0,
        queueStatusCounts: { alias_added: 1 },
      },
    ],
  };
  const contentCoverage = { bySubSurface: [] };
  const queueArtifact = { queues: { contentContractAliases: [{ legacyName: `${"v"}10_token`, status: "alias_added" }] } };

  const artifact = buildVersionedManualSurfaceClosure(makeRoot(), { remainingCoverage, contentCoverage, queueArtifact });
  const family = artifact.families.find((row) => row.id === "public_token_callback_contracts");

  assert.equal(family.coverageStatus, "coverage_proven");
  assert.ok(artifact.issues.some((issue) => issue.issue === "versioned_manual_surface_closure_missing_category"));
});

test("manual surface closure fails uncovered manual rows", () => {
  const remainingCoverage = {
    categories: [
      {
        id: "public_token_signed_link_external_action_contracts",
        uncoveredManualCount: 1,
        remainingSafeActionCount: 0,
        missingMetadataCount: 0,
        missingValidationCommandCount: 0,
        queueStatusCounts: {},
      },
    ],
  };
  const contentCoverage = { bySubSurface: [] };
  const queueArtifact = { queues: {} };

  const report = analyzeVersionedManualSurfaceClosure({
    root: makeRoot(),
    remainingCoverage,
    contentCoverage,
    queueArtifact,
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_manual_surface_closure_uncovered_manual_rows"));
});

test("local surface regression fails pending local safe actions", () => {
  const contentCoverage = {
    issues: [],
    bySubSurface: [
      {
        subSurfaceClass: "e2e_test_tag_or_fixture",
        owners: { "test-platform": 1 },
        contractCount: 1,
        hitCount: 1,
        manualOnlyContractCount: 0,
        uncoveredManualCount: 0,
        missingMetadataCount: 0,
        validationCommandCoveredCount: 1,
        remainingSafeActionCount: 1,
      },
    ],
  };
  const remainingCoverage = { issues: [], categories: [] };

  const artifact = buildVersionedLocalSurfaceRegression(makeRoot(), { contentCoverage, remainingCoverage });

  assert.equal(artifact.issueCount, 1);
  assert.equal(artifact.issues[0].issue, "versioned_local_surface_regression_pending_safe_actions");
});

test("local surface regression detects artifact drift", () => {
  const root = makeRoot();
  const contentCoverage = { issues: [], bySubSurface: [] };
  const remainingCoverage = { issues: [], categories: [] };
  writeJson(root, "artifacts/compatibility/versioned-local-surface-regression.json", { stale: true });

  const report = analyzeVersionedLocalSurfaceRegression({ root, contentCoverage, remainingCoverage });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_local_surface_regression_drift"));
});

test("open objective closure distinguishes retained and production-blocked objectives", () => {
  const detailed = { issues: [], objectives: [] };
  const manual = { issues: [], families: [] };
  const localSurface = { issues: [], groups: [] };
  const remaining = { issues: [] };
  const contentSurface = { issues: [] };
  const publicRuntimeReadiness = { issueCount: 0, issues: [], totals: { remainingSafeActionCount: 0, statusCounts: {} } };
  const packageReadiness = {
    aliasCount: PACKAGE_SCRIPT_ALIASES.length,
    readyForRemovalCount: 0,
    localReadyForRemovalCount: PACKAGE_SCRIPT_ALIASES.length,
    blockedAliasCount: PACKAGE_SCRIPT_ALIASES.length,
  };
  const queueArtifact = { queues: { packageScriptAliases: [{ legacyName: `check:${"v"}10-suite`, status: "alias_added" }] } };

  const artifact = buildVersionedOpenObjectiveClosure(makeRoot(), {
    detailed,
    manual,
    localSurface,
    remaining,
    contentSurface,
    publicRuntimeReadiness,
    packageReadiness,
    queueArtifact,
  });

  assert.equal(artifact.issueCount, 0);
  assert.equal(artifact.totals.statusCounts.retained_legacy_blocked, 1);
  assert.equal(artifact.totals.statusCounts.requires_production_or_external_cutover, 3);
});

test("open objective closure detects deterministic artifact drift", () => {
  const root = makeRoot();
  const detailed = { issues: [], objectives: [] };
  const manual = { issues: [], families: [] };
  const localSurface = { issues: [], groups: [] };
  const remaining = { issues: [] };
  const contentSurface = { issues: [] };
  const packageReadiness = {
    aliasCount: 0,
    readyForRemovalCount: 0,
    localReadyForRemovalCount: 0,
    blockedAliasCount: 0,
  };
  writeJson(root, "artifacts/compatibility/versioned-open-objective-closure.json", { stale: true });

  const report = analyzeVersionedOpenObjectiveClosure({
    root,
    detailed,
    manual,
    localSurface,
    remaining,
    contentSurface,
    packageReadiness,
    queueArtifact: { queues: {} },
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_open_objective_closure_drift"));
});

test("compatibility equivalence rejects package-script alias cycles", () => {
  const root = makeRoot();
  const legacyScript = `check:${"v"}10-suite`;
  const neutralScript = "check:release-suite-current";
  writeJson(root, "package.json", {
    scripts: {
      ...packageScripts(),
      [legacyScript]: `npm run ${neutralScript}`,
      [neutralScript]: `npm run ${legacyScript}`,
    },
  });
  writeJson(root, "artifacts/compatibility/versioned-exported-symbol-inventory.json", { symbols: [] });
  writeJson(root, "artifacts/telemetry/event-inventory.json", { eventCount: 0, versionedEventNameCount: 0, neutralAliasCount: 0, bridgeCount: 0 });
  writeJson(root, "artifacts/supabase/sql-object-rename-staging.json", { stagedRenames: [] });
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

  const report = analyzeVersionedCompatibilityEquivalence({ root, queueArtifact: { queues: {} } });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_compatibility_equivalence_package_neutral_delegates_to_legacy"));
});
