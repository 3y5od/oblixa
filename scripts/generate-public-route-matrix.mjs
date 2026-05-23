#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "public-routes.ts");

export function buildPublicRouteMatrixRows(manifest = uiSurfaceManifest) {
  return manifest
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
}

export function buildPublicRouteMatrixSource(manifest = uiSurfaceManifest) {
  return `export const GENERATED_PUBLIC_ROUTES = ${JSON.stringify(buildPublicRouteMatrixRows(manifest), null, 2)} as const;\n`;
}

export function writePublicRouteMatrix(outputPath = outPath) {
  const source = buildPublicRouteMatrixSource();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, source, "utf8");
  return { outputPath, routeCount: buildPublicRouteMatrixRows().length };
}

function main() {
  const result = writePublicRouteMatrix(outPath);
  console.log(`generated ${path.relative(root, result.outputPath)} (${result.routeCount} route(s))`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
