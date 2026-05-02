#!/usr/bin/env node
/**
 * Rewrite scripts/api-route-auth-route-index.txt from every src/app/api route.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const indexPath = path.join(__dirname, "api-route-auth-route-index.txt");

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(path.relative(apiRoot, p).replace(/\\/g, "/"));
  }
  return acc;
}

const lines = walkRoutes(apiRoot).sort();
const header = `# Auto-generated — one path per route.ts under src/app/api (relative to api/).
# Regenerate: npm run sync:api-route-auth-route-index
# Human auth model notes: scripts/api-route-auth-inventory.txt
`;
fs.writeFileSync(indexPath, `${header}\n${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${lines.length} path(s) to ${path.relative(root, indexPath)}`);
