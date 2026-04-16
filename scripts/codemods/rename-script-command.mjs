#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [, , fromName, toName, ...flags] = process.argv;
const dryRun = flags.includes("--dry-run");
if (!fromName || !toName) {
  console.error("usage: node scripts/codemods/rename-script-command.mjs <from> <to> [--dry-run]");
  process.exit(1);
}

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const scripts = pkg.scripts || {};

if (!(fromName in scripts)) {
  console.error(`source script not found: ${fromName}`);
  process.exit(1);
}
if (toName in scripts) {
  console.error(`target script already exists: ${toName}`);
  process.exit(1);
}

scripts[toName] = scripts[fromName];
delete scripts[fromName];
pkg.scripts = scripts;

if (dryRun) {
  console.log(JSON.stringify({ changed: true, dryRun, fromName, toName }, null, 2));
  process.exit(0);
}

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(JSON.stringify({ changed: true, dryRun, fromName, toName }, null, 2));
