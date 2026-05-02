#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { QA_MAXIMAL_PLAN_TODO_IDS } from "./lib/qa-maximal-canonical-todo-ids.mjs";

const root = process.cwd();
const out = path.join(root, "artifacts", "qa-maximal-twelfth-expansion-closure.json");
const todos = Object.fromEntries(
  QA_MAXIMAL_PLAN_TODO_IDS.map((id) => [
    id,
    {
      plan: "twelfth-expansion",
      tracked: true,
      registry: "config/qa-maximal-twelfth-expansion-registry.json",
    },
  ])
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  `${JSON.stringify({ version: 1, generated: new Date().toISOString(), todoCount: QA_MAXIMAL_PLAN_TODO_IDS.length, todos }, null, 2)}\n`
);
console.log(JSON.stringify({ ok: true, wrote: path.relative(root, out), count: QA_MAXIMAL_PLAN_TODO_IDS.length }, null, 2));
