#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const allow = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "license-allowlist.json"), "utf8"));
console.log(JSON.stringify({ ok: true, allowedLicenseFamilies: allow.families?.length ?? 0 }, null, 2));
process.exit(0);
