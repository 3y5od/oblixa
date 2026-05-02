#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};
const risky = [];
for (const [name, cmd] of Object.entries(scripts)) {
  if (typeof cmd !== "string") continue;
  if (/\b(curl|wget|bash)\b/i.test(cmd) && (name === "preinstall" || name === "postinstall" || name === "prepare")) {
    risky.push(name);
  }
}
if (risky.length) {
  console.warn(`WARN: lifecycle scripts with network/shell: ${risky.join(", ")}`);
}
console.log("OK: npm lifecycle audit complete.");
