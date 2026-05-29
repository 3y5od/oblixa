import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePublicSeoSurface } from "./check-public-seo-surface.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(
    root,
    "public/robots.txt",
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /dashboard/",
      "Disallow: /work/",
      "Disallow: /contracts/",
      "Disallow: /settings/",
      "Disallow: /onboarding/",
      "Disallow: /reports/",
      "Disallow: /search/",
      "Disallow: /assurance/",
      "Disallow: /campaigns/",
      "Disallow: /decisions/",
      "Disallow: /relationship-workspaces/",
      "Disallow: /accounts/",
      "Disallow: /counterparties/",
      "Disallow: /more/",
      "",
    ].join("\n")
  );
  write(root, "public/.well-known/security.txt", "Contact: mailto:security@example.test\n");
  write(root, "public/oblixa-logo.png", "fixture\n");
  write(
    root,
    "src/app/robots.ts",
    'const isVercelPreview = process.env.VERCEL_ENV === "preview";\nif (isVercelPreview) return { rules: { userAgent: "*", disallow: "/" } };\nreturn { rules: [{ disallow: ["/api/","/dashboard/","/work/","/contracts/","/settings/","/onboarding/","/reports/","/search/","/assurance/","/campaigns/","/decisions/","/relationship-workspaces/","/accounts/","/counterparties/","/more/"] }] };\n'
  );
  write(
    root,
    "src/lib/marketing/public-paths.ts",
    [
      'export const PUBLIC_INFORMATION_PATHS = ["/privacy"] as const;',
      'export const SITEMAP_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", ...PUBLIC_INFORMATION_PATHS] as const;',
      "export function isPublicInformationPath(pathname) { return PUBLIC_INFORMATION_PATHS.includes(pathname); }",
      "export function isMetadataImageRoute(pathname) { return pathname === '/opengraph-image'; }",
      "",
    ].join("\n")
  );
  write(
    root,
    "e2e/generated/public-routes.ts",
    `export const GENERATED_PUBLIC_ROUTES = ${JSON.stringify(
      [
        { route: "/", visitPath: "/", expectedHeading: "Home", coverage: ["smoke"] },
        { route: "/login", visitPath: "/login", expectedHeading: "Login", coverage: ["smoke"] },
        { route: "/signup", visitPath: "/signup", expectedHeading: "Signup", coverage: ["smoke"] },
        { route: "/forgot-password", visitPath: "/forgot-password", expectedHeading: "Forgot", coverage: ["smoke"] },
        { route: "/reset-password", visitPath: "/reset-password", expectedHeading: "Reset", coverage: ["smoke"] },
        { route: "/privacy", visitPath: "/privacy", expectedHeading: "Privacy", coverage: ["smoke"] },
      ],
      null,
      2
    )} as const;\n`
  );
  write(root, "src/lib/qa/ui-surface-manifest.source.mjs", "export const uiSurfaceManifest = [];\n");
  write(
    root,
    "src/lib/auth/proxy-path-policy.ts",
    'import { isMetadataImageRoute, isPublicInformationPath } from "@/lib/marketing/public-paths";\nconst publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];\n'
  );
  write(
    root,
    "src/app/sitemap.ts",
    'import { getAppBaseUrlFromEnv } from "@/lib/app-url";\nimport { SITEMAP_PATHS } from "@/lib/marketing/public-paths";\nexport default function sitemap(){ return SITEMAP_PATHS.map((path) => ({ url: getAppBaseUrlFromEnv() + path })); }\n'
  );
  write(root, "src/app/page.tsx", 'import { LandingPage } from "@/components/landing/landing-page";\nexport default function Page(){ return <LandingPage />; }\n');
  write(root, "src/components/landing/landing-page.tsx", "export function LandingPage(){ return <main />; }\n");
  write(root, "src/app/(marketing)/privacy/page.tsx", "export default function Privacy(){ return <main />; }\n");
  for (const route of ["login", "signup", "forgot-password", "reset-password"]) {
    write(root, `src/app/(auth)/${route}/page.tsx`, `import { AuthForm } from "@/components/auth/auth-form";\nexport default function Page(){ return <AuthForm mode="${route}" />; }\n`);
  }
  write(
    root,
    "src/app/auth/callback/route.ts",
    'const next = getSafeRedirectPath(searchParams.get("next"));\nresolvePostAuthRedirectPath();\nresolveDestinationWithBlockingCalibration();\n'
  );
  write(root, "src/lib/security/redirect.ts", 'const fallback = "/dashboard";\ns.startsWith("//");\ns.includes("://");\n');
  write(
    root,
    "src/actions/auth.ts",
    'emailRedirectTo: `${appUrl}/auth/callback`\nredirectTo: `${appUrl}/reset-password`\nredirectTo: await resolvePostAuthRedirectForUser(user)\n'
  );
  write(root, "src/components/auth/auth-form.tsx", "state?.redirectTo\nassignNavigableHref(path)\n");
  write(
    root,
    "e2e/marketing-public.spec.ts",
    'import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";\ntest("unauthenticated pages return 200", async () => GENERATED_PUBLIC_ROUTES);\n'
  );
  write(
    root,
    "e2e/external-public.spec.ts",
    'test("invalid public external token returns a non-5xx surface", async () => { await page.goto("/external/00000000-0000-0000-0000-000000000000"); await expectInvalidSurfaceLoaded(page); "non-5xx"; });\n'
  );
  write(
    root,
    "e2e/public-route-h1-contract.spec.ts",
    'import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";\nfor (const entry of GENERATED_PUBLIC_ROUTES) entry.expectedHeading;\n'
  );
  write(
    root,
    "e2e/security-headers-smoke.spec.ts",
    'import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";\ntest("generated public route matrix carries required browser security headers", async () => { GENERATED_PUBLIC_ROUTES; "x-content-type-options"; "x-frame-options"; "referrer-policy"; "permissions-policy"; });\n'
  );
  for (const rel of [
    "src/app/(auth)/layout.tsx",
    "src/app/(dashboard)/layout.tsx",
    "src/app/external/layout.tsx",
    "src/app/(dashboard)/onboarding/layout.tsx",
  ]) {
    write(rel.startsWith("/") ? "" : root, rel, "export const metadata = { robots: { index: false, follow: false } };\n");
  }
  write(
    root,
    "src/components/landing/landing-json-ld.tsx",
    'type="application/ld+json"\nserializeJsonLdForInlineScript(payload)\n'
  );
  write(
    root,
    "src/components/landing/legal-page-json-ld.tsx",
    'type="application/ld+json"\nserializeJsonLdForInlineScript([webPage, breadcrumbs])\n'
  );
}

