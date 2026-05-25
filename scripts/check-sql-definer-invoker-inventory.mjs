#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const MIGRATIONS_REL = "supabase/migrations";
const ARTIFACT_REL = "artifacts/assurance/sql-definer-invoker-inventory.json";
const VIEW_SMOKE_REL = "supabase/tests/view_invoker_smoke.sql";
const DEFAULT_SECURITY_DEFINER_OWNER = "platform-security";

const TENANT_ROOT_TABLES = new Set(["organizations", "organization_members"]);
const TENANT_CHILD_SCOPE = new Set(["contract_files", "extracted_fields", "reminders"]);
const CLIENT_EXECUTE_ALLOWLIST = new Map([
  ["create_user_org", "binds requested user_id to auth.uid() before creating tenant root rows"],
  ["is_org_member", "membership predicate helper used by RLS policies"],
  ["role_rank", "neutral compatibility wrapper for the pure v10 role ranking helper"],
  ["member_can_read", "neutral compatibility wrapper for the V10 RLS predicate helper"],
  ["v10_role_rank", "pure role ranking helper with no table reads or writes"],
  ["v10_member_can_read", "V10 RLS predicate helper binds row organization to auth.uid() membership"],
]);
const ANON_EXECUTE_ALLOWLIST = new Map([
  ["is_org_member", "RLS policy helper returns false for anon via auth.uid() and avoids permission-denied probes"],
]);

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function writeIfChanged(abs, content) {
  if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === content) return;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stripFullLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function normalizeIdentifier(name) {
  return name.replace(/^public\./i, "").replaceAll('"', "").trim();
}

function readMigrationRows(root) {
  const migrationsDir = path.join(root, MIGRATIONS_REL);
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const rel = `${MIGRATIONS_REL}/${file}`;
      const text = read(root, rel);
      return { file, rel, text, uncommented: stripFullLineComments(text) };
    });
}

function extractColumnNames(tableBody) {
  const out = [];
  for (const line of tableBody.split("\n")) {
    const match = /^\s*"?([a-zA-Z_][\w]*)"?\s+/.exec(line);
    if (!match) continue;
    const column = match[1].toLowerCase();
    if (["constraint", "primary", "unique", "foreign", "check"].includes(column)) continue;
    out.push(column);
  }
  return out;
}

function buildTenantTableSet(rows) {
  const tenantTables = new Set();
  for (const row of rows) {
    for (const match of row.uncommented.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)\s*\(([\s\S]*?)\);/gi)) {
      const table = normalizeIdentifier(match[1]);
      const columns = extractColumnNames(match[2]);
      if (columns.includes("organization_id") || TENANT_ROOT_TABLES.has(table) || TENANT_CHILD_SCOPE.has(table)) {
        tenantTables.add(table);
      }
    }
  }
  return tenantTables;
}

