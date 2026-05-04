#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";
import { routeStateManifest } from "../src/lib/qa/route-state-manifest.source.mjs";
import { collectEffectiveRouteStateKinds } from "./lib/route-state-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const STATE_FILE_KIND = new Map([
  ["loading.tsx", "loading"],
  ["error.tsx", "error"],
  ["not-found.tsx", "not_found"],
]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

export { collectEffectiveRouteStateKinds };

export function analyzeRouteStateCoverage(root = DEFAULT_ROOT) {
  const issues = [];
  const appRoot = path.join(root, "src", "app");
  const representedStateFiles = new Set();

  for (const entry of routeStateManifest) {
    const filePath = path.join(root, entry.sourcePath);
    if (!fs.existsSync(filePath)) {
      issues.push({ issue: "missing_manifest_file", sourcePath: entry.sourcePath });
      continue;
    }
    representedStateFiles.add(entry.sourcePath);
  }

  for (const abs of walk(appRoot)) {
    const basename = path.basename(abs);
    if (!STATE_FILE_KIND.has(basename)) continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (!representedStateFiles.has(rel)) {
      issues.push({ issue: "state_file_missing_from_manifest", sourcePath: rel });
    }
  }

  for (const entry of uiSurfaceManifest.filter((row) => row.coverage.includes("smoke"))) {
    const effectiveLocalKinds = collectEffectiveRouteStateKinds(entry.route, entry.shellFamily, routeStateManifest, false);
    if (effectiveLocalKinds.size === 0) {
      issues.push({ issue: "smoke_route_missing_local_state_coverage", route: entry.route, shellFamily: entry.shellFamily });
    }
  }

  return { issueCount: issues.length, issues, routeStateCount: routeStateManifest.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRouteStateCoverage();
  if (report.issueCount > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(`check-route-state-coverage: OK (${report.routeStateCount} route states)`);
}

