#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const ARTIFACT_REL = "artifacts/assurance/rls-sanity-tables.json";
const FORCE_RLS_MIGRATION_REL = "supabase/migrations/072_force_rls_tenant_tables.sql";
const SMOKE_SQL_REL = "supabase/tests/rls_sanity_smoke.sql";
const DEFAULT_DENY_SMOKE_SQL_REL = "supabase/tests/rls_default_deny_smoke.sql";
const REQUIRED_PACKAGE_SCRIPTS = ["check:rls-sanity-tables"];
const REQUIRED_CI_COMMANDS = ["npm run check:rls-sanity-tables"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:rls-sanity-tables"'];

const TENANT_ROOT_TABLES = new Set(["organizations", "organization_members"]);
const TENANT_CHILD_SCOPE = new Map([
  ["contract_files", "contract_id"],
  ["extracted_fields", "contract_id"],
  ["reminders", "contract_id"],
]);

const NON_TENANT_TABLES = new Set(["profiles", "stripe_webhook_events"]);

function stripFullLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function normalizeTableName(table) {
  return table.replace(/^public\./i, "").replaceAll('"', "").trim();
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function extractColumnNames(tableBody) {
  const out = [];
  for (const line of tableBody.split("\n")) {
    const match = /^\s*"?([a-zA-Z_][\w]*)"?\s+/.exec(line);
    if (!match) continue;
    const column = match[1];
    if (["constraint", "primary", "unique", "foreign", "check"].includes(column.toLowerCase())) continue;
    out.push(column);
  }
  return out;
}

function extractCreateTables(sql) {
  return [...sql.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)\s*\(([\s\S]*?)\);/gi)].map(
    (match) => ({
      table: normalizeTableName(match[1]),
      columns: extractColumnNames(match[2]),
    })
  );
}

function readMigrationRows(root) {
  const migrationsDir = path.join(root, "supabase", "migrations");
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const rel = `supabase/migrations/${file}`;
      const text = read(root, rel);
      return { file, rel, text, uncommented: stripFullLineComments(text) };
    });
}

function commandSetForPolicyCommand(command) {
  const normalized = (command ?? "all").toLowerCase();
  if (normalized === "all") return new Set(["select", "insert", "update", "delete"]);
  return new Set([normalized]);
}

function collectDirectPolicyCoverage(allSql) {
  const coverage = new Map();
  for (const match of allSql.matchAll(/create\s+policy\b([\s\S]*?)\s+on\s+public\.([a-zA-Z_][\w]*)(?:\s+for\s+(select|insert|update|delete|all))?([\s\S]*?);/gi)) {
    const table = normalizeTableName(match[2]);
    const policySql = match[0];
    const entry = coverage.get(table) ?? { commands: new Set(), policies: [] };
    for (const command of commandSetForPolicyCommand(match[3])) entry.commands.add(command);
    entry.policies.push(policySql);
    coverage.set(table, entry);
  }
  return coverage;
}

function extractQuotedArrayItems(arrayBody) {
  return [...arrayBody.matchAll(/'([a-zA-Z_][\w]*)'/g)].map((match) => match[1]).filter(Boolean);
}

function collectDynamicPolicyCoverage(allSql) {
  const coverage = new Map();
  for (const match of allSql.matchAll(/tables\s+text\[\]\s*:=\s*array\s*\[([\s\S]*?)\];([\s\S]*?)end\s+\$\$/gi)) {
    const tables = extractQuotedArrayItems(match[1]);
    const body = match[2];
    const hasMemberSelect = /create\s+policy[\s\S]*?for\s+select[\s\S]*?(?:is_org_member|organization_members|organization_id)/i.test(body);
    const hasEditorAll = /create\s+policy[\s\S]*?for\s+all[\s\S]*?with\s+check[\s\S]*?(?:organization_members|organization_id)/i.test(body);
    for (const table of tables) {
      const entry = coverage.get(table) ?? { commands: new Set(), policies: [] };
      if (hasMemberSelect) entry.commands.add("select");
      if (hasEditorAll) {
        entry.commands.add("insert");
        entry.commands.add("update");
        entry.commands.add("delete");
      }
      if (hasMemberSelect || hasEditorAll) entry.policies.push(body);
      coverage.set(table, entry);
    }
  }
  return coverage;
}

