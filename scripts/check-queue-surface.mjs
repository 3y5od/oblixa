#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const src = path.join(ROOT, "src");
let hits = 0;
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (n === "node_modules") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (n.endsWith(".ts") || n.endsWith(".tsx")) {
      const t = fs.readFileSync(p, "utf8");
      if (/\b(ioredis|kafkajs|@aws-sdk\/client-sqs)\b/.test(t)) hits += 1;
    }
  }
}
walk(src);
console.log(JSON.stringify({ ok: true, queueLibraryMentions: hits, surface: hits ? "present" : "absent" }, null, 2));
process.exit(0);
