#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const strict = process.argv.includes("--strict");

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const issues = [];

/** Baseline migration predates `SET search_path` pinning; superseded by later hardening migrations. */
const SECURITY_DEFINER_LEGACY_FILES = new Set(["001_initial_schema.sql"]);

/** Strip full-line `--` comments (migration hygiene; avoids false positives from prose). */
function stripFullLineComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

for (const file of files) {
  const rel = `supabase/migrations/${file}`;
  const text = fs.readFileSync(path.join(migrationsDir, file), "utf8");

  if (/disable\s+row\s+level\s+security/i.test(text)) {
    issues.push({ file: rel, issue: "disables_row_level_security" });
  }
  if (/grant\s+all\s+on\s+(?:table\s+)?public\./i.test(text)) {
    issues.push({ file: rel, issue: "grant_all_on_public_table" });
  }
  if (/create\s+table(?:\s+if\s+not\s+exists)?\s+public\./i.test(text)) {
    if (!/enable\s+row\s+level\s+security/i.test(text)) {
      issues.push({ file: rel, issue: "creates_table_without_rls_enable" });
    }
  }
  if (/storage\.objects/i.test(text) && !/create policy/i.test(text)) {
    issues.push({ file: rel, issue: "storage_objects_without_policy_update" });
  }

  const funcChunks = text.split(/(?=create\s+or\s+replace\s+function)/i);
  for (const chunk of funcChunks) {
    const trimmed = chunk.trimStart();
    if (!/^create\s+or\s+replace\s+function\b/i.test(trimmed)) continue;
    const body = stripFullLineComments(chunk);
    if (!/\bsecurity\s+definer\b/i.test(body)) continue;
    if (!/\bset\s+search_path\s*=/i.test(body) && !SECURITY_DEFINER_LEGACY_FILES.has(file)) {
      issues.push({ file: rel, issue: "security_definer_function_missing_set_search_path" });
      break;
    }
  }
}

console.log(JSON.stringify({ strict, issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
