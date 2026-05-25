#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const strict = process.argv.includes("--strict");

const SECURITY_DEFINER_LEGACY_FILES = new Set(["001_initial_schema.sql"]);
const NON_TENANT_TABLE_CLASSIFICATIONS = new Map([
  ["organizations", "tenant_root"],
  ["profiles", "auth_profile"],
  ["contract_files", "legacy_storage_join"],
  ["extracted_fields", "legacy_contract_child"],
  ["reminders", "legacy_contract_child"],
  ["stripe_webhook_events", "provider_event_dedupe"],
]);
const LEGACY_PLAINTEXT_SECRET_FILES = new Set([
  "014_v2_workflow_expansion.sql",
  "016_v2_remaining_depth.sql",
  "044_v5_control_plane_foundation.sql",
]);
const SECURITY_DEFINER_CLIENT_EXECUTE_ALLOWLIST = new Set([
  "create_user_org",
  "is_org_member",
  "role_rank",
  "member_can_read",
  "v10_role_rank",
  "v10_member_can_read",
]);
const NEUTRAL_TABLE_VIEW_ALIAS_GRANT_FILE = "089_sql_neutral_table_view_aliases.sql";
const LEGACY_IMPLICIT_DELETE_FILES = new Set([
  "001_initial_schema.sql",
  "039_v4_execution_platform_foundation.sql",
  "043_v4_feature_surface_completion.sql",
  "044_v5_control_plane_foundation.sql",
  "049_v6_assurance_adaptive_platform.sql",
]);
const NULLABLE_ORG_ID_JUSTIFICATIONS = new Map([
  [
    "v10_runtime_coverage_ledger",
    "Some coverage rows are global release/blocker controls rather than tenant runtime records; user-facing access remains RLS-gated.",
  ],
]);
const ORG_SCOPED_UNIQUE_REQUIREMENTS = new Map([
  ["calendar_feeds", ["token_hash"]],
  ["external_action_links", ["token_hash"]],
  ["integration_api_keys", ["key_hash"]],
  ["integration_oauth_states", ["state"]],
  ["v10_mutation_idempotency", ["actor_user_id", "mutation_name", "target_type", "target_id", "idempotency_key"]],
]);

function stripFullLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function normalizeTableName(table) {
  return table.replace(/^public\./i, "").replaceAll('"', "").trim();
}

function extractCreateTables(sql) {
  return [...sql.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)\s*\(([\s\S]*?)\);/gi)].map(
    (match) => ({ table: normalizeTableName(match[1]), body: match[2] })
  );
}

function normalizeColumnList(columns) {
  return columns
    .split(",")
    .map((column) => column.replace(/["\s]/g, "").toLowerCase())
    .filter(Boolean);
}

function hasOrgIndex(allSql, table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `create\\s+(?:unique\\s+)?index(?:\\s+if\\s+not\\s+exists)?\\s+[\\w"]+\\s+on\\s+(?:public\\.)?${escaped}\\s*\\([^;]*organization_id`,
    "i"
  ).test(allSql);
}

function hasRequiredOrgScopedUnique(allSql, table, requiredColumns) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const required = new Set(["organization_id", ...requiredColumns.map((column) => column.toLowerCase())]);

  for (const tableDef of extractCreateTables(allSql).filter((entry) => entry.table === table)) {
    for (const match of tableDef.body.matchAll(/\bunique\s*\(([^)]*)\)/gi)) {
      const columns = new Set(normalizeColumnList(match[1]));
      if ([...required].every((column) => columns.has(column))) return true;
    }
  }

  const indexRe = new RegExp(`create\\s+unique\\s+index(?:\\s+if\\s+not\\s+exists)?\\s+[\\w"]+\\s+on\\s+(?:public\\.)?${escaped}\\s*\\(([^)]*)\\)`, "gi");
  for (const match of allSql.matchAll(indexRe)) {
    const columns = new Set(normalizeColumnList(match[1]));
    if ([...required].every((column) => columns.has(column))) return true;
  }

  return false;
}

function orgIdIsNullable(tableBody) {
  return /\borganization_id\s+uuid\b/i.test(tableBody) && !/\borganization_id\s+uuid\s+not\s+null\b/i.test(tableBody);
}

function orgIdHasCascadeFk(tableBody) {
  return /\borganization_id\s+uuid\b[^,\n]*\breferences\s+public\.organizations\s*\(\s*id\s*\)[^,\n]*\bon\s+delete\s+cascade\b/i.test(tableBody);
}

