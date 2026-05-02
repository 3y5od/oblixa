import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=security_headers_smoke

test.describe("security headers (smoke)", () => {
  test("root response includes CSP or security headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    const csp = headers["content-security-policy"] || headers["content-security-policy-report-only"];
    const xfo = headers["x-frame-options"];
    expect.soft(!!csp || !!xfo).toBeTruthy();
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
});
