import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));

const prefixMap = new Map();
for (const name of files) {
  const m = /^(\d+)_/.exec(name);
  if (!m) continue;
  const prefix = m[1];
  const arr = prefixMap.get(prefix) ?? [];
  arr.push(name);
  prefixMap.set(prefix, arr);
}

const duplicates = Array.from(prefixMap.entries())
  .filter(([, names]) => names.length > 1)
  .sort((a, b) => Number(a[0]) - Number(b[0]));

if (duplicates.length > 0) {
  console.error("Duplicate migration prefixes detected:");
  for (const [prefix, names] of duplicates) {
    console.error(`  ${prefix}: ${names.join(", ")}`);
  }
  process.exit(1);
}

console.log(`Migration prefix check passed (${files.length} files).`);

