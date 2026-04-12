#!/usr/bin/env node
/**
 * When PWA / deep-link assets land under public/, keep scope/start_url safe.
 * Today: if no tracked manifest or association files, pass. If present, require allowlist entry.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const allowlistPath = path.join(__dirname, "pwa-well-known-allowlist.txt");

const WATCH_NAMES = new Set([
  "manifest.json",
  "manifest.webmanifest",
  "assetlinks.json",
  "apple-app-site-association",
]);

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return new Set();
  const s = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) s.add(t);
  }
  return s;
}

function listWellKnownFiles() {
  const wellKnown = path.join(publicDir, ".well-known");
  if (!fs.existsSync(wellKnown)) return [];
  return fs.readdirSync(wellKnown);
}

function main() {
  const allowlist = loadAllowlist();
  const violations = [];

  if (fs.existsSync(publicDir)) {
    for (const name of fs.readdirSync(publicDir)) {
      if (WATCH_NAMES.has(name) && !allowlist.has(`public/${name}`)) {
        violations.push(`Untracked PWA-related file public/${name} — add to scripts/pwa-well-known-allowlist.txt after reviewing scope/start_url`);
      }
    }
  }

  for (const f of listWellKnownFiles()) {
    const rel = `public/.well-known/${f}`;
    const lower = f.toLowerCase();
    if (
      (lower.includes("manifest") || lower.includes("assetlink") || lower.includes("apple-app")) &&
      !allowlist.has(rel)
    ) {
      violations.push(`Untracked well-known asset ${rel} — add to scripts/pwa-well-known-allowlist.txt`);
    }
  }

  if (violations.length > 0) {
    console.error("PWA / deep-link well-known check failed:\n");
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log("OK: no unexpected PWA / association files (or all allowlisted).");
}

main();
