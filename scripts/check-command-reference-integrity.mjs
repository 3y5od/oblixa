#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};

function collectReferences(text) {
  const refs = [];
  for (const m of text.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
    refs.push(m[1]);
  }
  return refs;
}

const files = [
  ...walkFiles(path.join(root, ".github", "workflows"), (abs) => abs.endsWith(".yml")),
  ...walkFiles(path.join(root, "scripts"), (abs) => abs.endsWith(".mjs") || abs.endsWith(".txt")),
];
const missing = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const ref of collectReferences(text)) {
    if (!(ref in scripts)) {
      missing.push({
        file: path.relative(root, file).replace(/\\/g, "/"),
        missingCommand: ref,
      });
    }
  }
}
const payload = {
  checkId: "command-reference-integrity",
  ok: missing.length === 0,
  missing,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
