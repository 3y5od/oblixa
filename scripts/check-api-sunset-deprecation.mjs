#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.FEATURE_API_VERSIONING === "1" && process.env.API_SUNSET_STRICT === "1";
const apiRoot = path.join(process.cwd(), "src", "app", "api");
let routeFiles = 0;
let sunsetHints = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === "route.ts") {
      routeFiles++;
      const t = fs.readFileSync(p, "utf8");
      if (/[Dd]eprecation:|Sunset:/.test(t)) sunsetHints++;
    }
  }
}

walk(apiRoot);
const ok = !strict || routeFiles === 0 || sunsetHints > 0;
console.log(JSON.stringify({ ok, strict, routeFiles, sunsetHints }, null, 2));
process.exit(ok ? 0 : 1);
