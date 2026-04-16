#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const srcRoot = path.join(root, "src");

const rules = [
  {
    fromPrefix: "src/components/",
    forbidden: ["@/app/api/"],
    reason: "components should not import api route handlers",
  },
  {
    fromPrefix: "src/lib/",
    forbidden: ["@/app/api/"],
    reason: "library modules should not import api route handlers",
  },
];

const violations = [];
for (const file of walkFiles(srcRoot, (abs) => /\.(ts|tsx)$/.test(abs))) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (/\.test\.(ts|tsx)$/.test(rel) || /\.spec\.(ts|tsx)$/.test(rel)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const rule of rules) {
    if (!rel.startsWith(rule.fromPrefix)) continue;
    for (const token of rule.forbidden) {
      if (content.includes(token)) {
        violations.push({ file: rel, token, reason: rule.reason });
      }
    }
  }
}

const payload = { checkId: "import-boundaries", strict, ok: !strict || violations.length === 0, violations };
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
