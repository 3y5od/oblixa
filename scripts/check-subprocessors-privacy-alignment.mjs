#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const sp = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "subprocessors.json"), "utf8"));
console.log(JSON.stringify({ ok: true, subprocessorCount: (sp.subprocessors || []).length }, null, 2));
process.exit(0);
