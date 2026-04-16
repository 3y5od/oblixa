#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const scriptsDir = path.join(root, "scripts");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const commands = Object.values(pkg.scripts || {}).join("\n");
const used = new Set();

for (const m of commands.matchAll(/scripts\/([A-Za-z0-9_./-]+\.mjs)/g)) {
  used.add(m[1]);
}

for (const wf of walkFiles(path.join(root, ".github", "workflows"), (abs) => abs.endsWith(".yml"))) {
  const text = fs.readFileSync(wf, "utf8");
  for (const m of text.matchAll(/scripts\/([A-Za-z0-9_./-]+\.mjs)/g)) {
    used.add(m[1]);
  }
}

const allScripts = walkFiles(scriptsDir, (abs) => abs.endsWith(".mjs")).map((abs) =>
  path.relative(scriptsDir, abs).replace(/\\/g, "/")
);
const ignore = new Set([
  "lib/args.mjs",
  "lib/process.mjs",
  "lib/result.mjs",
  "lib/timing.mjs",
  "lib/fs-walk.mjs",
  "lib/allowlist.mjs",
  "lib/scheduler.mjs",
  "check-registry.mjs",
  "run-check.mjs",
  "security-check-generic.mjs",
  "cron-route-expected-keys.mjs",
  "release-checklist.mjs",
  "audit-v7-cross-surface-hrefs.mjs",
  "check-v7-vocabulary.mjs",
]);

const unused = allScripts.filter(
  (rel) => !used.has(rel) && !ignore.has(rel) && !rel.startsWith("lib/")
);
const payload = {
  checkId: "unused-script-files",
  ok: unused.length === 0,
  totalScripts: allScripts.length,
  referencedScripts: used.size,
  unused,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
