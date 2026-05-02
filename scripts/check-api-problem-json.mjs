#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const apiRoot = path.join(process.cwd(), "src", "app", "api");
let files = 0;
let mentions = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === "route.ts") {
      files++;
      const t = fs.readFileSync(p, "utf8");
      if (/problem\+json|application\/problem\+json/i.test(t)) mentions++;
    }
  }
}

if (fs.existsSync(apiRoot)) walk(apiRoot);
const ok = true;
console.log(JSON.stringify({ ok, routeTsFiles: files, problemJsonMentions: mentions }, null, 2));
process.exit(0);
