#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildRouteUniversePayload, ROUTE_UNIVERSE_ARTIFACTS } from "./lib/build-route-universe.mjs";

const root = process.cwd();

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "generatedAt") continue;
      out[key] = stripVolatile(nested);
    }
    return out;
  }
  return value;
}

function loadJson(relPath) {
  const file = path.join(root, relPath);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const payload = buildRouteUniversePayload(root);
const expected = { universe: payload.universe, ...payload.derived };
const failures = [];

for (const [key, relPath] of Object.entries(ROUTE_UNIVERSE_ARTIFACTS)) {
  const actual = loadJson(relPath);
  if (!actual) {
    failures.push(`${relPath}:missing`);
    continue;
  }
  if (JSON.stringify(stripVolatile(actual)) !== JSON.stringify(stripVolatile(expected[key]))) {
    failures.push(`${relPath}:drift`);
  }
}

for (const row of payload.universe.routes) {
  if (!row.authModel) failures.push(`${row.sourcePath}:missing_auth_model`);
  if (!row.cachePolicy) failures.push(`${row.sourcePath}:missing_cache_policy`);
  if (!row.rateLimitPolicy) failures.push(`${row.sourcePath}:missing_rate_limit_policy`);
  if (!row.owner) failures.push(`${row.sourcePath}:missing_owner`);
  if (!row.smokeTier) failures.push(`${row.sourcePath}:missing_smoke_tier`);
  if (row.authModel === "requires_review") failures.push(`${row.sourcePath}:auth_model_requires_review`);
  if (row.class === "cron" && row.authModel !== "cron_secret") failures.push(`${row.sourcePath}:cron_auth_model`);
}

if (failures.length) {
  console.error("check-route-universe failed:");
  for (const failure of failures.slice(0, 80)) console.error(`  - ${failure}`);
  if (failures.length > 80) console.error(`  ... ${failures.length - 80} more`);
  console.error("Run: npm run generate:route-universe");
  process.exit(1);
}

console.log(`check-route-universe: OK (${payload.universe.total} classified rows)`);
