#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeSemgrepRulepackIntegrity } from "./check-semgrep-rulepack-integrity.mjs";
import { analyzeSeedVersionedNameQueueCoverage } from "./check-seed-versioned-name-queue-coverage.mjs";
import { analyzeVersionedLocalSurfaceRegression } from "./check-versioned-local-surface-regression.mjs";
import { analyzeVersionedPublicContractPreservation } from "./check-versioned-public-contract-preservation.mjs";
import { analyzeVersionedSourceConfigPreservation } from "./check-versioned-source-config-preservation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-additive-alias-preservation.json";

const DOM_ALIAS_TARGETS = [
  {
    id: "recoverable_state_selectors",
    owner: "frontend-platform",
    path: "src/components/ui/recoverable-state.tsx",
    validationCommand: "vitest run src/components/ui/recoverable-state.test.tsx",
    manualFollowUp: "Remove legacy data-v10-* attributes only after support tooling, tests, and analytics use neutral data-* attributes.",
    pairs: [
      ["data-v10-state", "data-state"],
      ["data-v10-surface", "data-surface"],
      ["data-v10-section", "data-section"],
      ["data-v10-action", "data-action"],
      ["data-v10-source-object", "data-source-object"],
      ["data-v10-diagnostic-id", "data-diagnostic-id"],
      ["data-v10-contract-ok", "data-contract-ok"],
      ["data-v10-focus-target", "data-focus-target"],
      ["data-v10-next-action-label", "data-next-action-label"],
      ["data-v10-contract-failures", "data-contract-failures"],
    ],
  },
  {
    id: "evidence_requirement_status_selector",
    owner: "frontend-platform",
    path: "src/components/contracts/contract-evidence-requirements-panel.tsx",
    validationCommand: "vitest run --config vitest.ui.config.ts src/components/contracts/contract-evidence-requirements-panel.ui.test.tsx",
    manualFollowUp: "Remove data-v9-evidence-req-status only after UI tests and external support selectors use data-evidence-req-status.",
    pairs: [["data-v9-evidence-req-status", "data-evidence-req-status"]],
  },
];

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function defaultSourceReports(root) {
  return {
    semgrepRulepackIntegrity: analyzeSemgrepRulepackIntegrity({ root, strict: true }),
    publicContractPreservation: analyzeVersionedPublicContractPreservation({ root }),
    sourceConfigPreservation: analyzeVersionedSourceConfigPreservation({ root }),
    localSurfaceRegression: analyzeVersionedLocalSurfaceRegression({ root }),
    seedQueueCoverage: analyzeSeedVersionedNameQueueCoverage({ root }),
  };
}

function dependentIssues(sources) {
  return [
    ["semgrep_rulepack_integrity", sources.semgrepRulepackIntegrity],
    ["versioned_public_contract_preservation", sources.publicContractPreservation],
    ["versioned_source_config_preservation", sources.sourceConfigPreservation],
    ["versioned_local_surface_regression", sources.localSurfaceRegression],
    ["seed_versioned_name_queue_coverage", sources.seedQueueCoverage],
  ].flatMap(([source, report]) => {
    const issues = report?.issues ?? [];
    const issueCount = Number(report?.issueCount ?? issues.length);
    if (issues.length === 0 && issueCount === 0) return [];
    return [
      issue("versioned_additive_alias_preservation_source_issues", {
        source,
        issueCount,
        sampleIssues: issues.slice(0, 5),
      }),
    ];
  });
}

function summarizeDomAlias(root, target) {
  const source = read(root, target.path);
  const issues = [];
  if (!source) {
    issues.push(issue("versioned_additive_alias_missing_source", { id: target.id, path: target.path }));
  }
  const pairs = target.pairs.map(([legacyName, neutralName]) => {
    const legacyPresent = source.includes(legacyName);
    const neutralPresent = source.includes(neutralName);
    if (!legacyPresent) {
      issues.push(issue("versioned_additive_alias_missing_legacy_selector", { id: target.id, path: target.path, legacyName }));
    }
    if (!neutralPresent) {
      issues.push(issue("versioned_additive_alias_missing_neutral_selector", { id: target.id, path: target.path, neutralName }));
    }
    return { legacyName, neutralName, legacyPresent, neutralPresent };
  });
  return {
    id: target.id,
    owner: target.owner,
    path: target.path,
    validationCommand: target.validationCommand,
    manualFollowUp: target.manualFollowUp,
    aliasPairCount: pairs.length,
    coveredAliasPairCount: pairs.filter((row) => row.legacyPresent && row.neutralPresent).length,
    pairs,
    issueCount: issues.length,
    issues,
  };
}

