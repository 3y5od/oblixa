#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(name, cmd, args) {
  const start = Date.now();
  const res = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", env: process.env });
  return {
    name,
    status: res.status ?? 1,
    elapsedMs: Date.now() - start,
    stderr: (res.stderr || "").slice(0, 300),
  };
}

const lint = run("lint", "npm", ["run", "lint"]);
const typecheck = run("typecheck", "npm", ["run", "typecheck"]);
console.log(JSON.stringify({ lint, typecheck }, null, 2));
