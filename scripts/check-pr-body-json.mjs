#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const body = process.env.PR_BODY || "";
const cfgPath = path.join(process.cwd(), "config", "pr-requirements.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const subs = cfg.requiredSubstrings || [];
if (!subs.length || !body) {
  console.log(JSON.stringify({ ok: true, mode: "no_gate", subs: subs.length }, null, 2));
  process.exit(0);
}
const missing = subs.filter((s) => !body.includes(s));
const ok = missing.length === 0;
console.log(JSON.stringify({ ok, missing }, null, 2));
process.exit(ok ? 0 : 1);
