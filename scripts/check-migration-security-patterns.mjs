#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const strict = process.argv.includes("--strict");

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const issues = [];

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
}

console.log(JSON.stringify({ strict, issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
