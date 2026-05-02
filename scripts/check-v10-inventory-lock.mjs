#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();

const SCAN_ROOTS = [
  ".github/workflows",
  "docs",
  "e2e",
  "scripts",
  "semgrep",
  "src/actions",
  "src/app/(dashboard)",
  "src/app/api",
  "src/components",
  "src/lib",
  "supabase/migrations",
];

const ROOT_FILES = [
  "package.json",
  "vercel.json",
  "vitest.config.ts",
  "vitest.ui.config.ts",
];

const FILE_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);

const IGNORED_SEGMENTS = new Set([
  ".next",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function toPosix(path) {
  return path.split(sep).join("/");
}

function fileExtension(path) {
  const match = path.match(/(\.[^.]+)$/);
  return match?.[1] ?? "";
}

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_SEGMENTS.has(entry.name)) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, out);
      continue;
    }
    const relativePath = toPosix(relative(root, absolute));
    if (FILE_EXTENSIONS.has(fileExtension(relativePath))) out.push(relativePath);
  }
}

function collectFiles() {
  const files = [];
  for (const scanRoot of SCAN_ROOTS) walk(join(root, scanRoot), files);
  for (const file of ROOT_FILES) {
    if (existsSync(join(root, file))) files.push(file);
  }
  return [...new Set(files)].sort();
}

function routePathForApiRoute(file) {
  return `/${file.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "")}`;
}

function pagePathForDashboardPage(file) {
  const route = file
    .replace(/^src\/app\/\(dashboard\)/, "")
    .replace(/\/page\.tsx$/, "")
    .replace(/\/index$/, "");
  return route === "" ? "/dashboard" : route;
}

function exportedHttpMethods(source) {
  return [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|DELETE)\b/g)].map((match) => match[1]);
}

function parseCatalogPaths() {
  const source = readFileSync(join(root, "src/lib/v10-route-api-catalog.ts"), "utf8");
  return new Set([...source.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]));
}

function parseInventoryArtifacts() {
  const artifacts = new Set();
  for (const file of [
    "src/lib/v10-final-gap-audit.ts",
    "src/lib/v10-no-exclusions-matrix.ts",
    "src/lib/v10-source-object-inventory.ts",
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    for (const match of source.matchAll(/"((?:\.github|docs|e2e|package\.json|scripts|semgrep|src|supabase|vercel\.json|vitest)[^"]+)"/g)) {
      artifacts.add(match[1]);
    }
  }
  return artifacts;
}

