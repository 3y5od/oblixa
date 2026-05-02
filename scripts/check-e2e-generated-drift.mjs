#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const genDir = path.join(process.cwd(), "e2e", "generated");
const required = ["public-routes.ts", "authenticated-routes.ts", "route-states.ts", "visual-routes.ts"];
let ok = true;
for (const f of required) {
  const p = path.join(genDir, f);
  if (!fs.existsSync(p) || fs.readFileSync(p, "utf8").length < 50) ok = false;
}
console.log(JSON.stringify({ ok, required }, null, 2));
process.exit(ok ? 0 : 1);
