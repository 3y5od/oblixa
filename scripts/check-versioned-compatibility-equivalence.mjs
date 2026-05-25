#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ENV_KEY_ALIASES,
  EXPORTED_SYMBOL_ALIASES,
  PACKAGE_SCRIPT_ALIASES,
  buildCompatibilityRemovalQueue,
} from "./check-compatibility-removal-queue.mjs";
import { analyzeVersionReferenceAllowlist } from "./check-version-reference-allowlist.mjs";
import { buildVersionedExportedSymbolAliasPlan } from "./check-versioned-exported-symbol-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

const REQUIRED_QUEUE_METADATA = [
  "owner",
  "reason",
  "status",
  "validationCommand",
  "earliestRemovalCondition",
  "manualFollowUp",
];
const LEGACY_ORG_SETTINGS_COLUMN = ["v", "6_org_settings_json"].join("");

function readJson(root, rel, fallback = null) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function readText(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function queueRows(queueArtifact, queueName) {
  const rows = queueArtifact?.queues?.[queueName];
  return Array.isArray(rows) ? rows : [];
}

function findQueueRow(queueArtifact, queueName, legacyName, neutralAlias) {
  return queueRows(queueArtifact, queueName).find(
    (row) => row.legacyName === legacyName && (neutralAlias == null || row.neutralAlias === neutralAlias),
  );
}

function validateQueueMetadata(row, queueName, legacyName) {
  const issues = [];
  if (!row) {
    issues.push({ issue: "versioned_compatibility_equivalence_missing_queue_row", queueName, legacyName });
    return issues;
  }
  for (const key of REQUIRED_QUEUE_METADATA) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "versioned_compatibility_equivalence_missing_queue_metadata", queueName, legacyName, key });
    }
  }
  if (typeof row.neutralAlias !== "string" || row.neutralAlias.trim() === "") {
    issues.push({ issue: "versioned_compatibility_equivalence_missing_neutral_alias", queueName, legacyName });
  }
  return issues;
}

function validatePackageScripts(root, queueArtifact) {
  const pkg = readJson(root, "package.json", { scripts: {} });
  const scripts = pkg.scripts ?? {};
  const issues = [];
  const rows = [];

  for (const alias of PACKAGE_SCRIPT_ALIASES) {
    const legacyCommand = scripts[alias.legacy] ?? null;
    const neutralCommand = scripts[alias.neutral] ?? null;
    const queueRow = findQueueRow(queueArtifact, "packageScriptAliases", alias.legacy, alias.neutral);
    issues.push(...validateQueueMetadata(queueRow, "packageScriptAliases", alias.legacy));
    if (legacyCommand !== `npm run ${alias.neutral}`) {
      issues.push({
        issue: "versioned_compatibility_equivalence_package_legacy_not_neutral_bridge",
        legacyName: alias.legacy,
        neutralAlias: alias.neutral,
        actualCommand: legacyCommand,
      });
    }
    if (neutralCommand === `npm run ${alias.legacy}`) {
      issues.push({
        issue: "versioned_compatibility_equivalence_package_neutral_delegates_to_legacy",
        legacyName: alias.legacy,
        neutralAlias: alias.neutral,
      });
    }
    rows.push({
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      legacyCommand,
      neutralCommand,
      queueCovered: Boolean(queueRow),
      equivalence: legacyCommand === `npm run ${alias.neutral}` && neutralCommand !== `npm run ${alias.legacy}`,
    });
  }

  return { rows, issues };
}

function validateExportedSymbols(root, queueArtifact) {
  const inventory = readJson(root, "artifacts/compatibility/versioned-exported-symbol-inventory.json", { symbols: [] });
  const plan = buildVersionedExportedSymbolAliasPlan(root);
  const inventoryByPair = new Map(
    (inventory.symbols ?? []).map((row) => [`${row.exportedName}\0${row.suggestedNeutralName}`, row]),
  );
  const issues = [];
  const rows = [];

  if ((plan.pendingAliasCount ?? 0) > 0 || (plan.blockedAliasCount ?? 0) > 0) {
    issues.push({
      issue: "versioned_compatibility_equivalence_export_alias_work_pending",
      pendingAliasCount: plan.pendingAliasCount ?? 0,
      blockedAliasCount: plan.blockedAliasCount ?? 0,
    });
  }

  for (const alias of EXPORTED_SYMBOL_ALIASES) {
    const queueRow = findQueueRow(queueArtifact, "exportedSymbolAliases", alias.legacy, alias.neutral);
    const inventoryRow = inventoryByPair.get(`${alias.legacy}\0${alias.neutral}`);
    const anyInventoryRow = (inventory.symbols ?? []).find((row) => row.exportedName === alias.legacy && row.neutralExportPresent === true);
    const sourceHasConfiguredNeutral =
      anyInventoryRow?.path && fs.existsSync(path.join(root, anyInventoryRow.path))
        ? fs.readFileSync(path.join(root, anyInventoryRow.path), "utf8").includes(alias.neutral)
        : false;
    issues.push(...validateQueueMetadata(queueRow, "exportedSymbolAliases", alias.legacy));
    if ((!inventoryRow || inventoryRow.neutralExportPresent !== true) && !sourceHasConfiguredNeutral) {
      issues.push({
        issue: "versioned_compatibility_equivalence_export_neutral_alias_missing",
        legacyName: alias.legacy,
        neutralAlias: alias.neutral,
      });
    }
    rows.push({
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      queueCovered: Boolean(queueRow),
      neutralExportPresent: Boolean(inventoryRow?.neutralExportPresent || sourceHasConfiguredNeutral),
      validationMode: "static_export_alias",
    });
  }

  const unqueuedAliasAdded = (inventory.symbols ?? [])
    .filter((row) => row.compatibilityAction === "alias_added")
    .filter((row) => !findQueueRow(queueArtifact, "exportedSymbolAliases", row.exportedName, row.suggestedNeutralName));
  for (const row of unqueuedAliasAdded) {
    issues.push({
      issue: "versioned_compatibility_equivalence_export_alias_unqueued",
      legacyName: row.exportedName,
      neutralAlias: row.suggestedNeutralName,
      path: row.path,
    });
  }

  return { rows, issues, totalAliasAddedCount: (inventory.symbols ?? []).filter((row) => row.compatibilityAction === "alias_added").length };
}

