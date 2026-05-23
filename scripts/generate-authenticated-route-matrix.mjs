#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "authenticated-routes.ts");

export function buildAuthenticatedRouteMatrixRows(manifest = uiSurfaceManifest) {
  return manifest
    .filter((entry) => entry.mode === "authenticated")
    .filter((entry) => entry.visitPath)
    .map((entry) => ({
      route: entry.route,
      visitPath: entry.visitPath,
      fixtureId: entry.fixtureId,
      routeFamily: entry.routeFamily,
      workspaceModeTier: entry.workspaceModeTier,
      coverage: [...entry.coverage],
    }));
}

export function buildAuthenticatedRouteMatrixSource(manifest = uiSurfaceManifest) {
  return `export const GENERATED_AUTHENTICATED_ROUTES = ${JSON.stringify(buildAuthenticatedRouteMatrixRows(manifest), null, 2)} as const;\n`;
}

export function writeAuthenticatedRouteMatrix(outputPath = outPath) {
  const source = buildAuthenticatedRouteMatrixSource();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, source, "utf8");
  return { outputPath, routeCount: buildAuthenticatedRouteMatrixRows().length };
}

function main() {
  const result = writeAuthenticatedRouteMatrix(outPath);
  console.log(`generated ${path.relative(root, result.outputPath)} (${result.routeCount} route(s))`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
