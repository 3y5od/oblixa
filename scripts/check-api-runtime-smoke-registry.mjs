#!/usr/bin/env node
/**
 * Epic 3 — Fail when api-runtime-smoke-registry.json drifts vs src/app/api route modules.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildApiRuntimeSmokeRegistryPayload } from "./lib/build-api-runtime-smoke-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const registryPath = path.join(root, "artifacts", "assurance", "api-runtime-smoke-registry.json");

function normalizeRoutes(routes) {
  return JSON.stringify(
    [...routes].sort((a, b) => a.pathTemplate.localeCompare(b.pathTemplate)),
    null,
    2
  );
}

const committed = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const fresh = buildApiRuntimeSmokeRegistryPayload(root);

if (committed.routeCount !== fresh.routeCount) {
  console.error(
    `api-runtime-smoke-registry drift: routeCount committed=${committed.routeCount} filesystem=${fresh.routeCount}`
  );
  console.error("Run: npm run generate:api-runtime-smoke-registry");
  process.exit(1);
}

if (normalizeRoutes(committed.routes) !== normalizeRoutes(fresh.routes)) {
  console.error("api-runtime-smoke-registry drift: routes[] differs from filesystem.");
  console.error("Run: npm run generate:api-runtime-smoke-registry");
  process.exit(1);
}

console.log(`OK: api-runtime-smoke-registry.json matches ${fresh.routeCount} routes.`);
