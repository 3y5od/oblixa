#!/usr/bin/env node
/**
 * Discover npm scripts named check:* from package.json for QA ultimate autodiscover.
 */
import fs from "node:fs";
import path from "node:path";

function stableBucket(key, total) {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return total > 0 ? h % total : 0;
}

/**
 * @param {object} pkg - parsed package.json
 * @param {{ denylist?: string[] }} [options]
 * @returns {string[]} sorted script names (e.g. check:foo)
 */
export function discoverCheckScripts(pkg, options = {}) {
  const deny = new Set((options.denylist || []).map(String));
  const scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  const out = [];
  for (const name of Object.keys(scripts)) {
    if (!name.startsWith("check:")) continue;
    if (deny.has(name)) continue;
    out.push(name);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/**
 * @param {string[]} names - check:* script names
 * @param {{ batchTotal?: number, batchIndex?: number }} [options] batchIndex is 1-based
 */
export function filterCheckBatch(names, options = {}) {
  const total = Number(options.batchTotal) || 0;
  const index = Number(options.batchIndex) || 0;
  if (!total || total < 1 || !index || index < 1) return names;
  return names.filter((n) => stableBucket(n, total) === index - 1);
}

export function loadPackageJson(root = process.cwd()) {
  const p = path.join(root, "package.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
