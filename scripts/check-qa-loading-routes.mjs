#!/usr/bin/env node
/**
 * Ensures scripts/qa-loading-routes-checklist.txt references existing loading.tsx files.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";
import { routeStateManifest } from "../src/lib/qa/route-state-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

function loadGeneratedArray(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/=\s*(\[[\s\S]*\])\s+as const;/);
  if (!match) {
    throw new Error(`Could not parse generated matrix: ${filePath}`);
  }
  return JSON.parse(match[1]);
}

export function analyzeQaLoadingRoutes(root = DEFAULT_ROOT) {
  const checklistPath = path.join(root, "scripts", "qa-loading-routes-checklist.txt");
  const routeStatesPath = path.join(root, "e2e", "generated", "route-states.ts");
  if (!fs.existsSync(checklistPath)) {
    return { ok: false, issue: "missing_checklist", checklistPath };
  }
  if (!fs.existsSync(routeStatesPath)) {
    return { ok: false, issue: "missing_generated_route_states", routeStatesPath };
  }
  const generatedStates = loadGeneratedArray(routeStatesPath);
  const generatedLoadingEntries = new Set(
    generatedStates.filter((entry) => entry.kind === "loading").map((entry) => entry.route)
  );
  const smokeRoutes = new Set(uiSurfaceManifest.filter((entry) => entry.coverage.includes("smoke")).map((entry) => entry.route));
  const expectedChecklistRoutes = new Set(
    routeStateManifest.filter((entry) => entry.kind === "loading" && smokeRoutes.has(entry.route)).map((entry) => entry.route)
  );
  const raw = fs.readFileSync(checklistPath, "utf8");
  const lines = raw.split("\n");
  const missing = [];
  const missingInGenerated = [];
  const notSmokeCovered = [];
  const checklistRoutes = new Set();
  let checked = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      console.warn("SKIP (need route + path):", line);
      continue;
    }
    const rel = parts[parts.length - 1];
    if (!rel.startsWith("src/")) {
      console.warn("SKIP (expected src/ path):", line);
      continue;
    }
    const abs = path.join(root, rel);
    const route = parts[0];
    checked += 1;
    checklistRoutes.add(route);
    if (!fs.existsSync(abs)) missing.push({ rel, line: t });
    if (!smokeRoutes.has(route)) {
      notSmokeCovered.push({ route, line: t });
    }
    if (!generatedLoadingEntries.has(route)) {
      missingInGenerated.push({ route, line: t });
    }
  }
  const missingFromChecklist = [...expectedChecklistRoutes].filter((route) => !checklistRoutes.has(route));
  return {
    ok: missing.length === 0 && missingInGenerated.length === 0 && notSmokeCovered.length === 0 && missingFromChecklist.length === 0,
    checked,
    missing,
    missingInGenerated,
    notSmokeCovered,
    missingFromChecklist,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeQaLoadingRoutes();
  if (!report.ok) {
    if (report.issue === "missing_checklist" || report.issue === "missing_generated_route_states") {
      console.error(JSON.stringify(report, null, 2));
      process.exit(1);
    }
    if (report.missing.length) {
      console.error("check-qa-loading-routes: missing files:");
      for (const m of report.missing) console.error(" ", m.rel, "<-", m.line);
    }
    if (report.missingInGenerated.length) {
      console.error("check-qa-loading-routes: checklist routes missing from generated route-state matrix:");
      for (const m of report.missingInGenerated) console.error(" ", m.route, "<-", m.line);
    }
    if (report.notSmokeCovered.length) {
      console.error("check-qa-loading-routes: checklist routes must be smoke-covered UI routes:");
      for (const m of report.notSmokeCovered) console.error(" ", m.route, "<-", m.line);
    }
    if (report.missingFromChecklist.length) {
      console.error("check-qa-loading-routes: smoke-covered loading routes missing from checklist:");
      for (const route of report.missingFromChecklist) console.error(" ", route);
    }
    process.exit(1);
  }

  console.log(`check-qa-loading-routes: OK (${report.checked} path(s))`);
}
