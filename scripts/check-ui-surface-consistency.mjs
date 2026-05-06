#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildRouteUniversePayload } from "./lib/build-route-universe.mjs";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const GENERATED_MATRIX_SPECS = [
  {
    rel: "e2e/generated/authenticated-routes.ts",
    buildExpected: () =>
      uiSurfaceManifest
        .filter((entry) => entry.mode === "authenticated")
        .filter((entry) => entry.visitPath)
        .map((entry) => ({
          route: entry.route,
          visitPath: entry.visitPath,
          fixtureId: entry.fixtureId,
          routeFamily: entry.routeFamily,
          workspaceModeTier: entry.workspaceModeTier,
          coverage: [...entry.coverage],
        })),
  },
  {
    rel: "e2e/generated/public-routes.ts",
    buildExpected: () =>
      uiSurfaceManifest
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
        })),
  },
  {
    rel: "e2e/generated/visual-routes.ts",
    buildExpected: () =>
      uiSurfaceManifest
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
        })),
  },
];

const ROUTE_INVENTORY_PATH = path.join(root, "src", "lib", "product-surface", "route-inventory.ts");
const NAV_SOURCE_FILES = [
  "src/lib/navigation.ts",
  "src/lib/product-surface/cmdk-search-jumps.ts",
  "src/lib/product-surface/workflow-destinations.ts",
];

function normalizeHrefToRoute(href) {
  if (typeof href !== "string") return null;
  if (!href.startsWith("/")) return null;
  if (href.startsWith("/api/")) return null;
  return href.split("#")[0]?.split("?")[0] ?? href;
}

function loadGeneratedArray(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/=\s*(\[[\s\S]*\])\s+as const;/);
  if (!match) {
    throw new Error(`Could not parse generated matrix: ${filePath}`);
  }
  return JSON.parse(match[1]);
}

function loadRouteInventoryEntries(filePath = ROUTE_INVENTORY_PATH) {
  const source = fs.readFileSync(filePath, "utf8");
  return [...source.matchAll(/\{\s*pattern:\s*"([^"]+)",\s*tier:\s*"([^"]+)"/g)].map((match) => ({
    pattern: match[1],
    tier: match[2],
  }));
}

function extractHrefStringsFromSource(source) {
  const hrefs = new Set();
  for (const match of source.matchAll(/href:\s*["']([^"']+)["']/g)) hrefs.add(match[1]);
  for (const match of source.matchAll(/return\s+["'](\/[^"']+)["']/g)) hrefs.add(match[1]);
  return [...hrefs].sort();
}

function expectedWorkspaceTierForInventoryTier(tier) {
  if (tier === "edge") return "core";
  return tier;
}

export function analyzeUiSurfaceConsistency(cwd = root) {
  const issues = [];
  const manifestRoutes = uiSurfaceManifest.map((entry) => entry.route);
  const manifestRouteSet = new Set(manifestRoutes);

  const duplicateRoutes = manifestRoutes.filter((route, index, arr) => arr.indexOf(route) !== index);
  if (duplicateRoutes.length) {
    issues.push({ issue: "duplicate_manifest_routes", routes: [...new Set(duplicateRoutes)].sort() });
  }

  for (const spec of GENERATED_MATRIX_SPECS) {
    const filePath = path.join(cwd, spec.rel);
    if (!fs.existsSync(filePath)) {
      issues.push({ issue: "missing_generated_matrix", path: spec.rel });
      continue;
    }
    const expected = spec.buildExpected();
    const actual = loadGeneratedArray(filePath);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      issues.push({
        issue: "generated_matrix_drift",
        path: spec.rel,
        expectedCount: expected.length,
        actualCount: actual.length,
      });
    }
  }

  const routeUniverse = buildRouteUniversePayload(cwd);
  const pageRoutes = routeUniverse.universe.routes
    .filter((row) => row.kind === "page")
    .map((row) => row.route)
    .sort();
  const pageRouteSet = new Set(pageRoutes);

  const pageRoutesMissingFromManifest = pageRoutes.filter((route) => !manifestRouteSet.has(route));
  if (pageRoutesMissingFromManifest.length) {
    issues.push({
      issue: "page_routes_missing_from_manifest",
      routes: pageRoutesMissingFromManifest,
    });
  }

  const orphanedManifestRoutes = manifestRoutes.filter((route) => !pageRouteSet.has(route));
  if (orphanedManifestRoutes.length) {
    issues.push({
      issue: "manifest_routes_missing_page_file",
      routes: orphanedManifestRoutes.sort(),
    });
  }

  const routeInventoryEntries = loadRouteInventoryEntries();
  const routeInventoryByPattern = new Map(routeInventoryEntries.map((entry) => [entry.pattern, entry]));

  const authenticatedManifestRoutes = uiSurfaceManifest.filter((entry) => entry.mode === "authenticated");
  const missingRouteInventoryRows = authenticatedManifestRoutes
    .filter((entry) => !routeInventoryByPattern.has(entry.route))
    .map((entry) => entry.route)
    .sort();
  if (missingRouteInventoryRows.length) {
    issues.push({ issue: "authenticated_routes_missing_from_route_inventory", routes: missingRouteInventoryRows });
  }

  const routeInventoryTierMismatches = authenticatedManifestRoutes
    .flatMap((entry) => {
      const inventory = routeInventoryByPattern.get(entry.route);
      if (!inventory) return [];
      const expectedTier = expectedWorkspaceTierForInventoryTier(inventory.tier);
      if (entry.workspaceModeTier === expectedTier) return [];
      return [
        {
          route: entry.route,
          manifestWorkspaceModeTier: entry.workspaceModeTier,
          routeInventoryTier: inventory.tier,
          expectedWorkspaceModeTier: expectedTier,
        },
      ];
    });
  if (routeInventoryTierMismatches.length) {
    issues.push({ issue: "route_inventory_workspace_mode_mismatch", rows: routeInventoryTierMismatches });
  }

  const orphanedRouteInventoryRows = routeInventoryEntries
    .map((entry) => entry.pattern)
    .filter((route) => !manifestRouteSet.has(route))
    .sort();
  if (orphanedRouteInventoryRows.length) {
    issues.push({ issue: "route_inventory_routes_missing_from_manifest", routes: orphanedRouteInventoryRows });
  }

  const navigationHrefs = NAV_SOURCE_FILES.flatMap((rel) => {
    const abs = path.join(cwd, rel);
    if (!fs.existsSync(abs)) return [];
    return extractHrefStringsFromSource(fs.readFileSync(abs, "utf8")).map((href) => ({ rel, href }));
  });
  const invalidNavigationHrefs = navigationHrefs
    .map(({ rel, href }) => ({ rel, href, route: normalizeHrefToRoute(href) }))
    .filter((entry) => entry.route && !manifestRouteSet.has(entry.route));
  if (invalidNavigationHrefs.length) {
    issues.push({ issue: "navigation_href_missing_from_manifest", rows: invalidNavigationHrefs });
  }

  return {
    issueCount: issues.length,
    issues,
    surfaceCount: uiSurfaceManifest.length,
    counts: {
      manifestRoutes: manifestRoutes.length,
      pageRoutes: pageRoutes.length,
      authenticatedManifestRoutes: authenticatedManifestRoutes.length,
      routeInventoryRoutes: routeInventoryEntries.length,
      navigationHrefsChecked: navigationHrefs.length,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeUiSurfaceConsistency();
  if (report.issueCount > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(`check-ui-surface-consistency: OK (${report.surfaceCount} surfaces)`);
}

