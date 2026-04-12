#!/usr/bin/env node
/**
 * Next.js 16+: files with "use server" must not export synchronous functions as server actions.
 * Pure helpers belong in src/lib/*.ts without "use server".
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

function hasUseServer(content) {
  const head = content.slice(0, 4000);
  return /^\s*["']use server["']\s*;/m.test(head) || /^\s*["']use server["']\s*$/m.test(head);
}

/** Sync `export function` or `export default function` (not async). */
function findViolations(content, relPath) {
  const violations = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    // export async function — OK
    if (/^\s*export\s+async\s+function\s+\w/.test(line)) continue;
    if (/^\s*export\s+default\s+async\s+function/.test(line)) continue;
    if (/^\s*export\s+function\s+\w/.test(line)) {
      violations.push(`${relPath}:${i + 1}: sync export function (move helper to src/lib or make async)`);
    }
    if (/^\s*export\s+default\s+function(?:\s|<)/.test(line) && !/^\s*export\s+default\s+async\s+function/.test(line)) {
      violations.push(`${relPath}:${i + 1}: sync export default function`);
    }
  }
  return violations;
}

function main() {
  const files = walk(actionsRoot);
  const all = [];
  for (const abs of files) {
    const content = fs.readFileSync(abs, "utf8");
    if (!hasUseServer(content)) continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    all.push(...findViolations(content, rel));
  }
  if (all.length > 0) {
    console.error("check-server-action-exports: invalid sync exports in \"use server\" files:\n");
    for (const v of all) console.error(`  ${v}`);
    console.error("\nMove pure helpers to src/lib/*.ts (no \"use server\") or use export async function.");
    process.exit(1);
  }
  console.log(`OK: ${files.length} action file(s) scanned; no sync function exports in "use server" modules.`);
}

main();