function validateTelemetry(queueArtifact, root) {
  const telemetry = readJson(root, "artifacts/telemetry/event-inventory.json", { versionedNameExceptions: [], neutralAliasCount: 0 });
  const queueRowsForTelemetry = queueRows(queueArtifact, "telemetryEventNames");
  const issues = [];
  if ((telemetry.versionedEventNameCount ?? 0) !== queueRowsForTelemetry.length) {
    issues.push({
      issue: "versioned_compatibility_equivalence_telemetry_queue_count_mismatch",
      versionedEventNameCount: telemetry.versionedEventNameCount ?? 0,
      queueCount: queueRowsForTelemetry.length,
    });
  }
  if ((telemetry.neutralAliasCount ?? 0) < (telemetry.versionedEventNameCount ?? 0)) {
    issues.push({
      issue: "versioned_compatibility_equivalence_telemetry_neutral_alias_missing",
      versionedEventNameCount: telemetry.versionedEventNameCount ?? 0,
      neutralAliasCount: telemetry.neutralAliasCount ?? 0,
    });
  }
  for (const row of queueRowsForTelemetry) {
    issues.push(...validateQueueMetadata(row, "telemetryEventNames", row.legacyName));
  }
  return {
    eventCount: telemetry.eventCount ?? 0,
    versionedEventNameCount: telemetry.versionedEventNameCount ?? 0,
    neutralAliasCount: telemetry.neutralAliasCount ?? 0,
    bridgeCount: telemetry.bridgeCount ?? 0,
    queueCount: queueRowsForTelemetry.length,
    issues,
  };
}

function validateEnvAliases(queueArtifact) {
  const issues = [];
  const rows = [];
  for (const alias of ENV_KEY_ALIASES) {
    const row = findQueueRow(queueArtifact, "environmentKeys", alias.legacy, alias.neutral);
    issues.push(...validateQueueMetadata(row, "environmentKeys", alias.legacy));
    rows.push({
      legacyName: alias.legacy,
      neutralAlias: alias.neutral,
      queueCovered: Boolean(row),
      precedence: "neutral_first_legacy_second",
      validationCommand: alias.validationCommand,
    });
  }
  return { rows, issues };
}

function validateRouteSqlStaging(queueArtifact, root) {
  const issues = [];
  const apiRows = queueRows(queueArtifact, "apiRoutes");
  const cronRows = queueRows(queueArtifact, "cronRoutes");
  const sqlRows = queueRows(queueArtifact, "sqlObjects");
  const staging = readJson(root, "artifacts/supabase/sql-object-rename-staging.json", { stagedRenames: [] });

  for (const [queueName, rows] of [
    ["apiRoutes", apiRows],
    ["cronRoutes", cronRows],
    ["sqlObjects", sqlRows],
  ]) {
    for (const row of rows) issues.push(...validateQueueMetadata(row, queueName, row.legacyName));
  }
  if (sqlRows.length !== (staging.stagedRenames ?? []).length) {
    issues.push({
      issue: "versioned_compatibility_equivalence_sql_staging_queue_count_mismatch",
      sqlQueueCount: sqlRows.length,
      stagedRenameCount: (staging.stagedRenames ?? []).length,
    });
  }

  return {
    apiRouteAliasCount: apiRows.length,
    cronRouteAliasCount: cronRows.length,
    sqlObjectAliasCount: sqlRows.length,
    stagedSqlRenameCount: (staging.stagedRenames ?? []).length,
    issues,
  };
}

function validateLegitimateVersionPreservation(root) {
  const allowlist = analyzeVersionReferenceAllowlist({ root });
  return {
    ok: allowlist.ok,
    entryCount: allowlist.entryCount,
    issues: allowlist.issues.map((issue) => ({
      ...issue,
      issue: `versioned_compatibility_equivalence_${issue.issue}`,
    })),
  };
}

