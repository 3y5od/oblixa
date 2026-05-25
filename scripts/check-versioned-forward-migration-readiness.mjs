#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { analyzeCompatibilityRemovalQueue } from "./check-compatibility-removal-queue.mjs";
import { analyzeSqlObjectRenameStaging } from "./check-sql-object-rename-staging.mjs";
import { analyzeSqlPolicyAliasReadiness } from "./check-sql-policy-alias-readiness.mjs";
import { analyzeSqlPolicyForwardMigrationBlueprint } from "./check-sql-policy-forward-migration-blueprint.mjs";
import { analyzeSqlPolicyPredicateEquivalence } from "./check-sql-policy-predicate-equivalence.mjs";
import {
  analyzeSqlRenameVerificationSql,
  buildSqlRenameVerificationSql,
} from "./check-sql-rename-verification-sql.mjs";
import { analyzeSqlSecurityAutomationCoverage } from "./check-sql-security-automation-coverage.mjs";
import { analyzeVersionedPublicRuntimeDualRead } from "./check-versioned-public-runtime-dual-read.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-forward-migration-readiness.json";

const MIGRATION_MANIFEST_REL = "artifacts/supabase/migration-manifest.json";
const MIGRATION_DOMAIN_INDEX_REL = "artifacts/supabase/migration-domain-index.json";
const LOCAL_CATALOG_FINGERPRINT_REL = "artifacts/supabase/local-catalog-fingerprint.json";

