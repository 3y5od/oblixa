#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vitestFiles = [
  "src/lib/product-surface/compatibility-vocabulary-consistency.test.ts",
  "src/lib/product-surface/workspace-settings-module-labels.test.ts",
  "src/lib/product-surface/workspace-settings-module-keys-exhaustive.test.ts",
];

const result = spawnSync("npx", ["vitest", "run", ...vitestFiles], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
