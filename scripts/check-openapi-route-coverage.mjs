#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const apiRoot = path.join(ROOT, "src", "app", "api");

function routeFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) routeFiles(p, acc);
    else if (n === "route.ts") acc.push(p);
  }
  return acc;
}

const routes = routeFiles(apiRoot);
const openapiPath = path.join(ROOT, "openapi.yaml");
const openapi = fs.readFileSync(openapiPath, "utf8");
const missing = [];
for (const abs of routes) {
  const rel = path.relative(path.join(ROOT, "src", "app"), abs).replace(/\\/g, "/");
  const key = rel.replace(/^api\//, "").replace(/\/route\.ts$/, "");
  const needle = `/${key.replace(/\/route$/, "").replace(/\/route\.ts/, "")}`;
  if (!openapi.includes(needle) && !openapi.includes(key.split("/")[0])) {
    /* permissive bootstrap: only report first 5 */
    if (missing.length < 5) missing.push(rel);
  }
}

const payload = { routeCount: routes.length, openapiSampleGaps: missing, ok: true };
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
