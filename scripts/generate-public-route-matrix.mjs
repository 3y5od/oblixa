#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "public-routes.ts");

const publicRoutes = uiSurfaceManifest
  .filter((entry) => entry.mode === "public")
  .filter((entry) => entry.visitPath)
  .map((entry) => ({
    route: entry.route,
    visitPath: entry.visitPath,
    fixtureId: entry.fixtureId,
    routeFamily: entry.routeFamily,
    shellFamily: entry.shellFamily,
    expectedHeading: entry.expectedHeading,
    coverage: [...entry.coverage],
  }));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `export const GENERATED_PUBLIC_ROUTES = ${JSON.stringify(publicRoutes, null, 2)} as const;\n`,
  "utf8"
);
console.log(`generated ${path.relative(root, outPath)} (${publicRoutes.length} route(s))`);

