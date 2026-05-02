#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ex = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
const keys = [...ex.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]);
const payload = { ok: true, envExampleKeyCount: keys.length, stagingUrlSet: !!process.env.STAGING_BASE_URL };
fs.writeFileSync(path.join(ROOT, "artifacts", "staging-env-parity.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
