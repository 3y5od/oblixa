#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_BASELINE_REGISTRY_REL = "scripts/baseline-registry.json";
const REQUIRED_IGNORED_LOCAL_PATHS = ["supabase/.branches", "supabase/.temp"];
const REQUIRED_BASELINE_TEMP_PATHS = ["supabase/.branches/**", "supabase/.temp/**"];
const CONFIG_PURPOSES = new Map([
  ["supabase/config.toml", "Supabase local development configuration"],
  ["supabase/seed.sql", "Local seed SQL applied by Supabase reset"],
  ["supabase/sql/read_only_operational_snapshot.sql", "Read-only operational snapshot SQL bundle"],
]);
const ALLOWED_SUPABASE_ROOTS = new Set(["config.toml", "seed.sql", "migrations", "sql", "tests", "snippets"]);
const SENSITIVE_PATTERNS = [
  { issue: "supabase_config_contains_remote_supabase_url", pattern: /https:\/\/[a-z0-9-]+\.supabase\.co/iu },
  { issue: "supabase_config_contains_database_url", pattern: /\bpostgres(?:ql)?:\/\/[^\s"'`]+/iu },
  { issue: "supabase_config_contains_pooler_host", pattern: /\b(?:aws-|ap-|ca-|eu-|sa-|us-)?[a-z0-9.-]*pooler\.supabase\.com\b/iu },
  { issue: "supabase_config_contains_service_role_key", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/u },
  { issue: "supabase_config_contains_webhook_secret", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/u },
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function walk(root, dir, entries = []) {
  if (!fs.existsSync(dir)) return entries;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = relPath(root, abs);
    entries.push({
      path: rel,
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
    });
    if (entry.isDirectory()) walk(root, abs, entries);
  }
  return entries;
}

function isIgnoredByGitignore(gitignore, rel) {
  const normalized = toPosix(rel).replace(/\/+$/u, "");
  return gitignore
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .some((line) => {
      const pattern = line.replace(/\/+$/u, "");
      return pattern === normalized || pattern === `${normalized}/**` || pattern === `${normalized}/`;
    });
}

function parseSupabaseConfigToml(text) {
  const rows = [];
  let section = "";
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sectionMatch = /^\[([^\]]+)\]$/u.exec(trimmed);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const assignment = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/u.exec(trimmed);
    if (!assignment) continue;
    rows.push({
      section,
      key: assignment[1],
      value: assignment[2].replace(/\s+#.*$/u, "").trim(),
    });
  }
  return rows;
}

function collectSupabaseInventory(root) {
  const supabaseRoot = path.join(root, "supabase");
  const entries = walk(root, supabaseRoot).sort((a, b) => a.path.localeCompare(b.path));
  const files = entries.filter((entry) => entry.kind === "file").map((entry) => entry.path);
  const configRows = parseSupabaseConfigToml(read(path.join(root, "supabase/config.toml")));
  return {
    roots: entries.filter((entry) => entry.path.split("/").length === 2).map((entry) => entry.path),
    files: files.map((file) => ({
      path: file,
      purpose: CONFIG_PURPOSES.get(file) ?? (file.startsWith("supabase/migrations/") ? "Database migration" : file.startsWith("supabase/tests/") ? "Local SQL smoke test" : file.startsWith("supabase/sql/") ? "Local SQL utility bundle" : "Supabase local file"),
    })),
    config: {
      path: "supabase/config.toml",
      rows: configRows,
      dbSeedSqlPaths: configRows
        .filter((row) => row.section === "db.seed" && row.key === "sql_paths")
        .map((row) => row.value),
      dbMigrationSchemaPaths: configRows
        .filter((row) => row.section === "db.migrations" && row.key === "schema_paths")
        .map((row) => row.value),
    },
  };
}

function loadBaselineRegistry(root, registryRel) {
  const abs = path.join(root, registryRel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(read(abs));
}

function addIssue(issues, issue) {
  issues.push(issue);
}

function assertNoSensitiveConfigValues(root, inventory, issues) {
  for (const file of inventory.files) {
    if (!/\.(?:toml|sql)$/u.test(file.path)) continue;
    const text = read(path.join(root, file.path));
    for (const { issue, pattern } of SENSITIVE_PATTERNS) {
      if (pattern.test(text)) {
        addIssue(issues, {
          issue,
          path: file.path,
          message: "Supabase local configuration must not contain production URLs, database URLs, service keys, or webhook secrets.",
        });
      }
    }
  }
}

function assertTestSqlNotAppliedAsMigrations(root, inventory, issues) {
  const configText = read(path.join(root, "supabase/config.toml"));
  if (!/^\s*sql_paths\s*=\s*\[\s*"\.\/seed\.sql"\s*\]\s*$/mu.test(configText)) {
    addIssue(issues, {
      issue: "unexpected_supabase_seed_sql_paths",
      path: "supabase/config.toml",
      message: "db.seed.sql_paths should only reference ./seed.sql; test SQL belongs under supabase/tests.",
    });
  }
  if (!/^\s*schema_paths\s*=\s*\[\s*\]\s*$/mu.test(configText)) {
    addIssue(issues, {
      issue: "unexpected_supabase_migration_schema_paths",
      path: "supabase/config.toml",
      message: "db.migrations.schema_paths should stay empty so test SQL is not applied as migrations.",
    });
  }

  for (const file of inventory.files.filter((row) => row.path.startsWith("supabase/migrations/"))) {
    const text = read(path.join(root, file.path));
    if (/\b(?:pgTAP|raises_ok|throws_ok|lives_ok|results_eq|rls_sanity|default_deny_smoke|view_invoker_smoke)\b/iu.test(text)) {
      addIssue(issues, {
        issue: "test_sql_appears_under_migrations",
        path: file.path,
        message: "Migration SQL appears to contain smoke-test markers; test SQL should live under supabase/tests.",
      });
    }
  }
}

function assertLocalStateIgnored(root, registryRel, issues) {
  const gitignore = read(path.join(root, ".gitignore"));
  for (const rel of REQUIRED_IGNORED_LOCAL_PATHS) {
    if (!isIgnoredByGitignore(gitignore, rel)) {
      addIssue(issues, {
        issue: "supabase_local_state_not_gitignored",
        path: ".gitignore",
        localPath: rel,
        message: "Supabase CLI local state must be ignored.",
      });
    }
  }

  const registry = loadBaselineRegistry(root, registryRel);
  if (!registry) {
    addIssue(issues, {
      issue: "baseline_registry_missing_for_supabase_temp_paths",
      path: registryRel,
      message: "Baseline registry is required to verify Supabase local state exclusions.",
    });
    return;
  }
  const temporaryPaths = new Set((registry.baselines ?? []).flatMap((entry) => entry.temporaryPaths ?? []));
  for (const rel of REQUIRED_BASELINE_TEMP_PATHS) {
    if (!temporaryPaths.has(rel)) {
      addIssue(issues, {
        issue: "supabase_local_state_missing_from_baseline_temporary_paths",
        path: registryRel,
        localPath: rel,
        message: "Baseline-owned scanners should explicitly exclude Supabase CLI local state.",
      });
    }
  }
}

function assertSupabaseRootIsRecognized(inventory, issues) {
  for (const rootPath of inventory.roots) {
    const name = rootPath.split("/")[1];
    if (name.startsWith(".")) continue;
    if (!ALLOWED_SUPABASE_ROOTS.has(name)) {
      addIssue(issues, {
        issue: "unexpected_supabase_root_entry",
        path: rootPath,
        message: "Supabase root contains an unrecognized tracked/local entry.",
      });
    }
  }
}

export function analyzeSupabaseConfigGuard(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const registryRel = toPosix(options.registryRel ?? DEFAULT_BASELINE_REGISTRY_REL);
  const issues = [];
  const inventory = collectSupabaseInventory(root);

  assertSupabaseRootIsRecognized(inventory, issues);
  assertNoSensitiveConfigValues(root, inventory, issues);
  assertTestSqlNotAppliedAsMigrations(root, inventory, issues);
  assertLocalStateIgnored(root, registryRel, issues);

  return {
    ok: issues.length === 0,
    supabaseFileCount: inventory.files.length,
    configPath: "supabase/config.toml",
    localStatePaths: REQUIRED_IGNORED_LOCAL_PATHS,
    baselineTemporaryPaths: REQUIRED_BASELINE_TEMP_PATHS,
    inventory,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, registryRel: DEFAULT_BASELINE_REGISTRY_REL };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--registry") {
      options.registryRel = toPosix(argv[index + 1] ?? DEFAULT_BASELINE_REGISTRY_REL);
      index += 1;
    } else if (arg.startsWith("--registry=")) {
      options.registryRel = toPosix(arg.slice("--registry=".length));
    }
  }
  return options;
}

export function runSupabaseConfigGuard(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeSupabaseConfigGuard(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseConfigGuard();
}
