#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const vitestFiles = [
  "src/lib/product-surface/compatibility-vocabulary-consistency.test.ts",
  "src/lib/product-surface/workspace-settings-module-labels.test.ts",
  "src/lib/product-surface/workspace-settings-module-keys-exhaustive.test.ts",
];

export function productSurfaceVocabularyCommand(platform = process.platform) {
  const args = ["vitest", "run", ...vitestFiles];
  if (platform === "win32") {
    return { cmd: "cmd.exe", args: ["/d", "/s", "/c", `npx ${args.join(" ")}`] };
  }
  return { cmd: "npx", args };
}

export function runProductSurfaceVocabularyCheck(options = {}) {
  const command = options.command ?? productSurfaceVocabularyCommand(options.platform);
  return (options.runner ?? spawnSync)(command.cmd, command.args, {
    cwd: options.cwd ?? root,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env,
  });
}

export function runProductSurfaceVocabularyCli() {
  const result = runProductSurfaceVocabularyCheck();
  if (typeof result.status === "number") {
    process.exit(result.status);
  }
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductSurfaceVocabularyCli();
}
