#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "e2e", "generated", "authenticated-routes.ts");

const authenticated = uiSurfaceManifest
  .filter((entry) => entry.mode === "authenticated")
  .filter((entry) => entry.visitPath)
  .map((entry) => ({
    route: entry.route,
    visitPath: entry.visitPath,
    routeFamily: entry.routeFamily,
    workspaceModeTier: entry.workspaceModeTier,
    coverage: [...entry.coverage],
  }));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `export const GENERATED_AUTHENTICATED_ROUTES = ${JSON.stringify(authenticated, null, 2)} as const;\n`,
  "utf8"
);
console.log(`generated ${path.relative(root, outPath)} (${authenticated.length} route(s))`);

