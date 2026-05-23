import { test, expect } from "@playwright/test";
import { GENERATED_PUBLIC_ROUTES } from "./generated/public-routes";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=security_headers_smoke

test.describe("security headers (smoke)", () => {
  test("root response includes CSP or security headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    const csp = headers["content-security-policy"] || headers["content-security-policy-report-only"];
    const xfo = headers["x-frame-options"];
    expect.soft(!!csp || !!xfo).toBeTruthy();
  });

  test("root CSP carries enforcing and report-only browser isolation directives", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    const csp = headers["content-security-policy"] ?? "";
    const reportOnly = headers["content-security-policy-report-only"] ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src-attr 'none'");
    if (headers["strict-transport-security"] || test.info().project.use.baseURL?.startsWith("https://")) {
      expect(csp).toContain("upgrade-insecure-requests");
    } else {
      expect(csp).not.toContain("upgrade-insecure-requests");
    }
    expect(reportOnly).toContain("script-src 'self'");
    expect(reportOnly).toContain("script-src-attr 'none'");
    expect(reportOnly).not.toContain("'unsafe-inline'");
    if (reportOnly.includes("require-trusted-types-for")) {
      expect(reportOnly).toContain("require-trusted-types-for 'script'");
    }
  });

  test("HSTS includes max-age when present", async ({ request }) => {
    const res = await request.get("/");
    const hsts = res.headers()["strict-transport-security"];
    if (!hsts) {
      test.skip(true, "No HSTS on this deployment (common in local preview).");
      return;
    }
    expect(hsts.toLowerCase()).toContain("max-age=");
    expect(hsts.toLowerCase()).toMatch(/includesubdomains/);
  });

  test("COOP / CORP hints when present (soft)", async ({ request }) => {
    const res = await request.get("/");
    const coop = res.headers()["cross-origin-opener-policy"];
    const corp = res.headers()["cross-origin-resource-policy"];
    if (coop) expect.soft(coop.length).toBeGreaterThan(3);
    if (corp) expect.soft(["same-origin", "same-site", "cross-origin"].some((x) => corp.includes(x))).toBeTruthy();
  });

  test("Permissions-Policy present on root (soft)", async ({ request }) => {
    const res = await request.get("/");
    const pp = res.headers()["permissions-policy"];
    if (!pp) {
      test.skip(true, "No Permissions-Policy on this deployment.");
      return;
    }
    expect(pp.toLowerCase()).toMatch(/camera=\(\)/);
  });

  test("marketing page carries required browser security headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(res.status()).toBeLessThan(500);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("browsing-topics=()");
    expect(headers["permissions-policy"]).toContain("xr-spatial-tracking=()");
  });

  test("generated public route matrix carries required browser security headers", async ({ request }) => {
    for (const route of GENERATED_PUBLIC_ROUTES) {
      const res = await request.get(route.visitPath);
      const headers = res.headers();
      expect(res.status(), `${route.route} status`).toBeLessThan(500);
      expect(headers["x-content-type-options"], `${route.route} x-content-type-options`).toBe("nosniff");
      expect(headers["x-frame-options"], `${route.route} x-frame-options`).toBe("DENY");
      expect(headers["referrer-policy"], `${route.route} referrer-policy`).toBe("strict-origin-when-cross-origin");
      expect(headers["permissions-policy"], `${route.route} permissions-policy`).toContain("camera=()");
      expect(headers["permissions-policy"], `${route.route} permissions-policy`).toContain("browsing-topics=()");
    }
  });

  test("dashboard page carries required browser security headers", async ({ request }) => {
    const res = await request.get("/dashboard");
    const headers = res.headers();
    expect(res.status()).toBeLessThan(500);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("API response carries private no-store", async ({ request }) => {
    const res = await request.get("/api/export/contracts");
    const cache = res.headers()["cache-control"] ?? "";
    expect(cache.toLowerCase()).toContain("private");
    expect(cache.toLowerCase()).toContain("no-store");
  });

  test("public-token route carries private no-store", async ({ request }) => {
    const res = await request.get("/api/external-actions/not-a-real-token/status");
    const cache = res.headers()["cache-control"] ?? "";
    expect(cache.toLowerCase()).toContain("private");
    expect(cache.toLowerCase()).toContain("no-store");
  });
});
