#!/usr/bin/env node
/**
 * Epic 50 — dependency policy as code: Dependabot config + Node engine floor.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dependabot = path.join(root, ".github", "dependabot.yml");
const pkgPath = path.join(root, "package.json");

if (!fs.existsSync(dependabot)) {
  console.error("check-dependency-policy-as-code: missing .github/dependabot.yml");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const engines = pkg.engines?.node;
if (typeof engines !== "string" || !engines.trim()) {
  console.error("check-dependency-policy-as-code: package.json engines.node required");
  process.exit(1);
}

console.log(`OK: dependency policy (${engines.trim()} dependabot present).`);
