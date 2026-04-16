import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
const formatViolations = files.filter((name) => !/^\d+_[a-z0-9][a-z0-9-_]*\.sql$/.test(name));
const strict = process.argv.includes("--strict");

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

const numericPrefixes = Array.from(prefixMap.keys())
  .map((n) => Number(n))
  .filter((n) => Number.isFinite(n))
  .sort((a, b) => a - b);
const hasNonMonotonicPrefix = numericPrefixes.some((value, index) => {
  if (index === 0) return false;
  return value <= numericPrefixes[index - 1];
});
const widths = new Set(Array.from(prefixMap.keys()).map((prefix) => prefix.length));
const mixedPrefixWidth = widths.size > 1;

const largeGaps = [];
for (let i = 1; i < numericPrefixes.length; i++) {
  const prev = numericPrefixes[i - 1];
  const curr = numericPrefixes[i];
  if (curr - prev > 20) {
    largeGaps.push({ from: prev, to: curr, gap: curr - prev });
  }
}

const forbiddenSqlPatternRows = [];
const forbiddenSqlPatterns = [
  /drop\s+schema\s+public\b/i,
  /\balter\s+role\b/i,
  /\btruncate\s+table\b/i,
  /\bdisable\s+row\s+level\s+security\b/i,
];
for (const name of files) {
  const sql = readFileSync(join(migrationsDir, name), "utf8");
  const matches = forbiddenSqlPatterns.filter((pattern) => pattern.test(sql)).map((pattern) => pattern.source);
  if (matches.length > 0) {
    forbiddenSqlPatternRows.push({ name, matches });
  }
}

console.log(
  JSON.stringify(
    {
      strict,
      migrationFileCount: files.length,
      duplicatePrefixCount: duplicates.length,
      formatViolationCount: formatViolations.length,
      formatViolations,
      mixedPrefixWidth,
      prefixWidths: Array.from(widths).sort((a, b) => a - b),
      hasNonMonotonicPrefix,
      largeGaps,
      forbiddenSqlPatternCount: forbiddenSqlPatternRows.length,
      forbiddenSqlPatternRows,
    },
    null,
    2
  )
);

if (duplicates.length > 0) {
  console.error("Duplicate migration prefixes detected:");
  for (const [prefix, names] of duplicates) {
    console.error(`  ${prefix}: ${names.join(", ")}`);
  }
  process.exit(1);
}

if (formatViolations.length > 0) {
  console.error("Migration filename format violations detected.");
  process.exit(1);
}

if (strict && mixedPrefixWidth) {
  console.error("Mixed migration prefix widths detected in strict mode.");
  process.exit(1);
}

if (strict && hasNonMonotonicPrefix) {
  console.error("Non-monotonic migration prefixes detected in strict mode.");
  process.exit(1);
}

if (strict && forbiddenSqlPatternRows.length > 0) {
  console.error("Forbidden SQL patterns detected in strict mode.");
  process.exit(1);
}

console.log(`Migration prefix check passed (${files.length} files).`);

