#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const allowPath = path.join(root, "scripts", "dangerously-set-inner-html-allowlist.txt");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx|jsx)$/.test(name.name)) out.push(p);
  }
  return out;
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
  const files = walk(path.join(root, "src"));
  const hits = [];
  for (const f of files) {
    const rel = path.relative(root, f);
    if (allow.has(rel)) continue;
    const s = fs.readFileSync(f, "utf8");
    if (/\bdangerouslySetInnerHTML\s*=/.test(s)) hits.push(rel);
  }
  if (hits.length) {
    console.error("dangerouslySetInnerHTML without allowlist entry:\n" + hits.join("\n"));
    console.error(`Add justified paths to ${path.relative(root, allowPath)}`);
    process.exit(1);
  }
  console.log("OK: dangerouslySetInnerHTML only in allowlisted files.");
}

main();
