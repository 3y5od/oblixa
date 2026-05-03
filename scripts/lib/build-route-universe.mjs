import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const APP_FILENAMES = new Set([
  "page.tsx",
  "layout.tsx",
  "route.ts",
  "loading.tsx",
  "error.tsx",
  "global-error.tsx",
  "not-found.tsx",
  "forbidden.tsx",
]);

const STATE_FILENAMES = new Set(["loading.tsx", "error.tsx", "global-error.tsx", "not-found.tsx", "forbidden.tsx"]);
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const SEGMENT_PLACEHOLDERS = {
  id: "00000000-0000-0000-0000-000000000001",
  token: "smoke-token",
  key: "smoke-key",
  jobId: "00000000-0000-0000-0000-000000000002",
  action: "smoke-action",
};

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function walk(dir, predicate = () => true, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, predicate, acc);
    else if (predicate(full, name)) acc.push(full);
  }
  return acc;
}

function normalizeAppSegments(segments) {
  return segments.filter((segment) => {
    if (!segment) return false;
    if (segment.startsWith("(") && segment.endsWith(")")) return false;
    if (segment.startsWith("@")) return false;
    return true;
  });
}

function appFileToRoute(appRoot, file) {
  const dir = path.dirname(file);
  const rawSegments = path.relative(appRoot, dir).replace(/\\/g, "/").split("/").filter(Boolean);
  const segments = normalizeAppSegments(rawSegments);
  return segments.length ? `/${segments.join("/")}` : "/";
}

function appShellFamily(appRoot, file) {
  const rawSegments = path.relative(appRoot, path.dirname(file)).replace(/\\/g, "/").split("/").filter(Boolean);
  const group = rawSegments.find((segment) => segment.startsWith("(") && segment.endsWith(")"));
  if (group) return group.slice(1, -1);
  const first = normalizeAppSegments(rawSegments)[0];
  if (first === "api") return "api";
  return first || "root";
}

