#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let found = false;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (n === "node_modules") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (n.endsWith(".ts") || n.endsWith(".tsx")) {
      const t = fs.readFileSync(p, "utf8");
      if (/@cost|costDirective|graphql-cost/i.test(t)) found = true;
    }
  }
}
walk(path.join(ROOT, "src"));
console.log(JSON.stringify({ ok: true, graphqlCostDirectivePresent: found }, null, 2));
process.exit(0);
