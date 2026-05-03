#!/usr/bin/env node
/**
 * Dry-parse every workflow under .github/workflows/*.yml (optional platform / CI sweep).
 */
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const root = process.cwd();
const wfDir = path.join(root, ".github", "workflows");
const names = fs.readdirSync(wfDir).filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"));
const failures = [];
for (const name of names.sort()) {
  const abs = path.join(wfDir, name);
  try {
    parseDocument(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    failures.push({ file: name, error: e instanceof Error ? e.message : String(e) });
  }
}
console.log(JSON.stringify({ checkId: "github-workflows-yaml-parse", ok: failures.length === 0, scanned: names.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
