#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "visual-routes.ts");

const visualRoutes = uiSurfaceManifest
  .filter((entry) => entry.coverage.includes("visual"))
  .filter((entry) => entry.visitPath)
  .map((entry) => ({
    route: entry.route,
    visitPath: entry.visitPath,
    fixtureId: entry.fixtureId,
    routeFamily: entry.routeFamily,
    shellFamily: entry.shellFamily,
    mode: entry.mode,
    expectedHeading: entry.expectedHeading,
  }));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `export const GENERATED_VISUAL_ROUTES = ${JSON.stringify(visualRoutes, null, 2)} as const;\n`,
  "utf8"
);
console.log(`generated ${path.relative(root, outPath)} (${visualRoutes.length} route(s))`);

