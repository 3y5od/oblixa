#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const scripts = pkg.scripts || {};

let changed = 0;
for (const [name, value] of Object.entries(scripts)) {
  if (!name.startsWith("check:")) continue;
  const m = value.match(/^node scripts\/check-([a-z0-9-]+)\.mjs(.*)$/);
  if (!m) continue;
  const id = m[1];
  const trailing = (m[2] || "").trim();
  scripts[name] = trailing
    ? `node scripts/run-check.mjs ${id} ${trailing}`.replace(/\s+/g, " ")
    : `node scripts/run-check.mjs ${id}`;
  changed += 1;
}

pkg.scripts = scripts;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(JSON.stringify({ changedScripts: changed }, null, 2));
