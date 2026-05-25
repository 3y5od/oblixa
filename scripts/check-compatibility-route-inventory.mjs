#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildVersionedRouteAliasPlan } from "./check-versioned-route-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_INVENTORY_REL = "artifacts/routes/compatibility-route-inventory.json";
const API_ROOT_REL = "src/app/api";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function walkRouteFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRouteFiles(abs, acc);
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") acc.push(abs);
  }
  return acc;
}

function routePathForFile(root, abs) {
  const apiRoot = path.join(root, API_ROOT_REL);
  const rel = relPath(apiRoot, path.dirname(abs));
  return `/${["api", ...rel.split("/").filter(Boolean)].join("/")}`;
}

function methodsFromSource(source) {
  return HTTP_METHODS.filter((method) => {
    const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`, "u");
    const cn = new RegExp(`export\\s+const\\s+${method}\\s*=`, "u");
    return fn.test(source) || cn.test(source);
  });
}

function readCronEntries(root) {
  try {
    const parsed = JSON.parse(read(path.join(root, "vercel.json")) || "{}");
    return (Array.isArray(parsed.crons) ? parsed.crons : [])
      .map((entry) => ({
        path: String(entry?.path ?? ""),
        schedule: String(entry?.schedule ?? ""),
      }))
      .filter((entry) => entry.path.startsWith("/api/"))
      .sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    return [];
  }
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function classifyRoute({ routePath, source, cronEntry }) {
  const categories = ["api"];
  const externalCallers = [];

  if (cronEntry || routePath.includes("/api/cron/")) {
    categories.push("cron");
    externalCallers.push(cronEntry ? "vercel_cron" : "cron_route_pattern");
  }

  if (
    routePath.includes("/webhook") ||
    routePath.includes("/webhooks/") ||
    /stripe-signature|constructEvent|verifyWebhook|webhook.*signature/iu.test(source)
  ) {
    categories.push("webhook");
    externalCallers.push("provider_webhook");
  }

  if (routePath.includes("/external-actions/")) {
    categories.push("signed_link");
    externalCallers.push("external_signed_link");
  }

  if (
    routePath.includes("[token]") ||
    routePath.includes("/reports/track/") ||
    /public-token-key|publicTokenHash|publicTokenPrefix|publicTokenStableKey/iu.test(source)
  ) {
    categories.push("public_token");
    externalCallers.push("public_token");
  }

  return {
    categories: uniqueSorted(categories),
    externalCallers: uniqueSorted(externalCallers),
  };
}

export function buildCompatibilityRouteInventory(root = DEFAULT_ROOT, existingAliases = []) {
  const apiRoot = path.join(root, API_ROOT_REL);
  const cronEntries = readCronEntries(root);
  const cronByPath = new Map(cronEntries.map((entry) => [entry.path, entry]));
  const routeFiles = walkRouteFiles(apiRoot).sort((a, b) => relPath(root, a).localeCompare(relPath(root, b)));
  const generatedAliases = buildVersionedRouteAliasPlan(root).map((alias) => ({
    from: alias.legacyPath,
    to: alias.neutralPath,
    owner: alias.owner,
    reason: alias.reason,
    status: "alias_added",
    earliestRemovalCondition:
      alias.surface === "cron_route"
        ? "Vercel cron schedules and any external callers are manually migrated to the neutral route and compatibility route inventory remains green."
        : "Clients and generated API documentation use the neutral route and compatibility route inventory remains green.",
    manualFollowUp:
      alias.surface === "cron_route"
        ? "Keep Vercel cron schedules unchanged until production scheduler cutover is approved."
        : "Keep the legacy API route callable until client and documentation cutover evidence exists.",
  }));
  const routes = routeFiles.map((abs) => {
    const routeFile = relPath(root, abs);
    const source = read(abs);
    const routePath = routePathForFile(root, abs);
    const cronEntry = cronByPath.get(routePath) ?? null;
    const classification = classifyRoute({ routePath, source, cronEntry });
    return {
      path: routePath,
      routeFile,
      methods: methodsFromSource(source),
      categories: classification.categories,
      externallyCalled: classification.externalCallers.length > 0,
      externalCallers: classification.externalCallers,
      compatibilitySensitive: true,
      cronSchedule: cronEntry?.schedule ?? null,
    };
  });

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-compatibility-route-inventory.mjs --write",
    sourceRoot: API_ROOT_REL,
    routeCount: routes.length,
    compatibilitySensitiveCount: routes.filter((route) => route.compatibilitySensitive).length,
    externallyCalledCount: routes.filter((route) => route.externallyCalled).length,
    aliases: normalizeAliases([...existingAliases, ...generatedAliases]),
    routes,
  };
}

function normalizeAliases(aliases) {
  const byKey = new Map();
  for (const alias of Array.isArray(aliases) ? aliases : []) {
    const normalized = {
      from: toPosix(alias?.from ?? ""),
      to: toPosix(alias?.to ?? ""),
      owner: String(alias?.owner ?? ""),
      reason: String(alias?.reason ?? ""),
      status: String(alias?.status ?? "alias_added"),
      earliestRemovalCondition: String(alias?.earliestRemovalCondition ?? "Neutral route remains available and legacy route removal is approved by the compatibility queue."),
      manualFollowUp: String(alias?.manualFollowUp ?? "Keep the legacy route callable until manual cutover evidence exists."),
    };
    if (!normalized.from || !normalized.to) continue;
    byKey.set(`${normalized.from}\0${normalized.to}`, normalized);
  }
  return Array.from(byKey.values())
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

function loadInventory(root, inventoryRel) {
  const abs = path.join(root, inventoryRel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(read(abs));
}

function normalizedRoute(route) {
  return {
    path: route.path,
    routeFile: route.routeFile,
    methods: uniqueSorted(route.methods ?? []),
    categories: uniqueSorted(route.categories ?? []),
    externallyCalled: Boolean(route.externallyCalled),
    externalCallers: uniqueSorted(route.externalCallers ?? []),
    compatibilitySensitive: Boolean(route.compatibilitySensitive),
    cronSchedule: route.cronSchedule ?? null,
  };
}

function sameRoute(a, b) {
  return JSON.stringify(normalizedRoute(a)) === JSON.stringify(normalizedRoute(b));
}

function validateAlias(alias, currentPaths) {
  const issues = [];
  if (!alias.owner) issues.push({ issue: "compatibility_route_alias_missing_owner", alias });
  if (!alias.reason) issues.push({ issue: "compatibility_route_alias_missing_reason", alias });
  if (!alias.status) issues.push({ issue: "compatibility_route_alias_missing_status", alias });
  if (!alias.earliestRemovalCondition) issues.push({ issue: "compatibility_route_alias_missing_earliest_removal_condition", alias });
  if (!alias.manualFollowUp) issues.push({ issue: "compatibility_route_alias_missing_manual_follow_up", alias });
  if (!currentPaths.has(alias.to)) {
    issues.push({ issue: "compatibility_route_alias_target_missing", alias });
  }
  return issues;
}

function cronAlignmentIssues({ current, cronEntries }) {
  const issues = [];
  const currentPaths = new Set(current.routes.map((route) => route.path));
  const currentCronPaths = new Set(
    current.routes.filter((route) => route.categories.includes("cron")).map((route) => route.path),
  );

  for (const entry of cronEntries) {
    if (!currentPaths.has(entry.path)) {
      issues.push({ issue: "vercel_cron_route_missing", path: entry.path, schedule: entry.schedule });
    }
  }

  for (const route of current.routes) {
    const isNeutralAliasTarget = current.aliases.some((alias) => alias.to === route.path);
    if (route.path.includes("/api/cron/") && !isNeutralAliasTarget && !cronEntries.some((entry) => entry.path === route.path)) {
      issues.push({ issue: "cron_route_missing_vercel_schedule", path: route.path });
    }
  }

  for (const entry of cronEntries) {
    if (currentPaths.has(entry.path) && !currentCronPaths.has(entry.path)) {
      issues.push({ issue: "vercel_cron_not_classified_as_cron", path: entry.path });
    }
  }

  return issues;
}

export function analyzeCompatibilityRouteInventory(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const inventoryRel = toPosix(options.inventoryRel ?? DEFAULT_INVENTORY_REL);
  const committed = loadInventory(root, inventoryRel);
  const aliases = normalizeAliases(committed?.aliases ?? []);
  const current = buildCompatibilityRouteInventory(root, aliases);
  const issues = [];

  if (!committed) {
    return {
      ok: false,
      inventoryPath: inventoryRel,
      currentRouteCount: current.routeCount,
      issueCount: 1,
      issues: [{ issue: "compatibility_route_inventory_missing", path: inventoryRel }],
      current,
    };
  }

  if (committed.schemaVersion !== 1) {
    issues.push({ issue: "invalid_compatibility_route_inventory_schema", path: inventoryRel });
  }

  const committedRoutes = Array.isArray(committed.routes) ? committed.routes : [];
  const committedByPath = new Map();
  for (const route of committedRoutes) {
    if (committedByPath.has(route.path)) {
      issues.push({ issue: "duplicate_compatibility_route_inventory_path", path: route.path });
    }
    committedByPath.set(route.path, route);
  }

  const currentByPath = new Map(current.routes.map((route) => [route.path, route]));
  const currentPaths = new Set(currentByPath.keys());
  const aliasByFrom = new Map(aliases.map((alias) => [alias.from, alias]));

  for (const alias of aliases) {
    issues.push(...validateAlias(alias, currentPaths));
  }

  for (const route of current.routes) {
    const committedRoute = committedByPath.get(route.path);
    if (!committedRoute) {
      issues.push({ issue: "compatibility_route_inventory_missing_current_route", path: route.path, routeFile: route.routeFile });
      continue;
    }
    if (!sameRoute(committedRoute, route)) {
      issues.push({ issue: "compatibility_route_inventory_drift", path: route.path, expected: normalizedRoute(route), actual: normalizedRoute(committedRoute) });
    }
  }

  for (const route of committedRoutes) {
    if (currentByPath.has(route.path)) continue;
    const alias = aliasByFrom.get(route.path);
    if (route.compatibilitySensitive && !alias) {
      issues.push({ issue: "compatibility_route_missing_without_alias", path: route.path, routeFile: route.routeFile });
    } else if (!route.compatibilitySensitive) {
      issues.push({ issue: "stale_compatibility_route_inventory_entry", path: route.path, routeFile: route.routeFile });
    }
  }

  issues.push(...cronAlignmentIssues({ current, cronEntries: readCronEntries(root) }));

  const committedRoutesForDrift = committedRoutes.filter((route) => currentByPath.has(route.path) || !aliasByFrom.has(route.path));
  const driftlessCommitted = {
    ...committed,
    routeCount: current.routeCount,
    compatibilitySensitiveCount: current.compatibilitySensitiveCount,
    externallyCalledCount: current.externallyCalledCount,
    aliases,
    routes: committedRoutesForDrift,
  };
  const comparableCurrent = {
    ...current,
    aliases,
  };
  if (JSON.stringify(driftlessCommitted) !== JSON.stringify(comparableCurrent)) {
    issues.push({ issue: "compatibility_route_inventory_file_drift", path: inventoryRel, hint: "Run npm run write:compatibility-route-inventory" });
  }

  return {
    ok: issues.length === 0,
    inventoryPath: inventoryRel,
    currentRouteCount: current.routeCount,
    externallyCalledCount: current.externallyCalledCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    inventoryRel: DEFAULT_INVENTORY_REL,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
      continue;
    }
    if (arg === "--inventory") {
      options.inventoryRel = toPosix(argv[index + 1] ?? DEFAULT_INVENTORY_REL);
      index += 1;
      continue;
    }
    if (arg.startsWith("--inventory=")) {
      options.inventoryRel = toPosix(arg.slice("--inventory=".length));
      continue;
    }
    if (arg === "--write") options.write = true;
  }
  return options;
}

function writeInventory(root, inventoryRel) {
  const existing = loadInventory(root, inventoryRel);
  const inventory = buildCompatibilityRouteInventory(root, existing?.aliases ?? []);
  const abs = path.join(root, inventoryRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(inventory, null, 2)}\n`);
  return inventory;
}

export function runCompatibilityRouteInventoryCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const inventory = writeInventory(options.root, options.inventoryRel);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.inventoryRel,
          routeCount: inventory.routeCount,
          externallyCalledCount: inventory.externallyCalledCount,
        },
        null,
        2,
      ),
    );
    return inventory;
  }

  const report = analyzeCompatibilityRouteInventory(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCompatibilityRouteInventoryCheck();
}