function collectReferencesWithoutExplicitDelete(sql) {
  const refs = [];
  for (const match of sql.matchAll(/\breferences\s+((?:public|auth)\.[a-zA-Z_][\w]*)\s*\([^)]*\)([^,;\n]*)/gi)) {
    if (!/\bon\s+delete\s+(cascade|set\s+null|restrict|no\s+action)\b/i.test(match[2])) {
      refs.push({ referencedTable: match[1] });
    }
  }
  return refs;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractNeutralTableViewAliases(sql) {
  const aliases = new Set();
  for (const match of sql.matchAll(
    /create\s+or\s+replace\s+view\s+public\.([a-zA-Z_][\w]*)\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)\s+as\s+select\s+\*\s+from\s+public\.v10_[a-zA-Z_][\w]*\s*;/gi
  )) {
    aliases.add(normalizeTableName(match[1]));
  }
  return aliases;
}

function collectClientPrivilegeGrants(sql) {
  return [...sql.matchAll(/\bgrant\s+(select|insert|update|delete|usage|all)\b\s+on\s+(?:table\s+)?(?:public\.)?([a-zA-Z_][\w]*)[\s\S]*?\bto\s+(public|anon|authenticated)\b/gi)].map(
    (match) => ({
      privilege: match[1].toLowerCase(),
      objectName: normalizeTableName(match[2]),
      role: match[3].toLowerCase(),
    })
  );
}

function neutralTableViewAliasGrantsAreScoped(file, uncommented) {
  if (file !== NEUTRAL_TABLE_VIEW_ALIAS_GRANT_FILE) return false;

  const aliases = extractNeutralTableViewAliases(uncommented);
  if (aliases.size === 0) return false;

  for (const grant of collectClientPrivilegeGrants(uncommented)) {
    if (grant.privilege !== "select") return false;
    if (grant.role !== "authenticated") return false;
    if (!aliases.has(grant.objectName)) return false;

    const escapedObject = escapeRegExp(grant.objectName);
    const revokePublic = new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${escapedObject}\\s+from\\s+public\\b`, "i");
    const grantServiceRole = new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.${escapedObject}\\s+to\\s+service_role\\b`, "i");
    if (!revokePublic.test(uncommented) || !grantServiceRole.test(uncommented)) return false;
  }

  return true;
}

