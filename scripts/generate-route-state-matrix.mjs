#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeStateManifest } from "../src/lib/qa/route-state-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "route-states.ts");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `export const GENERATED_ROUTE_STATES = ${JSON.stringify(routeStateManifest, null, 2)} as const;\n`,
  "utf8"
);
console.log(`generated ${path.relative(root, outPath)} (${routeStateManifest.length} state entries)`);

