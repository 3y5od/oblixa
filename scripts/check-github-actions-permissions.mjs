#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const wfDir = path.join(ROOT, ".github", "workflows");
const issues = [];

for (const name of fs.readdirSync(wfDir)) {
  if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
  const text = fs.readFileSync(path.join(wfDir, name), "utf8");
  if (!/^permissions:\s*$/m.test(text) && !/^permissions:\s*\{/m.test(text)) {
    issues.push({ file: name, issue: "missing_top_level_permissions" });
  }
}

console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2));
process.exit(issues.length ? 1 : 0);