const READINESS_STATUSES = new Set(["alias_added", "requires_forward_migration"]);
const BLOCKER_CLASSES = new Set([
  "none",
  "data_bearing_table_view_or_backfill",
  "policy_alias_requires_predicate_equivalence",
  "neutral_target_is_view_requires_policy_migration",
  "linked_verification_required",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
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

function sortedObject(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function defaultSources(root) {
  return {
    sqlObjectRenameStaging: analyzeSqlObjectRenameStaging({ root }),
    sqlRenameVerificationSql: analyzeSqlRenameVerificationSql({ root }),
    sqlRenameVerificationSqlCurrent: buildSqlRenameVerificationSql(root),
    sqlSecurityAutomationCoverage: analyzeSqlSecurityAutomationCoverage({ root }),
    sqlPolicyAliasReadiness: analyzeSqlPolicyAliasReadiness({ root }),
    sqlPolicyPredicateEquivalence: analyzeSqlPolicyPredicateEquivalence({ root }),
    sqlPolicyForwardMigrationBlueprint: analyzeSqlPolicyForwardMigrationBlueprint({ root }),
    compatibilityRemovalQueue: analyzeCompatibilityRemovalQueue({ root }),
    versionedPublicRuntimeDualRead: analyzeVersionedPublicRuntimeDualRead({ root }),
    migrationManifest: readJson(root, MIGRATION_MANIFEST_REL, null),
    migrationDomainIndex: readJson(root, MIGRATION_DOMAIN_INDEX_REL, null),
    localCatalogFingerprint: readJson(root, LOCAL_CATALOG_FINGERPRINT_REL, null),
  };
}

function reportIssueCount(report) {
  return Number(report?.issueCount ?? report?.issues?.length ?? 0);
}

function sourceIssueSummaries(sources) {
  return [
    ["sql_object_rename_staging", sources.sqlObjectRenameStaging],
    ["sql_rename_verification_sql", sources.sqlRenameVerificationSql],
    ["sql_security_automation_coverage", sources.sqlSecurityAutomationCoverage],
    ["sql_policy_alias_readiness", sources.sqlPolicyAliasReadiness],
    ["sql_policy_predicate_equivalence", sources.sqlPolicyPredicateEquivalence],
    ["sql_policy_forward_migration_blueprint", sources.sqlPolicyForwardMigrationBlueprint],
    ["compatibility_removal_queue", sources.compatibilityRemovalQueue],
    ["versioned_public_runtime_dual_read", sources.versionedPublicRuntimeDualRead],
  ].flatMap(([source, report]) => {
    const issueCount = reportIssueCount(report);
    if (issueCount === 0) return [];
    return [
      issue("versioned_forward_migration_readiness_source_issues", {
        source,
        issueCount,
        sampleIssues: (report?.issues ?? []).slice(0, 5),
      }),
    ];
  });
}

function stagedRows(sources) {
  return sources.sqlObjectRenameStaging?.current?.stagedRenames ?? sources.sqlObjectRenameStaging?.stagedRenames ?? [];
}

function queueRows(sources) {
  const queues = sources.compatibilityRemovalQueue?.current?.queues ?? sources.compatibilityRemovalQueue?.queues ?? {};
  return Array.isArray(queues.sqlObjects) ? queues.sqlObjects : [];
}

function verificationRows(sources) {
  return (
    sources.sqlRenameVerificationSqlCurrent?.statements ??
    sources.sqlRenameVerificationSql?.current?.statements ??
    sources.sqlRenameVerificationSql?.statements ??
    []
  );
}

function policyReadinessRows(sources) {
  return sources.sqlPolicyAliasReadiness?.current?.rows ?? sources.sqlPolicyAliasReadiness?.rows ?? [];
}

function policyPredicateEquivalenceRows(sources) {
  return sources.sqlPolicyPredicateEquivalence?.current?.rows ?? sources.sqlPolicyPredicateEquivalence?.rows ?? [];
}

function policyForwardMigrationBlueprintRows(sources) {
  return sources.sqlPolicyForwardMigrationBlueprint?.current?.rows ?? sources.sqlPolicyForwardMigrationBlueprint?.rows ?? [];
}

function policyReadinessEntryFor(row, rows) {
  return rows.find((entry) => entry.legacyPolicy === row.legacyObject && entry.neutralPolicy === row.newObject);
}

function policyPredicateEquivalenceEntryFor(row, rows) {
  return rows.find((entry) => entry.legacyPolicy === row.legacyObject && entry.neutralPolicy === row.newObject);
}

function policyForwardMigrationBlueprintEntryFor(row, rows) {
  return rows.find((entry) => entry.legacyPolicy === row.legacyObject && entry.neutralPolicy === row.newObject);
}

function expectedBlockerClass(row, sources) {
  if (row.status === "alias_added") return "none";
  if (row.objectType === "policy") {
    return policyReadinessEntryFor(row, policyReadinessRows(sources))?.blockerClass ?? "policy_alias_requires_predicate_equivalence";
  }
  if (row.objectType === "table" || row.objectType === "view" || row.dataBearing) return "data_bearing_table_view_or_backfill";
  return "linked_verification_required";
}

function queueEntryFor(row, rows) {
  return rows.find(
    (entry) =>
      entry.legacyName === row.legacyObject &&
      (entry.neutralAlias === row.newObject || entry.neutralName === row.newObject || entry.neutralObject === row.newObject),
  );
}

function verificationEntryFor(row, rows) {
  return rows.find((entry) => entry.legacyObject === row.legacyObject && entry.neutralObject === row.newObject);
}

function migrationRegistrationEvidence(sources) {
  const manifest = sources.migrationManifest;
  const domainIndex = sources.migrationDomainIndex;
  const fingerprint = sources.localCatalogFingerprint;
  const issues = [];

  if (!manifest) issues.push(issue("versioned_forward_migration_readiness_missing_migration_manifest", { path: MIGRATION_MANIFEST_REL }));
  if (!domainIndex) issues.push(issue("versioned_forward_migration_readiness_missing_migration_domain_index", { path: MIGRATION_DOMAIN_INDEX_REL }));
  if (!fingerprint) issues.push(issue("versioned_forward_migration_readiness_missing_catalog_fingerprint", { path: LOCAL_CATALOG_FINGERPRINT_REL }));

  const latestManifestMigration = manifest?.migrations?.at?.(-1) ?? null;
  const latestManifestFile = latestManifestMigration?.file ?? null;
  const latestVersion = manifest?.latestVersion ?? latestManifestMigration?.version ?? null;
  const domainHasLatest =
    Boolean(latestManifestFile) &&
    (domainIndex?.migrations ?? []).some((row) => row.file === latestManifestFile) &&
    (domainIndex?.groups ?? []).some((group) => Array.isArray(group.files) && group.files.includes(latestManifestFile));
  const fingerprintHasLatest = Boolean(latestManifestFile) && fingerprint?.latestMigration === latestManifestFile;
  const countsMatch =
    manifest &&
    domainIndex &&
    fingerprint &&
    Number(manifest.migrationCount) === Number(domainIndex.migrationCount) &&
    Number(manifest.migrationCount) === Number(fingerprint.migrationCount);

  if (manifest && domainIndex && manifest.latestVersion !== domainIndex.latestVersion) {
    issues.push(
      issue("versioned_forward_migration_readiness_migration_latest_version_mismatch", {
        manifestLatestVersion: manifest.latestVersion,
        domainLatestVersion: domainIndex.latestVersion,
      }),
    );
  }
  if (latestManifestFile && !domainHasLatest) {
    issues.push(
      issue("versioned_forward_migration_readiness_latest_migration_missing_domain_registration", {
        latestMigration: latestManifestFile,
      }),
    );
  }
  if (latestManifestFile && !fingerprintHasLatest) {
    issues.push(
      issue("versioned_forward_migration_readiness_latest_migration_missing_fingerprint_registration", {
        latestMigration: latestManifestFile,
        fingerprintLatestMigration: fingerprint?.latestMigration ?? null,
      }),
    );
  }
  if (manifest && domainIndex && fingerprint && !countsMatch) {
    issues.push(
      issue("versioned_forward_migration_readiness_migration_count_mismatch", {
        manifestCount: manifest.migrationCount,
        domainIndexCount: domainIndex.migrationCount,
        fingerprintCount: fingerprint.migrationCount,
      }),
    );
  }

  return {
    sourceArtifacts: {
      migrationManifest: MIGRATION_MANIFEST_REL,
      migrationDomainIndex: MIGRATION_DOMAIN_INDEX_REL,
      localCatalogFingerprint: LOCAL_CATALOG_FINGERPRINT_REL,
    },
    latestVersion,
    latestMigration: latestManifestFile,
    manifestMigrationCount: Number(manifest?.migrationCount ?? 0),
    domainIndexMigrationCount: Number(domainIndex?.migrationCount ?? 0),
    fingerprintMigrationCount: Number(fingerprint?.migrationCount ?? 0),
    domainHasLatest,
    fingerprintHasLatest,
    countsMatch: Boolean(countsMatch),
    issueCount: issues.length,
    issues,
  };
}

function buildReadinessRow(row, sources) {
  const queueEntry = queueEntryFor(row, queueRows(sources));
  const verificationEntry = verificationEntryFor(row, verificationRows(sources));
  const policyReadinessEntry = row.objectType === "policy" ? policyReadinessEntryFor(row, policyReadinessRows(sources)) : null;
  const policyPredicateEquivalenceEntry =
    row.objectType === "policy" ? policyPredicateEquivalenceEntryFor(row, policyPredicateEquivalenceRows(sources)) : null;
  const policyForwardMigrationBlueprintEntry =
    row.objectType === "policy" ? policyForwardMigrationBlueprintEntryFor(row, policyForwardMigrationBlueprintRows(sources)) : null;
  const readinessStatus = row.status === "alias_added" ? "alias_added" : "requires_forward_migration";
  const blockerClass = expectedBlockerClass(row, sources);

  return {
    legacyObject: row.legacyObject,
    neutralObject: row.newObject,
    objectType: row.objectType,
    dataBearing: Boolean(row.dataBearing),
    owner: row.owner,
    reason: row.reason,
    readinessStatus,
    blockerClass,
    statusFromStaging: row.status,
    validationCommand: row.validationCommand,
    validationSql: row.validationSql,
    cutoverStrategy: row.cutoverStrategy,
    earliestRemovalCondition: row.earliestRemovalCondition,
    manualFollowUp: row.manualFollowUp,
    queueCovered: Boolean(queueEntry),
    queueStatus: queueEntry?.status ?? null,
    queueValidationCommand: queueEntry?.validationCommand ?? null,
    verificationSqlCovered: Boolean(verificationEntry),
    verificationSql: verificationEntry?.validationSql ?? null,
    policyAliasReadinessCovered: row.objectType === "policy" ? Boolean(policyReadinessEntry) : null,
    policyAliasStatus: policyReadinessEntry?.status ?? null,
    policyAliasBlockerClass: policyReadinessEntry?.blockerClass ?? null,
    neutralTableViewAliasCovered: policyReadinessEntry?.neutralTableViewAliasCovered ?? null,
    legacyPolicyDefined: policyReadinessEntry?.legacyPolicyDefined ?? null,
    policyPredicateEquivalenceCovered: row.objectType === "policy" ? Boolean(policyPredicateEquivalenceEntry) : null,
    policyPredicateEquivalenceStatus: policyPredicateEquivalenceEntry?.status ?? null,
    policyPredicateEquivalenceKind: policyPredicateEquivalenceEntry?.linkedVerificationKind ?? null,
    policyPredicateEquivalenceAuthContextRequired: policyPredicateEquivalenceEntry?.authContextRequired ?? null,
    policyForwardMigrationBlueprintCovered: row.objectType === "policy" ? Boolean(policyForwardMigrationBlueprintEntry) : null,
    policyForwardMigrationBlueprintStatus: policyForwardMigrationBlueprintEntry?.status ?? null,
    policyForwardMigrationBlueprintFutureTargetRequirement: policyForwardMigrationBlueprintEntry?.futureTargetRequirement ?? null,
    policyForwardMigrationBlueprintLinkedVerificationContext:
      policyForwardMigrationBlueprintEntry?.requiredPredicateEquivalenceLinkedContext ?? null,
    aliasEvidencePresent: readinessStatus === "alias_added" && Boolean(verificationEntry) && row.validationCommand === "npm run check:sql-rename-verification-sql",
  };
}

function validateReadinessRow(row) {
  const issues = [];
  for (const key of [
    "legacyObject",
    "neutralObject",
    "objectType",
    "owner",
    "reason",
    "readinessStatus",
    "blockerClass",
    "validationCommand",
    "validationSql",
    "cutoverStrategy",
    "earliestRemovalCondition",
    "manualFollowUp",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push(issue("versioned_forward_migration_readiness_missing_metadata", { legacyObject: row.legacyObject ?? null, key }));
    }
  }
  if (!READINESS_STATUSES.has(row.readinessStatus)) {
    issues.push(
      issue("versioned_forward_migration_readiness_unknown_status", {
        legacyObject: row.legacyObject,
        readinessStatus: row.readinessStatus,
      }),
    );
  }
  if (!BLOCKER_CLASSES.has(row.blockerClass)) {
    issues.push(
      issue("versioned_forward_migration_readiness_unknown_blocker_class", {
        legacyObject: row.legacyObject,
        blockerClass: row.blockerClass,
      }),
    );
  }
  if (!row.queueCovered) {
    issues.push(issue("versioned_forward_migration_readiness_missing_queue_coverage", { legacyObject: row.legacyObject }));
  }
  if (!row.verificationSqlCovered) {
    issues.push(issue("versioned_forward_migration_readiness_missing_verification_sql", { legacyObject: row.legacyObject }));
  }
  if (row.objectType === "policy" && !row.policyAliasReadinessCovered) {
    issues.push(issue("versioned_forward_migration_readiness_missing_policy_alias_readiness", { legacyObject: row.legacyObject }));
  }
  if (row.objectType === "policy" && !row.policyPredicateEquivalenceCovered) {
    issues.push(issue("versioned_forward_migration_readiness_missing_policy_predicate_equivalence", { legacyObject: row.legacyObject }));
  }
  if (row.objectType === "policy" && !row.policyForwardMigrationBlueprintCovered) {
    issues.push(issue("versioned_forward_migration_readiness_missing_policy_forward_migration_blueprint", { legacyObject: row.legacyObject }));
  }
  if (row.readinessStatus === "alias_added" && !row.aliasEvidencePresent) {
    issues.push(issue("versioned_forward_migration_readiness_alias_marked_complete_without_evidence", { legacyObject: row.legacyObject }));
  }
  if (row.readinessStatus === "requires_forward_migration" && row.blockerClass === "none") {
    issues.push(issue("versioned_forward_migration_readiness_forward_row_missing_blocker", { legacyObject: row.legacyObject }));
  }
  return issues;
}

export function buildVersionedForwardMigrationReadiness(root = DEFAULT_ROOT, options = {}) {
  const sources = options.sources ?? defaultSources(root);
  const registration = migrationRegistrationEvidence(sources);
  const rows = stagedRows(sources)
    .map((row) => buildReadinessRow(row, sources))
    .sort((a, b) => a.objectType.localeCompare(b.objectType) || a.legacyObject.localeCompare(b.legacyObject));

  const statusCounts = {};
  const blockerClassCounts = {};
  const objectTypeCounts = {};
  for (const row of rows) {
    statusCounts[row.readinessStatus] = (statusCounts[row.readinessStatus] ?? 0) + 1;
    blockerClassCounts[row.blockerClass] = (blockerClassCounts[row.blockerClass] ?? 0) + 1;
    objectTypeCounts[row.objectType] = (objectTypeCounts[row.objectType] ?? 0) + 1;
  }

  const issues = [
    ...sourceIssueSummaries(sources),
    ...registration.issues,
    ...rows.flatMap(validateReadinessRow),
  ];

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-versioned-forward-migration-readiness.mjs --write",
    policy:
      "Classify remaining SQL staged rename rows by forward-migration readiness using SQL staging, verification SQL, security coverage, compatibility queues, migration registration, and public runtime readiness. Checklist docs are not configuration.",
    sourceArtifacts: {
      sqlObjectRenameStaging: "artifacts/supabase/sql-object-rename-staging.json",
      sqlRenameVerificationSql: "artifacts/supabase/sql-rename-verification-sql.json",
      sqlSecurityAutomationCoverage: "artifacts/supabase/sql-security-automation-coverage.json",
      sqlPolicyAliasReadiness: "artifacts/supabase/sql-policy-alias-readiness.json",
      sqlPolicyPredicateEquivalence: "artifacts/supabase/sql-policy-predicate-equivalence.json",
      sqlPolicyForwardMigrationBlueprint: "artifacts/supabase/sql-policy-forward-migration-blueprint.json",
      compatibilityRemovalQueue: "artifacts/compatibility/removal-queue.json",
      versionedPublicRuntimeDualRead: "artifacts/compatibility/versioned-public-runtime-dual-read.json",
      ...registration.sourceArtifacts,
    },
    migrationRegistration: {
      latestVersion: registration.latestVersion,
      latestMigration: registration.latestMigration,
      manifestMigrationCount: registration.manifestMigrationCount,
      domainIndexMigrationCount: registration.domainIndexMigrationCount,
      fingerprintMigrationCount: registration.fingerprintMigrationCount,
      domainHasLatest: registration.domainHasLatest,
      fingerprintHasLatest: registration.fingerprintHasLatest,
      countsMatch: registration.countsMatch,
      issueCount: registration.issueCount,
    },
    totals: {
      rowCount: rows.length,
      statusCounts: sortedObject(statusCounts),
      blockerClassCounts: sortedObject(blockerClassCounts),
      objectTypeCounts: sortedObject(objectTypeCounts),
      aliasAddedCount: statusCounts.alias_added ?? 0,
      requiresForwardMigrationCount: statusCounts.requires_forward_migration ?? 0,
      queueCoveredCount: rows.filter((row) => row.queueCovered).length,
      verificationSqlCoveredCount: rows.filter((row) => row.verificationSqlCovered).length,
      policyAliasReadinessCoveredCount: rows.filter((row) => row.policyAliasReadinessCovered).length,
      policyPredicateEquivalenceCoveredCount: rows.filter((row) => row.policyPredicateEquivalenceCovered).length,
      policyForwardMigrationBlueprintCoveredCount: rows.filter((row) => row.policyForwardMigrationBlueprintCovered).length,
      sourceIssueCount: sourceIssueSummaries(sources).length,
      issueCount: issues.length,
    },
    rows,
    issueCount: issues.length,
    issues,
  };
}

export function analyzeVersionedForwardMigrationReadiness(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedForwardMigrationReadiness(root, options);
  const issues = [...current.issues];
  const artifact = readJson(root, artifactRel, null);
  if (!artifact) {
    issues.push(issue("versioned_forward_migration_readiness_missing_artifact", { path: artifactRel }));
  } else if (stableStringify(artifact) !== stableStringify(current)) {
    issues.push(
      issue("versioned_forward_migration_readiness_drift", {
        path: artifactRel,
        hint: "Run npm run write:versioned-forward-migration-readiness",
      }),
    );
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    rowCount: current.totals.rowCount,
    statusCounts: current.totals.statusCounts,
    blockerClassCounts: current.totals.blockerClassCounts,
    aliasAddedCount: current.totals.aliasAddedCount,
    requiresForwardMigrationCount: current.totals.requiresForwardMigrationCount,
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

export function runVersionedForwardMigrationReadiness(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = buildVersionedForwardMigrationReadiness(options.root, options);
    writeJson(options.root, options.artifactRel, artifact);
    console.log(
      JSON.stringify(
        {
          ok: artifact.issueCount === 0,
          wrote: options.artifactRel,
          rowCount: artifact.totals.rowCount,
          statusCounts: artifact.totals.statusCounts,
          blockerClassCounts: artifact.totals.blockerClassCounts,
          issueCount: artifact.issueCount,
        },
        null,
        2,
      ),
    );
    if (artifact.issueCount > 0) process.exitCode = 1;
    return artifact;
  }

  const report = analyzeVersionedForwardMigrationReadiness(options);
  const { current: _current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedForwardMigrationReadiness();
}
