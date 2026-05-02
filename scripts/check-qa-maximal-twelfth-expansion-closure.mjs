#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { QA_MAXIMAL_PLAN_TODO_IDS } from "./lib/qa-maximal-canonical-todo-ids.mjs";

const root = process.cwd();
const p = path.join(root, "artifacts", "qa-maximal-twelfth-expansion-closure.json");
if (!fs.existsSync(p)) {
  console.error(JSON.stringify({ ok: false, reason: "missing_closure_artifact", path: p }, null, 2));
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(p, "utf8"));
const keys = new Set(Object.keys(data.todos || {}));
const expected = new Set(QA_MAXIMAL_PLAN_TODO_IDS);
const missing = [...expected].filter((id) => !keys.has(id));
const extra = [...keys].filter((id) => !expected.has(id));
const ok = missing.length === 0 && extra.length === 0 && keys.size === expected.size;
console.log(JSON.stringify({ ok, expected: expected.size, actual: keys.size, missing, extra }, null, 2));
process.exit(ok ? 0 : 1);