export function validateOrgSettingsRuntimeAlias(root = DEFAULT_ROOT) {
  const helperPath = "src/lib/assurance/org-settings.ts";
  const pagePath = "src/app/(dashboard)/assurance/autopilot/page.tsx";
  const componentPath = "src/components/assurance/org-settings-panel.tsx";
  const helper = readText(root, helperPath);
  const page = readText(root, pagePath);
  const component = readText(root, componentPath);
  const issues = [];

  const compatibilityViewTypePresent =
    /export\s+type\s+OrganizationSettingsCompatibilityViewRow\s*=/.test(helper);
  const storageRowTypePresent = /export\s+type\s+OrgSettingsStorageRow\s*=/.test(helper);
  const neutralFirstReaderPattern = new RegExp(
    `Object\\.prototype\\.hasOwnProperty\\.call\\(row,\\s*"org_settings_json"\\)[\\s\\S]{0,180}return\\s+row\\.org_settings_json[\\s\\S]{0,180}return\\s+row\\.${LEGACY_ORG_SETTINGS_COLUMN}`,
  );
  const neutralFirstReader =
    neutralFirstReaderPattern.test(helper);
  const neutralComponentExportPresent = /export\s+function\s+OrgSettingsPanel\b/.test(component);
  const legacyComponentAliasPresent =
    /export\s+const\s+OrgV6SettingsPanel\s*=\s*OrgSettingsPanel\b/.test(component);
  const pageUsesNeutralComponent = /\bOrgSettingsPanel\b/.test(page) && !/\bOrgV6SettingsPanel\b/.test(page);
  const pageUsesNeutralReader = /readOrgSettingsJsonFromRow\s*\(\s*orgRow\s*\)/.test(page);
  const pageDirectLegacyRead = new RegExp(`orgRow\\??\\.\\s*${LEGACY_ORG_SETTINGS_COLUMN}`).test(page);

  if (!compatibilityViewTypePresent) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_missing_view_row_type",
      path: helperPath,
    });
  }
  if (!storageRowTypePresent) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_missing_storage_row_type",
      path: helperPath,
    });
  }
  if (!neutralFirstReader) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_reader_not_neutral_first",
      path: helperPath,
    });
  }
  if (!neutralComponentExportPresent) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_neutral_component_missing",
      path: componentPath,
    });
  }
  if (!legacyComponentAliasPresent) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_legacy_component_alias_missing",
      path: componentPath,
    });
  }
  if (!pageUsesNeutralComponent) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_page_uses_legacy_component",
      path: pagePath,
    });
  }
  if (!pageUsesNeutralReader || pageDirectLegacyRead) {
    issues.push({
      issue: "versioned_compatibility_equivalence_org_settings_page_direct_legacy_read",
      path: pagePath,
      pageUsesNeutralReader,
      pageDirectLegacyRead,
    });
  }

  return {
    helperPath,
    pagePath,
    componentPath,
    compatibilityViewTypePresent,
    storageRowTypePresent,
    neutralFirstReader,
    neutralComponentExportPresent,
    legacyComponentAliasPresent,
    pageUsesNeutralComponent,
    pageUsesNeutralReader,
    pageDirectLegacyRead,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedCompatibilityEquivalence(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const queueArtifact = options.queueArtifact ?? buildCompatibilityRemovalQueue(root);
  const packageScripts = validatePackageScripts(root, queueArtifact);
  const exportedSymbols = validateExportedSymbols(root, queueArtifact);
  const telemetry = validateTelemetry(queueArtifact, root);
  const envAliases = validateEnvAliases(queueArtifact);
  const routeSql = validateRouteSqlStaging(queueArtifact, root);
  const legitimateVersions = validateLegitimateVersionPreservation(root);
  const orgSettingsRuntimeAlias = validateOrgSettingsRuntimeAlias(root);
  const issues = [
    ...packageScripts.issues,
    ...exportedSymbols.issues,
    ...telemetry.issues,
    ...envAliases.issues,
    ...routeSql.issues,
    ...legitimateVersions.issues,
    ...orgSettingsRuntimeAlias.issues,
  ];

  return {
    ok: issues.length === 0,
    packageScripts: {
      aliasCount: packageScripts.rows.length,
      equivalentAliasCount: packageScripts.rows.filter((row) => row.equivalence).length,
      aliases: packageScripts.rows,
    },
    exportedSymbols: {
      configuredAliasCount: exportedSymbols.rows.length,
      aliasAddedCount: exportedSymbols.totalAliasAddedCount,
      checkedAliases: exportedSymbols.rows,
    },
    telemetry,
    envAliases: {
      aliasCount: envAliases.rows.length,
      aliases: envAliases.rows,
    },
    routeSql,
    legitimateVersions: {
      ok: legitimateVersions.ok,
      entryCount: legitimateVersions.entryCount,
    },
    orgSettingsRuntimeAlias,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

export function runVersionedCompatibilityEquivalence(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeVersionedCompatibilityEquivalence(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedCompatibilityEquivalence();
}
