#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PRIVATE_PREFIXES = [
  "/api",
  "/dashboard",
  "/work",
  "/contracts",
  "/settings",
  "/onboarding",
  "/reports",
  "/assurance",
  "/campaigns",
  "/decisions",
  "/relationship-workspaces",
  "/accounts",
  "/counterparties",
  "/more",
];
const PUBLIC_FILE_ALLOWLIST = new Set([
  "public/.well-known/security.txt",
  "public/oblixa-logo.png",
  "public/robots.txt",
]);
const PRIVATE_METADATA_LAYOUTS = [
  "src/app/(auth)/layout.tsx",
  "src/app/(dashboard)/layout.tsx",
  "src/app/external/layout.tsx",
  "src/app/(dashboard)/onboarding/layout.tsx",
];
const JSON_LD_COMPONENTS = [
  "src/components/landing/landing-json-ld.tsx",
  "src/components/landing/legal-page-json-ld.tsx",
];
const AUTH_SURFACE_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];
const PUBLIC_ROUTE_TEST_FILES = [
  "e2e/marketing-public.spec.ts",
  "e2e/external-public.spec.ts",
  "e2e/public-route-h1-contract.spec.ts",
  "e2e/security-headers-smoke.spec.ts",
];
const MARKETING_TENANT_DATA_PATTERNS = [
  { issue: "public_page_imports_supabase", re: /from\s+["']@\/lib\/supabase\// },
  { issue: "public_page_imports_server_env", re: /from\s+["']@\/lib\/env\/server["']/ },
  { issue: "public_page_imports_server_actions", re: /from\s+["']@\/actions\// },
  { issue: "public_page_uses_supabase_admin", re: /\bcreateAdminClient\b/ },
  { issue: "public_page_uses_supabase_client", re: /\bcreateClient\b/ },
  { issue: "public_page_queries_database", re: /\b(?:supabase|admin|client|db)\w*\s*\.\s*from\s*\(/ },
  { issue: "public_page_fetches_internal_api", re: /\bfetch\s*\(\s*["']\/api\// },
];

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walkFiles(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = toPosix(path.join(rel, ent.name));
    if (ent.isDirectory()) walkFiles(root, childRel, out);
    else if (ent.isFile()) out.push(childRel);
  }
  return out;
}

function extractArrayStringLiterals(source, name) {
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\](?:\\s*as\\s+const)?`, "m");
  const body = re.exec(source)?.[1] ?? "";
  return [...body.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractPublicPathInventories(source) {
  const publicInformationPaths = extractArrayStringLiterals(source, "PUBLIC_INFORMATION_PATHS");
  const sitemapPaths = extractArrayStringLiterals(source, "SITEMAP_PATHS");
  if (/\.\.\.\s*PUBLIC_INFORMATION_PATHS\b/u.test(source)) {
    for (const route of publicInformationPaths) {
      if (!sitemapPaths.includes(route)) sitemapPaths.push(route);
    }
  }
  return { publicInformationPaths, sitemapPaths };
}

function extractGeneratedPublicRoutes(source) {
  const match = /GENERATED_PUBLIC_ROUTES\s*=\s*(\[[\s\S]*?\])\s*as\s+const/u.exec(source);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

function routeToPageRel(route) {
  if (route === "/") return "src/app/page.tsx";
  const name = route.replace(/^\//, "");
  if (AUTH_SURFACE_PATHS.includes(route)) return `src/app/(auth)/${name}/page.tsx`;
  return `src/app/(marketing)/${name}/page.tsx`;
}

function resolveInternalImport(root, fromRel, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  const fromDir = path.dirname(path.join(root, fromRel));
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(fromDir, specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return toPosix(path.relative(root, candidate));
    }
  }
  return null;
}

function collectInternalImportGraph(root, entryRel, seen = new Set()) {
  if (seen.has(entryRel) || !exists(root, entryRel)) return seen;
  seen.add(entryRel);
  const source = read(root, entryRel);
  const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importRe)) {
    const resolved = resolveInternalImport(root, entryRel, match[1]);
    if (resolved) collectInternalImportGraph(root, resolved, seen);
  }
  return seen;
}

function isPrivatePath(value) {
  return PRIVATE_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`));
}

function collectPublicFileIssues(root) {
  const issues = [];
  for (const rel of walkFiles(root, "public").sort()) {
    if (!PUBLIC_FILE_ALLOWLIST.has(rel)) {
      issues.push({ issue: "unallowlisted_public_file", rel });
    }
  }
  return issues;
}

function collectRobotsIssues(root) {
  const issues = [];
  const robotsRel = "public/robots.txt";
  if (!exists(root, robotsRel)) {
    issues.push({ issue: "missing_public_robots", rel: robotsRel });
    return issues;
  }
  const publicRobots = read(root, robotsRel);
  for (const prefix of PRIVATE_PREFIXES) {
    const expected = `Disallow: ${prefix}/`;
    if (!publicRobots.includes(expected)) {
      issues.push({ issue: "public_robots_missing_private_disallow", rel: robotsRel, prefix });
    }
  }
  const appRobotsRel = "src/app/robots.ts";
  if (!exists(root, appRobotsRel)) {
    issues.push({ issue: "missing_app_robots", rel: appRobotsRel });
    return issues;
  }
  const appRobots = read(root, appRobotsRel);
  if (!appRobots.includes('process.env.VERCEL_ENV === "preview"') || !appRobots.includes('disallow: "/"')) {
    issues.push({ issue: "app_robots_missing_preview_disallow", rel: appRobotsRel });
  }
  for (const prefix of PRIVATE_PREFIXES) {
    if (!appRobots.includes(`"${prefix}/"`)) {
      issues.push({ issue: "app_robots_missing_private_disallow", rel: appRobotsRel, prefix });
    }
  }
  return issues;
}

function collectSitemapIssues(root) {
  const issues = [];
  const publicPathsRel = "src/lib/marketing/public-paths.ts";
  const sitemapRel = "src/app/sitemap.ts";
  if (!exists(root, publicPathsRel)) {
    issues.push({ issue: "missing_public_paths_source", rel: publicPathsRel });
    return issues;
  }
  if (!exists(root, sitemapRel)) {
    issues.push({ issue: "missing_sitemap_route", rel: sitemapRel });
    return issues;
  }
  const publicPaths = read(root, publicPathsRel);
  const { sitemapPaths } = extractPublicPathInventories(publicPaths);
  for (const route of sitemapPaths) {
    if (isPrivatePath(route)) {
      issues.push({ issue: "private_path_in_sitemap_inventory", rel: publicPathsRel, route });
    }
  }
  const sitemap = read(root, sitemapRel);
  if (!sitemap.includes("SITEMAP_PATHS") || !sitemap.includes("getAppBaseUrlFromEnv")) {
    issues.push({ issue: "sitemap_not_using_public_inventory", rel: sitemapRel });
  }
  return issues;
}

function collectPublicInventoryIssues(root) {
  const issues = [];
  const publicPathsRel = "src/lib/marketing/public-paths.ts";
  const generatedRel = "e2e/generated/public-routes.ts";
  const manifestRel = "src/lib/qa/ui-surface-manifest.source.mjs";
  const proxyPolicyRel = "src/lib/auth/proxy-path-policy.ts";

  if (!exists(root, publicPathsRel)) {
    issues.push({ issue: "missing_public_paths_source", rel: publicPathsRel });
    return issues;
  }
  if (!exists(root, generatedRel)) {
    issues.push({ issue: "missing_generated_public_route_inventory", rel: generatedRel });
    return issues;
  }
  if (!exists(root, manifestRel)) {
    issues.push({ issue: "missing_public_route_manifest_source", rel: manifestRel });
    return issues;
  }
  if (!exists(root, proxyPolicyRel)) {
    issues.push({ issue: "missing_proxy_public_path_policy", rel: proxyPolicyRel });
    return issues;
  }

  const publicPaths = read(root, publicPathsRel);
  const { publicInformationPaths, sitemapPaths } = extractPublicPathInventories(publicPaths);
  const generatedRoutes = extractGeneratedPublicRoutes(read(root, generatedRel));
  const generatedPaths = generatedRoutes.map((entry) => entry.visitPath).filter(Boolean);
  const generatedRoutePaths = generatedRoutes.map((entry) => entry.route).filter(Boolean);
  const proxyPolicy = read(root, proxyPolicyRel);
  const proxyAuthPaths = extractArrayStringLiterals(proxyPolicy, "publicRoutes");

  if (sitemapPaths.length === 0) {
    issues.push({ issue: "empty_public_route_inventory", rel: publicPathsRel });
  }

  for (const route of sitemapPaths) {
    if (!generatedPaths.includes(route)) {
      issues.push({ issue: "sitemap_path_missing_generated_public_route", rel: generatedRel, route });
    }
    if (!exists(root, routeToPageRel(route))) {
      issues.push({ issue: "public_route_missing_page", route, expectedPage: routeToPageRel(route) });
    }
  }

  for (const route of generatedPaths) {
    if (!sitemapPaths.includes(route)) {
      issues.push({ issue: "generated_public_route_not_in_sitemap_inventory", rel: generatedRel, route });
    }
  }

  for (const route of generatedRoutePaths) {
    if (!sitemapPaths.includes(route)) {
      issues.push({ issue: "generated_public_route_not_in_public_inventory", rel: generatedRel, route });
    }
  }

  for (const route of publicInformationPaths) {
    if (!sitemapPaths.includes(route)) {
      issues.push({ issue: "public_information_path_missing_from_sitemap", rel: publicPathsRel, route });
    }
  }

  for (const route of AUTH_SURFACE_PATHS) {
    if (!proxyAuthPaths.includes(route)) {
      issues.push({ issue: "auth_surface_missing_proxy_policy", rel: proxyPolicyRel, route });
    }
  }

  if (!proxyPolicy.includes("isPublicInformationPath") || !proxyPolicy.includes("isMetadataImageRoute")) {
    issues.push({ issue: "proxy_policy_not_using_public_inventory_helpers", rel: proxyPolicyRel });
  }

  return issues;
}

function collectPublicTenantDataIssues(root) {
  const issues = [];
  const publicPathsRel = "src/lib/marketing/public-paths.ts";
  if (!exists(root, publicPathsRel)) return issues;
  const publicPaths = read(root, publicPathsRel);
  const { publicInformationPaths } = extractPublicPathInventories(publicPaths);
  const marketingRoutes = ["/", ...publicInformationPaths];
  const files = new Set();

  for (const route of marketingRoutes) {
    for (const rel of collectInternalImportGraph(root, routeToPageRel(route))) {
      files.add(rel);
    }
  }

  for (const rel of [...files].sort()) {
    const source = read(root, rel);
    for (const pattern of MARKETING_TENANT_DATA_PATTERNS) {
      if (pattern.re.test(source)) {
        issues.push({ issue: pattern.issue, rel });
      }
    }
  }

  return issues;
}

function collectPublicAuthRedirectIssues(root) {
  const issues = [];
  const callbackRel = "src/app/auth/callback/route.ts";
  const redirectRel = "src/lib/security/redirect.ts";
  const authActionRel = "src/actions/auth.ts";
  const authFormRel = "src/components/auth/auth-form.tsx";

  if (!exists(root, callbackRel)) {
    issues.push({ issue: "missing_auth_callback_route", rel: callbackRel });
  } else {
    const source = read(root, callbackRel);
    for (const marker of [
      "getSafeRedirectPath(searchParams.get(\"next\"))",
      "resolvePostAuthRedirectPath",
      "resolveDestinationWithBlockingCalibration",
    ]) {
      if (!source.includes(marker)) {
        issues.push({ issue: "auth_callback_missing_redirect_safety_marker", rel: callbackRel, marker });
      }
    }
    if (/searchParams\.get\(["'](?:next|redirect|returnTo)["']\)/.test(source) && !source.includes("getSafeRedirectPath")) {
      issues.push({ issue: "auth_callback_uses_raw_redirect_param", rel: callbackRel });
    }
  }

  if (!exists(root, redirectRel)) {
    issues.push({ issue: "missing_safe_redirect_helper", rel: redirectRel });
  } else {
    const source = read(root, redirectRel);
    for (const marker of ['startsWith("//")', 'includes("://")', 'fallback = "/dashboard"']) {
      if (!source.includes(marker)) {
        issues.push({ issue: "safe_redirect_helper_missing_marker", rel: redirectRel, marker });
      }
    }
  }

  if (!exists(root, authActionRel)) {
    issues.push({ issue: "missing_auth_actions", rel: authActionRel });
  } else {
    const source = read(root, authActionRel);
    if (!source.includes('emailRedirectTo: `${appUrl}/auth/callback`')) {
      issues.push({ issue: "signup_email_redirect_not_callback", rel: authActionRel });
    }
    if (!source.includes('redirectTo: `${appUrl}/reset-password`')) {
      issues.push({ issue: "password_reset_redirect_not_public_reset_page", rel: authActionRel });
    }
    if (!source.includes("redirectTo: await resolvePostAuthRedirectForUser(user)")) {
      issues.push({ issue: "auth_action_missing_post_auth_redirect_resolution", rel: authActionRel });
    }
  }

  if (!exists(root, authFormRel)) {
    issues.push({ issue: "missing_auth_form", rel: authFormRel });
  } else {
    const source = read(root, authFormRel);
    if (!source.includes("assignNavigableHref(path)") || !source.includes("state?.redirectTo")) {
      issues.push({ issue: "auth_form_missing_client_redirect_boundary", rel: authFormRel });
    }
  }

  return issues;
}

function collectPublicE2eIssues(root) {
  const issues = [];
  for (const rel of PUBLIC_ROUTE_TEST_FILES) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_public_route_e2e", rel });
    }
  }

  if (exists(root, "e2e/marketing-public.spec.ts")) {
    const source = read(root, "e2e/marketing-public.spec.ts");
    if (!source.includes("GENERATED_PUBLIC_ROUTES") || !source.includes("unauthenticated pages return 200")) {
      issues.push({ issue: "public_smoke_not_using_generated_route_inventory", rel: "e2e/marketing-public.spec.ts" });
    }
  }

  if (exists(root, "e2e/external-public.spec.ts")) {
    const source = read(root, "e2e/external-public.spec.ts");
    for (const marker of [
      "/external/00000000-0000-0000-0000-000000000000",
      "non-5xx",
      "expectInvalidSurfaceLoaded",
    ]) {
      if (!source.includes(marker)) {
        issues.push({ issue: "external_public_invalid_token_e2e_missing_marker", rel: "e2e/external-public.spec.ts", marker });
      }
    }
  }

  if (exists(root, "e2e/public-route-h1-contract.spec.ts")) {
    const source = read(root, "e2e/public-route-h1-contract.spec.ts");
    if (!source.includes("GENERATED_PUBLIC_ROUTES") || !source.includes("expectedHeading")) {
      issues.push({ issue: "public_heading_contract_not_using_generated_route_inventory", rel: "e2e/public-route-h1-contract.spec.ts" });
    }
  }

  if (exists(root, "e2e/security-headers-smoke.spec.ts")) {
    const source = read(root, "e2e/security-headers-smoke.spec.ts");
    for (const marker of [
      "GENERATED_PUBLIC_ROUTES",
      "generated public route matrix carries required browser security headers",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
    ]) {
      if (!source.includes(marker)) {
        issues.push({ issue: "public_security_headers_e2e_missing_marker", rel: "e2e/security-headers-smoke.spec.ts", marker });
      }
    }
  }

  return issues;
}

function collectPrivateMetadataIssues(root) {
  const issues = [];
  for (const rel of PRIVATE_METADATA_LAYOUTS) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_private_metadata_layout", rel });
      continue;
    }
    const source = read(root, rel);
    if (!source.includes("robots") || !source.includes("index: false") || !source.includes("follow: false")) {
      issues.push({ issue: "private_layout_missing_noindex_metadata", rel });
    }
  }
  return issues;
}

function collectJsonLdIssues(root) {
  const issues = [];
  for (const rel of JSON_LD_COMPONENTS) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_json_ld_component", rel });
      continue;
    }
    const source = read(root, rel);
    if (!source.includes("serializeJsonLdForInlineScript") || !source.includes('type="application/ld+json"')) {
      issues.push({ issue: "json_ld_missing_safe_serializer", rel });
    }
  }
  return issues;
}

export function analyzePublicSeoSurface(root = ROOT) {
  const issues = [
    ...collectPublicFileIssues(root),
    ...collectRobotsIssues(root),
    ...collectPublicInventoryIssues(root),
    ...collectPublicTenantDataIssues(root),
    ...collectPublicAuthRedirectIssues(root),
    ...collectPublicE2eIssues(root),
    ...collectSitemapIssues(root),
    ...collectPrivateMetadataIssues(root),
    ...collectJsonLdIssues(root),
  ];
  return {
    checkId: "public-seo-surface",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePublicSeoSurface();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