function dynamicSegments(route) {
  return route
    .split("/")
    .filter((segment) => /^\[\[?\.\.\.|^\[[^\]]+\]$/.test(segment))
    .map((segment) => segment.replace(/^\[\[?\.\.\./, "").replace(/^\[/, "").replace(/\]\]?$/, ""));
}

function samplePath(route) {
  const out = [];
  for (const segment of route.split("/").filter(Boolean)) {
    const match = /^\[\[?\.\.\.(.+)\]\]$|^\[(.+)\]$/.exec(segment);
    if (!match) {
      out.push(segment);
      continue;
    }
    const key = match[1] ?? match[2];
    out.push(SEGMENT_PLACEHOLDERS[key] ?? `smoke-${key}`);
  }
  return `/${out.join("/")}` || "/";
}

function methodsFromSource(source) {
  const methods = HTTP_METHODS.filter((method) => new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(source));
  return methods.length ? methods : [];
}

function runtimeFromSource(source, routeKind) {
  const match = /export\s+const\s+runtime\s*=\s*["']([^"']+)["']/.exec(source);
  if (match) return match[1];
  if (routeKind === "page") return "server_component";
  if (routeKind === "server_action") return "server_action";
  return "nodejs_default";
}

function detectProviders(source, route) {
  const providers = new Set();
  if (/supabase|createAdminClient|createClient|\.from\(|\.rpc\(/i.test(source)) providers.add("supabase");
  if (/Resend|send[A-Za-z]*Email|@\/lib\/email|resend/i.test(source)) providers.add("resend");
  if (/Stripe|stripe/i.test(source) || route.includes("stripe")) providers.add("stripe");
  if (/OpenAI|openai|extract/i.test(source) || route.includes("extract")) providers.add("openai");
  if (/Upstash|Ratelimit|rateLimitCheck|RATE_LIMITS/i.test(source)) providers.add("upstash_or_memory_rate_limit");
  if (/Sentry|captureServer/i.test(source)) providers.add("sentry");
  if (/fetch\(/.test(source)) providers.add("external_fetch");
  if (/storage|signed_url|signedUrl/i.test(source)) providers.add("storage");
  if (/webhook|outbound|enqueueOutboundEvent/i.test(source) || route.includes("webhook")) providers.add("webhook_outbox");
  if (/calendar/i.test(source) || route.includes("calendar")) providers.add("calendar");
  if (/crm/i.test(source) || route.includes("crm")) providers.add("crm");
  return [...providers].sort();
}

function detectDbDependencies(source) {
  const tables = [...source.matchAll(/\.from\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  const rpcs = [...source.matchAll(/\.rpc\(\s*["']([^"']+)["']\s*/g)].map((m) => m[1]);
  return {
    tables: [...new Set(tables)].sort(),
    rpcs: [...new Set(rpcs)].sort(),
  };
}

function authModel(route, source, cronPaths) {
  if (cronPaths.has(route) || route.includes("/api/cron/")) return "cron_secret";
  if (route.includes("/stripe/webhook") || route.includes("/webhooks/") || /stripe-signature|verifyWebhook/i.test(source)) return "webhook_signature";
  if (route.includes("/external-actions/") || route.startsWith("/external/")) return "external_token";
  if (route.includes("/reports/track/") || route.includes("/auth/") || route === "/login" || route === "/signup") return "public_or_token";
  if (route.startsWith("/api/internal/")) return "internal_bearer";
  if (route.startsWith("/api/")) return "session";
  if (route.startsWith("/dashboard") || route.startsWith("/contracts") || route.startsWith("/assurance") || route.startsWith("/settings") || route.startsWith("/reports") || route.startsWith("/work") || route.startsWith("/decisions") || route.startsWith("/accounts") || route.startsWith("/counterparties") || route.startsWith("/campaigns")) return "session";
  return "public";
}

function routeClass(route, kind, cronPaths) {
  if (kind === "server_action") return "server_action";
  if (cronPaths.has(route) || route.includes("/api/cron/")) return "cron";
  if (route.includes("/stripe/webhook") || route.includes("/webhooks/")) return "webhook";
  if (route.includes("/external-actions/") || route.startsWith("/external/")) return "external_token";
  if (route.includes("/reports/track/")) return "tracking";
  if (route.includes("/auth/") || route === "/login" || route === "/signup") return "auth";
  if (route.startsWith("/api/internal/")) return "internal";
  if (route.startsWith("/api/")) return "api";
  if (kind === "page") return authModel(route, "", cronPaths) === "session" ? "authenticated_page" : "public_page";
  return kind;
}

function cachePolicy(auth) {
  if (auth === "public") return "public_intentional";
  return "private_no_store";
}

function bodyPolicy(methods, source, cls) {
  const mutating = methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method));
  if (!mutating) return "no_body_expected";
  if (/readJsonBodyLimited|parseJsonBodyWithLimit|readRequestBodyLimited|formData\(/.test(source)) return "bounded_or_form_body";
  if (cls === "webhook") return "signature_bound_raw_body";
  return "body_limit_required";
}

function rateLimitPolicy(cls, methods, source) {
  if (cls === "cron") return "cron";
  if (cls === "webhook") return "webhook";
  if (cls === "external_token" || cls === "tracking") return "external_or_token";
  if (/rateLimitCheck|RATE_LIMITS/.test(source)) return "explicit";
  if (methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method))) return "mutation_required";
  return "standard_or_not_applicable";
}

function workspaceMode(route) {
  if (route.includes("assurance")) return ["assurance"];
  if (route.includes("autopilot") || route.includes("campaign") || route.includes("intelligence") || route.includes("simulation")) return ["advanced", "assurance"];
  if (route.startsWith("/api/") || route.startsWith("/contracts") || route.startsWith("/dashboard") || route.startsWith("/work") || route.startsWith("/reports") || route.startsWith("/settings")) return ["core", "advanced", "assurance"];
  return ["public_or_external"];
}

function rolePolicy(auth, source) {
  if (auth !== "session") return [auth];
  if (/admin|maintenance_manage|product_settings|settings/i.test(source)) return ["admin", "manager"];
  if (/editor|manage|mutat|PATCH|POST|DELETE/.test(source)) return ["editor", "manager", "admin"];
  return ["viewer", "editor", "manager", "admin"];
}

function requiredStatesForRoute(cls, auth) {
  if (cls === "api" || cls === "cron" || cls === "webhook" || cls === "internal" || cls === "tracking") return [];
  const base = ["loading", "error", "not_found", "mobile", "keyboard"];
  if (auth === "session") return [...base, "forbidden", "empty", "partial_data", "active_risk", "all_clear"];
  if (auth === "external_token") return [...base, "expired", "revoked", "completed"];
  return base;
}

function performanceBudget(cls) {
  if (cls === "cron") return { p95Ms: 55_000, maxResponseBytes: 256_000, timeoutClass: "batch" };
  if (cls === "webhook") return { p95Ms: 2_000, maxResponseBytes: 16_000, timeoutClass: "ingress" };
  if (cls === "api") return { p95Ms: 1_500, maxResponseBytes: 128_000, timeoutClass: "interactive_api" };
  if (cls.includes("page")) return { p95Ms: 3_000, maxResponseBytes: 512_000, timeoutClass: "page" };
  return { p95Ms: 2_000, maxResponseBytes: 128_000, timeoutClass: "default" };
}

function routeOwner(route, cls) {
  if (cls === "cron") return "operations";
  if (route.includes("settings") || route.includes("auth")) return "security";
  if (route.includes("report") || route.includes("export")) return "release";
  if (route.includes("assurance") || route.includes("review-board")) return "assurance";
  if (route.includes("integration") || route.includes("webhook")) return "integrations";
  return "engineering";
}

function riskTier(cls, route, methods) {
  if (cls === "cron" || cls === "webhook" || route.includes("stripe") || route.includes("external-actions")) return "P0";
  if (methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method))) return "P1";
  if (cls.includes("page")) return "P2";
  return "P3";
}

function smokeTier(cls, risk) {
  if (cls === "cron") return "cron-canary";
  if (cls === "webhook" || cls === "external_token" || risk === "P0") return "ci";
  if (risk === "P1" || risk === "P2") return "nightly";
  return "inventory";
}

function readCronPaths(root) {
  const raw = JSON.parse(read(path.join(root, "vercel.json")) || "{}");
  const crons = Array.isArray(raw.crons) ? raw.crons : [];
  return {
    cronEntries: crons.map((entry) => ({ path: String(entry.path ?? ""), schedule: String(entry.schedule ?? "") })).filter((entry) => entry.path),
    cronPaths: new Set(crons.map((entry) => String(entry.path ?? "")).filter(Boolean)),
  };
}

function readOpenApiPaths(root) {
  const file = path.join(root, "openapi.yaml");
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = YAML.parse(read(file));
    return Object.keys(parsed?.paths ?? {}).sort();
  } catch {
    return [...read(file).matchAll(/^\s{2}(\/[^:]+):/gm)].map((m) => m[1]).sort();
  }
}

function readHrefDestinations(root) {
  const files = [
    path.join(root, "src", "lib", "navigation.ts"),
    path.join(root, "src", "lib", "product-surface", "cmdk-search-jumps.ts"),
  ];
  const hrefs = new Set();
  for (const file of files) {
    const text = read(file);
    for (const match of text.matchAll(/href:\s*["']([^"']+)["']/g)) hrefs.add(match[1]);
    for (const match of text.matchAll(/return\s+["'](\/[^"']+)["']/g)) hrefs.add(match[1]);
  }
  return [...hrefs].sort();
}

function buildAppRouteRows(root, cronPaths) {
  const appRoot = path.join(root, "src", "app");
  const files = walk(appRoot, (_full, name) => APP_FILENAMES.has(name)).sort((a, b) => a.localeCompare(b));
  const statesByRoute = new Map();
  for (const file of files) {
    const name = path.basename(file);
    if (!STATE_FILENAMES.has(name)) continue;
    const route = appFileToRoute(appRoot, file);
    const kind = name.replace(".tsx", "").replace("global-error", "error").replace("not-found", "not_found");
    const row = { kind, sourcePath: rel(root, file), shellFamily: appShellFamily(appRoot, file) };
    statesByRoute.set(route, [...(statesByRoute.get(route) ?? []), row]);
  }

  return files.map((file) => {
    const name = path.basename(file);
    const route = appFileToRoute(appRoot, file);
    const source = read(file);
    const kind = name === "route.ts" ? "api_route" : name === "page.tsx" ? "page" : name === "layout.tsx" ? "layout" : "route_state";
    const methods = kind === "api_route" ? methodsFromSource(source) : ["GET"];
    const auth = authModel(route, source, cronPaths);
    const cls = routeClass(route, kind === "api_route" ? "api" : kind, cronPaths);
    const db = detectDbDependencies(source);
    const requiredStates = requiredStatesForRoute(cls, auth);
    const presentStates = (statesByRoute.get(route) ?? []).map((state) => state.kind);
    return {
      id: `${kind}:${route}:${rel(root, file)}`,
      route,
      samplePath: samplePath(route),
      sourcePath: rel(root, file),
      kind,
      class: cls,
      shellFamily: appShellFamily(appRoot, file),
      methods,
      runtime: runtimeFromSource(source, kind === "page" ? "page" : kind),
      dynamicSegments: dynamicSegments(route),
      authModel: auth,
      rolePolicy: rolePolicy(auth, source),
      workspaceModes: workspaceMode(route),
      cachePolicy: cachePolicy(auth),
      bodyPolicy: bodyPolicy(methods, source, cls),
      rateLimitPolicy: rateLimitPolicy(cls, methods, source),
      orgScopeRequired: auth === "session" || cls === "cron",
      orgScopeEvidence: /organization_id|orgId|organizationId|requireApiWorkspaceEligibility|getApiAuthContext|requireV\d+Context/.test(source),
      providers: detectProviders(source, route),
      dbDependencies: db,
      routeStates: {
        required: requiredStates,
        present: presentStates,
        inheritedShell: appShellFamily(appRoot, file),
      },
      performanceBudget: performanceBudget(cls),
      owner: routeOwner(route, cls),
      riskTier: riskTier(cls, route, methods),
      expectedStatuses: cls === "cron" ? [200, 207, 401, 429, 500, 503] : auth === "public" ? [200, 404, 500] : [200, 400, 401, 403, 404, 409, 429, 500],
      observabilityRequired: cls !== "layout" && cls !== "route_state",
      smokeTier: smokeTier(cls, riskTier(cls, route, methods)),
    };
  });
}

function serverActionAuthModel(source) {
  if (/auth\.signIn|auth\.signUp|resetPasswordForEmail|updateUser\(\s*\{\s*password/i.test(source)) {
    return "public_auth_action";
  }
  if (/getApiAuthContext|getAuthContext|requireSession|auth\.getUser|auth\.getSession|userId|organization_id|orgId|organizationId/i.test(source)) {
    return "session";
  }
  return "session_required_by_default";
}

function buildServerActionRows(root) {
  const actionsRoot = path.join(root, "src", "actions");
  const files = walk(actionsRoot, (_full, name) => /\.(ts|tsx)$/.test(name)).sort((a, b) => a.localeCompare(b));
  return files.flatMap((file) => {
    const source = read(file);
    const exports = [
      ...source.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g),
      ...source.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=\s*async/g),
    ].map((match) => match[1]);
    const names = exports.length ? exports : [path.basename(file).replace(/\.(ts|tsx)$/, "")];
    return names.map((name) => {
      const db = detectDbDependencies(source);
      const auth = serverActionAuthModel(source);
      return {
        id: `server_action:${name}:${rel(root, file)}`,
        route: `action:${name}`,
        samplePath: `action:${name}`,
        sourcePath: rel(root, file),
        kind: "server_action",
        class: "server_action",
        shellFamily: "actions",
        methods: ["ACTION"],
        runtime: "server_action",
        dynamicSegments: [],
        authModel: auth,
        rolePolicy: auth === "session" || auth === "session_required_by_default" ? rolePolicy("session", source) : [auth],
        workspaceModes: workspaceMode(rel(root, file)),
        cachePolicy: "private_no_store",
        bodyPolicy: /FormData|formData/.test(source) ? "bounded_or_form_body" : "structured_action_payload",
        rateLimitPolicy: /rateLimitCheck|RATE_LIMITS/.test(source) ? "explicit" : "mutation_required",
        orgScopeRequired: true,
        orgScopeEvidence: /organization_id|orgId|organizationId|getAuthContext|getApiAuthContext/.test(source),
        providers: detectProviders(source, name),
        dbDependencies: db,
        routeStates: { required: [], present: [], inheritedShell: "actions" },
        performanceBudget: performanceBudget("server_action"),
        owner: routeOwner(rel(root, file), "server_action"),
        riskTier: "P1",
        expectedStatuses: [200, 400, 401, 403, 409, 429, 500],
        observabilityRequired: true,
        smokeTier: "nightly",
      };
    });
  });
}

function matrixFromRows(rows) {
  return rows.map((row) => ({
    route: row.route,
    sourcePath: row.sourcePath,
    kind: row.kind,
    class: row.class,
    methods: row.methods,
    authModel: row.authModel,
    rolePolicy: row.rolePolicy,
    workspaceModes: row.workspaceModes,
    cachePolicy: row.cachePolicy,
    bodyPolicy: row.bodyPolicy,
    rateLimitPolicy: row.rateLimitPolicy,
    orgScopeRequired: row.orgScopeRequired,
    orgScopeEvidence: row.orgScopeEvidence,
    providers: row.providers,
    dbDependencies: row.dbDependencies,
    expectedStatuses: row.expectedStatuses,
    performanceBudget: row.performanceBudget,
    riskTier: row.riskTier,
    owner: row.owner,
    smokeTier: row.smokeTier,
  }));
}

function buildDerivedArtifacts(rows, cronEntries, openApiPaths, hrefDestinations) {
  return {
    functionalityMatrix: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: matrixFromRows(rows),
    },
    runtimeContract: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: rows.map((row) => ({ route: row.route, sourcePath: row.sourcePath, kind: row.kind, runtime: row.runtime, performanceBudget: row.performanceBudget })),
    },
    providerMatrix: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: rows.map((row) => ({ route: row.route, sourcePath: row.sourcePath, providers: row.providers, fallbackRequired: row.providers.length > 0 })),
    },
    dbDependencies: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: rows
        .filter((row) => row.dbDependencies.tables.length || row.dbDependencies.rpcs.length)
        .map((row) => ({ route: row.route, sourcePath: row.sourcePath, ...row.dbDependencies, orgScopeRequired: row.orgScopeRequired, orgScopeEvidence: row.orgScopeEvidence })),
    },
    performanceBudgets: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: rows.map((row) => ({ route: row.route, sourcePath: row.sourcePath, class: row.class, ...row.performanceBudget })),
    },
    incidentMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: rows.map((row) => ({ route: row.route, sourcePath: row.sourcePath, owner: row.owner, riskTier: row.riskTier, diagnosticPrefix: row.route.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "root" })),
    },
    pageRouteStateMatrix: {
      version: 1,
      generatedAt: new Date().toISOString(),
      rows: rows
        .filter((row) => row.kind === "page")
        .map((row) => ({ route: row.route, sourcePath: row.sourcePath, shellFamily: row.shellFamily, ...row.routeStates })),
    },
    externalContracts: {
      version: 1,
      generatedAt: new Date().toISOString(),
      vercelCrons: cronEntries,
      openApiPaths,
      hrefDestinations,
    },
  };
}

