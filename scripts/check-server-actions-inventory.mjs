#!/usr/bin/env node
/**
 * Phase 0f: list "use server" modules under src/actions and flag exports that
 * lack obvious org/session guard strings (heuristic; expand over time).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");

const GUARD_RE =
  /\b(requireOrg|getAuth|getUser|createClient|createServerClient|orgId|organization_id|assertOrg|apiKey)\b/i;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

let issues = 0;
for (const abs of walk(actionsRoot)) {
  const text = fs.readFileSync(abs, "utf8");
  if (!/^\s*["']use server["']/m.test(text)) continue;
  if (!GUARD_RE.test(text)) {
    console.warn(`WARN server action module may lack org/auth guard: ${path.relative(root, abs)}`);
    issues++;
  }
}
console.log(`check-server-actions-inventory: scanned (warnings=${issues}, heuristic only)`);
process.exit(0);
