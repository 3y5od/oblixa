#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_INVENTORY_REL = "artifacts/supabase/data-retention-inventory.json";
const POLICY_REL = "src/lib/security/retention-policy.ts";
const MIGRATIONS_REL = "supabase/migrations";
const CLEANUP_ROUTE_REL = "src/app/api/cron/security/retention-cleanup/route.ts";
const VERCEL_REL = "vercel.json";

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function allMigrationSql(root) {
  const dir = path.join(root, MIGRATIONS_REL);
  if (!fs.existsSync(dir)) return "";
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => read(root, `${MIGRATIONS_REL}/${file}`))
    .join("\n");
}

function valueForKey(block, key) {
  const match = new RegExp(`${key}\\s*:\\s*"([^"]+)"`, "u").exec(block);
  return match?.[1] ?? "";
}

function numberForKey(block, key) {
  const match = new RegExp(`${key}\\s*:\\s*(\\d+)`, "u").exec(block);
  return match ? Number(match[1]) : null;
}

function arrayForKey(block, key) {
  const match = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`, "u").exec(block);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((row) => row[1]).sort((a, b) => a.localeCompare(b));
}

export function parseRetentionPolicies(source) {
  const policies = [];
  for (const match of source.matchAll(/\{\s*dataClass:\s*"([^"]+)"([\s\S]*?)\n\s*\}/gu)) {
    const block = match[0];
    const dataClass = match[1];
    const table = valueForKey(block, "table");
    const timestampField = valueForKey(block, "timestampField");
    const retentionDays = numberForKey(block, "retentionDays");
    const strategy = valueForKey(block, "strategy");
    const cleanupRpc = valueForKey(block, "cleanupRpc");
    policies.push({
      dataClass,
      table,
      timestampField,
      retentionDays,
      strategy,
      cleanupRpc,
      fields: arrayForKey(block, "fields"),
    });
  }
  return policies.sort((a, b) => a.dataClass.localeCompare(b.dataClass));
}

function hasTableReference(sql, table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`\\bpublic\\.${escaped}\\b`, "iu").test(sql);
}

function hasColumnReference(sql, table, column) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    new RegExp(`alter\\s+table\\s+public\\.${escapedTable}[\\s\\S]{0,260}\\b${escapedColumn}\\b`, "iu").test(sql) ||
    new RegExp(`create\\s+table[\\s\\S]{0,260}\\bpublic\\.${escapedTable}\\b[\\s\\S]{0,800}\\b${escapedColumn}\\b`, "iu").test(sql) ||
    new RegExp(`\\b${escapedTable}\\b[\\s\\S]{0,200}\\b${escapedColumn}\\b`, "iu").test(sql)
  );
}

function hasCleanupIndex(sql, table, column) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `create\\s+(?:unique\\s+)?index(?:\\s+if\\s+not\\s+exists)?\\s+[\\w"]+\\s+on\\s+public\\.${escapedTable}\\s*\\([^;]*\\b${escapedColumn}\\b`,
    "iu",
  ).test(sql);
}

function routeIsCronAuthenticated(routeSource) {
  return /withCronRoute/u.test(routeSource) && /cleanup_code_owned_transient_data/u.test(routeSource);
}

