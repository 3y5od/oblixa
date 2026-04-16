#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const maxLines = strict ? 350 : 500;
const baselinePath = path.join(root, "scripts", "frontend-component-complexity-baseline.json");
const targets = [
  path.join(root, "src", "components"),
  path.join(root, "src", "app"),
];

const offenders = [];
for (const target of targets) {
  for (const file of walkFiles(target, (abs) => abs.endsWith(".tsx"))) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (/\.test\.tsx$|\.spec\.tsx$/.test(rel)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n").length;
    if (lines > maxLines) offenders.push({ file: rel, lines, maxLines });
  }
}

const payload = {
  checkId: "frontend-component-complexity",
  strict,
  ok: !strict || offenders.length === 0,
  offenders: offenders.slice(0, 100),
  offenderCount: offenders.length,
};
if (strict && fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const baselineMap = new Map((baseline.offenders || []).map((row) => [row.file, row.lines]));
  const regressions = offenders.filter((row) => {
    const prior = baselineMap.get(row.file);
    return prior === undefined || row.lines > prior;
  });
  payload.regressions = regressions;
  payload.ok = regressions.length === 0;
}
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
