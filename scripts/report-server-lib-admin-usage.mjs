#!/usr/bin/env node
/**
 * Lists src/lib TypeScript files (excluding tests) that reference createAdminClient (manual IDOR review).
 * Writes artifacts/generated/security/SECURITY_LIB_ADMIN_CLIENT_INDEX.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSecurityReportsDir, securityReportFilePath, SECURITY_REPORT_FILES } from "./lib/security-report-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const libRoot = path.join(root, "src", "lib");
ensureSecurityReportsDir(root);
const outPath = securityReportFilePath(root, SECURITY_REPORT_FILES.libAdmin);

function walkLibTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkLibTs(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const files = walkLibTs(libRoot).sort();
const hits = [];

for (const abs of files) {
  const content = fs.readFileSync(abs, "utf8");
  if (!/\bcreateAdminClient\b/.test(content)) continue;
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  const importAdmin = /createAdminClient/.test(content);
  hits.push({ rel, note: importAdmin ? "references createAdminClient" : "—" });
}

const lines = [
  "# Library modules referencing createAdminClient",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "**Purpose:** Index only. Each caller must enforce tenant scope when bypassing RLS.",
  "",
  "Regenerate:",
  "",
  "```bash",
  "npm run report:security-lib-admin",
  "```",
  "",
  `**Total files scanned:** ${files.length}`,
  `**Files with createAdminClient:** ${hits.length}`,
  "",
  "| File |",
  "|------|",
];

for (const h of hits) {
  lines.push(`| \`${h.rel}\` |`);
}

lines.push("");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(root, outPath)} (${hits.length} hits).`);
