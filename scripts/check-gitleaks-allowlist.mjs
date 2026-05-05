#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const configPath = path.join(root, ".gitleaks.toml");
const inventoryPath = path.join(root, "artifacts", "assurance", "gitleaks-allowlist-inventory.json");

function parsePathEntries(text) {
  const match = text.match(/paths\s*=\s*\[(?<body>[\s\S]*?)\]/m);
  if (!match?.groups?.body) return [];
  return [...match.groups.body.matchAll(/'''([^']+)'''/g)].map((entry) => entry[1]);
}

const config = fs.readFileSync(configPath, "utf8");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const configuredPaths = parsePathEntries(config);
const expectedPaths = inventory.allowlists.flatMap((entry) => entry.paths);
const issues = [];

if (!config.includes("[allowlist]")) {
  issues.push(".gitleaks.toml must define a single [allowlist] block");
}

if (JSON.stringify(configuredPaths) !== JSON.stringify(expectedPaths)) {
  issues.push(".gitleaks.toml paths must exactly match artifacts/assurance/gitleaks-allowlist-inventory.json");
}

for (const entry of configuredPaths) {
  if (entry.includes("node_modules") || entry.includes(".git") || entry.includes("coverage")) {
    issues.push(`disallowed allowlist path scope: ${entry}`);
  }
  if (!entry.startsWith("^") && !entry.startsWith(".*\\.test\\.")) {
    issues.push(`allowlist entry must be anchored or an approved test suffix pattern: ${entry}`);
  }
}

if (issues.length > 0) {
  console.error("check-gitleaks-allowlist failed:\n");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, allowlistEntries: configuredPaths.length }, null, 2));