#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/supabase/sql-object-rename-staging.json";
const DEFAULT_REFERENCE_INVENTORY_REL = "artifacts/supabase/sql-object-reference-inventory.json";

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(abs, fallback = null) {
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : fallback;
}

function neutralSqlObjectName(name) {
  return String(name)
    .replace(/\bv[0-9]+_/giu, "")
    .replace(/_v[0-9]+_/giu, "_")
    .replace(/_v[0-9]+\b/giu, "")
    .replace(/\bV[0-9]+\b/gu, "")
    .replace(/\s{2,}/gu, " ")
    .replace(/__+/gu, "_")
    .trim();
}

function objectTypeFromGroup(group) {
  if (group === "tables") return "table";
  if (group === "views") return "view";
  if (group === "functions") return "function";
  if (group === "policies") return "policy";
  if (group === "triggers") return "trigger";
  if (group === "storageBuckets") return "storage_bucket";
  return group;
}

function dataBearingForType(type) {
  return type === "table" || type === "storage_bucket";
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function validationSqlFor({ legacyObject, newObject, objectType }) {
  if (objectType === "function") {
    return `select to_regproc(${sqlLiteral(legacyObject)}) is not null as legacy_exists, to_regproc(${sqlLiteral(newObject)}) is not null as neutral_exists;`;
  }
  if (objectType === "table" || objectType === "view") {
    return `select to_regclass(${sqlLiteral(legacyObject)}) is not null as legacy_exists, to_regclass(${sqlLiteral(newObject)}) is not null as neutral_exists;`;
  }
  if (objectType === "policy") {
    return `select exists (select 1 from pg_policies where schemaname || '.' || policyname = ${sqlLiteral(legacyObject)}) as legacy_exists, exists (select 1 from pg_policies where schemaname || '.' || policyname = ${sqlLiteral(newObject)}) as neutral_exists;`;
  }
  if (objectType === "trigger") {
    return `select exists (select 1 from pg_trigger where tgname = split_part(${sqlLiteral(legacyObject)}, '.', 2)) as legacy_exists, exists (select 1 from pg_trigger where tgname = split_part(${sqlLiteral(newObject)}, '.', 2)) as neutral_exists;`;
  }
  if (objectType === "storage_bucket") {
    return `select exists (select 1 from storage.buckets where id = ${sqlLiteral(legacyObject.replace(/^storage\.buckets\./u, ""))}) as legacy_exists, exists (select 1 from storage.buckets where id = ${sqlLiteral(newObject.replace(/^storage\.buckets\./u, ""))}) as neutral_exists;`;
  }
  return `select ${sqlLiteral(legacyObject)} as legacy_object, ${sqlLiteral(newObject)} as neutral_candidate;`;
}

function cutoverStrategyFor(objectType) {
  if (dataBearingForType(objectType)) {
    return "Create a neutral compatibility object in a forward migration, dual-read or dual-write if needed, backfill or sync data, then move application references after linked read-only verification.";
  }
  return "Create a neutral compatibility alias in a forward migration, verify both old and neutral objects exist, then move application references in a later code batch.";
}

function objectGroupForType(objectType) {
  if (objectType === "table") return "tables";
  if (objectType === "view") return "views";
  if (objectType === "function") return "functions";
  if (objectType === "policy") return "policies";
  if (objectType === "trigger") return "triggers";
  if (objectType === "storage_bucket") return "storageBuckets";
  return null;
}

function neutralObjectExists(definedObjects, objectType, newObject) {
  if (objectType === "table") {
    return Object.hasOwn(definedObjects?.tables ?? {}, newObject) || Object.hasOwn(definedObjects?.views ?? {}, newObject);
  }
  const group = objectGroupForType(objectType);
  if (!group) return false;
  return Object.hasOwn(definedObjects?.[group] ?? {}, newObject);
}

function statusForStagedObject({ definedObjects, objectType, newObject }) {
  if ((objectType === "function" || objectType === "table" || objectType === "view") && neutralObjectExists(definedObjects, objectType, newObject)) {
    return "alias_added";
  }
  return "requires_forward_migration";
}

function validationCommandForStatus(status) {
  return status === "alias_added" ? "npm run check:sql-rename-verification-sql" : "npm run check:sql-object-reference-inventory";
}

function cutoverStrategyForStatus({ objectType, status }) {
  if (status === "alias_added") {
    return objectType === "function"
      ? "Neutral SQL function alias exists in a forward migration; keep the legacy function until linked read-only verification and application reference cutover are complete."
      : "Neutral read-only SQL table/view alias exists in a forward migration; keep the legacy data-bearing object until linked read-only verification and application reference cutover are complete.";
  }
  return cutoverStrategyFor(objectType);
}

function stagedRenamesFromReferenceInventory(root, referenceInventoryRel = DEFAULT_REFERENCE_INVENTORY_REL) {
  const inventory = readJson(path.join(root, referenceInventoryRel), null);
  const definedObjects = inventory?.definedObjects ?? {};
  const rows = [];
  for (const [group, objects] of Object.entries(definedObjects)) {
    const objectType = objectTypeFromGroup(group);
    for (const legacyObject of Object.keys(objects ?? {})) {
      if (!/[._:\s-][Vv][0-9]+|^[Vv][0-9]+/u.test(legacyObject)) continue;
      const newObject = neutralSqlObjectName(legacyObject);
      if (!newObject || newObject === legacyObject) continue;
      const status = statusForStagedObject({ definedObjects, objectType, newObject });
      const staged = {
        legacyObject,
        newObject,
        objectType,
        dataBearing: dataBearingForType(objectType),
        owner: "database-platform",
        reason: "Versioned SQL object names require forward-compatible aliases or views before application code can move.",
        status,
        validationCommand: validationCommandForStatus(status),
        validationSql: validationSqlFor({ legacyObject, newObject, objectType }),
        cutoverStrategy: cutoverStrategyForStatus({ objectType, status }),
        earliestRemovalCondition:
          "A forward migration creates the neutral SQL object or compatibility alias, application references move, and linked read-only catalog verification passes.",
        manualFollowUp: "Do not remove the legacy SQL object until production cutover evidence exists and the compatibility removal queue is ready_for_removal.",
        stages: [
          "add_new_object_or_alias",
          dataBearingForType(objectType) ? "dual_read_or_dual_write_if_data_bearing" : "move_code_references",
          dataBearingForType(objectType) ? "backfill_or_sync_if_needed" : "verify_linked_catalog_read_only",
          "remove_legacy_object_in_later_migration",
        ],
      };
      rows.push(staged);
    }
  }
  return rows.sort((a, b) => a.objectType.localeCompare(b.objectType) || a.legacyObject.localeCompare(b.legacyObject));
}

export function buildSqlObjectRenameStagingArtifact(root = DEFAULT_ROOT, options = {}) {
  const stagedRenames = stagedRenamesFromReferenceInventory(root, options.referenceInventoryRel);
  return {
    schemaVersion: 2,
    generatedBy: "scripts/check-sql-object-rename-staging.mjs --write",
    sourceInventory: options.referenceInventoryRel ?? DEFAULT_REFERENCE_INVENTORY_REL,
    stagedRenames,
    requiredStages: [
      "add_new_object_or_alias",
      "dual_read_or_dual_write_if_data_bearing",
      "backfill_or_sync_if_needed",
      "move_code_references",
      "verify_linked_catalog_read_only",
      "remove_legacy_object_in_later_migration",
    ],
    manualBoundaries: [
      "This artifact does not rename production database objects.",
      "Linked catalog verification remains optional and read-only.",
    ],
  };
}

function validateStagedRename(row, index, issues) {
  for (const key of [
    "legacyObject",
    "newObject",
    "objectType",
    "owner",
    "reason",
    "status",
    "validationCommand",
    "validationSql",
    "cutoverStrategy",
    "earliestRemovalCondition",
    "manualFollowUp",
  ]) {
    if (typeof row[key] !== "string" || row[key].trim() === "") {
      issues.push({ issue: "sql_object_rename_stage_missing_metadata", index, key });
    }
  }
  if (typeof row.dataBearing !== "boolean") {
    issues.push({ issue: "sql_object_rename_stage_missing_data_bearing_flag", index, legacyObject: row.legacyObject ?? null });
  }
  if (!Array.isArray(row.stages) || row.stages.length === 0) {
    issues.push({ issue: "sql_object_rename_stage_missing_stage_list", index, legacyObject: row.legacyObject ?? null });
  }
}

export function analyzeSqlObjectRenameStaging(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildSqlObjectRenameStagingArtifact(root, options);
  const issues = [];
  const artifact = readJson(path.join(root, artifactRel), null);

  if (!artifact) {
    issues.push({ issue: "sql_object_rename_staging_missing", path: artifactRel });
  } else if (artifact.schemaVersion !== 2 || !Array.isArray(artifact.stagedRenames)) {
    issues.push({ issue: "invalid_sql_object_rename_staging_schema", path: artifactRel });
  } else {
    artifact.stagedRenames.forEach((row, index) => validateStagedRename(row, index, issues));
    if (stableStringify(artifact) !== stableStringify(current)) {
      issues.push({ issue: "sql_object_rename_staging_drift", path: artifactRel, hint: "Run npm run write:sql-object-rename-staging" });
    }
  }

  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    stagedRenameCount: artifact?.stagedRenames?.length ?? 0,
    issueCount: issues.length,
    issues,
    current,
  };
}

function writeArtifact(root, artifactRel, options = {}) {
  const artifact = buildSqlObjectRenameStagingArtifact(root, options);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, referenceInventoryRel: DEFAULT_REFERENCE_INVENTORY_REL, write: false };
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
    } else if (arg === "--reference-inventory") {
      options.referenceInventoryRel = argv[index + 1] ?? DEFAULT_REFERENCE_INVENTORY_REL;
      index += 1;
    } else if (arg.startsWith("--reference-inventory=")) {
      options.referenceInventoryRel = arg.slice("--reference-inventory=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runSqlObjectRenameStaging(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel, options);
    console.log(JSON.stringify({ ok: true, wrote: options.artifactRel, stagedRenameCount: artifact.stagedRenames.length }, null, 2));
    return artifact;
  }
  const report = analyzeSqlObjectRenameStaging(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlObjectRenameStaging();
}
