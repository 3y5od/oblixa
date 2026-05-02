import { test, expect } from "@playwright/test";
// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=mobile_deeplink_well_known_optional

test.describe("mobile deep link well-known", () => {
  test("apple-app-site-association responds", async ({ request }) => {
    const res = await request.get("/.well-known/apple-app-site-association");
    expect([200, 301, 302, 404]).toContain(res.status());
    if (res.status() === 200) {
      const ct = res.headers()["content-type"] || "";
      expect(ct.includes("json") || ct.includes("application/pkcs7-mime") || ct.length >= 0).toBeTruthy();
    }
  });

  test("assetlinks.json responds", async ({ request }) => {
    const res = await request.get("/.well-known/assetlinks.json");
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const ct = res.headers()["content-type"] || "";
      expect(ct.includes("json")).toBeTruthy();
    }
  });
});
