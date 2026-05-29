#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(p, out);
    } else if (ent.name.endsWith(".v9.test.ts")) {
      out.push(p);
    }
  }
}

const root = process.cwd();
const files = [];
walk(join(root, "src"), files);
files.sort();

const acceptanceCriteria = join(root, "src", "lib", "acceptance-criteria.test.ts");
if (existsSync(acceptanceCriteria)) {
  files.push(acceptanceCriteria);
}

const r = spawnSync("npx", ["vitest", "run", ...files], { stdio: "inherit", cwd: root, shell: false });
process.exit(r.status ?? 1);
