export const PRIVATE_PREFIXES = [
  "/api",
  "/dashboard",
  "/work",
  "/contracts",
  "/settings",
  "/onboarding",
  "/reports",
  "/search",
  "/assurance",
  "/campaigns",
  "/decisions",
  "/relationship-workspaces",
  "/accounts",
  "/counterparties",
  "/more",
];
export const PUBLIC_FILE_ALLOWLIST = new Set([
  "public/.well-known/security.txt",
  "public/oblixa-logo.png",
  "public/robots.txt",
]);
export const PRIVATE_METADATA_LAYOUTS = [
  "src/app/(auth)/layout.tsx",
  "src/app/(dashboard)/layout.tsx",
  "src/app/external/layout.tsx",
  "src/app/(dashboard)/onboarding/layout.tsx",
];
export const JSON_LD_COMPONENTS = [
  "src/components/landing/landing-json-ld.tsx",
  "src/components/landing/legal-page-json-ld.tsx",
];
export const AUTH_SURFACE_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];
export const EXPECTED_SITEMAP_PATHS = [
  "/",
  "/product",
  "/request-access",
  "/pricing",
  "/contact",
  "/security",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/accessibility",
  "/cookies",
];
export const COMPATIBILITY_PUBLIC_PATHS = new Set(["/early-access"]);
export const SITEMAP_FORBIDDEN_PATHS = new Set([...AUTH_SURFACE_PATHS, ...COMPATIBILITY_PUBLIC_PATHS]);
export const PUBLIC_ROUTE_TEST_FILES = [
  "e2e/marketing-public.spec.ts",
  "e2e/external-public.spec.ts",
  "e2e/public-route-h1-contract.spec.ts",
  "e2e/security-headers-smoke.spec.ts",
];
export const MARKETING_TENANT_DATA_PATTERNS = [
  { issue: "public_page_imports_supabase", re: /from\s+["']@\/lib\/supabase\// },
  { issue: "public_page_imports_server_env", re: /from\s+["']@\/lib\/env\/server["']/ },
  { issue: "public_page_imports_server_actions", re: /from\s+["']@\/actions\// },
  { issue: "public_page_uses_supabase_admin", re: /\bcreateAdminClient\b/ },
  { issue: "public_page_uses_supabase_client", re: /\bcreateClient\b/ },
  { issue: "public_page_queries_database", re: /\b(?:supabase|admin|client|db)\w*\s*\.\s*from\s*\(/ },
  { issue: "public_page_fetches_internal_api", re: /\bfetch\s*\(\s*["']\/api\// },
];

export function extractArrayStringLiterals(source, name) {
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\](?:\\s*as\\s+const)?`, "m");
  const body = re.exec(source)?.[1] ?? "";
  return [...body.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

export function extractPublicPathInventories(source) {
  const publicInformationPaths = extractArrayStringLiterals(source, "PUBLIC_INFORMATION_PATHS");
  const sitemapPaths = extractArrayStringLiterals(source, "SITEMAP_PATHS");
  if (/\.\.\.\s*PUBLIC_INFORMATION_PATHS\b/u.test(source)) {
    for (const route of publicInformationPaths) {
      if (!sitemapPaths.includes(route)) sitemapPaths.push(route);
    }
  }
  return { publicInformationPaths, sitemapPaths };
}

export function extractGeneratedPublicRoutes(source) {
  const match = /GENERATED_PUBLIC_ROUTES\s*=\s*(\[[\s\S]*?\])\s*as\s+const/u.exec(source);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

export function routeToPageRel(route) {
  if (route === "/") return "src/app/page.tsx";
  const name = route.replace(/^\//, "");
  if (AUTH_SURFACE_PATHS.includes(route)) return `src/app/(auth)/${name}/page.tsx`;
  return `src/app/(marketing)/${name}/page.tsx`;
}

export function isPrivatePath(value) {
  return PRIVATE_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`));
}

