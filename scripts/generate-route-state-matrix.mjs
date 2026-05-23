#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { routeStateManifest } from "../src/lib/qa/route-state-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "route-states.ts");

export function buildRouteStateMatrixRows(manifest = routeStateManifest) {
  return manifest;
}

export function buildRouteStateMatrixSource(manifest = routeStateManifest) {
  return `export const GENERATED_ROUTE_STATES = ${JSON.stringify(buildRouteStateMatrixRows(manifest), null, 2)} as const;\n`;
}

export function writeRouteStateMatrix(outputPath = outPath) {
  const source = buildRouteStateMatrixSource();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, source, "utf8");
  return { outputPath, stateCount: buildRouteStateMatrixRows().length };
}

function main() {
  const result = writeRouteStateMatrix(outPath);
  console.log(`generated ${path.relative(root, result.outputPath)} (${result.stateCount} state entries)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
