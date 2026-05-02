#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const wfDir = path.join(process.cwd(), ".github", "workflows");
const risky = [];
for (const name of fs.readdirSync(wfDir)) {
  if (!name.endsWith(".yml")) continue;
  const text = fs.readFileSync(path.join(wfDir, name), "utf8");
  if (text.includes("pull_request_target")) risky.push({ file: name });
}
const strict = process.argv.includes("--strict");
const ok = risky.length === 0;
console.log(JSON.stringify({ ok, strict, pull_request_target_workflows: risky }, null, 2));
process.exit(ok || !strict ? 0 : 1);
