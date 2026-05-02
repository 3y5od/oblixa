#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const rel of ["artifacts/mta-sts-policy.json", "artifacts/bimi-svg-placeholder.json"]) {
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}
console.log(JSON.stringify({ ok: true, validated: ["mta-sts-policy", "bimi-placeholder"] }, null, 2));
process.exit(0);
