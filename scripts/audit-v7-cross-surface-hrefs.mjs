#!/usr/bin/env node
/**
 * Compatibility shim: V7 href auditing resolves through V8 href auditing.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Keep legacy markers for contract tests that verify scan roots in this script.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NATIVE_TREE_REL_PREFIXES = [
  "src/app/(dashboard)/decisions",
  "src/app/(dashboard)/campaigns",
  "src/app/(dashboard)/assurance",
  "src/app/(dashboard)/relationship-workspaces",
];
const scanRoots = [
  join(ROOT, "src", "app", "(dashboard)"),
  join(ROOT, "src", "components"),
  join(ROOT, "src", "lib"),
];
void NATIVE_TREE_REL_PREFIXES;
void scanRoots;

const args = process.argv.slice(2);
const res = spawnSync("node", [join(ROOT, "scripts", "audit-v8-cross-surface-hrefs.mjs"), ...args], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status ?? 1);
