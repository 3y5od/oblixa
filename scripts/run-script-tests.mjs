#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function findScriptTestFiles(root = process.cwd()) {
  const scriptsDir = path.join(root, "scripts");
  if (!fs.existsSync(scriptsDir)) return [];
  return fs
    .readdirSync(scriptsDir)
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => path.join(scriptsDir, name))
    .filter((abs) => fs.statSync(abs).isFile())
    .sort((a, b) => a.localeCompare(b));
}

export function buildNodeTestArgs(files) {
  return ["--test", ...files];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const files = findScriptTestFiles(root);
  if (files.length === 0) {
    console.error("run-script-tests: no scripts/*.test.mjs files found");
    process.exit(1);
  }

  const result = spawnSync(process.execPath, buildNodeTestArgs(files), {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}