export function buildRouteUniversePayload(root) {
  const { cronEntries, cronPaths } = readCronPaths(root);
  const appRows = buildAppRouteRows(root, cronPaths);
  const actionRows = buildServerActionRows(root);
  const rows = [...appRows, ...actionRows].sort((a, b) => `${a.route}:${a.sourcePath}`.localeCompare(`${b.route}:${b.sourcePath}`));
  const openApiPaths = readOpenApiPaths(root);
  const hrefDestinations = readHrefDestinations(root);
  const counts = rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});
  return {
    universe: {
      version: 1,
      program: "zero-exclusion-route-functionality",
      generatedAt: new Date().toISOString(),
      counts,
      total: rows.length,
      routes: rows,
      externalContracts: { vercelCronCount: cronEntries.length, openApiPathCount: openApiPaths.length, hrefDestinationCount: hrefDestinations.length },
    },
    derived: buildDerivedArtifacts(rows, cronEntries, openApiPaths, hrefDestinations),
  };
}

export const ROUTE_UNIVERSE_ARTIFACTS = {
  universe: "artifacts/route-universe.json",
  functionalityMatrix: "artifacts/route-functionality-matrix.json",
  runtimeContract: "artifacts/route-runtime-contract.json",
  providerMatrix: "artifacts/route-provider-matrix.json",
  dbDependencies: "artifacts/route-db-dependencies.json",
  performanceBudgets: "artifacts/route-performance-budgets.json",
  incidentMap: "artifacts/route-incident-map.json",
  pageRouteStateMatrix: "artifacts/page-route-state-matrix.json",
  externalContracts: "artifacts/route-external-contracts.json",
};