function extractFunctionDefinitions(row) {
  const starts = [...row.uncommented.matchAll(/create\s+or\s+replace\s+function\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)\s*\(/gi)];
  return starts.map((match, index) => {
    const start = match.index;
    const fallbackEnd = starts[index + 1]?.index ?? row.uncommented.length;
    const tail = row.uncommented.slice(start, fallbackEnd);
    const tagMatch = /\bas\s+(\$[A-Za-z0-9_]*\$)/i.exec(tail);
    const closingTagIndex = tagMatch ? tail.indexOf(tagMatch[1], tagMatch.index + tagMatch[0].length) : -1;
    const semicolonIndex = closingTagIndex >= 0 ? tail.indexOf(";", closingTagIndex + tagMatch[1].length) : -1;
    const end = semicolonIndex >= 0 ? start + semicolonIndex + 1 : fallbackEnd;
    const sql = row.uncommented.slice(start, end);
    const name = normalizeIdentifier(match[1]);
    const language = /\blanguage\s+([a-zA-Z_][\w]*)/i.exec(sql)?.[1]?.toLowerCase() ?? "unknown";
    const volatility = /\b(immutable|stable|volatile)\b/i.exec(sql)?.[1]?.toLowerCase() ?? "volatile";
    const searchPath = /\bset\s+search_path\s*=\s*([^\n;]+)/i.exec(sql)?.[1]?.trim() ?? null;
    return {
      name,
      file: row.rel,
      line: lineNumberAt(row.uncommented, start),
      sql,
      language,
      volatility,
      securityDefiner: /\bsecurity\s+definer\b/i.test(sql),
      securityInvoker: /\bsecurity\s+invoker\b/i.test(sql),
      searchPath,
      hasAuthUidCheck: /\bauth\.uid\s*\(/i.test(sql),
      hasMembershipCheck: /\borganization_members\b|\bis_org_member\s*\(|\bv10_member_can_read\s*\(/i.test(sql),
      usesDynamicSql: /\bexecute\s+(?:format\s*\(|sql\b)/i.test(sql),
    };
  });
}

function collectActiveFunctions(rows) {
  const active = new Map();
  for (const row of rows) {
    for (const fn of extractFunctionDefinitions(row)) {
      active.set(fn.name, fn);
    }
  }
  return [...active.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function collectFunctionPrivileges(allSql) {
  const privileges = new Map();
  const ensure = (name) => {
    const normalized = normalizeIdentifier(name);
    const entry = privileges.get(normalized) ?? { grants: new Set(), revokes: new Set() };
    privileges.set(normalized, entry);
    return entry;
  };

  for (const match of allSql.matchAll(/\brevoke\s+all\s+on\s+function\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)\s*\([^;]*\)\s+from\s+([a-zA-Z_][\w]*)\b/gi)) {
    ensure(match[1]).revokes.add(match[2].toLowerCase());
  }

  for (const match of allSql.matchAll(/\bgrant\s+execute\s+on\s+function\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)\s*\([^;]*\)\s+to\s+([^;]+);/gi)) {
    const entry = ensure(match[1]);
    for (const role of match[2].split(",")) {
      const normalizedRole = role.trim().toLowerCase();
      if (normalizedRole) entry.grants.add(normalizedRole);
    }
  }

  return privileges;
}

function extractViews(row) {
  return [...row.uncommented.matchAll(/create\s+or\s+replace\s+view\s+((?:public\.)?"?[a-zA-Z_][\w]*"?)([\s\S]*?);/gi)].map((match) => ({
    name: normalizeIdentifier(match[1]),
    file: row.rel,
    line: lineNumberAt(row.uncommented, match.index),
    sql: match[0],
    hasSecurityInvoker: /\bwith\s*\(\s*security_invoker\s*=\s*true\s*\)/i.test(match[0]),
  }));
}

function collectActiveViews(rows) {
  const active = new Map();
  for (const row of rows) {
    for (const view of extractViews(row)) {
      active.set(view.name, view);
    }
  }
  return [...active.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function referencedTenantTables(viewSql, tenantTables) {
  const refs = [];
  for (const table of tenantTables) {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\bpublic\\.${escaped}\\b`, "i").test(viewSql)) refs.push(table);
  }
  return refs.sort();
}

function hasViewSmokeMarkers(text) {
  return (
    /view_security_invoker_same_org_allowed/i.test(text) &&
    /view_security_invoker_cross_org_denied/i.test(text) &&
    /set\s+local\s+role\s+authenticated/i.test(text) &&
    /request\.jwt\.claim\.sub/i.test(text) &&
    /public\.contract_operational_dates/i.test(text) &&
    /rollback/i.test(text)
  );
}

function summarizeDefinerFunction(fn, privileges, owner = DEFAULT_SECURITY_DEFINER_OWNER) {
  const grantedTo = [...(privileges?.grants ?? [])].sort();
  const revokedFrom = [...(privileges?.revokes ?? [])].sort();
  const clientRoles = grantedTo.filter((role) => ["public", "anon", "authenticated"].includes(role));
  return {
    function: fn.name,
    owner,
    file: fn.file,
    line: fn.line,
    language: fn.language,
    volatility: fn.volatility,
    search_path: fn.searchPath,
    execute: {
      revoked_from_public: revokedFrom.includes("public"),
      granted_to: grantedTo,
    },
    client_callable: clientRoles.length > 0,
    client_roles: clientRoles,
    allowlist_rationale: clientRoles.length > 0 ? CLIENT_EXECUTE_ALLOWLIST.get(fn.name) ?? null : null,
    anon_allowlist_rationale: clientRoles.includes("anon") ? ANON_EXECUTE_ALLOWLIST.get(fn.name) ?? null : null,
    safety_evidence: {
      auth_uid_check: fn.hasAuthUidCheck,
      membership_check: fn.hasMembershipCheck,
      dynamic_sql: fn.usesDynamicSql,
    },
  };
}

function buildArtifact(definerFunctions, tenantViews, smokeOk) {
  return {
    version: 3,
    generated_by: "scripts/check-sql-definer-invoker-inventory.mjs",
    migration_dir: MIGRATIONS_REL,
    active_security_definer_function_count: definerFunctions.length,
    tenant_security_invoker_view_count: tenantViews.length,
    active_security_definer_functions: definerFunctions,
    tenant_views: tenantViews,
    smoke_tests: [
      {
        rel: VIEW_SMOKE_REL,
        authenticated_role_assumptions: smokeOk,
        assertions: ["view_security_invoker_same_org_allowed", "view_security_invoker_cross_org_denied"],
      },
    ],
  };
}

export function analyzeSqlDefinerInvokerInventory(root = ROOT, options = {}) {
  const issues = [];
  const rows = readMigrationRows(root);
  const allSql = rows.map((row) => row.uncommented).join("\n");
  const activeFunctions = collectActiveFunctions(rows);
  const activeFunctionNames = new Set(activeFunctions.map((fn) => fn.name));
  const privileges = collectFunctionPrivileges(allSql);
  const definerFunctions = activeFunctions.filter((fn) => fn.securityDefiner);

  const summarizedDefiners = definerFunctions.map((fn) => {
    const owner = options.ownerByFunction?.[fn.name] ?? DEFAULT_SECURITY_DEFINER_OWNER;
    const entry = summarizeDefinerFunction(fn, privileges.get(fn.name), owner);
    if (!entry.owner) {
      issues.push({ issue: "security_definer_missing_owner", function: fn.name, file: fn.file, line: fn.line });
    }
    if (!entry.search_path || !/^public\b/i.test(entry.search_path)) {
      issues.push({ issue: "security_definer_missing_public_search_path", function: fn.name, file: fn.file, line: fn.line });
    }
    if (!entry.execute.revoked_from_public) {
      issues.push({ issue: "security_definer_missing_public_revoke", function: fn.name, file: fn.file, line: fn.line });
    }
    if (entry.client_roles.includes("public")) {
      issues.push({ issue: "security_definer_granted_to_public", function: fn.name, roles: entry.client_roles });
    }
    if (entry.client_roles.includes("anon") && !ANON_EXECUTE_ALLOWLIST.has(fn.name)) {
      issues.push({ issue: "security_definer_granted_to_anon_not_allowlisted", function: fn.name, roles: entry.client_roles });
    }
    if (entry.client_roles.includes("authenticated") && !CLIENT_EXECUTE_ALLOWLIST.has(fn.name)) {
      issues.push({ issue: "security_definer_authenticated_grant_not_allowlisted", function: fn.name, file: fn.file, line: fn.line });
    }
    if (entry.client_roles.includes("authenticated") && fn.usesDynamicSql) {
      issues.push({ issue: "security_definer_authenticated_grant_uses_dynamic_sql", function: fn.name, file: fn.file, line: fn.line });
    }
    if (["create_user_org", "is_org_member", "v10_member_can_read"].includes(fn.name) && !fn.hasAuthUidCheck) {
      issues.push({ issue: "security_definer_client_helper_missing_auth_uid_check", function: fn.name, file: fn.file, line: fn.line });
    }
    return entry;
  });

  for (const functionName of privileges.keys()) {
    if (!activeFunctionNames.has(functionName)) {
      issues.push({ issue: "function_grant_references_missing_function", function: functionName });
    }
  }

  const tenantTables = buildTenantTableSet(rows);
  const tenantViews = collectActiveViews(rows)
    .map((view) => ({
      view: view.name,
      file: view.file,
      line: view.line,
      tenant_references: referencedTenantTables(view.sql, tenantTables),
      security_invoker: view.hasSecurityInvoker,
    }))
    .filter((view) => view.tenant_references.length > 0);

  for (const view of tenantViews) {
    if (!view.security_invoker) {
      issues.push({ issue: "tenant_view_missing_security_invoker", view: view.view, file: view.file, line: view.line });
    }
  }

  const smokeOk = exists(root, VIEW_SMOKE_REL) && hasViewSmokeMarkers(read(root, VIEW_SMOKE_REL));
  if (!smokeOk) {
    issues.push({ issue: "missing_view_security_invoker_authenticated_smoke", rel: VIEW_SMOKE_REL });
  }

  const artifact = buildArtifact(summarizedDefiners, tenantViews, smokeOk);
  const checkArtifact = Boolean(options.checkArtifact);
  const artifactRel = options.artifactRel ?? ARTIFACT_REL;
  if (checkArtifact) {
    const artifactPath = path.join(root, artifactRel);
    if (!fs.existsSync(artifactPath)) {
      issues.push({
        issue: "sql_definer_invoker_inventory_missing",
        rel: artifactRel,
        hint: "Run npm run write:sql-definer-invoker-inventory",
      });
    } else {
      const committed = fs.readFileSync(artifactPath, "utf8");
      const current = stableStringify(artifact);
      if (committed !== current) {
        issues.push({
          issue: "sql_definer_invoker_inventory_drift",
          rel: artifactRel,
          hint: "Run npm run write:sql-definer-invoker-inventory",
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    securityDefinerFunctionCount: summarizedDefiners.length,
    tenantViewCount: tenantViews.length,
    artifact,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: ROOT, artifactRel: ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

export function runSqlDefinerInvokerInventory(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeSqlDefinerInvokerInventory(options.root, {
    artifactRel: options.artifactRel,
    checkArtifact: !options.write,
  });
  if (options.write) {
    const outPath = path.join(options.root, options.artifactRel);
    writeIfChanged(outPath, stableStringify(report.artifact));
  }
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        artifact: options.artifactRel,
        mode: options.write ? "write" : "check",
        issueCount: report.issueCount,
        securityDefinerFunctionCount: report.securityDefinerFunctionCount,
        tenantViewCount: report.tenantViewCount,
        issues: report.issues,
      },
      null,
      2
    )
  );
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSqlDefinerInvokerInventory();
}