function classifyRouteBoundary(routePath) {
  const policies = [
    [/^\/api\/assurance\/|^\/assurance\//, "assurance", "assurance", "assurance_route_catalog_promotion"],
    [/^\/api\/(autopilot|campaigns|capacity|command-centers|control-policies|decisions|intelligence|maintenance|playbooks|policy|program-evolution|programs|review-boards|segments|simulations)(\/|$)/, "advanced", "advanced", "advanced_route_catalog_promotion"],
    [/^\/(campaigns|decisions|relationship-workspaces|onboarding)\b/, "advanced", "advanced", "advanced_dashboard_catalog_promotion"],
    [/^\/contracts\/(analytics|approvals\/sla-simulator|approvals\/workload|bulk|collaboration|data-quality|execution-graph|intake|maintenance|new|programs|review-cadence|watchlists)\b/, "contracts", "core", "contract_surface_catalog_promotion"],
    [/^\/api\/external-actions\//, "evidence", "core", "external_token_boundary"],
    [/^\/api\/attestations\//, "evidence", "core", "attestation_response_boundary"],
    [/^\/api\/exceptions\/run-detection\b/, "exceptions", "core", "exception_detection_boundary"],
    [/^\/api\/extract\b/, "activation", "core", "activation_provider_boundary"],
    [/^\/api\/integrations\//, "advanced", "advanced", "integration_provider_boundary"],
    [/^\/api\/product-telemetry\//, "settings", "core", "telemetry_ingest_boundary"],
    [/^\/api\/stripe\//, "settings", "core", "billing_provider_boundary"],
    [/^\/api\/tasks\//, "work", "core", "work_ingest_boundary"],
    [/^\/api\/webhooks\//, "advanced", "advanced", "webhook_provider_boundary"],
    [/^\/api\/workspace\//, "settings", "core", "workspace_settings_boundary"],
    [/^\/dashboard\/persona\b|^\/more\b|^\/settings\/(billing|operations|policy|security)\b/, "settings", "core", "settings_dashboard_catalog_promotion"],
  ];
  for (const [pattern, surface, minimumMode, promotionPath] of policies) {
    if (pattern.test(routePath)) {
      return {
        surface,
        minimumMode,
        owner: surface === "assurance" || surface === "advanced" ? "product" : "engineering",
        compatibilityBoundary: promotionPath,
      };
    }
  }
  return null;
}

function classifyFile(file, catalogPaths, inventoryArtifacts) {
  const inInventory = inventoryArtifacts.has(file);
  if (file.startsWith(".github/workflows/")) return { kind: "ci_workflow", inInventory };
  if (file.startsWith("docs/")) return { kind: "documentation", inInventory };
  if (file.startsWith("e2e/")) return { kind: "browser_evidence", inInventory };
  if (file.startsWith("scripts/")) return { kind: "release_or_ops_script", inInventory };
  if (file.startsWith("semgrep/")) return { kind: "security_rulepack", inInventory };
  if (file.startsWith("supabase/migrations/")) return { kind: "database_migration", inInventory };
  if (ROOT_FILES.includes(file)) return { kind: "release_configuration", inInventory };

  if (file.startsWith("src/app/api/")) {
    if (file.endsWith("/route.ts")) {
      const routePath = routePathForApiRoute(file);
      const source = readFileSync(join(root, file), "utf8");
      return {
        kind: "api_route",
        routePath,
        methods: exportedHttpMethods(source),
        inCatalog: catalogPaths.has(routePath),
        routeBoundary: catalogPaths.has(routePath) ? null : classifyRouteBoundary(routePath),
        inInventory,
      };
    }
    return { kind: "api_route_test_or_support", inInventory };
  }

  if (file.startsWith("src/app/(dashboard)/")) {
    if (file.endsWith("/page.tsx")) {
      const routePath = pagePathForDashboardPage(file);
      return {
        kind: "dashboard_page",
        routePath,
        inCatalog: catalogPaths.has(routePath),
        routeBoundary: catalogPaths.has(routePath) ? null : classifyRouteBoundary(routePath),
        inInventory,
      };
    }
    return { kind: "dashboard_support", inInventory };
  }

  if (file.startsWith("src/actions/")) return { kind: "server_action", inInventory };
  if (file.startsWith("src/components/")) return { kind: "component", inInventory };
  if (file.startsWith("src/lib/")) return { kind: "library", inInventory };
  return null;
}

const catalogPaths = parseCatalogPaths();
const inventoryArtifacts = parseInventoryArtifacts();
const files = collectFiles();
const rows = files.map((file) => ({ file, classification: classifyFile(file, catalogPaths, inventoryArtifacts) }));
const unclassified = rows.filter((row) => row.classification == null).map((row) => row.file);
const apiRoutes = rows.filter((row) => row.classification?.kind === "api_route");
const dashboardPages = rows.filter((row) => row.classification?.kind === "dashboard_page");
const serverActions = rows.filter((row) => row.classification?.kind === "server_action");
const uncatalogedStateChangingRoutes = apiRoutes.filter((row) => {
  const classification = row.classification;
  return classification && !classification.inCatalog && classification.methods?.some((method) => method !== "GET");
});
const uncatalogedDashboardPages = dashboardPages.filter((row) => row.classification && !row.classification.inCatalog);
const uncategorizedRouteBoundaries = [...uncatalogedStateChangingRoutes, ...uncatalogedDashboardPages]
  .filter((row) => row.classification && !row.classification.routeBoundary)
  .map((row) => ({
    file: row.file,
    routePath: row.classification.routePath,
  }));

const payload = {
  ok: unclassified.length === 0 && uncategorizedRouteBoundaries.length === 0,
  files: files.length,
  classified: files.length - unclassified.length,
  counts: {
    apiRoutes: apiRoutes.length,
    dashboardPages: dashboardPages.length,
    serverActions: serverActions.length,
    catalogedApiRoutes: apiRoutes.filter((row) => row.classification?.inCatalog).length,
    catalogedDashboardPages: dashboardPages.filter((row) => row.classification?.inCatalog).length,
    directInventoryArtifacts: rows.filter((row) => row.classification?.inInventory).length,
  },
  residualCoverageWork: {
    uncatalogedStateChangingRoutes: uncatalogedStateChangingRoutes.map((row) => ({
      file: row.file,
      routePath: row.classification.routePath,
      methods: row.classification.methods,
      routeBoundary: row.classification.routeBoundary,
    })),
    uncatalogedDashboardPages: uncatalogedDashboardPages.map((row) => ({
      file: row.file,
      routePath: row.classification.routePath,
      routeBoundary: row.classification.routeBoundary,
    })),
    uncategorizedRouteBoundaries,
  },
  unclassified,
};

if (unclassified.length > 0 || uncategorizedRouteBoundaries.length > 0) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
