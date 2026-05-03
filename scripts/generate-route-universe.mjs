#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildRouteUniversePayload, ROUTE_UNIVERSE_ARTIFACTS } from "./lib/build-route-universe.mjs";

const root = process.cwd();
const write = process.argv.includes("--write");
const payload = buildRouteUniversePayload(root);

const artifactPayloads = {
  universe: payload.universe,
  ...payload.derived,
};

if (!write) {
  console.log(JSON.stringify({ total: payload.universe.total, counts: payload.universe.counts }, null, 2));
  console.error("Dry run. Pass --write to update route-universe artifacts.");
  process.exit(0);
}

for (const [key, relPath] of Object.entries(ROUTE_UNIVERSE_ARTIFACTS)) {
  const out = path.join(root, relPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(artifactPayloads[key], null, 2)}\n`);
}

console.log(JSON.stringify({ wrote: Object.values(ROUTE_UNIVERSE_ARTIFACTS), total: payload.universe.total }, null, 2));