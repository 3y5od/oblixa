import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static invariants for Next.js proxy (middleware): matcher, auth gating, /api/* not wrapped by proxy auth.
 */
describe("proxy.ts routing invariants", () => {
  it("documents matcher, login redirect, and dashboard entry for signed-in users", () => {
    const file = join(process.cwd(), "src/proxy.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("export async function proxy");
    expect(raw).toContain("skipsProxyAuthProvider(request, pathname)");
    expect(raw.indexOf("skipsProxyAuthProvider(request, pathname)")).toBeLessThan(
      raw.indexOf("const supabase = createServerClient")
    );
    expect(raw).toContain("hasSupabaseAuthCookie(request)");
    expect(raw).toContain('isPublicAuthSurfacePath(pathname)');
    expect(raw).toContain('pathname.startsWith("/api/")');
    expect(raw).toContain("SUPABASE_PROXY_FETCH_TIMEOUT_MS");
    expect(raw).toContain("createSupabaseTimeoutFetch");
    expect(raw).toContain("fetch: proxySupabaseFetch");
    expect(raw).toContain("function buildLoginRedirect");
    expect(raw).toContain("getSafeRedirectPath(request.nextUrl.pathname)");
    expect(raw).toContain('url.pathname = "/login"');
    expect(raw).toContain('url.search = ""');
    expect(raw).toContain('url.searchParams.set("next", next)');
    expect(raw).toContain('url.pathname = "/dashboard"');
    expect(raw).toContain("export const config");
    expect(raw).toContain("matcher:");
    expect(raw).toContain("_next/static");
    expect(raw).toContain("robots");
    expect(raw).toContain("sitemap");
  });

  it("does not treat /api as authenticated-by-proxy; cron paths stay under /api prefix", () => {
    const raw = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(raw).toContain('!pathname.startsWith("/api/")');
    expect("/api/health".startsWith("/api/")).toBe(true);
  });

  it("sets V8 pathname header from nextUrl only for dashboard layout guard", () => {
    const raw = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(raw).toContain("withOblixaPathname");
    expect(raw).toContain("OBLIXA_PATHNAME_HEADER");
  });

  it("enforces browser-origin policy for API mutations while exempting signed non-browser routes", () => {
    const raw = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(raw).toContain("hasMethodOverrideAttempt(request)");
    expect(raw).toContain('code: "method_override_rejected"');
    expect(raw).toContain('const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])');
    expect(raw).toContain("requiresBrowserOriginPolicy(request, pathname)");
    expect(raw).toContain("secFetchSiteAllowsSensitiveMutation(request)");
    expect(raw).toContain('code: "cross_site_request_rejected"');
    expect(raw).toContain('pathname.startsWith("/api/cron/")');
    expect(raw).toContain('pathname.startsWith("/api/webhooks/")');
    expect(raw).toContain('pathname.startsWith("/api/external-actions/")');
    expect(raw).toContain('pathname === "/api/stripe/webhook"');
    expect(raw).toContain('pathname === "/api/integrations/actions/callback"');
  });
});
