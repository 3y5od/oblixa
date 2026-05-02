#!/usr/bin/env node
/**
 * Maintainer helper: flatten bucket-definitions into deduped stub-classes.txt (sorted).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUCKET_DEFS } from "./bucket-definitions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const out = new Set();
for (const b of BUCKET_DEFS) {
  for (const raw of b.csv.split(",")) {
    const t = raw.trim();
    if (t) out.add(t);
  }
}
const sorted = [...out].sort((a, b) => a.localeCompare(b));
const target = path.join(__dirname, "stub-classes.txt");
fs.writeFileSync(target, sorted.join("\n") + "\n", "utf8");
console.log(`Wrote ${sorted.length} stub classes to ${target}`);
