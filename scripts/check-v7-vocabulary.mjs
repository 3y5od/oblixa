#!/usr/bin/env node
/**
 * Single entrypoint for V7 vocabulary / nav label Vitest modules (docs/v7 §22.1, refinement §8.1).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vitestFiles = [
  "src/lib/product-surface/v7-vocabulary-consistency.test.ts",
  "src/lib/product-surface/workspace-settings-module-labels.test.ts",
  "src/lib/product-surface/workspace-settings-module-keys-exhaustive.test.ts",
];

const res = spawnSync("npx", ["vitest", "run", ...vitestFiles], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status ?? 1);
