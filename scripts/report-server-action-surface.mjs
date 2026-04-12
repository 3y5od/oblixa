#!/usr/bin/env node
/**
 * Heuristic scan of src/actions/*.ts (excluding *.test.ts).
 * Writes docs/SECURITY_SERVER_ACTIONS_HEURISTICS.md
 *
 * V7: Advanced/Assurance mutations should use the same surface guards as APIs; prefer colocated
 * `*.test.ts` next to each action module (see src/actions/*scope*.test.ts patterns).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");
const outPath = path.join(root, "docs", "SECURITY_SERVER_ACTIONS_HEURISTICS.md");

function walkActionFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkActionFiles(p, acc);
    else if (name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function exportedAsyncFunctions(content) {
  const names = [];
  const re = /export\s+async\s+function\s+(\w+)/g;
  let m;
  while ((m = re.exec(content)) !== null) names.push(m[1]);
  return names;
}

function flags(content) {
  const f = [];
  if (/\bcreateAdminClient\b/.test(content)) f.push("createAdminClient");
  if (/\bcreateClient\b/.test(content)) f.push("createClient");
  if (/\bgetUser\b/.test(content) || /\.auth\.getUser/.test(content)) f.push("getUser");
  if (/\bz\.object\s*\(/.test(content) || /\bzod\b/.test(content)) f.push("zod");
  if (/\bgetDeterministicMembership\b/.test(content)) f.push("getDeterministicMembership");
  if (/\bcanManage|requireAdmin|assertOrg|organization_id/.test(content))
    f.push("org/membership hints");
  return f.length ? f.join(", ") : "—";
}

const files = walkActionFiles(actionsRoot).sort();
const rows = [];

for (const abs of files) {
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  const content = fs.readFileSync(abs, "utf8");
  const exports = exportedAsyncFunctions(content);
  rows.push({
    rel,
    exports: exports.length ? exports.join(", ") : "—",
    flags: flags(content),
  });
}

const lines = [
  "# Server Actions surface (heuristics)",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "**Disclaimer:** Exported async functions and substring flags are approximate. Review each action for authz parity with API routes.",
  "",
  "Regenerate:",
  "",
  "```bash",
  "npm run report:security-server-actions",
  "```",
  "",
  `**Total files:** ${files.length}`,
  "",
  "| File | export async function … | Signals |",
  "|------|-------------------------|---------|",
];

for (const r of rows) {
  lines.push(`| \`${r.rel}\` | ${r.exports} | ${r.flags} |`);
}

lines.push("");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(root, outPath)} (${files.length} files).`);