function summarizeSemgrep(report) {
  return {
    activeRulepackCount: report?.activeRulepacks?.length ?? 0,
    legacyRulepackCount: report?.legacyRulepacks?.length ?? 0,
    neutralRulepackActive: Boolean(report?.activeRulepacks?.includes("semgrep/oblixa-surface.yml")),
    legacyRulepacksRetained: (report?.missingLegacyRulepacks ?? []).length === 0,
    legacyRulepacksInactiveInCi: (report?.legacyStillActive ?? []).length === 0,
    versionedActiveRuleIdCount: report?.versionedActiveRuleIds?.length ?? 0,
    validationCommand: "npm run check:semgrep-rulepack-integrity",
    manualFollowUp: "Keep legacy Semgrep rulepacks until historical SARIF and suppressions no longer reference old rule IDs.",
  };
}

function migrationSql(root) {
  const migrationsDir = path.join(root, "supabase/migrations");
  if (!fs.existsSync(migrationsDir)) return "";
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => read(root, path.join("supabase/migrations", file)))
    .join("\n\n");
}

function summarizeSqlAlias(root) {
  const sql = migrationSql(root);
  const seed = read(root, "supabase/seed.sql");
  const viewPattern = /create\s+or\s+replace\s+view\s+public\.organization_settings\b/i;
  const securityInvokerPattern =
    /create\s+or\s+replace\s+view\s+public\.organization_settings[\s\S]{0,200}?with\s*\(\s*security_invoker\s*=\s*true\s*\)/i;
  const neutralProjectionPattern = /v6_org_settings_json\s+as\s+org_settings_json/i;
  const legacySourcePattern = /from\s+public\.organizations\b/i;
  const dropsLegacyColumn = /drop\s+column\s+(?:if\s+exists\s+)?v6_org_settings_json/i.test(sql);
  const legacySeedWritePresent = /\bv6_org_settings_json\b/i.test(seed);
  const neutralAliasAvailable =
    viewPattern.test(sql) &&
    securityInvokerPattern.test(sql) &&
    neutralProjectionPattern.test(sql) &&
    legacySourcePattern.test(sql) &&
    !dropsLegacyColumn;
  const issues = [];
  if (!viewPattern.test(sql)) {
    issues.push(issue("versioned_additive_alias_missing_sql_settings_view"));
  }
  if (!securityInvokerPattern.test(sql)) {
    issues.push(issue("versioned_additive_alias_missing_sql_security_invoker"));
  }
  if (!neutralProjectionPattern.test(sql)) {
    issues.push(issue("versioned_additive_alias_missing_sql_neutral_projection"));
  }
  if (!legacySourcePattern.test(sql)) {
    issues.push(issue("versioned_additive_alias_missing_sql_legacy_source"));
  }
  if (dropsLegacyColumn) {
    issues.push(issue("versioned_additive_alias_sql_drops_legacy_column"));
  }
  if (!legacySeedWritePresent) {
    issues.push(issue("versioned_additive_alias_missing_legacy_seed_write"));
  }
  return {
    id: "organization_settings_sql_alias",
    owner: "platform-data",
    legacyName: "public.organizations.v6_org_settings_json",
    neutralName: "public.organization_settings.org_settings_json",
    validationCommand: "npm run check:versioned-additive-alias-preservation",
    manualFollowUp:
      "Keep the legacy organizations column until a production migration and downstream consumers explicitly cut over to the neutral view.",
    neutralAliasAvailable,
    legacySeedWritePresent,
    legacyColumnDropped: dropsLegacyColumn,
    issueCount: issues.length,
    issues,
  };
}

