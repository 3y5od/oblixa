#!/usr/bin/env node
/**
 * Fails if source uses Sentry.setTag(s) with keys listed in metric-label-sentry-banlist.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const banPath = path.join(root, "src", "lib", "observability", "metric-label-sentry-banlist.json");
const srcRoot = path.join(root, "src");

const ban = JSON.parse(fs.readFileSync(banPath, "utf8"));
const keys = Array.isArray(ban.deny_tag_keys) ? ban.deny_tag_keys.map((k) => String(k)) : [];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(name.name) && !name.name.endsWith(".test.ts") && !name.name.endsWith(".test.tsx")) {
      acc.push(p);
    }
  }
  return acc;
}

const hits = [];
for (const file of walk(srcRoot)) {
  const rel = path.relative(root, file);
  if (rel.includes("metric-label-sentry-banlist.json")) continue;
  const text = fs.readFileSync(file, "utf8");
  if (!/\bSentry\.setTags?\s*\(/.test(text)) continue;
  for (const key of keys) {
    const re = new RegExp(`Sentry\\.setTags?\\s*\\(\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
    if (re.test(text)) {
      hits.push(`${rel}: banned Sentry tag key "${key}"`);
    }
  }
}

if (hits.length) {
  console.error("Sentry tag banlist violations:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("OK: no banned Sentry.setTag keys in src/.");
