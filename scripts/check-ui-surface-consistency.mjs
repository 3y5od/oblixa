#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const generatedFiles = [
  "e2e/generated/authenticated-routes.ts",
  "e2e/generated/public-routes.ts",
  "e2e/generated/visual-routes.ts",
  "e2e/generated/route-states.ts",
];

for (const rel of generatedFiles) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`check-ui-surface-consistency: missing ${rel}`);
    process.exit(1);
  }
}

const duplicateRoutes = uiSurfaceManifest
  .map((entry) => entry.route)
  .filter((route, index, arr) => arr.indexOf(route) !== index);

if (duplicateRoutes.length) {
  console.error(`check-ui-surface-consistency: duplicate manifest routes ${duplicateRoutes.join(", ")}`);
  process.exit(1);
}

console.log(`check-ui-surface-consistency: OK (${uiSurfaceManifest.length} surfaces)`);

