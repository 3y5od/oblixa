#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const allowPath = path.join(__dirname, "postmessage-origins-allowlist.txt");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(name.name) && !name.name.endsWith(".test.ts") && !name.name.endsWith(".test.tsx")) {
      acc.push(p);
    }
  }
  return acc;
}

function main() {
  const allow = new Set(
    fs.existsSync(allowPath)
      ? fs
          .readFileSync(allowPath, "utf8")
          .split("\n")
          .map((l) => l.replace(/#.*$/, "").trim())
          .filter(Boolean)
      : []
  );
  const hits = [];
  for (const f of walk(path.join(root, "src"))) {
    const rel = path.relative(root, f);
    if (allow.has(rel)) continue;
    const raw = fs.readFileSync(f, "utf8");
    if (/\bpostMessage\s*\(/.test(raw) || /\.postMessage\s*\(/.test(raw)) hits.push(rel);
  }
  if (hits.length) {
    console.error("postMessage usage without allowlist entry:\n" + hits.join("\n"));
    process.exit(1);
  }
  console.log("OK: no unlisted postMessage calls in src/.");
}

main();