export function buildVersionedAdditiveAliasPreservation(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSourceReports(root);
  const domAliases = DOM_ALIAS_TARGETS.map((target) => summarizeDomAlias(root, target));
  const semgrep = summarizeSemgrep(sources.semgrepRulepackIntegrity);
  const sqlAlias = summarizeSqlAlias(root);
  const issues = [
    ...dependentIssues(sources),
    ...domAliases.flatMap((row) => row.issues),
    ...sqlAlias.issues,
  ];
  if (!semgrep.neutralRulepackActive) {
    issues.push(issue("versioned_additive_alias_semgrep_neutral_pack_missing"));
  }
  if (!semgrep.legacyRulepacksRetained) {
    issues.push(issue("versioned_additive_alias_semgrep_legacy_pack_missing"));
  }
  if (!semgrep.legacyRulepacksInactiveInCi) {
    issues.push(issue("versioned_additive_alias_semgrep_legacy_pack_still_active"));
  }
  if (semgrep.versionedActiveRuleIdCount > 0) {
    issues.push(issue("versioned_additive_alias_semgrep_versioned_active_rule_ids", { count: semgrep.versionedActiveRuleIdCount }));
  }

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-additive-alias-preservation.mjs --write",
    policy:
      "Prove additive neutral aliases exist for code-owned remaining version-name surfaces while legacy selectors, rulepacks, and runtime contracts remain compatible.",
    sourceArtifacts: {
      versionedLocalSurfaceRegression: "artifacts/compatibility/versioned-local-surface-regression.json",
      seedVersionedNameQueueCoverage: "artifacts/supabase/seed-versioned-name-queue-coverage.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
    },
    semgrep,
    sqlAliases: [sqlAlias],
    domAliases,
    dependentCoverage: {
      publicContractPreservationOk: Boolean(sources.publicContractPreservation?.ok),
      sourceConfigPreservationOk: Boolean(sources.sourceConfigPreservation?.ok),
      localSurfaceRegressionOk: Boolean(sources.localSurfaceRegression?.ok),
      seedQueueCoverageOk: Boolean(sources.seedQueueCoverage?.ok),
    },
    totals: {
      domAliasTargetCount: domAliases.length,
      domAliasPairCount: domAliases.reduce((sum, row) => sum + row.aliasPairCount, 0),
      coveredDomAliasPairCount: domAliases.reduce((sum, row) => sum + row.coveredAliasPairCount, 0),
      sqlAliasTargetCount: 1,
      coveredSqlAliasTargetCount: sqlAlias.neutralAliasAvailable ? 1 : 0,
      issueCount: issues.length,
    },
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedAdditiveAliasPreservation(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedAdditiveAliasPreservation(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push(issue("versioned_additive_alias_preservation_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify({ ...current, issueCount: current.issues.length, issues: current.issues })) {
    issues.push(issue("versioned_additive_alias_preservation_drift", { path: artifactRel, hint: "Run npm run write:versioned-additive-alias-preservation" }));
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    domAliasPairCount: current.totals.domAliasPairCount,
    coveredDomAliasPairCount: current.totals.coveredDomAliasPairCount,
    sqlAliasTargetCount: current.totals.sqlAliasTargetCount,
    coveredSqlAliasTargetCount: current.totals.coveredSqlAliasTargetCount,
    semgrepNeutralRulepackActive: current.semgrep.neutralRulepackActive,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runVersionedAdditiveAliasPreservation(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedAdditiveAliasPreservation(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(JSON.stringify({
      ok: artifact.issueCount === 0,
      wrote: options.artifactRel,
      domAliasPairCount: artifact.totals.domAliasPairCount,
      coveredDomAliasPairCount: artifact.totals.coveredDomAliasPairCount,
      sqlAliasTargetCount: artifact.totals.sqlAliasTargetCount,
      coveredSqlAliasTargetCount: artifact.totals.coveredSqlAliasTargetCount,
      issueCount: artifact.issueCount,
    }, null, 2));
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }
  const report = analyzeVersionedAdditiveAliasPreservation(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedAdditiveAliasPreservation();
}
