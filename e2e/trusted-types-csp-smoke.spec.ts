import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=trusted_types_csp_optional

test.describe("CSP / Trusted-Types hints", () => {
  test("root CSP header mentions trusted-types or default-src when present", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"] || res.headers()["content-security-policy-report-only"];
    if (!csp) {
      test.skip(true, "No CSP header on this deployment.");
      return;
    }
    const lower = csp.toLowerCase();
    expect(lower.includes("trusted-types") || lower.includes("default-src") || lower.includes("script-src")).toBeTruthy();
  });
});