function mergeCoverage(...maps) {
  const out = new Map();
  for (const map of maps) {
    for (const [table, entry] of map) {
      const merged = out.get(table) ?? { commands: new Set(), policies: [] };
      for (const command of entry.commands) merged.commands.add(command);
      merged.policies.push(...entry.policies);
      out.set(table, merged);
    }
  }
  return out;
}

function hasTenantBoundary(policySql) {
  return /\borganization_id\b|organization_members|is_org_member|v10_member_can_read|auth\.uid\s*\(|\busing\s*\(\s*false\s*\)|\bwith\s+check\s*\(\s*false\s*\)/i.test(policySql);
}

function buildTenantInventory(rows) {
  const createdTables = new Map();
  for (const row of rows) {
    for (const table of extractCreateTables(row.uncommented)) {
      createdTables.set(table.table, { ...table, rel: row.rel });
    }
  }

  const inventory = [];
  for (const [table, meta] of createdTables) {
    if (NON_TENANT_TABLES.has(table)) continue;
    const hasOrg = meta.columns.includes("organization_id");
    const rootScope = TENANT_ROOT_TABLES.has(table);
    const childScope = TENANT_CHILD_SCOPE.get(table);
    if (!hasOrg && !rootScope && !childScope) continue;
    inventory.push({
      table,
      scope: hasOrg ? "organization_id" : rootScope ? "tenant_root" : childScope,
      rel: meta.rel,
    });
  }
  inventory.sort((a, b) => a.table.localeCompare(b.table));
  return inventory;
}

function hasRlsEnable(allSql, table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${escaped}\\s+enable\\s+row\\s+level\\s+security`, "i").test(allSql);
}

function hasForceMigration(text) {
  return (
    /force\s+row\s+level\s+security/i.test(text) &&
    /relrowsecurity/i.test(text) &&
    /No direct tenant insert by default/i.test(text) &&
    /No direct tenant update by default/i.test(text) &&
    /No direct tenant delete by default/i.test(text) &&
    /service[-_]role bypass remains explicit/i.test(text)
  );
}

function hasSmokeMarkers(text) {
  return (
    /same_org_allowed/i.test(text) &&
    /cross_org_denied/i.test(text) &&
    /set\s+local\s+role\s+authenticated/i.test(text) &&
    /request\.jwt\.claim\.sub/i.test(text) &&
    /rollback/i.test(text)
  );
}

function hasDefaultDenySmokeMarkers(text) {
  return (
    /anon_direct_insert_denied/i.test(text) &&
    /authenticated_direct_update_denied/i.test(text) &&
    /authenticated_direct_delete_denied/i.test(text) &&
    /set\s+local\s+role\s+anon/i.test(text) &&
    /set\s+local\s+role\s+authenticated/i.test(text) &&
    /RLS default-deny smoke checks failed/i.test(text)
  );
}

export function analyzeRlsSanityTables(root = ROOT) {
  const issues = [];
  const rows = readMigrationRows(root);
  const allSql = rows.map((row) => row.uncommented).join("\n");
  const inventory = buildTenantInventory(rows);
  const policyCoverage = mergeCoverage(collectDirectPolicyCoverage(allSql), collectDynamicPolicyCoverage(allSql));
  const forceMigrationText = exists(root, FORCE_RLS_MIGRATION_REL) ? read(root, FORCE_RLS_MIGRATION_REL) : "";
  const forceMigrationOk = hasForceMigration(forceMigrationText);

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  if (!exists(root, ARTIFACT_REL)) {
    issues.push({ issue: "missing_rls_inventory_artifact", rel: ARTIFACT_REL });
  } else {
    const artifact = JSON.parse(read(root, ARTIFACT_REL));
    const artifactTables = Array.isArray(artifact.tables) ? artifact.tables : [];
    if (artifact.version !== 2) issues.push({ issue: "rls_inventory_version_mismatch", expected: 2, actual: artifact.version });
    if (artifactTables.length === 0) issues.push({ issue: "rls_inventory_empty" });
    const actualTables = artifactTables.map((entry) => (typeof entry === "string" ? entry : entry?.table)).filter(Boolean).sort();
    const expectedTables = inventory.map((entry) => entry.table).sort();
    if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) {
      issues.push({
        issue: "rls_inventory_drift",
        expectedCount: expectedTables.length,
        actualCount: actualTables.length,
        missing: expectedTables.filter((table) => !actualTables.includes(table)).slice(0, 20),
        extra: actualTables.filter((table) => !expectedTables.includes(table)).slice(0, 20),
      });
    }
    if (!/service[_ -]role/i.test(String(artifact.service_role_bypass ?? ""))) {
      issues.push({ issue: "missing_service_role_bypass_note", rel: ARTIFACT_REL });
    }
  }

  if (!forceMigrationOk) {
    issues.push({ issue: "missing_force_rls_default_deny_migration", rel: FORCE_RLS_MIGRATION_REL });
  }

  if (!exists(root, SMOKE_SQL_REL)) {
    issues.push({ issue: "missing_rls_smoke_sql", rel: SMOKE_SQL_REL });
  } else if (!hasSmokeMarkers(read(root, SMOKE_SQL_REL))) {
    issues.push({ issue: "rls_smoke_sql_missing_same_or_cross_org_assertions", rel: SMOKE_SQL_REL });
  }

  if (!exists(root, DEFAULT_DENY_SMOKE_SQL_REL)) {
    issues.push({ issue: "missing_rls_default_deny_smoke_sql", rel: DEFAULT_DENY_SMOKE_SQL_REL });
  } else if (!hasDefaultDenySmokeMarkers(read(root, DEFAULT_DENY_SMOKE_SQL_REL))) {
    issues.push({ issue: "rls_default_deny_smoke_sql_missing_insert_update_delete_assertions", rel: DEFAULT_DENY_SMOKE_SQL_REL });
  }

  for (const entry of inventory) {
    if (!hasRlsEnable(allSql, entry.table)) {
      issues.push({ issue: "tenant_table_missing_rls_enable", table: entry.table, rel: entry.rel });
    }

    const coverage = policyCoverage.get(entry.table);
    if (!coverage?.commands.has("select")) {
      issues.push({ issue: "tenant_table_missing_select_policy", table: entry.table, rel: entry.rel });
    }
    if (!forceMigrationOk) {
      for (const command of ["insert", "update", "delete"]) {
        if (!coverage?.commands.has(command)) {
          issues.push({ issue: `tenant_table_missing_${command}_policy_or_default_deny`, table: entry.table, rel: entry.rel });
        }
      }
    }
    if (coverage && coverage.policies.length > 0 && !coverage.policies.some(hasTenantBoundary)) {
      issues.push({ issue: "tenant_table_policy_missing_tenant_boundary", table: entry.table, rel: entry.rel });
    }
  }

  return {
    checkId: "rls-sanity-tables",
    ok: issues.length === 0,
    issueCount: issues.length,
    tenantTableCount: inventory.length,
    inventory,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRlsSanityTables();
  const showInventory = process.argv.includes("--report");
  console.log(
    JSON.stringify(
      showInventory ? report : { checkId: report.checkId, ok: report.ok, issueCount: report.issueCount, tenantTableCount: report.tenantTableCount, issues: report.issues },
      null,
      2
    )
  );
  process.exit(report.ok ? 0 : 1);
}
