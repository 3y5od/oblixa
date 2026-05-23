#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "visual-routes.ts");

export function buildVisualRouteMatrixRows(manifest = uiSurfaceManifest) {
  return manifest
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
}

export function buildVisualRouteMatrixSource(manifest = uiSurfaceManifest) {
  return `export const GENERATED_VISUAL_ROUTES = ${JSON.stringify(buildVisualRouteMatrixRows(manifest), null, 2)} as const;\n`;
}

export function writeVisualRouteMatrix(outputPath = outPath) {
  const source = buildVisualRouteMatrixSource();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, source, "utf8");
  return { outputPath, routeCount: buildVisualRouteMatrixRows().length };
}

function main() {
  const result = writeVisualRouteMatrix(outPath);
  console.log(`generated ${path.relative(root, result.outputPath)} (${result.routeCount} route(s))`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
