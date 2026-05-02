#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const e2eDir = path.join(ROOT, "e2e");
const exemptPath = path.join(ROOT, "scripts", "e2e-tag-exemptions.json");
const TAG_RE = /@(smoke|nightly|staging|pr)\b/;

let exempt = { exemptUntil: null, exemptFiles: [] };
if (fs.existsSync(exemptPath)) {
  exempt = JSON.parse(fs.readFileSync(exemptPath, "utf8"));
}

const until = exempt.exemptUntil ? new Date(exempt.exemptUntil) : null;
if (until && until > new Date()) {
  console.log(
    JSON.stringify({ ok: true, mode: "migration_window", exemptUntil: exempt.exemptUntil }, null, 2)
  );
  process.exit(0);
}

const files = fs
  .readdirSync(e2eDir)
  .filter((f) => f.endsWith(".spec.ts"))
  .map((f) => path.join(e2eDir, f));

const exemptSet = new Set((exempt.exemptFiles || []).map((f) => path.basename(f)));
const missing = [];
for (const abs of files) {
  const base = path.basename(abs);
  if (exemptSet.has(base)) continue;
  const text = fs.readFileSync(abs, "utf8");
  if (!TAG_RE.test(text)) missing.push(base);
}

if (missing.length) {
  console.error(JSON.stringify({ ok: false, missingTags: missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, taggedFiles: files.length }, null, 2));
process.exit(0);
