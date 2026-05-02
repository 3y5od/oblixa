#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.PEN_TEST_STRICT === "1" || process.env.PEN_TEST_STRICT === "true";
const p = path.join(process.cwd(), "artifacts", "pen-test-findings.json");
if (!fs.existsSync(p)) {
  console.log(JSON.stringify({ ok: !strict, mode: "no_file" }, null, 2));
  process.exit(strict ? 1 : 0);
}
const data = JSON.parse(fs.readFileSync(p, "utf8"));
const findings = data.findings || [];
const open = findings.filter((f) => String(f.status || "").toLowerCase() !== "closed");
const ok = !strict || open.length === 0;
console.log(JSON.stringify({ ok, strict, openCount: open.length, total: findings.length }, null, 2));
process.exit(ok ? 0 : 1);