export function analyzeMigrationSecurityPatterns(scanRoot = root, options = { strict }) {
  const scanMigrationsDir = path.join(scanRoot, "supabase", "migrations");
  const files = fs.readdirSync(scanMigrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const rows = files.map((file) => {
    const text = fs.readFileSync(path.join(scanMigrationsDir, file), "utf8");
    return { file, rel: `supabase/migrations/${file}`, text, uncommented: stripFullLineComments(text) };
  });
  const allSql = rows.map((row) => row.uncommented).join("\n");
  const issues = [];
  const orgScopedTables = new Set();

  for (const row of rows) {
    for (const tableDef of extractCreateTables(row.uncommented)) {
      if (/\borganization_id\b/i.test(tableDef.body)) orgScopedTables.add(tableDef.table);
    }
  }

  for (const row of rows) {
    const { file, rel, text, uncommented } = row;

    if (/disable\s+row\s+level\s+security/i.test(uncommented)) {
      issues.push({ file: rel, issue: "disables_row_level_security" });
    }
    if (/\bgrant\s+all\s+on\s+(?:table\s+)?public\./i.test(uncommented)) {
      issues.push({ file: rel, issue: "grant_all_on_public_table" });
    }
    if (
      collectClientPrivilegeGrants(uncommented).length > 0 &&
      !neutralTableViewAliasGrantsAreScoped(file, uncommented)
    ) {
      issues.push({ file: rel, issue: "broad_grant_to_client_role" });
    }

    for (const tableDef of extractCreateTables(uncommented)) {
      if (!new RegExp(`alter\\s+table\\s+(?:public\\.)?${tableDef.table}\\s+enable\\s+row\\s+level\\s+security`, "i").test(allSql)) {
        issues.push({ file: rel, table: tableDef.table, issue: "creates_table_without_rls_enable" });
      }
      if (!/\borganization_id\b/i.test(tableDef.body) && !NON_TENANT_TABLE_CLASSIFICATIONS.has(tableDef.table)) {
        issues.push({ file: rel, table: tableDef.table, issue: "tenant_table_missing_org_id_or_classification" });
      }
      if (/\borganization_id\b/i.test(tableDef.body) && !hasOrgIndex(allSql, tableDef.table)) {
        issues.push({ file: rel, table: tableDef.table, issue: "missing_org_lookup_index" });
      }
      if (/\borganization_id\b/i.test(tableDef.body) && orgIdIsNullable(tableDef.body) && !NULLABLE_ORG_ID_JUSTIFICATIONS.has(tableDef.table)) {
        issues.push({ file: rel, table: tableDef.table, issue: "nullable_org_id_requires_justification" });
      }
      if (/\borganization_id\b/i.test(tableDef.body) && !orgIdHasCascadeFk(tableDef.body)) {
        issues.push({ file: rel, table: tableDef.table, issue: "tenant_org_id_missing_org_fk_cascade" });
      }
    }

    if (!LEGACY_IMPLICIT_DELETE_FILES.has(file)) {
      for (const ref of collectReferencesWithoutExplicitDelete(uncommented)) {
        issues.push({ file: rel, referencedTable: ref.referencedTable, issue: "foreign_key_missing_explicit_on_delete" });
      }
    }

    if (/storage\.objects/i.test(uncommented) && !/create\s+policy/i.test(uncommented)) {
      issues.push({ file: rel, issue: "storage_objects_without_policy_update" });
    }

    for (const policyMatch of uncommented.matchAll(/create\s+policy[\s\S]*?\s+on\s+(?:public\.)?([a-zA-Z_][\w]*)[\s\S]*?(?=;\s*)/gi)) {
      const policyTable = normalizeTableName(policyMatch[1]);
      const policySql = policyMatch[0];
      const explicitlyDeniesDirectAccess = /\busing\s*\(\s*false\s*\)/i.test(policySql) && /\bwith\s+check\s*\(\s*false\s*\)/i.test(policySql);
      const isWritePolicy = /\bfor\s+(?:insert|update|all)\b/i.test(policySql);
      const writePolicyHasNoWritePredicate =
        orgScopedTables.has(policyTable) &&
        isWritePolicy &&
        !explicitlyDeniesDirectAccess &&
        !/\bwith\s+check\s*\(/i.test(policySql) &&
        !/\busing\s*\(/i.test(policySql);
      if (
        orgScopedTables.has(policyTable) &&
        !explicitlyDeniesDirectAccess &&
        !writePolicyHasNoWritePredicate &&
        !/\borganization_id\b|organization_members|v10_member_can_read|auth\.uid\s*\(/i.test(policySql)
      ) {
        issues.push({ file: rel, table: policyTable, issue: "policy_missing_org_membership_constraint" });
      }
      if (writePolicyHasNoWritePredicate) {
        issues.push({ file: rel, table: policyTable, issue: "write_policy_missing_with_check" });
      }
    }

    if (
      /\b(?:token|secret|api_key)\s+text\b/i.test(uncommented) &&
      !/\b(?:token_hash|secret_hash|api_key_hash)\b/i.test(uncommented) &&
      !LEGACY_PLAINTEXT_SECRET_FILES.has(file)
    ) {
      issues.push({ file: rel, issue: "plaintext_secret_or_token_column_without_hash" });
    }

    const funcChunks = text.split(/(?=create\s+or\s+replace\s+function)/i);
    for (const chunk of funcChunks) {
      const trimmed = chunk.trimStart();
      if (!/^create\s+or\s+replace\s+function\b/i.test(trimmed)) continue;
      const body = stripFullLineComments(chunk);
      if (!/\bsecurity\s+definer\b/i.test(body)) continue;
      if (!/\bset\s+search_path\s*=/i.test(body) && !SECURITY_DEFINER_LEGACY_FILES.has(file)) {
        issues.push({ file: rel, issue: "security_definer_function_missing_set_search_path" });
        continue;
      }
      const name = /create\s+or\s+replace\s+function\s+((?:public\.)?[a-zA-Z_][\w]*)\s*\(/i.exec(body)?.[1];
      if (name) {
        const normalizedName = name.replace(/^public\./i, "");
        const escapedName = escapeRegExp(normalizedName);
        const broadExecuteGrant = new RegExp(
          `grant\\s+execute\\s+on\\s+function\\s+(?:public\\.)?${escapedName}\\s*\\([^;]*\\)\\s+to\\s+(?:public|anon|authenticated)\\b`,
          "i"
        );
        if (!SECURITY_DEFINER_CLIENT_EXECUTE_ALLOWLIST.has(normalizedName) && broadExecuteGrant.test(allSql)) {
          issues.push({ file: rel, function: normalizedName, issue: "security_definer_broad_execute_grant" });
        }
      }
    }
  }

  for (const [table, requiredColumns] of ORG_SCOPED_UNIQUE_REQUIREMENTS) {
    if (orgScopedTables.has(table) && !hasRequiredOrgScopedUnique(allSql, table, requiredColumns)) {
      issues.push({ table, columns: ["organization_id", ...requiredColumns], issue: "sensitive_table_missing_org_scoped_unique" });
    }
  }

  return { strict: Boolean(options.strict), issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeMigrationSecurityPatterns(root, { strict });
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length > 0) process.exit(1);
}
