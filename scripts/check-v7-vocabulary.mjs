#!/usr/bin/env node
/**
 * Compatibility shim: V7 vocabulary checks now resolve through the V8 vocabulary command.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = spawnSync("node", [join(root, "scripts", "check-v8-vocabulary.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status ?? 1);
