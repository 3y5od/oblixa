#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { buildCheckRegistry } from "./check-registry.mjs";

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const scripts = pkg.scripts || {};
const registry = buildCheckRegistry();
const issues = [];

for (const [name, cmd] of Object.entries(scripts)) {
  if (!name.startsWith("check:")) continue;
  const match = cmd.match(/scripts\/(check-[\w-]+\.mjs)/);
  if (!match) continue;
  const id = match[1].replace(/^check-/, "").replace(/\.mjs$/, "");
  if (!registry.has(id)) {
    issues.push({ script: name, issue: "missing_registry_entry", expectedId: id });
  }
}

const payload = {
  checkId: "script-registry-integrity",
  ok: issues.length === 0,
  issues,
  registrySize: registry.size,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
