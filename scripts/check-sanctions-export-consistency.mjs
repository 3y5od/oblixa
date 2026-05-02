#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const m = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "eccn-feature-matrix.json"), "utf8"));
console.log(JSON.stringify({ ok: true, exportRestrictedRows: (m.features || []).filter((f) => f.exportRestricted).length }, null, 2));
process.exit(0);
