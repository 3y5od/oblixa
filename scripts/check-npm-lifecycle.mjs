#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LIFECYCLE_SCRIPTS = new Set(["preinstall", "install", "postinstall", "prepublish", "prepare"]);
const RISKY_COMMAND_RE = /\b(?:curl|wget|bash|sh|python|ruby|node)\b|\bnpx\s+--yes\b|https?:\/\//i;

export function analyzeNpmLifecycle(root = ROOT) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const scripts = pkg.scripts ?? {};
  const issues = [];
  for (const [name, cmd] of Object.entries(scripts)) {
    if (!LIFECYCLE_SCRIPTS.has(name) || typeof cmd !== "string") continue;
    if (RISKY_COMMAND_RE.test(cmd)) {
      issues.push({ issue: "risky_npm_lifecycle_script", script: name });
    }
  }
  return { checkId: "npm-lifecycle", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeNpmLifecycle();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
