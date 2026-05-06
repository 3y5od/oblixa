#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uiSurfaceManifest } from "../src/lib/qa/ui-surface-manifest.source.mjs";
import { analyzeRouteStateCoverage } from "./check-route-state-coverage.mjs";
import { analyzeUiSurfaceConsistency } from "./check-ui-surface-consistency.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
export const USER_FACING_INTERACTION_ARTIFACT = path.join(
  ROOT,
  "artifacts",
  "assurance",
  "user-facing-interactions-closure.json"
);

const SOURCE_DIRS = [path.join(ROOT, "src", "app"), path.join(ROOT, "src", "components")];
const WAIVERS_PATH = path.join(ROOT, "artifacts", "assurance", "waivers.json");
const INTERACTION_AUDIT_IGNORE_PATHS = new Set(["src/components/ui/external-link.tsx"]);

function walk(dir, options = {}, acc = []) {
  const { includeTests = false } = options;
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, options, acc);
    else if (/\.(ts|tsx)$/.test(name) && (includeTests || !/\.(test|spec)\./.test(name))) acc.push(full);
  }
  return acc;
}

function normalizeAppRouteSegments(segments) {
  return segments.filter((segment) => segment && !segment.startsWith("(") && !segment.startsWith("@"));
}

function routeFromAppFile(relPath) {
  const withoutPrefix = relPath.replace(/^src\/app\//, "");
  const segments = withoutPrefix.split("/").filter(Boolean);
  const fileName = segments.at(-1) ?? "";
  if (!/(page|layout|loading|error|not-found|global-error)\.tsx$/.test(fileName)) return null;
  const normalized = normalizeAppRouteSegments(segments.slice(0, -1));
  return normalized.length ? `/${normalized.join("/")}` : "/";
}

function inferRouteContext(relPath) {
  if (relPath.startsWith("src/app/")) {
    return routeFromAppFile(relPath);
  }

  const family = relPath.replace(/^src\/components\//, "").split("/")[0] ?? "";
  const familyRouteMap = {
    assurance: "/assurance",
    auth: "/login",
    campaigns: "/campaigns",
    contracts: "/contracts",
    dashboard: "/dashboard",
    decisions: "/decisions",
    external: "/external/[token]",
    layout: "/dashboard",
    onboarding: "/onboarding/calibration",
    relationship: "/relationship-workspaces",
    reports: "/reports",
    settings: "/settings",
    ui: "/dashboard",
    v4: "/contracts/renewals",
  };
  return familyRouteMap[family] ?? null;
}

function inferOwner(route) {
  if (!route) return "engineering";
  const exact = uiSurfaceManifest.find((entry) => entry.route === route);
  if (exact) return exact.owner;
  const prefix = [...uiSurfaceManifest]
    .sort((a, b) => b.route.length - a.route.length)
    .find((entry) => route === entry.route || route.startsWith(`${entry.route}/`));
  return prefix?.owner ?? "engineering";
}

function hasSiblingUiTest(relPath) {
  const abs = path.join(ROOT, relPath);
  const candidates = [
    abs.replace(/\.(ts|tsx)$/, ".test.$1"),
    abs.replace(/\.(ts|tsx)$/, ".ui.test.$1"),
    abs.replace(/\.(ts|tsx)$/, ".spec.$1"),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function buildE2eCorpus() {
  const e2eRoot = path.join(ROOT, "e2e");
  if (!fs.existsSync(e2eRoot)) return "";
  return walk(e2eRoot, { includeTests: true })
    .filter((abs) => abs.endsWith(".ts") || abs.endsWith(".tsx"))
    .map((abs) => fs.readFileSync(abs, "utf8"))
    .join("\n");
}

function hasE2eReference(route, e2eCorpus) {
  if (!route) return false;
  const probe = route.includes("[") ? route.split("/").filter(Boolean).slice(0, -1).join("/") : route;
  if (!probe) return false;
  return e2eCorpus.includes(route) || e2eCorpus.includes(probe) || e2eCorpus.includes(`/${probe}`);
}

function interactionRisk(kind, snippet) {
  if (kind === "client_http_helper") {
    if (/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(snippet)) return "medium";
    return "low";
  }
  if (kind === "raw_client_fetch") {
    if (/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(snippet)) return "high";
    return "medium";
  }
  if (kind === "imperative_navigation") {
    if (/window\.location/.test(snippet)) return "high";
    return "medium";
  }
  if (kind === "new_tab_link" || kind === "form") return "medium";
  return "low";
}

function extractTarget(kind, snippet) {
  if (kind === "client_http_helper") return /(?:fetchJson|mutateJson)\(([^,)]+)/.exec(snippet)?.[1]?.trim() ?? null;
  if (kind === "raw_client_fetch") return /fetch\(([^,)]+)/.exec(snippet)?.[1]?.trim() ?? null;
  if (kind === "imperative_navigation") {
    return (
      /router\.(?:push|replace)\(([^,)]+)/.exec(snippet)?.[1]?.trim() ??
      /window\.location\.(?:assign|replace)\(([^,)]+)/.exec(snippet)?.[1]?.trim() ??
      /window\.location\.href\s*=\s*([^;]+)/.exec(snippet)?.[1]?.trim() ??
      null
    );
  }
  if (kind === "new_tab_link") return /href=\{?(["'`][^"'`]+["'`])/.exec(snippet)?.[1] ?? null;
  return null;
}

function addRows(rows, relPath, kind, count, lineNumber, snippet, route, e2eCorpus) {
  for (let index = 0; index < count; index += 1) {
    rows.push({
      id: `${kind}:${relPath}:${lineNumber}:${index + 1}`,
      kind,
      sourcePath: relPath,
      line: lineNumber,
      route,
      owner: inferOwner(route),
      risk: interactionRisk(kind, snippet),
      target: extractTarget(kind, snippet),
      ui_test: hasSiblingUiTest(relPath),
      e2e_test: hasE2eReference(route, e2eCorpus),
    });
  }
}

function collectInteractionRows(root = ROOT) {
  const rows = [];
  const e2eCorpus = buildE2eCorpus();
  const sourceFiles = SOURCE_DIRS.flatMap((dir) => walk(dir, { includeTests: false }));

  for (const abs of sourceFiles) {
    const relPath = path.relative(root, abs).replace(/\\/g, "/");
    if (INTERACTION_AUDIT_IGNORE_PATHS.has(relPath)) continue;
    const source = fs.readFileSync(abs, "utf8");
    const lines = source.split("\n");
    const isClientModule = /^\s*["']use client["'];/m.test(lines.slice(0, 5).join("\n"));
    const route = inferRouteContext(relPath);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const snippet = lines.slice(lineIndex, lineIndex + 4).join(" ");
      const lineNumber = lineIndex + 1;

      if (/\.tsx$/.test(relPath)) {
        addRows(rows, relPath, "button", line.match(/<button\b/g)?.length ?? 0, lineNumber, snippet, route, e2eCorpus);
        addRows(rows, relPath, "form", line.match(/<form\b/g)?.length ?? 0, lineNumber, snippet, route, e2eCorpus);
        addRows(rows, relPath, "link", line.match(/<(?:Link|ExternalLink|a)\b/g)?.length ?? 0, lineNumber, snippet, route, e2eCorpus);
      }

      if (isClientModule && /\bfetch\s*\(/.test(line) && !/\b(?:fetchJson|mutateV10|safeFetch)\s*\(/.test(line)) {
        addRows(rows, relPath, "raw_client_fetch", 1, lineNumber, snippet, route, e2eCorpus);
      }

      if (isClientModule && /\b(?:fetchJson|mutateJson)\s*\(/.test(line)) {
        addRows(rows, relPath, "client_http_helper", 1, lineNumber, snippet, route, e2eCorpus);
      }

      if (isClientModule && /router\.(?:push|replace)\(|window\.location\.(?:assign|replace)|window\.location\.href\s*=/.test(snippet)) {
        addRows(rows, relPath, "imperative_navigation", 1, lineNumber, snippet, route, e2eCorpus);
      }

      if (/target=\"_blank\"/.test(snippet)) {
        addRows(rows, relPath, "new_tab_link", 1, lineNumber, snippet, route, e2eCorpus);
      }

      addRows(rows, relPath, "new_tab_link", line.match(/<ExternalLink\b/g)?.length ?? 0, lineNumber, snippet, route, e2eCorpus);
    }
  }

  return rows;
}

function loadWaivers() {
  if (!fs.existsSync(WAIVERS_PATH)) return { total: 0, expiredCount: 0, rows: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(WAIVERS_PATH, "utf8"));
    const rows = Array.isArray(parsed.waivers) ? parsed.waivers : [];
    const today = Date.now();
    const expired = rows.filter((row) => {
      const raw = row.expiresOn ?? row.expiresAt ?? null;
      const ts = raw ? Date.parse(`${raw}T23:59:59.999Z`) : Number.NaN;
      return Number.isFinite(ts) && ts < today;
    });
    return { total: rows.length, expiredCount: expired.length, rows, expired };
  } catch (error) {
    return {
      total: 0,
      expiredCount: 1,
      rows: [],
      expired: [{ issue: "waiver_registry_parse_failure", message: String(error?.message ?? error) }],
    };
  }
}

function summarizeBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export function buildUserFacingInteractionReport(root = ROOT) {
  const uiSurfaceConsistency = analyzeUiSurfaceConsistency(root);
  const routeStateCoverage = analyzeRouteStateCoverage(root);
  const interactionRows = collectInteractionRows(root);
  const waivers = loadWaivers();

  const routes = uiSurfaceManifest.map((entry) => ({
    route: entry.route,
    mode: entry.mode,
    routeFamily: entry.routeFamily,
    workspaceModeTier: entry.workspaceModeTier,
    visitPath: entry.visitPath,
    fixtureId: entry.fixtureId,
    coverage: [...entry.coverage],
    smokeTier: entry.smokeTier,
    a11yTier: entry.a11yTier,
    visualTier: entry.visualTier,
    owner: entry.owner,
    ownerExpiry: entry.ownerExpiry,
    ownerEscalation: entry.ownerEscalation,
  }));

  const blockingFailures = [
    ...uiSurfaceConsistency.issues.map((issue) => ({ source: "ui_surface_consistency", ...issue })),
    ...routeStateCoverage.issues.map((issue) => ({ source: "route_state_coverage", ...issue })),
    ...(waivers.expired ?? []).map((issue) => ({ source: "waivers", ...issue })),
  ];

  const openInteractionRisks = interactionRows.filter((row) => {
    return row.kind === "raw_client_fetch" || row.kind === "imperative_navigation" || row.kind === "new_tab_link";
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    routes: {
      total: routes.length,
      byMode: summarizeBy(routes, "mode"),
      byRouteFamily: summarizeBy(routes, "routeFamily"),
      byOwner: summarizeBy(routes, "owner"),
      withFixtureIds: routes.filter((route) => route.fixtureId).length,
      rows: routes,
    },
    interactions: {
      total: interactionRows.length,
      byKind: summarizeBy(interactionRows, "kind"),
      byRisk: summarizeBy(interactionRows, "risk"),
      rows: interactionRows,
    },
    waivers,
    checks: {
      uiSurfaceConsistency,
      routeStateCoverage,
    },
    failures: blockingFailures,
    openInteractionRisks,
    summary: {
      routeCount: routes.length,
      interactionCount: interactionRows.length,
      blockingFailureCount: blockingFailures.length,
      openInteractionRiskCount: openInteractionRisks.length,
      expiredWaiverCount: waivers.expiredCount ?? 0,
    },
  };
}

export function writeUserFacingInteractionReport(root = ROOT) {
  const report = buildUserFacingInteractionReport(root);
  fs.mkdirSync(path.dirname(USER_FACING_INTERACTION_ARTIFACT), { recursive: true });
  fs.writeFileSync(USER_FACING_INTERACTION_ARTIFACT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function assertUserFacingInteractionReport(report) {
  return report.failures ?? [];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writeUserFacingInteractionReport();
  console.log(JSON.stringify(report, null, 2));
}