#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const scriptsDir = path.join(root, "scripts");
const strict = process.argv.includes("--strict");
const maxLines = strict ? 450 : 700;

const offenders = [];
for (const file of walkFiles(scriptsDir, (abs) => abs.endsWith(".mjs"))) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/pipelines/") || rel.startsWith("scripts/lib/")) continue;
  const lines = fs.readFileSync(file, "utf8").split("\n").length;
  if (lines > maxLines) offenders.push({ file: rel, lines, maxLines });
}

const payload = {
  checkId: "script-complexity-ratchet",
  strict,
  ok: offenders.length === 0,
  offenders,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
