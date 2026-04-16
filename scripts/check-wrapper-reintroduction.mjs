#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scriptsDir = path.join(root, "scripts");
const strict = process.argv.includes("--strict");
const baselinePath = path.join(root, "scripts", "wrapper-reintroduction-baseline.json");
const wrapperBody =
  '#!/usr/bin/env node\nimport { runGenericSecurityCheck } from "./security-check-generic.mjs";\nrunGenericSecurityCheck(import.meta.url);\n';

let allowedGenericWrappers = new Set();
let baselineAllowList = [];
if (fs.existsSync(baselinePath)) {
  const raw = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  baselineAllowList = raw.allowedGenericWrappers || [];
  for (const rel of baselineAllowList) allowedGenericWrappers.add(rel);
}

const staleAllowlistEntries = [];
if (strict) {
  for (const rel of baselineAllowList) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      staleAllowlistEntries.push({ rel, reason: "missing_file" });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    if (text !== wrapperBody) {
      staleAllowlistEntries.push({ rel, reason: "content_mismatch" });
    }
  }
}

const wrappers = [];
for (const name of fs.readdirSync(scriptsDir)) {
  if (!name.startsWith("check-") || !name.endsWith(".mjs")) continue;
  const abs = path.join(scriptsDir, name);
  const text = fs.readFileSync(abs, "utf8");
  if (text === wrapperBody) wrappers.push(`scripts/${name}`);
}

const unexpected = wrappers.filter((w) => !allowedGenericWrappers.has(w));
const payload = {
  checkId: "wrapper-reintroduction",
  strict,
  ok: !strict || (unexpected.length === 0 && staleAllowlistEntries.length === 0),
  wrappers,
  unexpectedGenericWrappers: unexpected,
  allowedGenericWrapperCount: allowedGenericWrappers.size,
  staleAllowlistEntries,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
