#!/usr/bin/env node
/**
 * Asserts keys listed in config/e2e-env-matrix.json appear in .env.example (documentation parity).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrix = JSON.parse(fs.readFileSync(path.join(root, "config", "e2e-env-matrix.json"), "utf8"));
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const missing = [];
for (const key of matrix.keys || []) {
  if (!envExample.includes(key)) missing.push(key);
}
const ok = missing.length === 0;
console.log(JSON.stringify({ ok, checkId: "env-matrix", missing }, null, 2));
process.exit(ok ? 0 : 1);
