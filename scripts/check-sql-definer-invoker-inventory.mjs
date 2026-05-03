#!/usr/bin/env node
/**
 * Epic 25 — inventory SECURITY DEFINER / INVOKER (and related) usage in Supabase migrations.
 * Writes artifacts/assurance/sql-definer-invoker-inventory.json; exits 0 unless SQL_DEFINER_INVOKER_STRICT=1 and parse errors.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const migDir = path.join(root, "supabase", "migrations");
const outPath = path.join(root, "artifacts", "assurance", "sql-definer-invoker-inventory.json");

const strict = process.env.SQL_DEFINER_INVOKER_STRICT === "1";

function scanFile(relPath, text) {
  const hits = [];
  const lines = text.split(/\n/);
  lines.forEach((line, idx) => {
    const n = idx + 1;
    const lower = line.toLowerCase();
    if (/\bsecurity\s+definer\b/i.test(line)) {
      hits.push({ line: n, kind: "SECURITY_DEFINER", text: line.trim().slice(0, 240) });
    }
    if (/\bsecurity\s+invoker\b/i.test(line)) {
      hits.push({ line: n, kind: "SECURITY_INVOKER", text: line.trim().slice(0, 240) });
    }
    if (/\bsecurity_invoker\s*=/i.test(line)) {
      hits.push({ line: n, kind: "VIEW_SECURITY_INVOKER_OPTION", text: line.trim().slice(0, 240) });
    }
  });
  return hits.length ? { file: relPath, hits } : null;
}

const rows = [];
if (fs.existsSync(migDir)) {
  for (const name of fs.readdirSync(migDir).sort()) {
    if (!name.endsWith(".sql")) continue;
    const abs = path.join(migDir, name);
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch (e) {
      console.error(`read failed ${name}:`, e);
      process.exit(strict ? 1 : 0);
    }
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const row = scanFile(rel, text);
    if (row) rows.push(row);
  }
}

const payload = {
  version: 1,
  program: "maximal-assurance-epic25",
  generatedAt: new Date().toISOString(),
  migrationDir: "supabase/migrations",
  filesWithHits: rows.length,
  rows,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  JSON.stringify({
    ok: true,
    artifact: path.relative(root, outPath),
    filesWithHits: rows.length,
  })
);
