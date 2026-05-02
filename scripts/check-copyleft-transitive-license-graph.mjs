#!/usr/bin/env node
/** Flags AGPL/GPL in package-lock license strings when QA_COPYLEFT_STRICT=1. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.env.QA_COPYLEFT_STRICT === "1";
const lockPath = path.join(root, "package-lock.json");
if (!fs.existsSync(lockPath)) {
  console.log(JSON.stringify({ ok: true, reason: "no_lockfile" }, null, 2));
  process.exit(0);
}
const raw = fs.readFileSync(lockPath, "utf8");
const bad = /"license":\s*"(AGPL|GPL)/i.test(raw);
const ok = !strict || !bad;
console.log(JSON.stringify({ checkId: "copyleft-transitive-license-graph", strict, bad }, null, 2));
process.exit(ok ? 0 : 1);
