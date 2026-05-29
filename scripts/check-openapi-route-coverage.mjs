#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "yaml";
import { methodsFromSource, readEffectiveRouteSource } from "./lib/build-route-universe.mjs";

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

function routePathForFile(abs) {
  const rel = path.relative(apiRoot, path.dirname(abs)).replace(/\\/g, "/");
  const parts = rel.split("/").filter(Boolean);
  const converted = parts.map((part) => {
    const match = /^\[\[?\.\.\.([^\]]+)\]\]$|^\[([^\]]+)]$/.exec(part);
    return match ? `{${match[1] ?? match[2]}}` : part;
  });
  return `/api/${converted.join("/")}`.replace(/\/+$/, "");
}

const routes = routeFiles(apiRoot);
const openapiPath = path.join(ROOT, "openapi.yaml");
const openapi = parse(fs.readFileSync(openapiPath, "utf8"));
const openapiPaths = openapi?.paths && typeof openapi.paths === "object" ? openapi.paths : {};
const expected = routes
  .map((abs) => ({
    path: routePathForFile(abs),
    methods: methodsFromSource(readEffectiveRouteSource(abs)).map((method) => method.toLowerCase()),
    file: path.relative(ROOT, abs).replace(/\\/g, "/"),
  }))
  .sort((a, b) => a.path.localeCompare(b.path));
const missing = [];
const methodMismatches = [];

for (const route of expected) {
  const specPath = openapiPaths[route.path];
  if (!specPath) {
    missing.push(route);
    continue;
  }
  for (const method of route.methods) {
    if (!specPath[method]) {
      methodMismatches.push({ path: route.path, method, file: route.file });
    }
  }
}

const expectedPaths = new Set(expected.map((route) => route.path));
const extra = Object.keys(openapiPaths)
  .filter((specPath) => specPath.startsWith("/api/") && !expectedPaths.has(specPath))
  .sort();

const errors = [
  ...missing.map((route) => `${route.file}: missing OpenAPI path ${route.path}`),
  ...methodMismatches.map((route) => `${route.file}: missing OpenAPI ${route.method.toUpperCase()} ${route.path}`),
  ...extra.map((specPath) => `${specPath}: OpenAPI path has no matching src/app/api route.ts`),
];

const payload = {
  ok: errors.length === 0,
  routeCount: routes.length,
  openapiPathCount: Object.keys(openapiPaths).length,
  missingPathCount: missing.length,
  methodMismatchCount: methodMismatches.length,
  extraPathCount: extra.length,
  errors: errors.slice(0, 80),
};
console.log(JSON.stringify(payload, null, 2));
if (errors.length) {
  if (errors.length > 80) console.error(`... ${errors.length - 80} more`);
  console.error("Run npm run generate:openapi-route-skeleton to refresh openapi.yaml.");
  process.exit(1);
}
