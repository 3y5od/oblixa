#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stub = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "ml-lineage-stub.json"), "utf8"));
console.log(JSON.stringify({ ok: true, modelVersion: stub.modelVersion ?? null }, null, 2));
process.exit(0);
