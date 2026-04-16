#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "src", "lib", "product-surface", "feature-registry.ts");
const text = fs.readFileSync(file, "utf8");
const strict = process.argv.includes("--strict");

const flagMentions = [...text.matchAll(/ENABLE_[A-Z0-9_]+/g)].map((m) => m[0]);
const unique = [...new Set(flagMentions)].sort();
const stale = unique.filter((name) => /_V7_|LEGACY|DEPRECATED/.test(name));

const payload = {
  checkId: "feature-flag-lifecycle",
  strict,
  ok: !strict || stale.length === 0,
  totalFlags: unique.length,
  staleFlagCandidates: stale,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