function routeHasIdempotentCleanupShape(routeSource) {
  return (
    /export\s+const\s+GET\s*=\s*withCronRoute\b/u.test(routeSource) &&
    !/export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b|export\s+const\s+(?:POST|PUT|PATCH|DELETE)\b/u.test(routeSource) &&
    /const\s+retentionCutoff\s*=\s*new\s+Date\(\)\.toISOString\(\)/u.test(routeSource) &&
    /admin\.rpc\(\s*["']cleanup_code_owned_transient_data["']\s*,\s*\{\s*retention_cutoff:\s*retentionCutoff\s*,?\s*\}/u.test(routeSource) &&
    !/\brequest\.(?:json|formData|text|arrayBuffer)\s*\(/u.test(routeSource)
  );
}

function vercelHasCleanupCron(root) {
  try {
    const parsed = JSON.parse(read(root, VERCEL_REL) || "{}");
    return (Array.isArray(parsed.crons) ? parsed.crons : []).some((entry) => entry.path === "/api/cron/security/retention-cleanup");
  } catch {
    return false;
  }
}

export function buildSupabaseRetentionInventory(root = DEFAULT_ROOT) {
  const policies = parseRetentionPolicies(read(root, POLICY_REL));
  const sql = allMigrationSql(root);
  const routeSource = read(root, CLEANUP_ROUTE_REL);
  const tables = policies.map((policy) => ({
    ...policy,
    tableReferencedInMigrations: hasTableReference(sql, policy.table),
    timestampColumnReferenced: hasColumnReference(sql, policy.table, policy.timestampField),
    cleanupIndexPresent: hasCleanupIndex(sql, policy.table, policy.timestampField),
    cleanupRpcReferenced: new RegExp(`\\b${policy.cleanupRpc}\\b`, "u").test(sql) && routeSource.includes(policy.cleanupRpc),
  }));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-supabase-retention-inventory.mjs --write",
    policySource: POLICY_REL,
    cleanupRoute: CLEANUP_ROUTE_REL,
    policyCount: tables.length,
    cleanupRouteCronAuthenticated: routeIsCronAuthenticated(routeSource),
    cleanupRouteIdempotencyGuarded: routeHasIdempotentCleanupShape(routeSource),
    cleanupRouteScheduled: vercelHasCleanupCron(root),
    tables,
  };
}

function loadInventory(root, inventoryRel) {
  const abs = path.join(root, inventoryRel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export function analyzeSupabaseRetentionInventory(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const inventoryRel = toPosix(options.inventoryRel ?? DEFAULT_INVENTORY_REL);
  const current = buildSupabaseRetentionInventory(root);
  const committed = loadInventory(root, inventoryRel);
  const issues = [];

  if (!committed) {
    issues.push({ issue: "retention_inventory_missing", path: inventoryRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({ issue: "retention_inventory_drift", path: inventoryRel, hint: "Run npm run write:supabase:retention-inventory" });
  }

  if (!current.cleanupRouteCronAuthenticated) {
    issues.push({ issue: "retention_cleanup_route_missing_cron_auth", path: CLEANUP_ROUTE_REL });
  }
  if (!current.cleanupRouteIdempotencyGuarded) {
    issues.push({ issue: "retention_cleanup_route_idempotency_not_guarded", path: CLEANUP_ROUTE_REL });
  }
  if (!current.cleanupRouteScheduled) {
    issues.push({ issue: "retention_cleanup_route_missing_schedule", path: VERCEL_REL });
  }
  for (const table of current.tables) {
    if (!table.tableReferencedInMigrations) issues.push({ issue: "retention_table_missing_migration_reference", table: table.table });
    if (!table.timestampColumnReferenced) {
      issues.push({ issue: "retention_timestamp_column_missing_migration_reference", table: table.table, column: table.timestampField });
    }
    if (!table.cleanupIndexPresent) {
      issues.push({ issue: "retention_cleanup_index_missing", table: table.table, column: table.timestampField });
    }
    if (!table.cleanupRpcReferenced) {
      issues.push({ issue: "retention_cleanup_rpc_missing_reference", table: table.table, rpc: table.cleanupRpc });
    }
  }

  return {
    ok: issues.length === 0,
    inventoryPath: inventoryRel,
    policyCount: current.policyCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, inventoryRel: DEFAULT_INVENTORY_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--inventory") {
      options.inventoryRel = toPosix(argv[index + 1] ?? DEFAULT_INVENTORY_REL);
      index += 1;
    } else if (arg.startsWith("--inventory=")) {
      options.inventoryRel = toPosix(arg.slice("--inventory=".length));
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

function writeInventory(root, inventoryRel) {
  const inventory = buildSupabaseRetentionInventory(root);
  const abs = path.join(root, inventoryRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(inventory));
  return inventory;
}

export function runSupabaseRetentionInventory(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const inventory = writeInventory(options.root, options.inventoryRel);
    console.log(JSON.stringify({ ok: true, wrote: options.inventoryRel, policyCount: inventory.policyCount }, null, 2));
    return inventory;
  }

  const report = analyzeSupabaseRetentionInventory(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseRetentionInventory();
}
