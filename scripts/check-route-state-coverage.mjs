#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";
import { routeStateManifest } from "../src/lib/qa/route-state-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const routeStateRoutes = new Set(routeStateManifest.map((entry) => entry.route));
const missing = uiSurfaceManifest
  .filter((entry) => entry.coverage.includes("smoke"))
  .filter((entry) => entry.route === "/" || entry.route === "/login" || entry.route === "/dashboard" || entry.route === "/contracts" || entry.route === "/reports" || entry.route === "/settings")
  .map((entry) => entry.route)
  .filter((route) => !routeStateRoutes.has(route));

for (const entry of routeStateManifest) {
  const filePath = path.join(root, entry.sourcePath);
  if (!fs.existsSync(filePath)) {
    console.error(`check-route-state-coverage: missing file ${entry.sourcePath}`);
    process.exit(1);
  }
}

if (missing.length) {
  console.error(`check-route-state-coverage: missing state entries for ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`check-route-state-coverage: OK (${routeStateManifest.length} route states)`);

