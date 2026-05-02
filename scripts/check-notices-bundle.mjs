#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const notices = path.join(ROOT, "artifacts", "third-party-licenses-notices.json");
const payload = fs.existsSync(notices)
  ? JSON.parse(fs.readFileSync(notices, "utf8"))
  : { mode: "bootstrap", packages: [] };
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "notices-bundle-report.json"), `${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true }, null, 2));
process.exit(0);
