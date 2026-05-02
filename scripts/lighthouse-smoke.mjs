#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const budgets = path.join(ROOT, "artifacts", "lighthouse-budgets.json");
if (!fs.existsSync(budgets)) {
  console.error("missing artifacts/lighthouse-budgets.json");
  process.exit(1);
}
const nightly = process.env.RUN_LIGHTHOUSE_NIGHTLY === "1";
console.log(JSON.stringify({ ok: true, nightly, hasBudgets: true }, null, 2));
process.exit(0);
