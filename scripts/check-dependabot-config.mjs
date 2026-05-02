#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), ".github", "dependabot.yml");
if (!fs.existsSync(p)) {
  console.log(JSON.stringify({ ok: true, mode: "no_dependabot" }, null, 2));
  process.exit(0);
}
const text = fs.readFileSync(p, "utf8");
const ok = /^version:\s*2/m.test(text) && /updates:/m.test(text);
console.log(JSON.stringify({ ok, checkId: "dependabot-config" }, null, 2));
process.exit(ok ? 0 : 1);
