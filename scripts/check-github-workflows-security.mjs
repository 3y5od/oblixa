#!/usr/bin/env node
/**
 * Fails on high-risk GitHub Actions patterns (e.g. pull_request_target).
 * Paths listed in scripts/github-workflows-security-allowlist.txt are skipped (one basename per line).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowsDir = path.join(__dirname, "..", ".github", "workflows");
const allowlistPath = path.join(__dirname, "github-workflows-security-allowlist.txt");

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return new Set();
  const s = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) s.add(t);
  }
  return s;
}

const allowlist = loadAllowlist();
const violations = [];

if (fs.existsSync(workflowsDir)) {
  for (const name of fs.readdirSync(workflowsDir)) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    if (allowlist.has(name)) continue;
    const full = path.join(workflowsDir, name);
    const text = fs.readFileSync(full, "utf8");
    if (/\bpull_request_target\b/.test(text)) {
      violations.push(`${name}: uses pull_request_target (high fork risk)`);
    }
    if (/permissions:\s*write-all/i.test(text)) {
      violations.push(`${name}: uses permissions: write-all (overly broad)`);
    }
    if (/permissions:\s*\n\s*contents:\s*write\b/i.test(text) && !/release|publish|deploy/i.test(name)) {
      violations.push(`${name}: uses contents: write without explicit deploy/release workflow naming`);
    }
    const runBlocks = text.match(/run:\s*\|[\s\S]*?(?=\n\s*[a-zA-Z_-]+:|\n\s*-\s*name:|\n\s*jobs:|\n\s*$)/g) ?? [];
    for (const block of runBlocks) {
      if (
        /\$\{\{\s*github\.event\.pull_request\.(?:title|body)\s*\}\}/i.test(block) &&
        /\b(?:bash|sh|node|python|ruby|pwsh)?\b/i.test(block)
      ) {
        violations.push(
          `${name}: interpolates pull_request title/body directly inside shell run block (command injection risk)`
        );
      }
    }
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("uses:") && !trimmed.startsWith("- uses:")) continue;
      const m = trimmed.match(/uses:\s*([^\s#]+)/);
      if (!m) continue;
      const ref = m[1];
      if (/@v\d+(\.|$)/i.test(ref)) {
        violations.push(`${name}: floating GitHub Actions version tag in "${ref}" — pin to a full commit SHA`);
      }
      if (/^docker:\/\/.+:latest$/i.test(ref)) {
        violations.push(`${name}: floating docker image tag in "${ref}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("GitHub workflow security check failed:\n");
  for (const v of violations) console.error(`  - ${v}`);
  console.error("\nRemove the pattern or add the workflow basename to scripts/github-workflows-security-allowlist.txt with justification.");
  process.exit(1);
}

console.log("OK: workflow security patterns (pull_request_target, actions/*@v tags) not found.");