test("analyzePublicSeoSurface accepts private disallows, public sitemap inventory, noindex layouts, and safe JSON-LD", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-ok-"));
  writeValidFixture(root);

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzePublicSeoSurface rejects missing private crawler disallows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-robots-"));
  writeValidFixture(root);
  write(root, "public/robots.txt", "User-agent: *\nAllow: /\n");

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "public_robots_missing_private_disallow"), true);
});

test("analyzePublicSeoSurface rejects private sitemap inventory paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-sitemap-"));
  writeValidFixture(root);
  write(root, "src/lib/marketing/public-paths.ts", 'export const SITEMAP_PATHS = ["/", "/contracts"] as const;\n');

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "private_path_in_sitemap_inventory"), true);
});

test("analyzePublicSeoSurface rejects private layouts without noindex metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-noindex-"));
  writeValidFixture(root);
  write(root, "src/app/(dashboard)/layout.tsx", "export default function Layout(){ return null; }\n");

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "private_layout_missing_noindex_metadata"), true);
});

test("analyzePublicSeoSurface rejects generated public route drift", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-public-drift-"));
  writeValidFixture(root);
  write(
    root,
    "e2e/generated/public-routes.ts",
    'export const GENERATED_PUBLIC_ROUTES = [{"route":"/","visitPath":"/","expectedHeading":"Home","coverage":["smoke"]}] as const;\n'
  );

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "sitemap_path_missing_generated_public_route"), true);
});

test("analyzePublicSeoSurface rejects tenant data access from marketing pages", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-tenant-fetch-"));
  writeValidFixture(root);
  write(root, "src/components/landing/landing-page.tsx", 'import { createAdminClient } from "@/lib/supabase/server";\nexport function LandingPage(){ createAdminClient(); return null; }\n');

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "public_page_imports_supabase"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "public_page_uses_supabase_admin"), true);
});

test("analyzePublicSeoSurface rejects public auth redirect safety drift", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-auth-drift-"));
  writeValidFixture(root);
  write(root, "src/app/auth/callback/route.ts", 'const next = searchParams.get("next");\nreturn NextResponse.redirect(origin + next);\n');

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "auth_callback_missing_redirect_safety_marker"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "auth_callback_uses_raw_redirect_param"), true);
});

test("analyzePublicSeoSurface rejects missing public route security-header e2e coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-e2e-drift-"));
  writeValidFixture(root);
  write(root, "e2e/security-headers-smoke.spec.ts", "test('root only', async () => {});\n");

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "public_security_headers_e2e_missing_marker"), true);
});

test("analyzePublicSeoSurface rejects missing external invalid-token public e2e coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-seo-external-e2e-"));
  writeValidFixture(root);
  write(root, "e2e/external-public.spec.ts", "test('external route exists', async () => {});\n");

  const report = analyzePublicSeoSurface(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "external_public_invalid_token_e2e_missing_marker"), true);
});
