#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsRoot = path.join(root, "src", "actions");
const baselinePath = path.join(__dirname, "server-action-complexity-baseline.json");
const strict = process.argv.includes("--strict");
const maxLines = strict ? 450 : 700;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts")) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

const offenders = [];
for (const abs of walk(actionsRoot)) {
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  const lines = fs.readFileSync(abs, "utf8").split("\n").length;
  if (lines > maxLines) offenders.push({ file: rel, lines, maxLines });
}

const payload = {
  checkId: "server-action-complexity",
  strict,
  ok: !strict || offenders.length === 0,
  offenders,
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
