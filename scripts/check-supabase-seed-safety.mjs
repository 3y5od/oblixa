#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_REPORT_REL = "artifacts/supabase/seed-safety-report.json";
const MIGRATIONS_REL = "supabase/migrations";
const SEED_REL = "supabase/seed.sql";
const RLS_SMOKE_RELS = ["supabase/tests/rls_sanity_smoke.sql", "supabase/tests/rls_default_deny_smoke.sql"];
const SECRET_PATTERNS = [
  { issue: "seed_private_key_block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/u },
  { issue: "seed_supabase_service_role_jwt", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*"role"\s*:\s*"service_role"/u },
  { issue: "seed_openai_key", pattern: /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9]{48,})\b/u },
  { issue: "seed_stripe_live_key", pattern: /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{16,}\b/u },
  { issue: "seed_webhook_secret", pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/u },
  { issue: "seed_url_embeds_credentials", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s]+@/iu },
];

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stripComments(sql) {
  return sql
    .split(/\r?\n/u)
    .filter((line) => !/^\s*--/u.test(line))
    .join("\n");
}

function extractColumnNames(body) {
  const columns = [];
  for (const line of body.split(/\r?\n/u)) {
    const match = /^\s*"?([a-zA-Z_][\w]*)"?\s+/u.exec(line);
    if (!match) continue;
    const column = match[1].toLowerCase();
    if (["constraint", "primary", "unique", "foreign", "check"].includes(column)) continue;
    columns.push(column);
  }
  return columns;
}

function collectDefinitions(root) {
  const definitions = new Map();
  const migrationsDir = path.join(root, MIGRATIONS_REL);
  if (!fs.existsSync(migrationsDir)) return definitions;
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    const rel = `${MIGRATIONS_REL}/${file}`;
    const sql = stripComments(read(root, rel));
    for (const match of sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\);/giu)) {
      definitions.set(`${match[1]}.${match[2]}`, {
        schema: match[1],
        table: match[2],
        columns: new Set(extractColumnNames(match[3])),
        source: rel,
      });
    }
    for (const match of sql.matchAll(
      /\balter\s+table\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?\b/giu,
    )) {
      const ref = `${match[1]}.${match[2]}`;
      const definition = definitions.get(ref) ?? {
        schema: match[1],
        table: match[2],
        columns: new Set(),
        source: rel,
      };
      definition.columns.add(match[3].toLowerCase());
      definitions.set(ref, definition);
    }
  }
  definitions.set("storage.buckets", {
    schema: "storage",
    table: "buckets",
    columns: new Set(["id", "name", "owner", "public", "file_size_limit", "allowed_mime_types"]),
    source: "supabase managed storage schema",
  });
  return definitions;
}

function collectSeedInserts(seedSql) {
  const inserts = [];
  for (const match of seedSql.matchAll(/\binsert\s+into\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/giu)) {
    inserts.push({
      schema: match[1],
      table: match[2],
      ref: `${match[1]}.${match[2]}`,
      columns: match[3]
        .split(",")
        .map((column) => column.replace(/["\s]/gu, "").toLowerCase())
        .filter(Boolean),
    });
  }
  return inserts;
}

function detectSecrets(seedSql) {
  const issues = [];
  for (const { issue, pattern } of SECRET_PATTERNS) {
    if (pattern.test(seedSql)) issues.push({ issue, path: SEED_REL });
  }
  return issues;
}

function seedRlsCoverage({ seedSql, root }) {
  const smokeText = RLS_SMOKE_RELS.map((rel) => read(root, rel)).join("\n");
  return {
    seedsOrganization: /\binsert\s+into\s+public\.organizations\b/iu.test(seedSql),
    smokeUsesOrganizations: /\binsert\s+into\s+public\.organizations\b/iu.test(smokeText),
    smokeUsesMemberships: /\binsert\s+into\s+public\.organization_members\b/iu.test(smokeText),
    smokeFiles: RLS_SMOKE_RELS,
  };
}

export function analyzeSupabaseSeedSafety(root = DEFAULT_ROOT) {
  const issues = [];
  const seedSql = read(root, SEED_REL);
  if (!seedSql) issues.push({ issue: "missing_supabase_seed_sql", path: SEED_REL });

  const definitions = collectDefinitions(root);
  const inserts = collectSeedInserts(seedSql);
  for (const insert of inserts) {
    const definition = definitions.get(insert.ref);
    if (!definition) {
      issues.push({ issue: "seed_references_missing_table", path: SEED_REL, ref: insert.ref });
      continue;
    }
    for (const column of insert.columns) {
      if (!definition.columns.has(column)) {
        issues.push({ issue: "seed_references_missing_column", path: SEED_REL, ref: insert.ref, column });
      }
    }
  }

  issues.push(...detectSecrets(seedSql));

  const rlsCoverage = seedRlsCoverage({ seedSql, root });
  if (rlsCoverage.seedsOrganization && (!rlsCoverage.smokeUsesOrganizations || !rlsCoverage.smokeUsesMemberships)) {
    issues.push({
      issue: "seed_rls_paths_missing_smoke_coverage",
      path: SEED_REL,
      smokeFiles: RLS_SMOKE_RELS,
    });
  }

  return {
    schemaVersion: 1,
    ok: issues.length === 0,
    seedPath: SEED_REL,
    insertCount: inserts.length,
    insertedObjects: inserts.map((insert) => ({ ref: insert.ref, columns: insert.columns })),
    rlsCoverage,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, write: false, reportRel: DEFAULT_REPORT_REL };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--report") {
      options.reportRel = toPosix(argv[index + 1] ?? DEFAULT_REPORT_REL);
      index += 1;
    } else if (arg.startsWith("--report=")) {
      options.reportRel = toPosix(arg.slice("--report=".length));
    }
  }
  return options;
}

export function runSupabaseSeedSafety(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeSupabaseSeedSafety(options.root);
  if (options.write) {
    const abs = path.join(options.root, options.reportRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, stableStringify(report));
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSupabaseSeedSafety();
}
